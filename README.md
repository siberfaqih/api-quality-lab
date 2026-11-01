# API Quality Lab

Portfolio-grade REST API QA automation framework for a demo Inventory API,
built contract-first with OpenCode builder/reviewer agents. The QA framework
is the product; the system under test (SUT) is intentionally simple.

> This README is updated in the same commit as every pushed change, so what
> you read here describes the code in this repository — including what is
> **not** built yet.

## Status

| Phase | Deliverable | Gate | Status |
| --- | --- | --- | --- |
| 0 | Node/TypeScript bootstrap, `harness:doctor` | G0 | ✅ DONE — doctor 11/11, selftest 16/16, reviewer APPROVED |
| 1 | OpenAPI 3.1 contract + requirement IDs | G1 | ✅ DONE — `contract:validate` 21/21, `contract:selftest` 56/56, reviewer APPROVED (round 5) |
| 2 | Local Inventory SUT + SUT unit tests | G2 | ✅ DONE — unit tests 29/29, start/stop smoke verified, reviewer APPROVED (round 2, after round-1 fixes) |
| 3 | 32 Playwright API tests + traceability | G3 | ✅ DONE — round-2 independent review APPROVED; 32/32 twice, shuffled 4-worker pass, discovery traceability 28/28 + 9/9 self-test; G3 PASS locally (remote CI not verified) |
| 4 | Mutation evaluation harness (3 mutants) | G4 | ✅ DONE — round-2 independent review APPROVED; exact expected/received semantics, HTTP-500/wrong-value rejection, 37/37 self-tests, 3/3 mutations, SUT hash restored, 32/32 baseline twice; G4 PASS locally (remote CI not verified) |
| 5 | GitHub Actions CI + HTML/JUnit reports | G5 | ✅ DONE — local APPROVED + remote verified (run 41271870930 SUCCESS, exact head `9dad20e`: API 32/32, 3/3 mutations, report verifier 14/14, `actionlint` 0; round-2 + remote review, no open blockers) |
| 6 | Simulated defect report + case study | G6 | ⬜ TODO |

Task board: [`TASKS.md`](TASKS.md) · Execution log with exact commands and
exit codes: [`PROGRESS.md`](PROGRESS.md) · Review reports: [`reviews/`](reviews/)

## Quick start

Requires Node.js 24 and Git.

```sh
npm install
npm run harness:doctor     # 11 preflight checks
npm run contract:validate  # 21 contract checks against contract/openapi.yaml
npm run test:unit          # 29 SUT tests on an ephemeral port
npm run test:api                 # 32 Playwright API tests, fresh SUT per test
npm run qa:traceability          # discovery ↔ matrix ↔ requirement check
npm run qa:traceability:selftest # negative controls for that check
npm run harness:eval             # 3 controlled mutations + clean restore + baseline re-pass
npm run harness:eval:selftest    # negative controls for the mutation evaluator
npm run reports:selftest         # 14 negative controls for the HTML/JUnit verifier
npm run typecheck
```

Run the SUT:

```sh
npm run sut:start          # http://127.0.0.1:3000 (PORT=3100 to override)
```

Synthetic users (local fixtures only, see `sut/README.md`):

| username | password         |
| -------- | ---------------- |
| `alice`  | `alice-password` |
| `bob`    | `bob-password`   |

```sh
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"alice-password"}' | jq -r .token)
curl -s -X POST http://127.0.0.1:3000/items \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Widget","price":19.99,"quantity":5}'
```

State is in-memory per server instance: restarting the SUT resets all
items and tokens. There is deliberately no reset endpoint in the contract.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run harness:doctor` | Preflight environment/config checks (fails closed) |
| `npm run harness:selftest` | Negative controls proving the doctor can fail |
| `npm run contract:validate` | Fail-closed validation of `contract/openapi.yaml` (21 checks, 63 schema instances) |
| `npm run contract:selftest` | 56-case mutation self-test of the contract validator |
| `npm run sut:start` | Start the Inventory SUT |
| `npm run test:unit` | SUT unit/API tests (`node --test`, 29 cases titled by requirement ID) |
| `npm run test:api` | Playwright `APIRequestContext` suite (32 cases, fresh SUT instance per test) |
| `npm run qa:traceability` | Reconciles Playwright `--list` discovery with `qa/traceability.md` and all 28 contract requirement IDs (fails closed) |
| `npm run qa:traceability:selftest` | 9 negative controls for the traceability parser and matrix reconciliation |
| `npm run harness:eval` | Applies three controlled SUT mutations, asserts the intended test failures, restores the SUT by hash, and re-runs the 32-test baseline; optional `--reports <dir>` writes HTML/JUnit per run |
| `npm run harness:eval:selftest` | 37 negative/positive controls for mutation patching, exact expected/received semantics, HTTP-500/wrong-value rejection and restore |
| `npm run reports:verify` | Fails closed unless the API baseline, harness baselines and intentional-mutation runs have the expected JUnit counts/failing ids and HTML reports |
| `npm run reports:selftest` | 14 negative controls for the report verifier |
| `npm run typecheck` | `tsc --noEmit` (strict, `erasableSyntaxOnly`) |

## CI and reports

`.github/workflows/qa.yml` defines one sequential `quality` job on
`ubuntu-latest` with Node.js 24. It installs with `npm ci`, runs the doctor,
typecheck, contract validate/selftest, unit tests, traceability/selftest,
harness self-tests, report self-test, the 32-test API baseline with HTML/JUnit,
and `harness:eval` with HTML/JUnit reports. It then verifies the reports, checks
that `sut/src/app.ts` is byte-identical to its pre-evaluation hash (restoring
from git on mismatch), and uploads four artifacts.

Reports are deliberately separated so an intentional failure cannot be confused
with a green baseline:

```text
reports/
  api-baseline/                 # 32 tests, 0 failures
  harness-eval/
    baseline-pre/               # 32 tests, 0 failures
    baseline-post/              # 32 tests, 0 failures
    mutations/
      negative-price-accepted/          # 9 tests, 2 intended failures
      token-validation-skipped/         # 2 tests, 1 intended failure
      cross-user-authorization-bypass/  # 2 tests, 1 intended failure
```

Each directory contains `junit.xml` and `html/index.html`. The workflow uploads
`api-baseline-reports`, `harness-baseline-reports`,
`harness-mutation-reports` and `harness-eval-evidence`. `reports/` is generated
and gitignored.

**Remote status: VERIFIED.** The workflow and report pipeline pass locally and
in CI: run https://github.com/siberfaqih/api-quality-lab/actions/runs/41271870930
(SUCCESS, attempt 1, push to `main`, exact head `9dad20e`, every job step
SUCCESS) executed every gate — doctor 11/11, contract 21/21 + selftest 56/56,
unit 29/29, traceability 32/28/32 + selftest 9/9, harness self-tests 16/16 +
37/37 + 14/14, API baseline 32/32 with HTML/JUnit, `harness:eval` 3/3 with
baselines 32/32 twice and the SUT hash exact before/after, `reports:verify`
PASS — and uploaded all four artifacts. The same independent reviewer verified
the run and returned full G5 APPROVED PASS (see `reviews/AQL-500.md`).

## Project layout

```text
.github/    GitHub Actions QA workflow (AQL-500)
contract/   Normative OpenAPI 3.1 contract (source of truth, written first)
sut/        Minimal Inventory API (Node http, no dependencies) + unit tests
qa/         Playwright API tests, per-test fixtures and traceability matrix (AQL-300)
harness/    Doctor, contract validator, mutation evaluator, report verifier and self-tests
docs/       Test plan and case-study material
reviews/    Independent reviewer reports per task
reports/    Generated HTML/JUnit reports (gitignored)
evidence/   Generated run evidence (gitignored outputs, not claims)
```

## Working method (OpenCode)

1. Builder implements the next unblocked task from `TASKS.md`, runs the
   gates, records exact commands/results in `PROGRESS.md`, and sets the
   task to `REVIEW_REQUIRED`.
2. An independent reviewer audits the contract, code, tests and evidence
   without editing the worktree.
3. Builder persists the report in `reviews/<task-id>.md`, fixes blocking
   findings, and only then marks the task `DONE`.
4. Every commit that is pushed also updates this README's status.

The `.opencode` role/command files are not present in this checkout; the
workflow above is the repository contract in `AGENTS.md`.

## Quality rules

- The contract is never weakened to make a failing test pass.
- Tests assert response bodies, state changes and negatives — not only
  HTTP status codes.
- No invented coverage, CI results or findings: a gate is PASS only when a
  command was actually run and its output recorded. Remote CI is
  **NOT VERIFIED** until a real GitHub Actions run is observed.
- Synthetic credentials only; local services only; no third-party targets.
