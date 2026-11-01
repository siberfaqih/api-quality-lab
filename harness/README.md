# Mutation evaluation harness (AQL-400)

`harness:eval` implements G4: it injects three isolated, intentional defects
into the SUT one at a time, proves the relevant Playwright tests fail for the
intended assertion, restores `sut/src/app.ts` byte-for-byte, and proves the
full API suite passes again.

## Run

```sh
npm run harness:eval
npm run harness:eval:selftest
```

`harness:eval` writes its own evidence directory by default
(`evidence/generated/aql-400-eval-<UTC>/`); pass `--evidence <path>` to choose
one explicitly:

```sh
npm run harness:eval -- --evidence evidence/generated/aql-400-g4-<UTC>/eval
```

Pass `--reports <dir>` to also emit Playwright HTML and JUnit reports for every
run. JSON remains on stdout for the harness parser; HTML/JUnit are written
per run:

```text
<dir>/baseline-pre/junit.xml + html/
<dir>/mutations/<mutation-id>/junit.xml + html/
<dir>/baseline-post/junit.xml + html/
```

```sh
npm run harness:eval -- \
  --evidence evidence/generated/aql-500-<UTC>/eval \
  --reports evidence/generated/aql-500-<UTC>/reports/harness-eval
npm run reports:verify -- --reports evidence/generated/aql-500-<UTC>/reports
```

`reports:verify` checks the baseline and mutation JUnit counts, the exact QA
testcase inventory (no missing/extra/duplicated/substituted ids) and the
exact failing subset, plus Playwright-specific HTML markers (report title and
embedded report data); `reports:selftest` exercises its 14 negative controls. The API
baseline is generated separately (for example with
`PLAYWRIGHT_JUNIT_OUTPUT_FILE` and `PLAYWRIGHT_HTML_REPORT` pointing at
`reports/api-baseline`).

No extra dependencies: the harness runs the locally installed Playwright CLI
with `node`, using Playwright's JSON, HTML and JUnit reporters.

## Mutations

| Id | Patch | Targeted spec | Required failure semantics |
| --- | --- | --- | --- |
| `negative-price-accepted` | `validatePrice` drops the `value < 0` lower bound | `qa/tests/validation.spec.ts` | QA-VAL-02: expected `400`, received `201`; QA-VAL-07: expected `>= 3`, received `2` |
| `token-validation-skipped` | `authenticate` returns alice for any well-formed Bearer token instead of checking the token store/expiry | `qa/tests/authz.spec.ts` | QA-AUTHZ-02: expected `401`, received `200` |
| `cross-user-authorization-bypass` | `ownedItem` drops the `ownerId !== user.id` check | `qa/tests/isolation.spec.ts` | QA-ISO-01: expected `404`, received `200` |

Each patch is an exact, single-occurrence string replacement in
`sut/src/app.ts`. The harness refuses to patch when an anchor is missing,
ambiguous or produces no change. Tests and the contract are never edited.

## Evaluation flow

1. Record the SUT source hash and run the full 32-test suite (`baseline-pre`).
2. For each mutation:
   - require the current SUT hash to equal the baseline hash;
   - apply the exact patch and run only the targeted spec with
     `--reporter=json`;
   - require exit code `1`, the exact expected failing QA ids, the exact
     assertion signature, and the exact `Expected:`/`Received:` values for
     each expected failure (missing or ambiguous values fail closed);
   - reject HTTP 500, wrong received values, any unexpected failing test,
     partial spec discovery, runner-level errors and setup/crash markers
     (timeouts, connection errors, missing modules, fixture hooks, bind errors);
   - restore the original bytes in a `finally` block and verify the hash.
3. Verify the final SUT hash equals the baseline, then run the full suite again
   (`baseline-post`).
4. Write `summary.json` (per-mutation test counts and expected assertion
   records with `qaId`, `signature`, `expected`, `received`, `matched`,
   `actual` and a message excerpt), per-run stdout/stderr logs and exit codes,
   and exit non-zero if any check fails.

SIGINT/SIGTERM handlers also restore the original source. A hard `SIGKILL`
cannot be intercepted; `shasum -a 256 sut/src/app.ts` must equal the recorded
baseline hash. The file already carries legitimate uncommitted AQL-300
changes, so `git diff -- sut/src/app.ts` is not a clean-tree check.

## Fail-closed rules

- Missing/ambiguous/no-op patch anchors, or a SUT that changed before patching.
- Mutation run exit `0` (undetected) or anything other than `1`.
- Wrong or missing failing test set, wrong assertion signature, missing or
  ambiguous `Expected:`/`Received:` values, or values that differ from the
  mutation's required pair.
- HTTP 500, unexpected failure, runner-level errors, zero/partial test
  discovery.
- Restore hash mismatch, or a failing post-restore baseline.

`harness:eval:selftest` exercises these rules without Playwright: patch
rejection cases, JSON parsing, ANSI stripping, exact expected/received parsing,
HTTP-500 and wrong-received negatives for every expected QA id, intended and
unintended failure classification, crash classification, signal termination,
baseline checks, and restore-on-success/restore-on-throw in a temp directory
(37 controls).

## Limits

- The harness patches the real source in place (the tests import it directly);
  restoration is hash-verified, not a separate copy.
- Mutation runs are limited to the targeted spec; the full suite runs before
  and after, not during each mutation.
- The baseline count is pinned to the G3 suite (32 tests); a deliberate suite
  change requires updating `BASELINE_TEST_COUNT`.
- No coverage percentage is claimed, and remote CI remains G5 / NOT VERIFIED.
