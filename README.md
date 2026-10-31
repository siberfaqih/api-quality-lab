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
| 3 | 22+ Playwright API tests + traceability | G3 | ⬜ TODO |
| 4 | Mutation evaluation harness (3 mutants) | G4 | ⬜ TODO |
| 5 | GitHub Actions CI + HTML/JUnit reports | G5 | ⬜ TODO (no remote CI run observed yet) |
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
| `npm run typecheck` | `tsc --noEmit` (strict, `erasableSyntaxOnly`) |

## Project layout

```text
contract/   Normative OpenAPI 3.1 contract (source of truth, written first)
sut/        Minimal Inventory API (Node http, no dependencies) + unit tests
qa/         Playwright API tests — AQL-300, not started
harness/    Doctor, contract validator and (later) mutation evaluator
docs/       Test plan and case-study material
reviews/    Independent reviewer reports per task
evidence/   Generated run evidence (gitignored outputs, not claims)
```

## Working method (OpenCode)

1. Builder implements the next unblocked task from `TASKS.md`, runs the
   gates, records exact commands/results in `PROGRESS.md`, and sets the
   task to `REVIEW_REQUIRED`.
2. `/aql-review` invokes the read-only reviewer agent, which audits the
   contract, code, tests and evidence independently.
3. Builder persists the report in `reviews/<task-id>.md`, fixes blocking
   findings, and only then marks the task `DONE`.
4. Every commit that is pushed also updates this README's status.

Commands: `/aql-resume` (recover state), `/aql-next` (next task),
`/aql-review` (independent audit), `/aql-eval` (run gates, report honestly).

## Quality rules

- The contract is never weakened to make a failing test pass.
- Tests assert response bodies, state changes and negatives — not only
  HTTP status codes.
- No invented coverage, CI results or findings: a gate is PASS only when a
  command was actually run and its output recorded. Remote CI is
  **NOT VERIFIED** until a real GitHub Actions run is observed.
- Synthetic credentials only; local services only; no third-party targets.
