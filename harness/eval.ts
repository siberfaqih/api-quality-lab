import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyMutation,
  evaluateBaselineRun,
  evaluateMutationRun,
  failedQaIds,
  parseExpectationValues,
  parsePlaywrightReport,
  qaIdFromTitle,
  sha256,
  withMutatedSource,
  type ExpectedFailure,
  type ExpectationValues,
  type MutationSpec,
  type PlaywrightRunSummary,
} from "./eval-lib.ts";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SUT_PATH = fileURLToPath(new URL("../sut/src/app.ts", import.meta.url));
const PLAYWRIGHT_CLI = fileURLToPath(
  new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
);
const PLAYWRIGHT_PACKAGE = fileURLToPath(
  new URL("../node_modules/@playwright/test/package.json", import.meta.url),
);

/** G3 baseline: all 32 Playwright API tests. */
const BASELINE_TEST_COUNT = 32;

/**
 * Three isolated, intentional defects (G4). Each patch is an exact,
 * single-occurrence replacement in the SUT source; tests are never edited.
 */
export const MUTATIONS: readonly MutationSpec[] = [
  {
    id: "negative-price-accepted",
    description: "validatePrice accepts negative prices (drops the lower bound)",
    file: "sut/src/app.ts",
    find: "  } else if (value < 0 || value > 1_000_000) {",
    replace: "  } else if (value > 1_000_000) {",
    spec: "qa/tests/validation.spec.ts",
    specTestCount: 9,
    expectedFailures: [
      {
        qaId: "QA-VAL-02",
        signature: "expected HTTP 400 for validation_failed",
        expected: "400",
        received: "201",
      },
      { qaId: "QA-VAL-07", signature: "toBeGreaterThanOrEqual", expected: ">= 3", received: "2" },
    ],
  },
  {
    id: "token-validation-skipped",
    description: "authenticate() accepts any well-formed Bearer token as alice",
    file: "sut/src/app.ts",
    find: [
      "    const record = tokens.get(match[1] as string);",
      "    if (record === undefined || record.expiresAt <= now()) {",
      "      if (record !== undefined) tokens.delete(match[1] as string);",
      '      sendAuthProblem(res, "invalid_token");',
      "      return undefined;",
      "    }",
      "    return record.user;",
    ].join("\n"),
    replace: "    return SYNTHETIC_USERS[0]!;",
    spec: "qa/tests/authz.spec.ts",
    specTestCount: 2,
    expectedFailures: [
      {
        qaId: "QA-AUTHZ-02",
        signature: "expect(received).toBe(expected)",
        expected: "401",
        received: "200",
      },
    ],
  },
  {
    id: "cross-user-authorization-bypass",
    description: "ownedItem() drops the owner check, exposing other users' items",
    file: "sut/src/app.ts",
    find: "    if (item === undefined || item.ownerId !== user.id) return undefined;",
    replace: "    if (item === undefined) return undefined;",
    spec: "qa/tests/isolation.spec.ts",
    specTestCount: 2,
    expectedFailures: [
      {
        qaId: "QA-ISO-01",
        signature: "expected HTTP 404 for item_not_found",
        expected: "404",
        received: "200",
      },
    ],
  },
];

interface RunOutcome {
  label: string;
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

interface BaselineRecord {
  label: string;
  exitCode: number | null;
  tests: number;
  failed: string[];
  errors: string[];
  status: "PASS" | "FAIL";
}

interface AssertionRecord {
  qaId: string;
  signature: string;
  expected: string;
  received: string;
  /** True only when the signature and exact expected/received values all match. */
  matched: boolean;
  actual: ExpectationValues | null;
  /** Whitespace-collapsed excerpt of the failing test's message, or null. */
  message: string | null;
}

interface MutationRecord {
  id: string;
  description: string;
  spec: string;
  tests: number;
  exitCode: number | null;
  failed: string[];
  expectedFailures: ExpectedFailure[];
  assertions: AssertionRecord[];
  restored: boolean;
  status: "PASS" | "FAIL";
  errors: string[];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function excerpt(text: string, max = 400): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max)}...`;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function optionValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a path value`);
  }
  return value;
}

const evidenceDir = resolve(
  REPO_ROOT,
  optionValue("--evidence") ?? `evidence/generated/aql-400-eval-${timestamp()}`,
);
const reportsOption = optionValue("--reports");
const reportsDir = reportsOption === undefined ? undefined : resolve(REPO_ROOT, reportsOption);
mkdirSync(evidenceDir, { recursive: true });

if (!existsSync(PLAYWRIGHT_CLI)) {
  console.error(
    `FAIL Playwright CLI not found at ${PLAYWRIGHT_CLI}; run "npm install" before harness:eval`,
  );
  process.exit(1);
}

const commandExitCodes = join(evidenceDir, "command-exit-codes.txt");
writeFileSync(commandExitCodes, "");

function playwrightVersion(): string {
  const parsed = JSON.parse(readFileSync(PLAYWRIGHT_PACKAGE, "utf8")) as { version?: string };
  return parsed.version ?? "unknown";
}

writeFileSync(
  join(evidenceDir, "environment.txt"),
  [
    `captured_at_utc ${new Date().toISOString()}`,
    `repo ${REPO_ROOT}`,
    `node ${process.version}`,
    `platform ${process.platform} ${process.arch}`,
    `playwright ${playwrightVersion()}`,
    `baseline_tests ${BASELINE_TEST_COUNT}`,
    `mutations ${MUTATIONS.map((mutation) => mutation.id).join(",")}`,
    `reports ${reportsDir ?? "none"}`,
  ].join("\n") + "\n",
);

function runPlaywright(label: string, extraArgs: string[], reportDir?: string): RunOutcome {
  const args = [
    PLAYWRIGHT_CLI,
    "test",
    "--config",
    "qa/playwright.config.ts",
    ...extraArgs,
  ];
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (reportDir === undefined) {
    args.push("--reporter=json");
  } else {
    mkdirSync(reportDir, { recursive: true });
    args.push("--reporter=json,html,junit");
    env.PLAYWRIGHT_HTML_REPORT = join(reportDir, "html");
    env.PLAYWRIGHT_HTML_OPEN = "never";
    env.PLAYWRIGHT_JUNIT_OUTPUT_FILE = join(reportDir, "junit.xml");
  }
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
    env,
  });
  let stderr = result.stderr ?? "";
  if (result.error !== undefined) {
    stderr += `\n[spawn error] ${messageOf(result.error)}\n`;
  }
  const stdout = result.stdout ?? "";
  writeFileSync(join(evidenceDir, `${label}.log`), stdout);
  writeFileSync(join(evidenceDir, `${label}.stderr.log`), stderr);
  appendFileSync(commandExitCodes, `${label}\t${result.status ?? "null"}\n`);
  return {
    label,
    status: result.status,
    signal: result.signal,
    stdout,
    stderr,
  };
}

function runBaseline(label: string, reportDir?: string): BaselineRecord {
  const outcome = runPlaywright(label, [], reportDir);
  let summary: PlaywrightRunSummary;
  try {
    summary = parsePlaywrightReport(outcome.stdout);
  } catch (error) {
    return {
      label,
      exitCode: outcome.status,
      tests: 0,
      failed: [],
      errors: [`${label}: ${messageOf(error)}`],
      status: "FAIL",
    };
  }
  const errors = evaluateBaselineRun(summary, outcome.status, BASELINE_TEST_COUNT);
  return {
    label,
    exitCode: outcome.status,
    tests: summary.specs.length,
    failed: failedQaIds(summary),
    errors,
    status: errors.length === 0 ? "PASS" : "FAIL",
  };
}

let originalSource: string;
try {
  originalSource = readFileSync(SUT_PATH, "utf8");
} catch (error) {
  console.error(`FAIL could not read ${SUT_PATH}: ${messageOf(error)}`);
  process.exit(1);
}

const baselineHash = sha256(originalSource);

function emergencyRestore(): void {
  try {
    if (readFileSync(SUT_PATH, "utf8") !== originalSource) {
      writeFileSync(SUT_PATH, originalSource, "utf8");
    }
  } catch {
    // Best effort only; the finally blocks and final hash check are primary.
  }
}

process.on("SIGINT", () => {
  emergencyRestore();
  process.exit(130);
});
process.on("SIGTERM", () => {
  emergencyRestore();
  process.exit(143);
});

const startedAt = new Date().toISOString();
console.log(`AQL-400 mutation evaluation`);
console.log(`sut          ${SUT_PATH}`);
console.log(`baseline     sha256 ${baselineHash}`);
console.log(`evidence     ${evidenceDir}`);
if (reportsDir !== undefined) console.log(`reports      ${reportsDir}`);
console.log("");

const baselinePre = runBaseline(
  "baseline-pre",
  reportsDir === undefined ? undefined : join(reportsDir, "baseline-pre"),
);
console.log(
  `${baselinePre.label}: ${baselinePre.status} (${baselinePre.tests}/${BASELINE_TEST_COUNT} tests, exit ${baselinePre.exitCode})`,
);

const mutationRecords: MutationRecord[] = [];
const fatalErrors: string[] = [];

for (const mutation of MUTATIONS) {
  const record: MutationRecord = {
    id: mutation.id,
    description: mutation.description,
    spec: mutation.spec,
    tests: 0,
    exitCode: null,
    failed: [],
    expectedFailures: mutation.expectedFailures,
    assertions: [],
    restored: false,
    status: "FAIL",
    errors: [],
  };

  try {
    const current = readFileSync(SUT_PATH, "utf8");
    if (sha256(current) !== baselineHash) {
      throw new Error("SUT source changed before this mutation; refusing to patch");
    }
    const mutated = applyMutation(current, mutation);
    const outcome = withMutatedSource(SUT_PATH, current, mutated, () =>
      runPlaywright(
        mutation.id,
        [mutation.spec],
        reportsDir === undefined ? undefined : join(reportsDir, "mutations", mutation.id),
      ),
    );
    record.exitCode = outcome.status;
    const summary = parsePlaywrightReport(outcome.stdout);
    record.tests = summary.specs.length;
    record.failed = failedQaIds(summary);
    record.assertions = mutation.expectedFailures.map((expected) => {
      const spec = summary.specs.find(
        (entry) => entry.failed && qaIdFromTitle(entry.title) === expected.qaId,
      );
      const text = spec?.messages.join("\n") ?? "";
      let actual: ExpectationValues | null = null;
      if (spec !== undefined) {
        try {
          actual = parseExpectationValues(text);
        } catch {
          actual = null;
        }
      }
      const matched =
        spec !== undefined &&
        text.includes(expected.signature) &&
        actual !== null &&
        actual.expected === expected.expected &&
        actual.received === expected.received;
      return {
        qaId: expected.qaId,
        signature: expected.signature,
        expected: expected.expected,
        received: expected.received,
        matched,
        actual,
        message: spec === undefined ? null : excerpt(text),
      };
    });
    record.errors = evaluateMutationRun(summary, outcome.status, mutation);
    record.status = record.errors.length === 0 ? "PASS" : "FAIL";
  } catch (error) {
    record.errors.push(messageOf(error));
    record.status = "FAIL";
  } finally {
    const after = readFileSync(SUT_PATH, "utf8");
    record.restored = sha256(after) === baselineHash;
    if (!record.restored) {
      writeFileSync(SUT_PATH, originalSource, "utf8");
      const forced = readFileSync(SUT_PATH, "utf8");
      record.errors.push("SUT was not restored by the mutation runner; forced restore applied");
      record.restored = forced === originalSource;
      if (!record.restored) record.errors.push("FORCED RESTORE FAILED");
      record.status = "FAIL";
    }
  }

  mutationRecords.push(record);
  console.log(
    `${record.id}: ${record.status} (exit ${record.exitCode}, tests ${record.tests}/${mutation.specTestCount}, failed: ${record.failed.join(", ") || "none"}, restored: ${record.restored})`,
  );
  const assertionSummary = record.assertions
    .map((assertion) => {
      const actual =
        assertion.actual === null
          ? "no Expected/Received"
          : `${assertion.actual.expected} -> ${assertion.actual.received}`;
      return `${assertion.qaId}=${assertion.matched ? "matched" : "MISMATCH"} (${actual})`;
    })
    .join(", ");
  if (assertionSummary !== "") console.log(`  assertions ${assertionSummary}`);
  for (const error of record.errors) console.log(`  FAIL ${error}`);
}

const finalHash = sha256(readFileSync(SUT_PATH, "utf8"));
const restored = finalHash === baselineHash;
if (!restored) {
  writeFileSync(SUT_PATH, originalSource, "utf8");
  const forcedHash = sha256(readFileSync(SUT_PATH, "utf8"));
  if (forcedHash !== baselineHash) {
    fatalErrors.push("SUT source could not be restored to the baseline bytes");
  } else {
    fatalErrors.push("SUT source differed after the mutation loop; forced restore applied");
  }
}
console.log("");
console.log(`restore      ${restored ? "PASS" : "FAIL"} (sha256 ${finalHash})`);

let baselinePost: BaselineRecord | undefined;
if (fatalErrors.length === 0) {
  baselinePost = runBaseline(
    "baseline-post",
    reportsDir === undefined ? undefined : join(reportsDir, "baseline-post"),
  );
  console.log(
    `${baselinePost.label}: ${baselinePost.status} (${baselinePost.tests}/${BASELINE_TEST_COUNT} tests, exit ${baselinePost.exitCode})`,
  );
} else {
  console.log("baseline-post: SKIPPED because the SUT restore failed");
}

const allErrors: string[] = [];
if (baselinePre.status !== "PASS") {
  allErrors.push(...baselinePre.errors.map((error) => `baseline-pre: ${error}`));
}
for (const record of mutationRecords) {
  if (record.status !== "PASS") {
    allErrors.push(...record.errors.map((error) => `${record.id}: ${error}`));
  }
}
allErrors.push(...fatalErrors);
if (baselinePost !== undefined && baselinePost.status !== "PASS") {
  allErrors.push(...baselinePost.errors.map((error) => `baseline-post: ${error}`));
}
if (baselinePost === undefined) {
  allErrors.push("baseline-post did not run");
}

const finishedAt = new Date().toISOString();
const summary = {
  ok: allErrors.length === 0,
  startedAt,
  finishedAt,
  sut: {
    path: "sut/src/app.ts",
    baselineSha256: baselineHash,
    finalSha256: sha256(readFileSync(SUT_PATH, "utf8")),
    restored: sha256(readFileSync(SUT_PATH, "utf8")) === baselineHash,
  },
  reports: reportsDir ?? null,
  baseline: {
    expectedTests: BASELINE_TEST_COUNT,
    pre: baselinePre,
    post: baselinePost ?? null,
  },
  mutations: mutationRecords,
  errors: allErrors,
};
writeFileSync(join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

console.log("");
if (allErrors.length === 0) {
  console.log(`RESULT: PASS - ${MUTATIONS.length} mutations detected, SUT restored, baseline re-passed`);
  process.exitCode = 0;
} else {
  console.log(`RESULT: FAIL - ${allErrors.length} evaluation error(s)`);
  for (const error of allErrors) console.log(`  - ${error}`);
  process.exitCode = 1;
}
