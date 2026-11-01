import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyMutation,
  evaluateBaselineRun,
  evaluateMutationRun,
  parseExpectationValues,
  parsePlaywrightReport,
  withMutatedSource,
  type ExpectedFailure,
  type MutationSpec,
} from "./eval-lib.ts";

interface FakeSpec {
  title: string;
  failed?: boolean;
  message?: string;
}

function fakeReport(
  specs: FakeSpec[],
  options: { errors?: string[]; stats?: Partial<{ expected: number; unexpected: number; skipped: number; flaky: number }> } = {},
): string {
  const failed = specs.filter((spec) => spec.failed === true);
  return JSON.stringify({
    suites: [
      {
        file: "fake.spec.ts",
        specs: specs.map((spec) => ({
          title: spec.title,
          ok: spec.failed !== true,
          tests: [
            {
              results: [
                spec.failed === true
                  ? { status: "failed", error: { message: spec.message ?? "boom" } }
                  : { status: "passed" },
              ],
            },
          ],
        })),
      },
    ],
    errors: options.errors ?? [],
    stats: {
      expected: specs.length - failed.length,
      unexpected: failed.length,
      skipped: 0,
      flaky: 0,
      ...options.stats,
    },
  });
}

function failureMessage(signature: string, expected: string, received: string): string {
  return `Error: ${signature}\nexpect(received).toBe(expected) // Object.is equality\n\nExpected: ${expected}\nReceived: ${received}`;
}

const mutation: MutationSpec = {
  id: "fake-mutation",
  description: "fake",
  file: "fake.ts",
  find: "BAD",
  replace: "GOOD",
  spec: "fake.spec.ts",
  specTestCount: 2,
  expectedFailures: [
    { qaId: "QA-T-01", signature: "expected HTTP 400", expected: "400", received: "201" },
  ],
};

const allExpected: ExpectedFailure[] = [
  {
    qaId: "QA-VAL-02",
    signature: "expected HTTP 400 for validation_failed",
    expected: "400",
    received: "201",
  },
  { qaId: "QA-VAL-07", signature: "toBeGreaterThanOrEqual", expected: ">= 3", received: "2" },
  {
    qaId: "QA-AUTHZ-02",
    signature: "expect(received).toBe(expected)",
    expected: "401",
    received: "200",
  },
  {
    qaId: "QA-ISO-01",
    signature: "expected HTTP 404 for item_not_found",
    expected: "404",
    received: "200",
  },
];

const mutationAll: MutationSpec = {
  ...mutation,
  specTestCount: 4,
  expectedFailures: allExpected,
};

function allReport(overrides: Partial<Record<string, string>> = {}): string {
  return fakeReport(
    allExpected.map((expected) => ({
      title: `${expected.qaId} REQ-X: expected failure`,
      failed: true,
      message:
        overrides[expected.qaId] ??
        failureMessage(expected.signature, expected.expected, expected.received),
    })),
  );
}

const intendedFailure = fakeReport([
  {
    title: "QA-T-01 REQ-T-01: expected failure",
    failed: true,
    message: failureMessage("expected HTTP 400 for validation_failed", "400", "201"),
  },
  { title: "QA-T-02 REQ-T-02: still passes" },
]);

const passing = fakeReport([
  { title: "QA-T-01 REQ-T-01: expected failure" },
  { title: "QA-T-02 REQ-T-02: still passes" },
]);

const wrongReceived: Record<string, string> = {
  "QA-VAL-02": "200",
  "QA-VAL-07": "1",
  "QA-AUTHZ-02": "403",
  "QA-ISO-01": "403",
};

const cases: Array<{ name: string; run: () => void }> = [
  {
    name: "applyMutation replaces one unique anchor",
    run: () => {
      const result = applyMutation("a BAD b", mutation);
      if (result !== "a GOOD b") throw new Error(`unexpected result ${JSON.stringify(result)}`);
    },
  },
  {
    name: "applyMutation rejects a missing anchor",
    run: () => {
      try {
        applyMutation("nothing here", mutation);
      } catch (error) {
        if (!String(error).includes("anchor was not found")) throw error;
        return;
      }
      throw new Error("expected a missing-anchor error");
    },
  },
  {
    name: "applyMutation rejects an ambiguous anchor",
    run: () => {
      try {
        applyMutation("BAD and BAD", mutation);
      } catch (error) {
        if (!String(error).includes("occurs 2 times")) throw error;
        return;
      }
      throw new Error("expected an ambiguous-anchor error");
    },
  },
  {
    name: "applyMutation rejects a no-op replacement",
    run: () => {
      const noop: MutationSpec = { ...mutation, replace: "BAD" };
      try {
        applyMutation("a BAD b", noop);
      } catch (error) {
        if (!String(error).includes("did not change")) throw error;
        return;
      }
      throw new Error("expected a no-op error");
    },
  },
  {
    name: "parsePlaywrightReport reads a failed spec and its message",
    run: () => {
      const summary = parsePlaywrightReport(intendedFailure);
      if (summary.specs.length !== 2) throw new Error("expected two specs");
      const failed = summary.specs.find((spec) => spec.failed);
      if (failed === undefined) throw new Error("expected a failed spec");
      if (!failed.messages.join("\n").includes("expected HTTP 400")) {
        throw new Error("failure message was not captured");
      }
      if (summary.stats.unexpected !== 1) throw new Error("unexpected count was not parsed");
    },
  },
  {
    name: "parsePlaywrightReport rejects invalid JSON",
    run: () => {
      try {
        parsePlaywrightReport("not json");
      } catch (error) {
        if (!String(error).includes("not valid JSON")) throw error;
        return;
      }
      throw new Error("expected a JSON parse error");
    },
  },
  {
    name: "parsePlaywrightReport strips ANSI color codes from failures",
    run: () => {
      const summary = parsePlaywrightReport(
        fakeReport([
          {
            title: "QA-T-01 REQ-T-01: expected failure",
            failed: true,
            message: '\u001b[32mExpected: "Bearer"\u001b[39m',
          },
          { title: "QA-T-02 REQ-T-02: still passes" },
        ]),
      );
      const failed = summary.specs.find((spec) => spec.failed);
      const text = failed?.messages.join("\n") ?? "";
      if (!text.includes('Expected: "Bearer"')) {
        throw new Error(`ANSI-stripped message missing signature: ${JSON.stringify(text)}`);
      }
      if (text.includes("\u001b")) throw new Error("ANSI escape codes were not stripped");
    },
  },
  {
    name: "parseExpectationValues reads exact expected and received values",
    run: () => {
      const values = parseExpectationValues(
        failureMessage("expected HTTP 400 for validation_failed", "400", "201"),
      );
      if (values.expected !== "400" || values.received !== "201") {
        throw new Error(`unexpected values ${JSON.stringify(values)}`);
      }
    },
  },
  {
    name: "parseExpectationValues rejects missing Expected/Received lines",
    run: () => {
      try {
        parseExpectationValues("expected HTTP 400 for validation_failed");
      } catch (error) {
        if (!String(error).includes("has no Expected: line")) throw error;
        return;
      }
      throw new Error("expected a missing-values error");
    },
  },
  {
    name: "parseExpectationValues rejects ambiguous Expected lines",
    run: () => {
      try {
        parseExpectationValues("Expected: 400\nExpected: 401\nReceived: 201");
      } catch (error) {
        if (!String(error).includes("ambiguous parse")) throw error;
        return;
      }
      throw new Error("expected an ambiguous-values error");
    },
  },
  {
    name: "evaluateMutationRun rejects a signal-terminated runner",
    run: () => {
      const summary = parsePlaywrightReport(intendedFailure);
      const errors = evaluateMutationRun(summary, null, mutation);
      if (!errors.some((error) => error.includes("terminated by a signal"))) {
        throw new Error(`expected a signal error, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateMutationRun accepts the intended assertion",
    run: () => {
      const summary = parsePlaywrightReport(intendedFailure);
      const errors = evaluateMutationRun(summary, 1, mutation);
      if (errors.length > 0) throw new Error(errors.join("; "));
    },
  },
  {
    name: "evaluateMutationRun accepts all four intended expected/received pairs",
    run: () => {
      const summary = parsePlaywrightReport(allReport());
      const errors = evaluateMutationRun(summary, 1, mutationAll);
      if (errors.length > 0) throw new Error(errors.join("; "));
    },
  },
  {
    name: "evaluateMutationRun rejects a correct signature without Expected/Received values",
    run: () => {
      const summary = parsePlaywrightReport(
        fakeReport([
          {
            title: "QA-T-01 REQ-T-01: expected failure",
            failed: true,
            message: "expected HTTP 400 for validation_failed",
          },
          { title: "QA-T-02 REQ-T-02: still passes" },
        ]),
      );
      const errors = evaluateMutationRun(summary, 1, mutation);
      if (!errors.some((error) => error.includes("no unambiguous Expected/Received"))) {
        throw new Error(`expected a missing-values error, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateMutationRun rejects a wrong expected value",
    run: () => {
      const summary = parsePlaywrightReport(
        fakeReport([
          {
            title: "QA-T-01 REQ-T-01: expected failure",
            failed: true,
            message: failureMessage("expected HTTP 400", "401", "201"),
          },
          { title: "QA-T-02 REQ-T-02: still passes" },
        ]),
      );
      const errors = evaluateMutationRun(summary, 1, mutation);
      if (!errors.some((error) => error.includes("reported Expected/Received"))) {
        throw new Error(`expected an expected-value error, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateMutationRun rejects an undetected mutation (exit 0)",
    run: () => {
      const summary = parsePlaywrightReport(passing);
      const errors = evaluateMutationRun(summary, 0, mutation);
      if (!errors.some((error) => error.includes("was not detected"))) {
        throw new Error(`expected a not-detected error, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateMutationRun rejects an expected test that passed",
    run: () => {
      const summary = parsePlaywrightReport(passing);
      const errors = evaluateMutationRun(summary, 1, mutation);
      if (!errors.some((error) => error.includes("expected QA-T-01 to fail"))) {
        throw new Error(`expected a missing-failure error, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateMutationRun rejects an unexpected failing test",
    run: () => {
      const summary = parsePlaywrightReport(
        fakeReport([
          {
            title: "QA-T-01 REQ-T-01: expected failure",
            failed: true,
            message: failureMessage("expected HTTP 400", "400", "201"),
          },
          { title: "QA-T-02 REQ-T-02: also fails", failed: true, message: "boom" },
        ]),
      );
      const errors = evaluateMutationRun(summary, 1, mutation);
      if (!errors.some((error) => error.includes("unexpected failure: QA-T-02"))) {
        throw new Error(`expected an unexpected-failure error, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateMutationRun rejects an unexpected HTTP 500 failure",
    run: () => {
      const summary = parsePlaywrightReport(
        fakeReport([
          {
            title: "QA-T-01 REQ-T-01: expected failure",
            failed: true,
            message: failureMessage("expected HTTP 400", "400", "201"),
          },
          {
            title: "QA-T-02 REQ-T-02: also fails",
            failed: true,
            message: failureMessage("boom", "200", "500"),
          },
        ]),
      );
      const errors = evaluateMutationRun(summary, 1, mutation);
      if (
        !errors.some((error) => error.includes("unexpected failure: QA-T-02")) ||
        !errors.some((error) => error.includes("HTTP 500"))
      ) {
        throw new Error(`expected unexpected/HTTP-500 errors, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateMutationRun rejects a wrong assertion message",
    run: () => {
      const summary = parsePlaywrightReport(
        fakeReport([
          { title: "QA-T-01 REQ-T-01: expected failure", failed: true, message: "some other assertion" },
          { title: "QA-T-02 REQ-T-02: still passes" },
        ]),
      );
      const errors = evaluateMutationRun(summary, 1, mutation);
      if (!errors.some((error) => error.includes("did not contain the intended assertion"))) {
        throw new Error(`expected a signature error, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateMutationRun rejects setup/crash failures",
    run: () => {
      const summary = parsePlaywrightReport(
        fakeReport([
          {
            title: "QA-T-01 REQ-T-01: expected failure",
            failed: true,
            message: "Test timeout of 15000ms exceeded while running beforeEach",
          },
          { title: "QA-T-02 REQ-T-02: still passes" },
        ]),
      );
      const errors = evaluateMutationRun(summary, 1, mutation);
      if (!errors.some((error) => error.includes("setup/crash error"))) {
        throw new Error(`expected a crash classification, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateMutationRun rejects runner-level errors",
    run: () => {
      const summary = parsePlaywrightReport(fakeReport([], { errors: ["browser launch failed"] }));
      const errors = evaluateMutationRun(summary, 1, mutation);
      if (!errors.some((error) => error.includes("runner reported errors"))) {
        throw new Error(`expected a runner-error report, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateMutationRun rejects zero discovered tests",
    run: () => {
      const summary = parsePlaywrightReport(fakeReport([]));
      const errors = evaluateMutationRun(summary, 1, mutation);
      if (!errors.some((error) => error.includes("no tests were discovered"))) {
        throw new Error(`expected a zero-tests error, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateMutationRun rejects a partial spec discovery",
    run: () => {
      const summary = parsePlaywrightReport(
        fakeReport([
          {
            title: "QA-T-01 REQ-T-01: expected failure",
            failed: true,
            message: failureMessage("expected HTTP 400", "400", "201"),
          },
        ]),
      );
      const errors = evaluateMutationRun(summary, 1, mutation);
      if (!errors.some((error) => error.includes("discovered 1"))) {
        throw new Error(`expected a spec-count error, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateBaselineRun accepts a full green run",
    run: () => {
      const summary = parsePlaywrightReport(passing);
      const errors = evaluateBaselineRun(summary, 0, 2);
      if (errors.length > 0) throw new Error(errors.join("; "));
    },
  },
  {
    name: "evaluateBaselineRun rejects a non-zero baseline",
    run: () => {
      const summary = parsePlaywrightReport(passing);
      const errors = evaluateBaselineRun(summary, 1, 2);
      if (!errors.some((error) => error.includes("baseline runner exited 1"))) {
        throw new Error(`expected a baseline-exit error, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "evaluateBaselineRun rejects a test-count mismatch",
    run: () => {
      const summary = parsePlaywrightReport(passing);
      const errors = evaluateBaselineRun(summary, 0, 3);
      if (!errors.some((error) => error.includes("expected 3 tests, discovered 2"))) {
        throw new Error(`expected a count error, got ${JSON.stringify(errors)}`);
      }
    },
  },
  {
    name: "withMutatedSource restores after a normal return",
    run: () => {
      const directory = mkdtempSync(join(tmpdir(), "aql-400-selftest-"));
      try {
        const path = join(directory, "app.ts");
        writeFileSync(path, "ORIGINAL", "utf8");
        const result = withMutatedSource(path, "ORIGINAL", "MUTATED", () => {
          if (readFileSync(path, "utf8") !== "MUTATED") throw new Error("mutation was not written");
          return "ok";
        });
        if (result !== "ok") throw new Error("body result was lost");
        if (readFileSync(path, "utf8") !== "ORIGINAL") throw new Error("source was not restored");
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  },
  {
    name: "withMutatedSource restores when the body throws",
    run: () => {
      const directory = mkdtempSync(join(tmpdir(), "aql-400-selftest-"));
      try {
        const path = join(directory, "app.ts");
        writeFileSync(path, "ORIGINAL", "utf8");
        try {
          withMutatedSource(path, "ORIGINAL", "MUTATED", () => {
            throw new Error("intentional body failure");
          });
        } catch (error) {
          if (!String(error).includes("intentional body failure")) throw error;
        }
        if (readFileSync(path, "utf8") !== "ORIGINAL") {
          throw new Error("source was not restored after the body threw");
        }
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  },
];

for (const expected of allExpected) {
  cases.push({
    name: `evaluateMutationRun rejects HTTP 500 for ${expected.qaId}`,
    run: () => {
      const summary = parsePlaywrightReport(
        allReport({
          [expected.qaId]: failureMessage(expected.signature, expected.expected, "500"),
        }),
      );
      const errors = evaluateMutationRun(summary, 1, mutationAll);
      if (
        !errors.some(
          (error) => error.includes(expected.qaId) && error.includes("HTTP 500"),
        )
      ) {
        throw new Error(`expected an HTTP-500 error for ${expected.qaId}, got ${JSON.stringify(errors)}`);
      }
    },
  });

  cases.push({
    name: `evaluateMutationRun rejects wrong received value for ${expected.qaId}`,
    run: () => {
      const received = wrongReceived[expected.qaId]!;
      const summary = parsePlaywrightReport(
        allReport({
          [expected.qaId]: failureMessage(expected.signature, expected.expected, received),
        }),
      );
      const errors = evaluateMutationRun(summary, 1, mutationAll);
      if (
        !errors.some(
          (error) => error.includes(expected.qaId) && error.includes("reported Expected/Received"),
        )
      ) {
        throw new Error(
          `expected an expected/received error for ${expected.qaId}, got ${JSON.stringify(errors)}`,
        );
      }
    },
  });
}

let failures = 0;
for (const testCase of cases) {
  try {
    testCase.run();
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    failures += 1;
    console.error(
      `FAIL ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

console.log(`harness:eval selftest: ${cases.length - failures}/${cases.length} passed`);
if (failures > 0) process.exitCode = 1;
