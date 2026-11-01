import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const BASELINE_TESTS = 32;

/**
 * Exact QA-id inventory of the 32-test Playwright suite. Derived from the
 * actual suite discovery
 * (`npx playwright test --config qa/playwright.config.ts --list --reporter=json`,
 * 32 specs) and cross-checked against `qa/traceability.md` (32 unique QA ids)
 * and the per-spec counts pinned in `harness/eval.ts` (9/2/2). Pinned
 * deliberately: a deliberate suite change must update these constants from a
 * fresh discovery output, otherwise verification fails closed.
 *
 * These are consistency/authenticity sanity checks on the report contents —
 * they catch substituted, unrelated or hand-written report trees. They are
 * not cryptographic provenance: nothing here proves which process wrote a
 * file, only that its contents match the suite that should have produced it.
 */
const BASELINE_QA_IDS: readonly string[] = [
  "QA-ENV-01",
  "QA-AUTH-01",
  "QA-AUTH-02",
  "QA-AUTH-03",
  "QA-AUTH-04",
  "QA-AUTH-05",
  "QA-AUTHZ-01",
  "QA-AUTHZ-02",
  "QA-CRUD-01",
  "QA-CRUD-02",
  "QA-CRUD-03",
  "QA-CRUD-04",
  "QA-CRUD-05",
  "QA-CRUD-06",
  "QA-LIST-01",
  "QA-LIST-02",
  "QA-LIST-03",
  "QA-LIST-04",
  "QA-VAL-01",
  "QA-VAL-02",
  "QA-VAL-03",
  "QA-VAL-04",
  "QA-VAL-05",
  "QA-VAL-06",
  "QA-VAL-07",
  "QA-VAL-08",
  "QA-VAL-09",
  "QA-ISO-01",
  "QA-ISO-02",
  "QA-ERR-01",
  "QA-ERR-02",
  "QA-ERR-03",
];

interface MutationReportExpectation {
  id: string;
  tests: number;
  failing: string[];
  /** Exact QA-id inventory of the targeted spec file (see BASELINE_QA_IDS). */
  inventory: readonly string[];
}

const MUTATION_REPORTS: readonly MutationReportExpectation[] = [
  {
    id: "negative-price-accepted",
    tests: 9,
    failing: ["QA-VAL-02", "QA-VAL-07"],
    inventory: [
      "QA-VAL-01",
      "QA-VAL-02",
      "QA-VAL-03",
      "QA-VAL-04",
      "QA-VAL-05",
      "QA-VAL-06",
      "QA-VAL-07",
      "QA-VAL-08",
      "QA-VAL-09",
    ],
  },
  {
    id: "token-validation-skipped",
    tests: 2,
    failing: ["QA-AUTHZ-02"],
    inventory: ["QA-AUTHZ-01", "QA-AUTHZ-02"],
  },
  {
    id: "cross-user-authorization-bypass",
    tests: 2,
    failing: ["QA-ISO-01"],
    inventory: ["QA-ISO-01", "QA-ISO-02"],
  },
];

// Fail fast on constant drift: the pinned counts and inventories must agree
// with each other, so a half-updated edit breaks loudly instead of passing.
if (BASELINE_QA_IDS.length !== BASELINE_TESTS) {
  throw new Error(
    `BASELINE_QA_IDS has ${BASELINE_QA_IDS.length} entries; expected ${BASELINE_TESTS}`,
  );
}
if (new Set(BASELINE_QA_IDS).size !== BASELINE_QA_IDS.length) {
  throw new Error("BASELINE_QA_IDS contains duplicate entries");
}
for (const expected of MUTATION_REPORTS) {
  if (expected.inventory.length !== expected.tests) {
    throw new Error(
      `mutation ${expected.id} inventory has ${expected.inventory.length} entries; expected ${expected.tests}`,
    );
  }
  if (new Set(expected.inventory).size !== expected.inventory.length) {
    throw new Error(`mutation ${expected.id} inventory contains duplicate entries`);
  }
  for (const qaId of expected.failing) {
    if (!expected.inventory.includes(qaId)) {
      throw new Error(`mutation ${expected.id} failing id ${qaId} is not in its inventory`);
    }
  }
}

interface JUnitSummary {
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  testcases: number;
  xml: string;
}

const QA_ID_PATTERN = /^QA-[A-Z]+-\d+$/;

function readRequired(path: string, label: string): string {
  if (!existsSync(path)) {
    throw new Error(`${label} is missing: ${path}`);
  }
  const content = readFileSync(path, "utf8");
  if (content.trim() === "") {
    throw new Error(`${label} is empty: ${path}`);
  }
  return content;
}

function numericAttribute(tag: string, name: string): number {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  if (match === null) {
    throw new Error(`JUnit root has no ${name} attribute`);
  }
  const value = match[1] as string;
  if (!/^\d+$/.test(value)) {
    throw new Error(`JUnit ${name} attribute is not a non-negative integer: ${JSON.stringify(value)}`);
  }
  return Number(value);
}

function parseJUnit(path: string, label: string): JUnitSummary {
  const xml = readRequired(path, label);
  const rootMatch = /<testsuites\b([^>]*)>/.exec(xml);
  if (rootMatch === null) {
    throw new Error(`${label} has no <testsuites> root element`);
  }
  const root = rootMatch[1] as string;
  const summary: JUnitSummary = {
    tests: numericAttribute(root, "tests"),
    failures: numericAttribute(root, "failures"),
    errors: numericAttribute(root, "errors"),
    skipped: numericAttribute(root, "skipped"),
    testcases: (xml.match(/<testcase\b/g) ?? []).length,
    xml,
  };
  if (summary.tests !== summary.testcases) {
    throw new Error(
      `${label} declares ${summary.tests} tests but contains ${summary.testcases} <testcase> elements`,
    );
  }
  if (summary.failures !== (xml.match(/<failure\b/g) ?? []).length) {
    throw new Error(
      `${label} declares ${summary.failures} failures but contains a different number of <failure> elements`,
    );
  }
  if (summary.errors !== (xml.match(/<error\b/g) ?? []).length) {
    throw new Error(
      `${label} declares ${summary.errors} errors but contains a different number of <error> elements`,
    );
  }
  return summary;
}

function unescapeXmlEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_match, entity: string) => {
    switch (entity) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      default:
        return "'";
    }
  });
}

interface TestcaseEntry {
  qaId: string;
  failed: boolean;
}

/**
 * Every `<testcase>` element, including self-closing ones for passing tests.
 * The QA id is the first whitespace-delimited token of the `name` attribute
 * (Playwright titles start with the QA id, e.g. `QA-VAL-02 REQ-VAL-02: ...`).
 */
function parseTestcases(xml: string, label: string): TestcaseEntry[] {
  const entries: TestcaseEntry[] = [];
  // Note: `/` is excluded from unquoted attribute characters so the `/` of a
  // self-closing `<testcase ... />` is never absorbed into the attributes
  // (which would merge the element with the next `</testcase>` downstream).
  const pattern = /<testcase\b((?:"[^"]*"|[^">/])*)(\/>|>([\s\S]*?)<\/testcase>)/g;
  for (const match of xml.matchAll(pattern)) {
    const attributes = match[1] as string;
    const rawName = /\bname="([^"]*)"/.exec(attributes)?.[1];
    if (rawName === undefined) {
      throw new Error(`${label} has a <testcase> element without a name attribute`);
    }
    const firstToken = unescapeXmlEntities(rawName).split(/\s+/)[0];
    if (firstToken === undefined || firstToken === "" || !QA_ID_PATTERN.test(firstToken)) {
      throw new Error(
        `${label} has a testcase whose name does not start with a QA id: ${JSON.stringify(rawName.slice(0, 80))}`,
      );
    }
    const closing = match[2] as string;
    entries.push({ qaId: firstToken, failed: closing !== "/>" && closing.includes("<failure") });
  }
  return entries;
}

/** Exact-inventory check: no missing, extra, duplicated or non-QA testcases. */
function checkQaInventory(
  entries: TestcaseEntry[],
  expected: readonly string[],
  label: string,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.qaId)) duplicates.add(entry.qaId);
    seen.add(entry.qaId);
  }
  if (duplicates.size > 0) {
    errors.push(
      `${label} JUnit report has duplicate testcase(s): ${[...duplicates].sort().join(", ")}`,
    );
  }
  const expectedSet = new Set(expected);
  const missing = expected.filter((qaId) => !seen.has(qaId));
  if (missing.length > 0) {
    errors.push(`${label} JUnit report is missing testcase(s): ${missing.join(", ")}`);
  }
  const extra = [...seen].filter((qaId) => !expectedSet.has(qaId));
  if (extra.length > 0) {
    errors.push(`${label} JUnit report has unexpected testcase(s): ${extra.sort().join(", ")}`);
  }
  return errors;
}

function checkHtml(reportDir: string, label: string): string[] {
  const path = join(reportDir, "html", "index.html");
  try {
    const html = readRequired(path, `${label} HTML report`);
    const errors: string[] = [];
    // Playwright-specific markers: the fixed report title plus the embedded
    // report-data script variable. A generic HTML page has neither.
    if (!html.includes("<title>Playwright Test Report</title>")) {
      errors.push(
        `${label} HTML report has no Playwright report title: ${path}`,
      );
    }
    if (!html.includes("playwrightReportBase64")) {
      errors.push(
        `${label} HTML report has no Playwright embedded report data: ${path}`,
      );
    }
    return errors;
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

function checkBaseline(reportDir: string, label: string): string[] {
  const errors: string[] = [];
  try {
    const summary = parseJUnit(join(reportDir, "junit.xml"), `${label} JUnit report`);
    if (summary.tests !== BASELINE_TESTS) {
      errors.push(`${label} JUnit report has ${summary.tests} tests; expected ${BASELINE_TESTS}`);
    }
    if (summary.failures !== 0) {
      errors.push(`${label} JUnit report has ${summary.failures} failure(s); expected 0`);
    }
    if (summary.errors !== 0) {
      errors.push(`${label} JUnit report has ${summary.errors} error(s); expected 0`);
    }
    if (summary.skipped !== 0) {
      errors.push(`${label} JUnit report has ${summary.skipped} skipped test(s); expected 0`);
    }
    try {
      const entries = parseTestcases(summary.xml, `${label} JUnit report`);
      errors.push(...checkQaInventory(entries, BASELINE_QA_IDS, label));
      const failing = entries.filter((entry) => entry.failed).map((entry) => entry.qaId);
      if (failing.length > 0) {
        errors.push(`${label} JUnit report has failing testcase(s): ${failing.join(", ")}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  errors.push(...checkHtml(reportDir, label));
  return errors;
}

function checkMutation(reportDir: string, expected: MutationReportExpectation): string[] {
  const label = `mutation ${expected.id}`;
  const errors: string[] = [];
  try {
    const summary = parseJUnit(join(reportDir, "junit.xml"), `${label} JUnit report`);
    if (summary.tests !== expected.tests) {
      errors.push(`${label} JUnit report has ${summary.tests} tests; expected ${expected.tests}`);
    }
    if (summary.failures !== expected.failing.length) {
      errors.push(
        `${label} JUnit report has ${summary.failures} failure(s); expected ${expected.failing.length}`,
      );
    }
    if (summary.errors !== 0) {
      errors.push(`${label} JUnit report has ${summary.errors} error(s); expected 0`);
    }
    if (summary.skipped !== 0) {
      errors.push(`${label} JUnit report has ${summary.skipped} skipped test(s); expected 0`);
    }
    try {
      const entries = parseTestcases(summary.xml, `${label} JUnit report`);
      errors.push(...checkQaInventory(entries, expected.inventory, label));
      const failingIds = entries.filter((entry) => entry.failed).map((entry) => entry.qaId);
      const failingSet = new Set(failingIds);
      for (const qaId of expected.failing) {
        if (!failingSet.has(qaId)) {
          errors.push(`${label} JUnit testcase ${qaId} is not marked as a failure`);
        }
      }
      const expectedFailing = new Set(expected.failing);
      const unexpected = failingIds.filter((qaId) => !expectedFailing.has(qaId));
      if (unexpected.length > 0) {
        errors.push(
          `${label} JUnit report has unexpected failing testcase(s): ${[...new Set(unexpected)].sort().join(", ")}`,
        );
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  errors.push(...checkHtml(reportDir, label));
  return errors;
}

/** Validate the API baseline, harness baseline and intentional mutation reports. */
export function checkReports(root: string): string[] {
  const errors: string[] = [];
  errors.push(...checkBaseline(join(root, "api-baseline"), "api-baseline"));
  errors.push(...checkBaseline(join(root, "harness-eval", "baseline-pre"), "harness baseline-pre"));
  errors.push(...checkBaseline(join(root, "harness-eval", "baseline-post"), "harness baseline-post"));
  for (const expected of MUTATION_REPORTS) {
    errors.push(
      ...checkMutation(join(root, "harness-eval", "mutations", expected.id), expected),
    );
  }
  return errors;
}

function fixtureJUnit(qaIds: readonly string[], failing: readonly string[]): string {
  const failingSet = new Set(failing);
  const testcases = qaIds.map((qaId) => {
    const body = failingSet.has(qaId)
      ? '<failure message="intentional fixture failure" type="expect.toBe"></failure>'
      : "";
    const element =
      body === ""
        ? `<testcase name="${qaId} REQ-FIXTURE: fixture test" classname="fixture.spec.ts" time="0.001"/>`
        : `<testcase name="${qaId} REQ-FIXTURE: fixture test" classname="fixture.spec.ts" time="0.001">${body}</testcase>`;
    return `    ${element}`;
  });
  return [
    `<testsuites tests="${qaIds.length}" failures="${failing.length}" skipped="0" errors="0">`,
    `<testsuite name="fixture.spec.ts" tests="${qaIds.length}" failures="${failing.length}" skipped="0" errors="0">`,
    ...testcases,
    "</testsuite>",
    "</testsuites>",
  ].join("\n");
}

function fixtureHtml(): string {
  return "<!DOCTYPE html>\n<html lang=\"en\"><head><title>Playwright Test Report</title></head><body>fixture playwrightReportBase64</body></html>\n";
}

function genericHtml(): string {
  return "<!DOCTYPE html>\n<html lang=\"en\"><head><title>fixture</title></head><body>not a Playwright report</body></html>\n";
}

function writeReport(reportDir: string, qaIds: readonly string[], failing: readonly string[] = []): void {
  mkdirSync(join(reportDir, "html"), { recursive: true });
  writeFileSync(join(reportDir, "junit.xml"), fixtureJUnit(qaIds, failing), "utf8");
  writeFileSync(join(reportDir, "html", "index.html"), fixtureHtml(), "utf8");
}

function writeFixtureTree(root: string): void {
  writeReport(join(root, "api-baseline"), BASELINE_QA_IDS);
  writeReport(join(root, "harness-eval", "baseline-pre"), BASELINE_QA_IDS);
  writeReport(join(root, "harness-eval", "baseline-post"), BASELINE_QA_IDS);
  for (const expected of MUTATION_REPORTS) {
    writeReport(
      join(root, "harness-eval", "mutations", expected.id),
      expected.inventory,
      expected.failing,
    );
  }
}

function fakeBaselineIds(): string[] {
  return Array.from({ length: BASELINE_TESTS }, (_, index) => `QA-FAKE-${String(index + 1).padStart(2, "0")}`);
}

function runSelftest(): void {
  const negativePrice = MUTATION_REPORTS[0] as MutationReportExpectation;
  const cases: Array<{ name: string; mutate: (root: string) => void; expectErrors: boolean }> = [
    {
      name: "valid baseline and mutation reports are accepted",
      mutate: () => {},
      expectErrors: false,
    },
    {
      name: "missing api baseline JUnit report is rejected",
      mutate: (root) => rmSync(join(root, "api-baseline", "junit.xml")),
      expectErrors: true,
    },
    {
      name: "malformed api baseline JUnit report is rejected",
      mutate: (root) => writeFileSync(join(root, "api-baseline", "junit.xml"), "not xml", "utf8"),
      expectErrors: true,
    },
    {
      name: "wrong api baseline test count is rejected",
      mutate: (root) => writeReport(join(root, "api-baseline"), BASELINE_QA_IDS.slice(0, BASELINE_TESTS - 1)),
      expectErrors: true,
    },
    {
      name: "api baseline failure is rejected",
      mutate: (root) =>
        writeReport(join(root, "api-baseline"), BASELINE_QA_IDS, ["QA-ENV-01"]),
      expectErrors: true,
    },
    {
      name: "generic non-Playwright HTML report is rejected",
      mutate: (root) =>
        writeFileSync(join(root, "api-baseline", "html", "index.html"), genericHtml(), "utf8"),
      expectErrors: true,
    },
    {
      name: "unrelated all-green baseline with unknown QA ids is rejected",
      mutate: (root) => writeReport(join(root, "api-baseline"), fakeBaselineIds()),
      expectErrors: true,
    },
    {
      name: "baseline with one substituted QA id is rejected",
      mutate: (root) =>
        writeReport(join(root, "api-baseline"), [...BASELINE_QA_IDS.slice(0, BASELINE_TESTS - 1), "QA-FAKE-01"]),
      expectErrors: true,
    },
    {
      name: "baseline with a duplicated QA id is rejected",
      mutate: (root) =>
        writeReport(join(root, "api-baseline"), [BASELINE_QA_IDS[0] as string, ...BASELINE_QA_IDS.slice(0, BASELINE_TESTS - 1)]),
      expectErrors: true,
    },
    {
      name: "baseline testcase without a QA id is rejected",
      mutate: (root) => writeReport(join(root, "api-baseline"), [...BASELINE_QA_IDS.slice(0, BASELINE_TESTS - 1), "not-a-test"]),
      expectErrors: true,
    },
    {
      name: "mutation with a missing intended failure is rejected",
      mutate: (root) =>
        writeReport(
          join(root, "harness-eval", "mutations", "negative-price-accepted"),
          negativePrice.inventory,
          ["QA-VAL-02"],
        ),
      expectErrors: true,
    },
    {
      name: "mutation with an unexpected extra failure is rejected",
      mutate: (root) =>
        writeReport(
          join(root, "harness-eval", "mutations", "negative-price-accepted"),
          [...negativePrice.inventory, "QA-ISO-01"],
          ["QA-VAL-02", "QA-VAL-07", "QA-ISO-01"],
        ),
      expectErrors: true,
    },
    {
      name: "mutation with the right failing ids but a wrong inventory is rejected",
      mutate: (root) =>
        writeReport(
          join(root, "harness-eval", "mutations", "negative-price-accepted"),
          [...negativePrice.inventory.slice(0, 8), "QA-FAKE-01"],
          ["QA-VAL-02", "QA-VAL-07"],
        ),
      expectErrors: true,
    },
    {
      name: "missing HTML report is rejected",
      mutate: (root) => rmSync(join(root, "harness-eval", "baseline-post", "html"), { recursive: true }),
      expectErrors: true,
    },
  ];

  let failures = 0;
  for (const testCase of cases) {
    const root = mkdtempSync(join(tmpdir(), "aql-500-reports-"));
    try {
      writeFixtureTree(root);
      testCase.mutate(root);
      const errors = checkReports(root);
      const passed = testCase.expectErrors ? errors.length > 0 : errors.length === 0;
      if (passed) {
        console.log(`PASS ${testCase.name}`);
      } else {
        failures += 1;
        console.error(
          `FAIL ${testCase.name}: ${testCase.expectErrors ? "expected errors but got none" : errors.join("; ")}`,
        );
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  console.log(`reports selftest: ${cases.length - failures}/${cases.length} passed`);
  if (failures > 0) process.exitCode = 1;
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

if (process.argv.includes("--self-test")) {
  runSelftest();
} else {
  const root = resolve(optionValue("--reports") ?? "reports");
  const errors = checkReports(root);
  if (errors.length === 0) {
    console.log(`reports: PASS - baseline and intentional mutation reports verified under ${root}`);
  } else {
    console.error(`reports: FAIL - ${errors.length} error(s) under ${root}`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  }
}
