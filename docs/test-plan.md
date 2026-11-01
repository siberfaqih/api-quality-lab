# Test Plan — Inventory API

Status: the G3 Playwright suite is implemented and round-2 independently
approved (G3 PASS locally). The G5 CI/report pipeline is implemented, locally
validated and remotely verified: AQL-500 is DONE after the successful
GitHub Actions run 41271870930 at the exact committed head (see
`reviews/AQL-500.md`). The normative behavior is
`contract/openapi.yaml`; this plan describes how the suite verifies it and how
CI reports it.

## Scope

In scope: the seven local Inventory API operations (`GET /health`,
`POST /auth/login`, `GET/POST /items`, `GET/PATCH/DELETE /items/{id}`),
authentication, validation boundaries, cross-user isolation, pagination and
RFC 9457 error semantics.

Out of scope: frontend/browser testing, load/performance, persistence,
third-party services and publication of a remote CI result before one exists.
Mutation testing (AQL-400) and CI/report generation (AQL-500) are implemented
but are documented below rather than re-scoped as API behavior.

## Approach

- Playwright Test with `APIRequestContext`; no browser project.
- Each test starts a fresh `createInventoryServer()` on an ephemeral
  loopback port and disposes it in fixture teardown. The suite never uses a
  shared mutable server or an out-of-contract reset endpoint.
- Two synthetic users (`alice`, `bob`) exercise ownership and isolation.
- Test titles carry `QA-*` case ids and contract `REQ-*` ids.
- Assertions cover exact bodies, state transitions and negative behavior,
  not only status codes.
- The contract is not modified or weakened for test convenience.

## Test inventory

| Spec | Cases | Requirement areas |
| --- | --- | --- |
| `qa/tests/health.spec.ts` | QA-ENV-01 | environment |
| `qa/tests/auth.spec.ts` | QA-AUTH-01 … QA-AUTH-05 | auth, validation media/JSON |
| `qa/tests/authz.spec.ts` | QA-AUTHZ-01, QA-AUTHZ-02 | missing/invalid tokens on all protected operations |
| `qa/tests/items-crud.spec.ts` | QA-CRUD-01 … QA-CRUD-06 | create/read/update/delete, unknown ids, empty PATCH |
| `qa/tests/items-list.spec.ts` | QA-LIST-01 … QA-LIST-04 | envelope, ordering with a deterministic timestamp tie, slicing, invalid query bounds |
| `qa/tests/validation.spec.ts` | QA-VAL-01 … QA-VAL-09 | create/update equivalence for name/price/quantity bounds, unknown properties, JSON/media, multi-field errors, Unicode and precision boundaries |
| `qa/tests/isolation.spec.ts` | QA-ISO-01, QA-ISO-02 | cross-user read/update/delete and list isolation |
| `qa/tests/errors.spec.ts` | QA-ERR-01 … QA-ERR-03 | registered codes, Problem shape, no leaks, unmatched routes |

The authoritative case-to-requirement mapping is `qa/traceability.md`.
`npm run qa:traceability` reconciles that matrix against Playwright's
`--list --reporter=json` discovery and fails closed if a discovered test
lacks ids, a contract requirement is uncovered, or the matrix is stale.
`npm run qa:traceability:selftest` exercises the parser and reconciliation
with negative controls.

## Environment and data

- Node.js 24, npm, Playwright Test 1.64.1 (`@playwright/test`).
- Local loopback only; no third-party targets or scanning.
- Synthetic credentials are fixed in `sut/README.md` and DECISIONS D012.
- Every test owns its data; no test depends on another test's items or
  tokens.

## Pass criteria

1. `npm run test:api` exits 0 with all 32 tests passing.
2. A second consecutive run also passes.
3. A shuffled, parallel run (`--shuffle=<seed> --workers=4
   --fully-parallel`) also passes, demonstrating no order dependency.
4. `npm run qa:traceability` exits 0 and reports all 28 requirements covered;
   `npm run qa:traceability:selftest` exits 0.
5. `npm run typecheck` exits 0; existing contract/SUT gates remain green.
6. Evidence logs and exit codes are recorded in `evidence/generated/` and
   summarized in `PROGRESS.md`.

## CI and reporting

`.github/workflows/qa.yml` runs one sequential job on `ubuntu-latest` with
Node.js 24. It executes the doctor, typecheck, contract validation/self-test,
unit tests, traceability/self-test, harness self-tests, report self-test, the
32-test API baseline with HTML/JUnit, and `harness:eval` with HTML/JUnit. The
report verifier then checks the JUnit counts/failing ids and HTML presence, and
a pre/post SHA-256 check proves `sut/src/app.ts` was restored after the
mutations. Artifacts are uploaded separately for the API baseline, harness
baselines, intentional mutations and raw harness evidence.

Reports use this layout:

```text
reports/api-baseline/                          # 32 tests, 0 failures
reports/harness-eval/baseline-pre/             # 32 tests, 0 failures
reports/harness-eval/baseline-post/            # 32 tests, 0 failures
reports/harness-eval/mutations/<mutation-id>/  # targeted spec, intended failures only
```

`npm run reports:verify -- --reports <dir>` fails closed on missing reports,
wrong counts, missing/extra/duplicated/substituted QA testcase ids, wrong
failing ids or non-Playwright HTML; `npm run reports:selftest` covers 14
negative controls. The mutation report expectations are pinned to
`negative-price-accepted` (9 tests, 2 failures), `token-validation-skipped`
(2 tests, 1 failure) and `cross-user-authorization-bypass` (2 tests,
1 failure).

**Remote CI is VERIFIED.** Beyond the local evidence above, GitHub Actions run
https://github.com/siberfaqih/api-quality-lab/actions/runs/41271870930
(SUCCESS, attempt 1, push to `main`, exact head `9dad20e`) executed every
workflow command with the same results, uploaded all four artifacts, and was
independently verified by the same reviewer (full G5 APPROVED PASS; see
`reviews/AQL-500.md`).

## Known limitations

- The per-test SUT is in-process (real HTTP listener, not a separate child
  process); AQL-200 separately covers process start/stop.
- The deterministic ordering test injects the SUT clock; default SUT behavior
  remains wall-clock `Date.now`.
- The suite does not compute coverage percentages.
- The G5 workflow and reports are validated locally and on the observed remote
  run 41271870930 (G5 PASS local + remote; see `reviews/AQL-500.md`).
- The report verifier checks structure, counts, exact QA testcase inventories,
  intended failing subsets and Playwright-specific report markers; it is not a
  full XML-schema validator, and its checks are consistency/authenticity sanity
  checks rather than cryptographic provenance.
- Error `FieldError.code` values are pinned to observed SUT behavior where
  the contract defines the vocabulary but not a field-to-code map.
