import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

export interface ExpectedFailure {
  qaId: string;
  /** Exact assertion text that must appear in the failing test's error message. */
  signature: string;
  /** Exact expected value as Playwright renders it, e.g. "400" or ">= 3". */
  expected: string;
  /** Exact received value as Playwright renders it, e.g. "201" or "2". */
  received: string;
}

export interface ExpectationValues {
  expected: string;
  received: string;
}

export interface MutationSpec {
  id: string;
  description: string;
  /** Repository-relative path of the mutated source file. */
  file: string;
  /** Exact source text to replace; must occur exactly once. */
  find: string;
  replace: string;
  /** Repository-relative spec that must detect the mutation. */
  spec: string;
  /** Number of tests Playwright must discover in that spec. */
  specTestCount: number;
  expectedFailures: ExpectedFailure[];
}

export interface PlaywrightSpecResult {
  title: string;
  file: string | undefined;
  failed: boolean;
  messages: string[];
}

export interface PlaywrightRunSummary {
  specs: PlaywrightSpecResult[];
  errors: string[];
  stats: {
    expected: number;
    unexpected: number;
    skipped: number;
    flaky: number;
  };
}

interface RawResult {
  status?: string;
  error?: { message?: string };
}

interface RawTest {
  results?: RawResult[];
}

interface RawSpec {
  title?: string;
  file?: string;
  ok?: boolean;
  tests?: RawTest[];
}

interface RawSuite {
  file?: string;
  specs?: RawSpec[];
  suites?: RawSuite[];
}

interface RawReport {
  suites?: RawSuite[];
  errors?: Array<string | { message?: string }>;
  stats?: {
    expected?: number;
    unexpected?: number;
    skipped?: number;
    flaky?: number;
  };
}

/**
 * Failure text that indicates infrastructure/setup breakage rather than the
 * assertion a mutation is supposed to trigger. The evaluation fails closed if
 * a mutation's failure matches one of these markers.
 */
export const CRASH_MARKERS = [
  "Test timeout of",
  "ECONNREFUSED",
  "EADDRINUSE",
  "Cannot find module",
  "beforeAll",
  "afterAll",
  "Target page, context or browser has been closed",
  "Inventory SUT did not bind",
  "socket hang up",
  "fetch failed",
  "EAI_AGAIN",
  "ENOTFOUND",
  "UND_ERR_CONNECT_TIMEOUT",
  "getaddrinfo",
] as const;

/**
 * An HTTP 500 is never an acceptable mutation detection, even when the broad
 * assertion text is present. This is separate from CRASH_MARKERS because the
 * received status is part of the expected/received semantics.
 */
export const HTTP_500_PATTERN = /(?:^|\n)\s*Received:\s*500\b|\bHTTP 500\b|\bInternal Server Error\b/i;

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function applyMutation(source: string, mutation: MutationSpec): string {
  const occurrences = source.split(mutation.find).length - 1;
  if (occurrences === 0) {
    throw new Error(`${mutation.id}: mutation anchor was not found in ${mutation.file}`);
  }
  if (occurrences > 1) {
    throw new Error(
      `${mutation.id}: mutation anchor occurs ${occurrences} times in ${mutation.file}; refusing an ambiguous patch`,
    );
  }
  const mutated = source.split(mutation.find).join(mutation.replace);
  if (mutated === source) {
    throw new Error(`${mutation.id}: mutation replacement did not change ${mutation.file}`);
  }
  return mutated;
}

/**
 * Apply a mutated source file, run the body, and always restore the original
 * bytes. The restore is verified byte-for-byte before returning or rethrowing.
 */
export function withMutatedSource<T>(
  path: string,
  original: string,
  mutated: string,
  body: () => T,
): T {
  writeFileSync(path, mutated, "utf8");
  try {
    return body();
  } finally {
    writeFileSync(path, original, "utf8");
    const restored = readFileSync(path, "utf8");
    if (restored !== original) {
      throw new Error(`restore verification failed for ${path}`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Playwright colorizes expect diffs; signatures must match the plain text. */
function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function extractSingleLine(text: string, label: "Expected" | "Received"): string {
  const matches = [...text.matchAll(new RegExp(`^${label}:[ \\t]+(.+)$`, "gm"))];
  if (matches.length === 0) {
    throw new Error(`failure message has no ${label}: line`);
  }
  if (matches.length > 1) {
    throw new Error(
      `failure message has ${matches.length} ${label}: lines; refusing an ambiguous parse`,
    );
  }
  return matches[0]![1]!.trim();
}

/**
 * Extract the exact expected/received values Playwright renders for a scalar
 * assertion. Missing or repeated lines fail closed so a broad substring can
 * never stand in for the intended semantics.
 */
export function parseExpectationValues(text: string): ExpectationValues {
  const normalized = text.replace(/\r\n/g, "\n");
  return {
    expected: extractSingleLine(normalized, "Expected"),
    received: extractSingleLine(normalized, "Received"),
  };
}

function collectSpecs(
  suites: RawSuite[],
  inheritedFile: string | undefined,
  output: PlaywrightSpecResult[],
): void {
  for (const suite of suites) {
    const file = suite.file ?? inheritedFile;
    for (const spec of suite.specs ?? []) {
      const messages: string[] = [];
      let failed = spec.ok === false;
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          if (result.status === "failed") {
            failed = true;
            if (result.error?.message !== undefined) {
              messages.push(stripAnsi(result.error.message));
            }
          }
        }
      }
      output.push({
        title: spec.title ?? "(untitled spec)",
        file: spec.file ?? file,
        failed,
        messages,
      });
    }
    if (suite.suites !== undefined) collectSpecs(suite.suites, file, output);
  }
}

/** Parse the JSON reporter output; malformed or structurally wrong output throws. */
export function parsePlaywrightReport(raw: string): PlaywrightRunSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Playwright output is not valid JSON");
  }
  if (!isRecord(parsed)) {
    throw new Error("Playwright output is not a JSON object");
  }
  const report = parsed as RawReport;
  if (report.suites !== undefined && !Array.isArray(report.suites)) {
    throw new Error("Playwright report has no suites array");
  }
  const specs: PlaywrightSpecResult[] = [];
  collectSpecs(report.suites ?? [], undefined, specs);
  const errors = (report.errors ?? []).map((entry) =>
    stripAnsi(typeof entry === "string" ? entry : (entry.message ?? "unknown runner error")),
  );
  return {
    specs,
    errors,
    stats: {
      expected: report.stats?.expected ?? 0,
      unexpected: report.stats?.unexpected ?? 0,
      skipped: report.stats?.skipped ?? 0,
      flaky: report.stats?.flaky ?? 0,
    },
  };
}

/** Leading QA-* id of a test title, or the full title when absent. */
export function qaIdFromTitle(title: string): string {
  return /^(QA-[A-Z]+-\d+)\b/.exec(title)?.[1] ?? title;
}

export function failedQaIds(summary: PlaywrightRunSummary): string[] {
  return summary.specs.filter((spec) => spec.failed).map((spec) => qaIdFromTitle(spec.title));
}

function failureText(spec: PlaywrightSpecResult): string {
  return spec.messages.join("\n");
}

/**
 * Validate one mutation run: exit code, expected failing set, intended
 * assertion signatures and absence of setup/crash failures.
 */
export function evaluateMutationRun(
  summary: PlaywrightRunSummary,
  exitCode: number | null,
  mutation: MutationSpec,
): string[] {
  const errors: string[] = [];

  if (summary.errors.length > 0) {
    errors.push(`runner reported errors: ${summary.errors.join(" | ")}`);
  }
  if (exitCode === null) {
    errors.push("runner was terminated by a signal");
  } else if (exitCode === 0) {
    errors.push(`mutation ${mutation.id} was not detected: runner exited 0`);
  } else if (exitCode !== 1) {
    errors.push(`runner exited ${exitCode}; expected 1 for detected test failures`);
  }
  if (summary.specs.length === 0) {
    errors.push("no tests were discovered or executed");
  } else if (summary.specs.length !== mutation.specTestCount) {
    errors.push(
      `expected ${mutation.specTestCount} tests in ${mutation.spec}, discovered ${summary.specs.length}`,
    );
  }

  const failed = summary.specs.filter((spec) => spec.failed);
  const failedIds = new Set(failed.map((spec) => qaIdFromTitle(spec.title)));
  const expectedIds = new Set(mutation.expectedFailures.map((entry) => entry.qaId));

  for (const expected of mutation.expectedFailures) {
    const spec = failed.find((entry) => qaIdFromTitle(entry.title) === expected.qaId);
    if (spec === undefined) {
      errors.push(`expected ${expected.qaId} to fail but it passed`);
      continue;
    }
    const text = failureText(spec);
    if (!text.includes(expected.signature)) {
      errors.push(
        `failure for ${expected.qaId} did not contain the intended assertion ${JSON.stringify(
          expected.signature,
        )}; got ${JSON.stringify(text.slice(0, 600))}`,
      );
      continue;
    }
    let actual: ExpectationValues;
    try {
      actual = parseExpectationValues(text);
    } catch (error) {
      errors.push(
        `failure for ${expected.qaId} has no unambiguous Expected/Received values: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      continue;
    }
    if (actual.expected !== expected.expected || actual.received !== expected.received) {
      errors.push(
        `failure for ${expected.qaId} reported Expected/Received ${JSON.stringify(
          actual,
        )}; required ${JSON.stringify({
          expected: expected.expected,
          received: expected.received,
        })}`,
      );
    }
  }

  for (const spec of failed) {
    const id = qaIdFromTitle(spec.title);
    if (!expectedIds.has(id)) {
      errors.push(`unexpected failure: ${id} (${spec.title})`);
    }
    const text = failureText(spec);
    if (HTTP_500_PATTERN.test(text)) {
      errors.push(`failure for ${id} looks like an HTTP 500 response, not the intended assertion`);
    }
    for (const marker of CRASH_MARKERS) {
      if (text.includes(marker)) {
        errors.push(`failure for ${id} looks like a setup/crash error (${JSON.stringify(marker)})`);
      }
    }
  }

  if (summary.stats.unexpected > 0 && failed.length === 0) {
    errors.push(`runner reported ${summary.stats.unexpected} unexpected test(s) without failure details`);
  }

  return errors;
}

/** Validate a full-suite baseline run: every expected test must pass. */
export function evaluateBaselineRun(
  summary: PlaywrightRunSummary,
  exitCode: number | null,
  expectedTests: number,
): string[] {
  const errors: string[] = [];
  if (summary.errors.length > 0) {
    errors.push(`runner reported errors: ${summary.errors.join(" | ")}`);
  }
  if (exitCode === null) {
    errors.push("runner was terminated by a signal");
  } else if (exitCode !== 0) {
    errors.push(`baseline runner exited ${exitCode}; expected 0`);
  }
  if (summary.specs.length !== expectedTests) {
    errors.push(`expected ${expectedTests} tests, discovered ${summary.specs.length}`);
  }
  const failed = summary.specs.filter((spec) => spec.failed);
  if (failed.length > 0) {
    errors.push(
      `baseline failures: ${failed.map((spec) => qaIdFromTitle(spec.title)).join(", ")}`,
    );
  }
  if (summary.stats.skipped !== 0) {
    errors.push(`baseline skipped ${summary.stats.skipped} test(s)`);
  }
  if (summary.stats.unexpected !== 0) {
    errors.push(`baseline reported ${summary.stats.unexpected} unexpected test(s)`);
  }
  return errors;
}
