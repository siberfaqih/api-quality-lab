import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

interface ContractDocument {
  "x-requirements"?: Array<{ id: string }>;
}

interface TestTitle {
  file: string;
  title: string;
  qaId: string;
  requirementIds: string[];
}

interface PlaywrightSpec {
  title: string;
  file?: string;
}

interface PlaywrightSuite {
  title?: string;
  file?: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  suites?: PlaywrightSuite[];
  errors?: Array<string | { message?: string }>;
}

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const MATRIX_PATH = new URL("./traceability.md", import.meta.url);
const CONTRACT_PATH = new URL("../contract/openapi.yaml", import.meta.url);

function readRequirements(): string[] {
  const contract = parseYaml(readFileSync(CONTRACT_PATH, "utf8")) as ContractDocument;
  const declared = contract["x-requirements"];
  if (!Array.isArray(declared)) {
    throw new Error("contract/openapi.yaml has no x-requirements array");
  }
  return declared.map((requirement) => requirement.id);
}

/**
 * Extract QA/REQ ids from a title reported by Playwright discovery. Only
 * executable tests reach this function; commented or otherwise unregistered
 * source strings never do.
 */
function parseTestTitle(
  file: string,
  title: string,
  errors: string[],
): TestTitle | undefined {
  const qaMatch = /\b(QA-[A-Z]+-\d+)\b/.exec(title);
  const requirementIds = [
    ...new Set([...title.matchAll(/\bREQ-[A-Z]+-\d+\b/g)].map((entry) => entry[0])),
  ];
  if (qaMatch === null) {
    errors.push(`${file}: test title has no QA id: ${title}`);
    return undefined;
  }
  if (requirementIds.length === 0) {
    errors.push(`${file}: test title has no REQ id: ${title}`);
    return undefined;
  }
  return { file, title, qaId: qaMatch[1] as string, requirementIds };
}

function collectSpecs(
  suites: PlaywrightSuite[],
  inheritedFile: string | undefined,
  output: PlaywrightSpec[],
): void {
  for (const suite of suites) {
    const suiteFile = suite.file ?? inheritedFile;
    for (const spec of suite.specs ?? []) {
      output.push({ title: spec.title, file: spec.file ?? suiteFile });
    }
    if (suite.suites !== undefined) collectSpecs(suite.suites, suiteFile, output);
  }
}

function discoverTests(): { tests: TestTitle[]; errors: string[] } {
  const errors: string[] = [];
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  let stdout: string;
  try {
    stdout = execFileSync(
      npx,
      [
        "--no-install",
        "playwright",
        "test",
        "--config",
        "qa/playwright.config.ts",
        "--list",
        "--reporter=json",
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    const failure = error as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };
    const detail = [failure.stderr, failure.stdout]
      .filter((value) => value !== undefined)
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0)
      .join("\n");
    errors.push(
      `Playwright discovery failed: ${detail.length > 0 ? detail : (failure.message ?? "unknown error")}`,
    );
    return { tests: [], errors };
  }

  let report: PlaywrightReport;
  try {
    report = JSON.parse(stdout) as PlaywrightReport;
  } catch {
    errors.push("Playwright discovery did not produce parseable JSON");
    return { tests: [], errors };
  }
  for (const entry of report.errors ?? []) {
    const message = typeof entry === "string" ? entry : (entry.message ?? "unknown error");
    errors.push(`Playwright discovery reported an error: ${message}`);
  }

  const specs: PlaywrightSpec[] = [];
  collectSpecs(report.suites ?? [], undefined, specs);
  if (specs.length === 0) {
    errors.push("Playwright discovery found no executable tests");
    return { tests: [], errors };
  }

  const tests: TestTitle[] = [];
  for (const spec of specs) {
    const parsed = parseTestTitle(spec.file ?? "unknown spec", spec.title, errors);
    if (parsed !== undefined) tests.push(parsed);
  }
  return { tests, errors };
}

function validate(
  tests: TestTitle[],
  requirements: string[],
  matrix: string,
): string[] {
  const errors: string[] = [];
  const requirementSet = new Set(requirements);

  if (tests.length < 22) {
    errors.push(`expected at least 22 executable tests, found ${tests.length}`);
  }

  const seenQaIds = new Map<string, string>();
  for (const entry of tests) {
    const titleQa = /\b(QA-[A-Z]+-\d+)\b/.exec(entry.title)?.[1];
    if (titleQa !== entry.qaId) {
      errors.push(`${entry.file}: parsed QA id does not match the test title: ${entry.title}`);
    }
    const titleRequirements = new Set(
      [...entry.title.matchAll(/\bREQ-[A-Z]+-\d+\b/g)].map((match) => match[0]),
    );
    if (
      titleRequirements.size !== entry.requirementIds.length ||
      entry.requirementIds.some((requirement) => !titleRequirements.has(requirement))
    ) {
      errors.push(`${entry.qaId}: parsed requirements do not match the test title`);
    }

    const previous = seenQaIds.get(entry.qaId);
    if (previous !== undefined) {
      errors.push(`${entry.qaId} is declared in both ${previous} and ${entry.file}`);
    } else {
      seenQaIds.set(entry.qaId, entry.file);
    }
    for (const requirementId of entry.requirementIds) {
      if (!requirementSet.has(requirementId)) {
        errors.push(`${entry.qaId} references unknown requirement ${requirementId}`);
      }
    }
  }

  const covered = new Set(tests.flatMap((entry) => entry.requirementIds));
  for (const requirement of requirements) {
    if (!covered.has(requirement)) {
      errors.push(`no test title references ${requirement}`);
    }
  }

  const matrixRows = new Map<string, Set<string>>();
  for (const line of matrix.split("\n")) {
    if (!line.startsWith("| QA-")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    const qaId = cells[1];
    const requirementCell = cells[2];
    if (qaId === undefined || requirementCell === undefined) {
      errors.push(`traceability.md has a malformed row: ${line}`);
      continue;
    }
    if (matrixRows.has(qaId)) {
      errors.push(`traceability.md declares ${qaId} more than once`);
      continue;
    }
    matrixRows.set(
      qaId,
      new Set(
        [...requirementCell.matchAll(/\bREQ-[A-Z]+-\d+\b/g)].map((entry) => entry[0]),
      ),
    );
  }

  for (const entry of tests) {
    const row = matrixRows.get(entry.qaId);
    if (row === undefined) {
      errors.push(`traceability.md is missing test id ${entry.qaId}`);
      continue;
    }
    const titleRequirements = new Set(entry.requirementIds);
    if (
      row.size !== titleRequirements.size ||
      [...titleRequirements].some((requirement) => !row.has(requirement))
    ) {
      errors.push(
        `traceability.md row ${entry.qaId} requirements do not match its test title`,
      );
    }
  }
  for (const qaId of matrixRows.keys()) {
    if (!seenQaIds.has(qaId)) {
      errors.push(`traceability.md lists ${qaId} but no executable test declares it`);
    }
  }
  for (const requirement of requirements) {
    if (!matrix.includes(requirement)) {
      errors.push(`traceability.md is missing requirement ${requirement}`);
    }
  }

  return errors;
}

function runCheck(): void {
  const errors: string[] = [];
  let requirements: string[] = [];
  try {
    requirements = readRequirements();
  } catch (error) {
    errors.push(
      `could not read contract requirements: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let matrix = "";
  try {
    matrix = readFileSync(MATRIX_PATH, "utf8");
  } catch (error) {
    errors.push(
      `could not read qa/traceability.md: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const discovery = discoverTests();
  errors.push(...discovery.errors);
  errors.push(...validate(discovery.tests, requirements, matrix));

  const covered = new Set(discovery.tests.flatMap((entry) => entry.requirementIds));
  const result = {
    ok: errors.length === 0,
    source: "playwright test --list --reporter=json",
    tests: discovery.tests.length,
    requirements: {
      total: requirements.length,
      covered: covered.size,
      missing: requirements.filter((requirement) => !covered.has(requirement)),
    },
    qaIds: discovery.tests.map((entry) => entry.qaId),
    errors,
  };

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `traceability: ${result.tests} executable tests, ${result.requirements.covered}/${result.requirements.total} requirements covered, ${new Set(result.qaIds).size} unique QA ids`,
    );
    if (errors.length > 0) {
      for (const error of errors) console.error(`FAIL ${error}`);
    } else {
      console.log(
        "PASS Playwright discovery, every contract requirement and qa/traceability.md agree",
      );
    }
  }

  if (errors.length > 0) process.exitCode = 1;
}

function matrixFor(tests: TestTitle[]): string {
  const rows = tests.map(
    (entry) =>
      `| ${entry.qaId} | ${entry.requirementIds.join(", ")} | ${entry.file} |`,
  );
  return ["| Test ID | Contract requirement(s) | Spec file |", "| --- | --- | --- |", ...rows].join(
    "\n",
  );
}

/** Negative controls for the discovery parser and matrix reconciliation. */
function runSelfTest(): void {
  const requirements = Array.from(
    { length: 22 },
    (_, index) => `REQ-T-${String(index + 1).padStart(2, "0")}`,
  );
  const goodTitles = requirements.map(
    (requirement, index) => `QA-T-${String(index + 1).padStart(2, "0")} ${requirement}: fake test`,
  );
  const goodMatrix = matrixFor(
    requirements.map((requirement, index) => ({
      file: "fake.spec.ts",
      title: goodTitles[index] as string,
      qaId: `QA-T-${String(index + 1).padStart(2, "0")}`,
      requirementIds: [requirement],
    })),
  );

  const parseAll = (titles: string[]): { tests: TestTitle[]; errors: string[] } => {
    const errors: string[] = [];
    const tests: TestTitle[] = [];
    for (const title of titles) {
      const parsed = parseTestTitle("fake.spec.ts", title, errors);
      if (parsed !== undefined) tests.push(parsed);
    }
    return { tests, errors };
  };

  const cases: Array<{
    name: string;
    titles: string[];
    matrix: string;
    expected: string;
  }> = [
    { name: "valid baseline", titles: goodTitles, matrix: goodMatrix, expected: "" },
    {
      name: "missing QA id",
      titles: ["REQ-T-01: fake test", ...goodTitles.slice(1)],
      matrix: goodMatrix,
      expected: "test title has no QA id",
    },
    {
      name: "missing REQ id",
      titles: ["QA-T-01: fake test", ...goodTitles.slice(1)],
      matrix: goodMatrix,
      expected: "test title has no REQ id",
    },
    {
      name: "duplicate QA id",
      titles: [
        goodTitles[0] as string,
        "QA-T-01 REQ-T-02: duplicate",
        ...goodTitles.slice(2),
      ],
      matrix: goodMatrix,
      expected: "is declared in both",
    },
    {
      name: "unknown requirement",
      titles: [
        "QA-T-01 REQ-T-99: fake test",
        ...goodTitles.slice(1),
      ],
      matrix: goodMatrix,
      expected: "references unknown requirement",
    },
    {
      name: "fewer than 22 tests",
      titles: goodTitles.slice(0, 21),
      matrix: matrixFor(parseAll(goodTitles.slice(0, 21)).tests),
      expected: "expected at least 22 executable tests",
    },
    {
      name: "missing matrix row",
      titles: goodTitles,
      matrix: matrixFor(parseAll(goodTitles.slice(0, 21)).tests),
      expected: "traceability.md is missing test id",
    },
    {
      name: "matrix requirement mismatch",
      titles: goodTitles,
      matrix: goodMatrix.replace("| QA-T-01 | REQ-T-01 |", "| QA-T-01 | REQ-T-02 |"),
      expected: "requirements do not match its test title",
    },
    {
      name: "extra matrix row",
      titles: goodTitles,
      matrix: `${goodMatrix}\n| QA-T-99 | REQ-T-01 | fake.spec.ts |`,
      expected: "but no executable test declares it",
    },
  ];

  let failures = 0;
  for (const testCase of cases) {
    const parsed = parseAll(testCase.titles);
    const errors = [...parsed.errors, ...validate(parsed.tests, requirements, testCase.matrix)];
    const passed =
      testCase.expected === ""
        ? errors.length === 0
        : errors.some((error) => error.includes(testCase.expected));
    if (passed) {
      console.log(`PASS ${testCase.name}`);
    } else {
      failures += 1;
      console.error(
        `FAIL ${testCase.name}: expected ${JSON.stringify(testCase.expected)}; got ${JSON.stringify(errors)}`,
      );
    }
  }
  console.log(`traceability selftest: ${cases.length - failures}/${cases.length} passed`);
  if (failures > 0) process.exitCode = 1;
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  runCheck();
}
