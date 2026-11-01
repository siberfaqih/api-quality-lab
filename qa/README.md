# QA Suite — Playwright API Tests (AQL-300)

This directory contains the executable API quality suite for the local
Inventory SUT. It uses Playwright Test's `APIRequestContext` (no browser)
against the real HTTP server from `sut/src/app.ts`.

## Run

```sh
npm run test:api                 # 32 tests, 1 worker, fresh SUT per test
npm run qa:traceability          # fail-closed discovery/matrix reconciliation
npm run qa:traceability:selftest # negative controls for that check
npm run typecheck
```

Order-independence evidence is reproducible with a fixed shuffle seed:

```sh
npx playwright test --config qa/playwright.config.ts \
  --shuffle=20261101 --workers=4 --fully-parallel
```

## Structure

| Path | Purpose |
| --- | --- |
| `playwright.config.ts` | Test directory, one worker by default, 15s test timeout, list reporter |
| `fixtures/inventory.ts` | Per-test SUT lifecycle, Playwright request context, synthetic-user helpers, Problem/FieldError assertions |
| `tests/*.spec.ts` | 32 requirement-titled API tests across health, auth, authorization, CRUD, list/pagination, validation, isolation and errors |
| `traceability.md` | Test → requirement matrix, including all 28 contract requirement ids |
| `traceability-check.ts` | Executable check that reconciles Playwright's own `--list --reporter=json` discovery with `traceability.md`: every discovered test has a `QA-*` and `REQ-*` id, every contract requirement is covered, each matrix row matches its title, and the matrix lists every id. Commented or otherwise unregistered source strings cannot count. `--self-test` adds negative controls |

## Fixture isolation

Each test gets a fresh `createInventoryServer()` instance listening on an
ephemeral `127.0.0.1` port. A new Playwright `APIRequestContext` is created
with that dynamic `baseURL`, and both the context and server are closed in
the fixture teardown. Tests therefore share no items, tokens or ordering
state, and the contract's deliberate absence of a reset endpoint is not
bypassed.

This is a real HTTP listener per test, but it runs in the Playwright worker
process rather than as a separate child process. Process-level start/stop
behavior is covered by AQL-200's SUT smoke evidence, not re-claimed here.

`inventory.setNow(ms)` overrides the SUT clock for the current test; the
ordering test uses it to create a proven three-item `createdAt` tie before
asserting the ascending-id tie-break. `setNow(undefined)` restores real time.

## Assertion style

Tests assert response bodies, state transitions and negatives, not only
status codes:

- exact item and list envelopes, field values and defaults;
- `Location`, `WWW-Authenticate` and media types;
- persisted state after PATCH/DELETE and unchanged state after rejected
  requests, including create/update equivalence for validation bounds;
- full Problem assertions before every 404 GET/PATCH/DELETE body comparison;
- cross-user 404 equivalence and list isolation;
- RFC 9457 `Problem` shape, registered error codes and absence of leaked
  stack traces, paths or synthetic credentials.

The contract is not weakened to make a test pass. The suite does not
calculate or claim line/branch coverage.

## Reports and limits

- The list reporter writes to stdout; failure artifacts, if any, go to
  `test-results/` (gitignored).
- CI and `harness:eval --reports` run Playwright with
  `--reporter=json,html,junit`; HTML/JUnit land in the chosen report directory
  (`reports/api-baseline` or `reports/harness-eval/...`). `reports/` is
  generated and gitignored.
- `npm run reports:verify -- --reports <dir>` checks the generated baseline and
  intentional-mutation reports; `npm run reports:selftest` covers its negative
  controls.
- Remote CI passed on the observed run 41271870930 (G5 PASS local + remote;
  see `reviews/AQL-500.md`).
- The OpenAPI document is validated separately by `npm run contract:validate`.
  These tests exercise behavior and do not replace that document check.
- Field-level error codes are pinned to the SUT's observed vocabulary where
  the contract documents the vocabulary without enumerating a field-to-code
  mapping (see AQL-100/AQL-200 handoffs).
