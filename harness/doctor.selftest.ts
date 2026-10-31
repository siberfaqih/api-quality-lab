#!/usr/bin/env node
/**
 * harness:selftest — executable regression checks for harness:doctor logic.
 *
 * Guards the fail-closed contract: validation helpers must reject malformed and
 * weaker inputs, not merely accept the happy path. Exits 1 if any case mismatches.
 *
 * Usage: node harness/doctor.selftest.ts
 */
import { validateNodeEngines } from "./engine-range.ts";

interface Case {
  readonly label: string;
  readonly input: unknown;
  readonly expectOk: boolean;
}

const CASES: readonly Case[] = [
  { label: "exact minimum", input: ">=24.0.0", expectOk: true },
  { label: "major-only minimum", input: ">=24", expectOk: true },
  { label: "padded minimum", input: "  >=24.0.0  ", expectOk: true },
  { label: "major wildcard", input: "24.x", expectOk: true },
  { label: "stricter minimum", input: ">=26.1.0", expectOk: true },
  { label: "bounded stricter range", input: ">=24.0.0 <25", expectOk: true },
  { label: "caret on 24", input: "^24.0.0", expectOk: true },
  // Reviewer regressions: must not pass.
  { label: "disjunction re-admitting Node 18", input: ">=24.0.0 || >=18.0.0", expectOk: false },
  { label: "garbage with >=24 substring", input: "garbage >=24", expectOk: false },
  { label: "weaker minimum", input: ">=18.0.0", expectOk: false },
  { label: "open lower bound", input: "*", expectOk: false },
  { label: "empty string", input: "", expectOk: false },
  { label: "whitespace only", input: "   ", expectOk: false },
  { label: "non-string number", input: 24, expectOk: false },
  { label: "null", input: null, expectOk: false },
  { label: "undefined", input: undefined, expectOk: false },
];

let failures = 0;

for (const testCase of CASES) {
  const verdict = validateNodeEngines(testCase.input);
  const passed = verdict.ok === testCase.expectOk;
  if (!passed) failures += 1;
  const expected = testCase.expectOk ? "accept" : "reject";
  console.log(`[${passed ? "PASS" : "FAIL"}] ${testCase.label.padEnd(34)} expected ${expected} — ${verdict.detail}`);
}

console.log("");
console.log(`Summary: ${CASES.length - failures} pass, ${failures} fail`);
process.exitCode = failures > 0 ? 1 : 0;
