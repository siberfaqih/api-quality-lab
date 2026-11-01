# Progress Log

Current phase: 5 complete — AQL-500 DONE (G5 local + remote PASS, verified Actions run 41271870930)
Current task: AQL-600 TODO (not started); next unblocked implementation task
Last verified checkpoint: 2026-11-01T04:01Z — AQL-500 round-1 fix evidence `evidence/generated/aql-500-ci-20261101T0400Z/` (17 commands, all exit 0; earlier `aql-500-ci-20261101T0345Z`/`0348Z` dirs retained unedited): typecheck 0; unit 29/29; contract 21/21 + selftest 56/56; traceability 32 tests/28 requirements/32 ids + selftest 9/9; harness selftest 16/16; eval selftest 37/37; reports selftest 14/14; API baseline 32/32 with JUnit 32/0 and Playwright HTML; `harness:eval` 3/3 mutations with exact expected/received pairs, SUT `c2f33ba4…d2d7fd` before/during/after, baseline 32/32 twice; mutation JUnit 9/2, 2/1, 2/1 with the intended QA ids and exact spec inventories; `reports:verify` PASS on the real tree and FAIL (24 errors) on the reviewer's synthetic probe; workflow structural check PASS; `actionlint` 1.7.12 exit 0; contract diff empty; `npm ls` clean. Local work then committed and pushed as `9dad20e` (user-authorized); the same reviewer verified run 41271870930 (SUCCESS, exact head) and returned full G5 APPROVED PASS, so **G5 PASS local + remote and AQL-500 DONE** (see Gate G5).

## Important distinction
The OpenCode role configuration and documentation scaffold were prepared externally. As of AQL-000, `harness/doctor.ts` has actually been executed locally and its output recorded below. The local Inventory SUT and its unit tests were executed for AQL-200, and the Playwright API suite was executed for AQL-300 (journal below). The mutation harness was executed for AQL-400: all three mutations were detected at their exact expected/received semantics and the SUT was restored, but **remote GitHub Actions has still not been executed.** AQL-300's round-1 review returned CHANGES_REQUESTED; the fixes are recorded below, and round 2 returned APPROVED with G3 PASS locally, so AQL-300 is DONE. AQL-400 round 1 returned CHANGES_REQUESTED for broad assertion semantics; the fix is recorded below, and round 2 returned APPROVED with G4 PASS locally, so AQL-400 is DONE. AQL-500 (CI + HTML/JUnit reports) round 1 returned CHANGES_REQUESTED for the verifier-weakness defect; the fix is recorded below, and round 2 (same reviewer session) returned APPROVED locally with G5 local PASS and no open local blockers. After the user-authorized commit/push of `9dad20e`, the same reviewer independently verified the successful run https://github.com/siberfaqih/api-quality-lab/actions/runs/41271870930 and returned full G5 APPROVED PASS, so AQL-500 is **DONE**. (Earlier "no remote run / NOT VERIFIED" statements in this log are historical: they describe the state before the `9dad20e` push and are retained as such.)

## Execution journal
| Time (UTC) | Task | Command | Exit code | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 2026-10-31T15:15Z | OPS initial-commit+push (user-requested) | `git add -A` | 0 | PASS — staged 24 scaffold files; .DS_Store correctly ignored | `git diff --cached --stat` (24 files, +369) |
| 2026-10-31T15:15Z | OPS initial-commit+push (user-requested) | `git commit -m "chore: initial API Quality Lab scaffold ..."` | 0 | PASS — root-commit 303a91f on main | `git log --oneline -1` = 303a91f |
| 2026-10-31T15:15Z | OPS initial-commit+push (user-requested) | `gh repo create api-quality-lab --public --source=. --remote=origin` | 0 | PASS — repo created | https://github.com/siberfaqih/api-quality-lab |
| 2026-10-31T15:15Z | OPS initial-commit+push (user-requested) | `git push -u origin main` | BLOCKED (tool) | NOT VERIFIED at the time — `permission.rejected`; later confirmed pushed by user: `git status -sb` now reports `## main...origin/main` | `git status -sb` |
| 2026-10-31T08:40Z | AQL-000 | `node --version; npm --version; git --version; sw_vers; uname -m` | 0 | PASS — Node v24.19.0, npm 11.17.0, git 2.50.1, macOS 26.6.2, arm64 | terminal output in this session |
| 2026-10-31T08:41Z | AQL-000 | `node .probe.ts` (typed probe file) | 0 | PASS — `ts-strip-ok 42`; Node 24 executes TypeScript without a transpiler; probe deleted | see DECISIONS.md D006 |
| 2026-10-31T08:42Z | AQL-000 | `npm install --save-dev typescript @types/node` | 0 | PASS — 4 packages added, 0 vulnerabilities; typescript 7.0.2, @types/node 26.6.6 | `package-lock.json` |
| 2026-10-31T08:43Z | AQL-000 | `npm run harness:doctor` | 0 | PASS — 11 pass, 0 warn, 0 fail (node, npm, git, worktree, required files/dirs, gitignore rules, no tracked `.env`, engines, tsconfig, typescript) | `evidence/generated/doctor-aql-000.json` (gitignored) |
| 2026-10-31T08:43Z | AQL-000 | `node harness/doctor.ts --min-node-major=99` | 1 | PASS (negative control) — doctor correctly reports `[FAIL] runtime.node` and exits 1, proving failure detection is live | terminal output |
| 2026-10-31T08:43Z | AQL-000 | `node harness/doctor.ts --json` | 0 | PASS — valid JSON; `summary = {pass:11,warn:0,fail:0}`, `checks = 11` | `evidence/generated/doctor-aql-000.json` |
| 2026-10-31T08:43Z | AQL-000 | `npm run typecheck` | 0 | PASS — `tsc --noEmit` clean under strict + nodenext + verbatimModuleSyntax | terminal output |
| 2026-10-31T08:44Z | AQL-000 | `npm ls --depth=0` | 0 | PASS — dependency tree valid (@types/node, typescript) | terminal output |
| 2026-10-31T08:44Z | AQL-000 | `git check-ignore -v node_modules evidence/generated/doctor-aql-000.json` | 0 | PASS — both ignored by `.gitignore` rules (lines 1 and 12) | terminal output |
| 2026-10-31T08:46Z | AQL-000 (review fix) | `npm install --save-dev semver @types/semver` | 0 | PASS — semver 7.8.5, 0 vulnerabilities | `package-lock.json` |
| 2026-10-31T08:47Z | AQL-000 (review fix) | `npm run harness:selftest` | 0 | PASS — 16/16 cases; both reviewer regressions (`">=24.0.0 \|\| >=18.0.0"`, `"garbage >=24"`) rejected | terminal output; `harness/doctor.selftest.ts` |
| 2026-10-31T08:47Z | AQL-000 (review fix) | doctor with `engines.node = ">=24.0.0 \|\| >=18.0.0"` (temp edit, restored) | 1 | PASS (negative control) — `[FAIL] config.package-engines`, `1 fail`; package.json restored byte-identical (sha256 match) | `/tmp/aql-neg1.txt` |
| 2026-10-31T08:47Z | AQL-000 (review fix) | doctor with `engines.node = "garbage >=24"` (temp edit, restored) | 1 | PASS (negative control) — `[FAIL] config.package-engines`, `1 fail`; restore verified by sha256 | `/tmp/aql-neg2.txt` |
| 2026-10-31T08:47Z | AQL-000 (review fix) | `npx tsc --noEmit` with `enum` probe file | 1 | PASS (negative control) — `error TS1294 ... not allowed when 'erasableSyntaxOnly' is enabled`; probe removed | terminal output |
| 2026-10-31T08:48Z | AQL-000 (review fix) | `npm run harness:doctor` (after restore) | 0 | PASS — 11 pass, 0 warn, 0 fail | `/tmp/aql-pos.txt` |
| 2026-10-31T08:48Z | AQL-000 (review fix) | `npm run typecheck` | 0 | PASS — clean with `erasableSyntaxOnly` + `esModuleInterop` added | `/tmp/aql-tc.txt` |
| 2026-10-31T08:50Z | AQL-000 | Independent review round 2 (reviewer subagent, same session) | APPROVED | PASS — all 3 findings resolved; reviewer reran doctor 11/11, selftest 16/16, typecheck 0, extra range assertions, enum control; G0 verified locally; remote CI NOT VERIFIED | `reviews/AQL-000.md` |
| 2026-10-31T08:52Z | AQL-000 | `git status --short; ls harness/` (final tree check) | 0 | PASS — no stray probe files; 4 tracked modifications + 7 untracked additions, none committed | terminal output |
| 2026-10-31T08:52Z | AUDIT (post-DONE, user-requested) | `npm run`; `npm run harness:doctor`; `npm run harness:selftest`; `npm run typecheck` | 0,0,0,0 | PASS — 3 of 3 existing scripts executed successfully | `evidence/generated/aql-scripts-20261031T0852Z/` |
| 2026-10-31T08:52Z | AUDIT (post-DONE, user-requested) | `npm run test`; `test:unit`; `test:api`; `harness:eval`; `lint` | 1 each | BLOCKED — `npm error Missing script` for all five; recorded as absent, not as failing tests | same evidence dir, `absent-*.log` |
| 2026-10-31T09:13Z | AQL-100 | `git status --porcelain`; `npm run harness:doctor`; `harness:selftest`; `typecheck` | 0,0,0,0 | PASS — resume baseline: clean tree at `f82a0c8`; doctor 11 pass, selftest 16 pass, typecheck clean; AQL-000 checkpoint reconfirmed | terminal output |
| 2026-10-31T09:16Z | AQL-100 | `npm install --save-dev yaml@2.9.1 @apidevtools/swagger-parser@13.1.0` | 0 | PASS — 16 packages added, 0 vulnerabilities; local YAML parse + OpenAPI 3.1 meta-schema validation with no runtime network | `package.json`, `package-lock.json` |
| 2026-10-31T09:17Z | AQL-100 | `npm run contract:validate` (first run) | 1 | FAIL (tool defect, not contract) — `contract.operations` reported all seven operations "missing" because the new checker compared uppercase labels against lowercase method keys; contract itself had passed structure/security/requirement checks | terminal output |
| 2026-10-31T09:17Z | AQL-100 (fix) | `npm run typecheck`; `npm run contract:validate` | 0,0 | PASS — case bug fixed; 15/15 checks pass | `evidence/generated/aql-100-contract-20261031T0917Z/` |
| 2026-10-31T09:17Z | AQL-100 | `node harness/contract-check.ts --json` | 0 | PASS — `ok=true`, summary `{pass:15,fail:0}` | evidence dir, `contract-validate.json` |
| 2026-10-31T09:17Z | AQL-100 | `npm run contract:selftest` | 0 | PASS — 24/24; baseline accepted, 23 targeted mutations rejected for the intended rule (3.1 downgrade, dropped security, dropped 401/Location/challenge, unknown/duplicate/unused requirement, external server, permissive schema, weakened bounds, 204 with body, wrong media type, status-mismatched and orphan error codes, empty registry) | evidence dir, `contract-selftest.log` |
| 2026-10-31T09:18Z | AQL-100 | `npm run typecheck` | 0 | PASS — strict + nodenext + verbatimModuleSyntax + erasableSyntaxOnly, no diagnostics | evidence dir, `typecheck.log` |
| 2026-10-31T09:18Z | AQL-100 (regression) | `npm run harness:doctor` | 0 | PASS — 11 pass, 0 warn, 0 fail after adding contract files | evidence dir, `doctor.log` |
| 2026-10-31T09:18Z | AQL-100 (regression) | `npm run harness:selftest` | 0 | PASS — 16 pass, 0 fail | evidence dir, `harness-selftest.log` |
| 2026-10-31T09:21Z | AQL-100 | Independent review round 1 (reviewer subagent `ses_e6ebf0dfcffdnQiMXMTgC6G4p0`) | CHANGES_REQUESTED | FAIL — 5 MEDIUM findings: name/PATCH normative ambiguity; six contract weakenings the validator accepted; incomplete operation-set and server-override checks; self-test did not assert the intended failing rule; requirement applicability incomplete | `reviews/AQL-100.md` |
| 2026-10-31T09:23Z | AQL-100 (review fix) | `npm run typecheck` | 0 | PASS — after expanding rule set and self-test | terminal output |
| 2026-10-31T09:24Z | AQL-100 (review fix) | `npm run contract:validate` | 0 | PASS — 18 checks: new `contract.requests`, `contract.error-coverage`, `contract.error-schema`; PATCH/Item bounds; exact `appliesTo` matrix; all-method operation set; path/operation server overrides rejected | `evidence/generated/aql-100-contract-r2-20261031T0925Z/contract-validate.log` |
| 2026-10-31T09:25Z | AQL-100 (review fix) | `npm run contract:selftest` | 0 | PASS — 36/36; every reject case now declares `expectFailCheck` and the runner asserts that exact check failed; regression controls added for all six reviewer-reproduced weakenings, server overrides, extra `PUT`, applicability drift and name pattern | evidence dir r2, `contract-selftest.log` |
| 2026-10-31T09:25Z | AQL-100 (review fix) | `node harness/contract-check.ts --json` | 0 | PASS — `ok=true`, summary `{pass:18,fail:0}` | evidence dir r2, `contract-validate.json` |
| 2026-10-31T09:25Z | AQL-100 (regression) | `npm run harness:doctor`; `npm run harness:selftest` | 0,0 | PASS — 11/11 and 16/16 after contract changes | evidence dir r2, `doctor.log`, `harness-selftest.log` |
| 2026-10-31T09:31Z | AQL-100 | Independent review round 2 (same reviewer session `ses_e6ebf0dfcffdnQiMXMTgC6G4p0`) | CHANGES_REQUESTED | FAIL — round-1 reproductions fixed (6/6 now fail at intended check), but 5 new findings: R2-1 type/effective-boundary gaps, R2-2 header/media/conditional gaps, R2-3 malformed global appliesTo, R2-4 check-ID causal-attribution limit, R2-5 stale README/PROGRESS wording | `reviews/AQL-100.md` (round-2 verbatim) |
| 2026-10-31T09:32Z | AQL-100 (review fix) | `npm install --save-dev ajv@8.17.1` | 0 | PASS — AJV 2020-12 added for effective-schema instance checks; 0 vulnerabilities | `package.json`, `package-lock.json` |
| 2026-10-31T09:32Z | AQL-100 (review fix) | `npm run typecheck` | 0 | PASS — after AJV instance checks + header/example/strict-appliesTo/diagnostic assertions | terminal output |
| 2026-10-31T09:32Z | AQL-100 (review fix) | `npm run contract:validate` | 0 | PASS — 21 checks: new `contract.headers`, `contract.examples`, `contract.instances` (40 AJV probes); strict `appliesTo` array; JSON-only bodies; exact Problem conditional | `evidence/generated/aql-100-contract-r3-20261031T0932Z/contract-validate.log` |
| 2026-10-31T09:32Z | AQL-100 (review fix) | `npm run contract:selftest` | 0 | PASS — 49/49 (1 baseline + 48 negative); every reject asserts `expectFailCheck`, targeted subrules also assert `expectFailDetail`; 13 new R2 regression controls | evidence dir r3, `contract-selftest.log` |
| 2026-10-31T09:32Z | AQL-100 (review fix) | `node harness/contract-check.ts --json` | 0 | PASS — `ok=true`, summary `{pass:21,fail:0}` | evidence dir r3, `contract-validate.json` |
| 2026-10-31T09:32Z | AQL-100 (review fix) | builder in-memory probe of 11 R2 mutations (4× type/bounds, 4× header/media/conditional, malformed appliesTo, example mismatch, + 1 more) | 0 | PASS — all 11 REJECTED at the intended check (`contract.instances`, `contract.boundaries`, `contract.headers`, `contract.requests`, `contract.error-schema`, `contract.requirement-registry`, `contract.examples`) | evidence dir r3, `builder-independent-mutation-probe.log` |
| 2026-10-31T09:32Z | AQL-100 (regression) | `npm run harness:doctor`; `npm run harness:selftest`; `npm run typecheck` | 0,0,0 | PASS — 11/11, 16/16, 0 diagnostics after contract changes | evidence dir r3, `doctor.log`, `harness-selftest.log`, `typecheck.log` |
| 2026-10-31T09:33Z | AQL-100 | Independent review round 3 (same reviewer session `ses_e6ebf0dfcffdnQiMXMTgC6G4p0`) | CHANGES_REQUESTED | FAIL — round-2 reproductions fixed (63-instance wording aside, all prior mutations now fail with relevant diagnostics), but 2 new MEDIUM findings: R3-1 operation-level header references bypass component checks; R3-2 operation-level `$ref`-sibling schemas + PATCH max-price/field-type gaps, docs overclaim 40-instance universality | `reviews/AQL-100.md` (round-3 verbatim) |
| 2026-10-31T09:40Z | AQL-100 (review fix) | `npm run typecheck` | 0 | PASS — after header-reference + sibling + operation-instance fixes | terminal output |
| 2026-10-31T09:40Z | AQL-100 (review fix) | `npm run contract:validate` | 0 | PASS — 21 checks; `contract.headers` enforces exact header refs at each applicable response, `contract.requests`/`contract.success-shapes` reject `$ref` siblings, `contract.instances` 63 probes (component + POST /items operation schemas) | `evidence/generated/aql-100-contract-r4-20261031T0940Z/contract-validate.log` |
| 2026-10-31T09:40Z | AQL-100 (review fix) | `npm run contract:selftest` | 0 | PASS — 56/56 (1 baseline + 55 negative); 7 new R3 regression controls with `expectFailDetail` | evidence dir r4, `contract-selftest.log` |
| 2026-10-31T09:40Z | AQL-100 (review fix) | `node harness/contract-check.ts --json` | 0 | PASS — `ok=true`, summary `{pass:21,fail:0}` | evidence dir r4, `contract-validate.json` |
| 2026-10-31T09:40Z | AQL-100 (review fix) | builder in-memory probe of 7 R3 mutations (3× header usage, 2× `not:{}` siblings, PATCH max + numeric desc) | 0 | PASS — all 7 REJECTED at intended checks (`contract.headers`, `contract.requests`, `contract.success-shapes`, `contract.instances`) | evidence dir r4, `builder-r3-mutation-probe.log` |
| 2026-10-31T09:40Z | AQL-100 (regression) | `npm run harness:doctor`; `npm run harness:selftest` | 0,0 | PASS — 11/11 and 16/16 after contract changes | evidence dir r4, `doctor.log`, `harness-selftest.log` |
| 2026-10-31T09:41Z | AQL-100 | Independent review round 4 (same reviewer session `ses_e6ebf0dfcffdnQiMXMTgC6G4p0`) | CHANGES_REQUESTED (evidence only) | PASS on implementation (7/7 R3 mutations rejected at intended checks, 63 instances, docs scoped); FAIL on evidence — `contract-validate.json` in r4 mixes 6 AJV stderr warnings + JSON, whole-file `JSON.parse` fails; CLI itself outputs valid JSON when streams separated | `reviews/AQL-100.md` (round-4 verbatim) |
| 2026-10-31T09:47Z | AQL-100 (evidence fix) | `node harness/contract-check.ts --json > contract-validate.json 2> contract-validate.stderr.log` | 0 | PASS — `contract-validate.json` is pure JSON; 6 `unknown format` warnings isolated in `contract-validate.stderr.log` | `evidence/generated/aql-100-contract-r5-20261031T0947Z/contract-validate.json`, `.stderr.log` |
| 2026-10-31T09:47Z | AQL-100 (evidence fix) | `node -e 'JSON.parse(readFileSync(json))'` whole-file strict check | 0 | PASS — `JSON.parse OK: pass=21 fail=0 ok=true checks=21` | evidence dir r5, `json-parse-check.log` |
| 2026-10-31T09:47Z | AQL-100 (evidence fix) | `npm run contract:validate`; `npm run contract:selftest`; `npm run typecheck`; `npm run harness:doctor`; `npm run harness:selftest` (separated streams) | 0,0,0,0,0 | PASS — 21/21, 56/56, 0 diagnostics, 11/11, 16/16; no code change from r4 | evidence dir r5, `*.log` + `*.stderr.log` + `exit-codes.txt` |
| 2026-10-31T09:48Z | AQL-100 | Independent verification round 5 (same reviewer session `ses_e6ebf0dfcffdnQiMXMTgC6G4p0`) | APPROVED | PASS — whole-file JSON.parse OK (21/0/true/21), stderr has exactly 6 AJV warnings, 21/56/0/11/16 reruns match; no open blocking findings; G1 PASS locally | `reviews/AQL-100.md` (round-5 verbatim) |
| 2026-10-31T09:48Z | AQL-100 | Mark DONE (gates passed + APPROVED + evidence recorded) | — | DONE — TASKS.md AQL-100 REVIEW_REQUIRED → DONE; next unblocked task AQL-200 TODO | `TASKS.md`, `reviews/AQL-100.md` |
| 2026-10-31T10:54Z | AQL-200 (resume) | `npm install --no-audit --no-fund` | 0 | PASS — `node_modules/` had been deleted (7 UNMET DEPENDENCY); 22 packages restored; no tracked file changed | terminal output; `npm ls --depth=0` clean after install |
| 2026-10-31T10:58Z | AQL-200 | `npm run test:unit` | 0 | PASS — 22/22 SUT tests (health, login, auth negatives, CRUD, pagination, isolation, validation boundaries, problem format, reset) | terminal output |
| 2026-10-31T10:58Z | AQL-200 | `PORT=3107 node sut/src/server.ts` + `curl /health`, login, create, list; `kill -TERM` | 0 | PASS — health 200 `{"status":"ok","version":"1.0.0"}`, create/list round-trip, SIGTERM stops server (subsequent curl exit 7 refused) | `/private/var/.../T/opencode/sut-smoke.log` |
| 2026-10-31T10:59Z | AQL-200 | `npm run test:unit` ×2; `typecheck`; `contract:validate`; `contract:selftest`; `harness:doctor`; `harness:selftest` | 0,0,0,0,0,0,0 | PASS — unit 22/22 twice, 0 diagnostics, 21/21, 56/56, 11/11, 16/16 | `evidence/generated/aql-200-sut-20261031T1059Z/` (`*.log`, `exit-codes.txt`, `environment.txt`) |
| 2026-10-31T11:10Z | AQL-200 | Independent review round 1 (reviewer subagent `ses_e6e61ef7affd5sQUlo4cVS1JiF`) | CHANGES_REQUESTED | FAIL — all six Builder commands rerun PASS by reviewer, plus independent curl probes; 4 MEDIUM contract defects reproduced (Unicode length, price precision, offset overflow, empty FieldError) + 2 LOW (test strength, stale docs) | `reviews/AQL-200.md` (round-1 verbatim) |
| 2026-10-31T11:15Z | AQL-200 (review fix) | `npm run test:unit` ×2; `typecheck`; `contract:validate`; `contract:selftest`; `harness:doctor`; `harness:selftest` | 0,0,0,0,0,0,0 | PASS — unit 29/29 twice (7 new regression/strengthened cases for R1–R5), other gates unchanged | `evidence/generated/aql-200-sut-r2-20261031T1115Z/` |
| 2026-10-31T11:16Z | AQL-200 (review fix) | `PORT=3108 node sut/src/server.ts` + `curl /health`; `kill -TERM` | 0 | PASS — health 200, SIGTERM stop verified (curl exit 7 after) | `/private/var/.../T/opencode/sut-smoke2.log` |
| 2026-10-31T11:20Z | AQL-200 | Independent re-review round 2 (same reviewer session `ses_e6e61ef7affd5sQUlo4cVS1JiF`) | APPROVED | PASS — R1–R4 verified resolved by independent HTTP probes (port 51399), all six commands rerun PASS (29/21/56/11/16), SIGTERM stop verified; 2 LOW non-blocking observations (coverage breadth, stale 22-counts) | `reviews/AQL-200.md` (round-2 verbatim) |
| 2026-10-31T11:25Z | AQL-200 (post-approval corrections) | `npm run test:unit` ×2; `typecheck`; `contract:validate`; `contract:selftest`; `harness:doctor`; `harness:selftest` | 0,0,0,0,0,0,0 | PASS — unit 29/29 twice after R2-1 coverage extensions (same test count, broader assertions) and R2-2 count corrections; contract diff empty | `evidence/generated/aql-200-sut-r3-20261031T1125Z/` |
| 2026-10-31T11:25Z | AQL-200 | Mark DONE (gates passed + APPROVED + evidence recorded) | — | DONE — TASKS.md AQL-200 REVIEW_REQUIRED → DONE; next unblocked task AQL-300 TODO | `TASKS.md`, `reviews/AQL-200.md` |
| 2026-10-31T23:05Z | AQL-300 | Read `AGENTS.md`, `PLAN.md`, `TASKS.md`, `PROGRESS.md`, `EVALUATION.md`, `DECISIONS.md`, `contract/openapi.yaml`; inspected `git status` | 0 | PASS — baseline understood; user deletions of `.opencode/agents/*`, `.opencode/commands/*` and `opencode.json` preserved, not restored | terminal output; `git status --short` |
| 2026-10-31T23:10Z | AQL-300 | `npm install --save-dev @playwright/test@1.64.1` | 0 | PASS — 3 packages added, 0 vulnerabilities; no browser download required for `APIRequestContext` | `package.json`, `package-lock.json`, `npm ls --depth=0` |
| 2026-10-31T23:18Z | AQL-300 | `npm run typecheck` (first run) | 1 | FAIL (test-code type defect) — `qa/tests/isolation.spec.ts:55` union of `{limit}`/`{offset}` not assignable to `Record<string, string \| number>`; fixed by typing the query list explicitly | terminal output |
| 2026-10-31T23:19Z | AQL-300 | `npm run typecheck` (after fix) | 0 | PASS — strict `tsc --noEmit`, no diagnostics | terminal output |
| 2026-10-31T23:22Z | AQL-300 | `npm run test:api` (first suite run) | 1 | FAIL (test-harness input defect, not SUT) — 29/32 passed; QA-AUTH-05, QA-ERR-01 and QA-VAL-06 expected `malformed_json` but Playwright serialized the raw string `data` as a JSON string, so the SUT correctly returned `validation_failed`; fixed by sending `Buffer.from(...)` for malformed and empty bodies | terminal output |
| 2026-10-31T23:24Z | AQL-300 | `npm run test:api` (after fix) | 0 | PASS — 32/32 | terminal output |
| 2026-10-31T23:28Z | AQL-300 | `npm run test:api` ×2; `npx playwright test --shuffle=20261101 --workers=4 --fully-parallel`; `npx playwright test --shuffle=20261102 --workers=4 --fully-parallel` | 0,0,0,0 | PASS — 32/32 twice with 1 worker; 32/32 shuffled and parallel with both seeds; every test gets a fresh in-process SUT on an ephemeral port | `evidence/generated/aql-300-qa-20261031T2328Z/api-run1.log`, `api-run2.log`, `api-shuffle-seed-20261101.log`, `api-shuffle-seed-20261102.log`, `api-list.log` |
| 2026-10-31T23:28Z | AQL-300 | `npm run qa:traceability`; `npm run qa:traceability -- --json` | 0,0 | PASS — 32 tests, 28/28 requirements covered, 32 unique QA ids, matrix current, `ok=true` | evidence dir, `traceability.log`, `traceability-json.log` |
| 2026-10-31T23:28Z | AQL-300 (regression) | `npm run typecheck`; `npm run test:unit`; `npm run contract:validate`; `npm run contract:selftest`; `npm run harness:doctor`; `npm run harness:selftest`; `git diff --exit-code -- contract/openapi.yaml` | 0,0,0,0,0,0,0 | PASS — typecheck 0, unit 29/29, contract 21/21, contract selftest 56/56, doctor 11/11, harness selftest 16/16, contract diff empty | evidence dir, corresponding `*.log`, `*.stderr.log`, `exit-codes.txt` |
| 2026-10-31T23:29Z | AQL-300 | TASKS.md AQL-300 TODO → IN_PROGRESS → REVIEW_REQUIRED | — | REVIEW_REQUIRED — implementation and local G3 checks pass; independent review pending; not DONE | `TASKS.md`, this log |
| 2026-10-31T23:32Z | AQL-300 (final evidence rerun after strengthening the no-leak test and matrix-row traceability check) | `npm run test:api` ×2; shuffled 4-worker seeds 20261101/20261102; `qa:traceability`; `typecheck`; `test:unit`; `contract:validate`; `contract:selftest`; `doctor`; `harness:selftest`; `git diff --exit-code -- contract/openapi.yaml` | 0 across all 16 commands | PASS — final evidence: 32/32 twice, 32/32 shuffled/parallel both seeds, 28/28 requirements, typecheck 0, unit 29/29, contract 21/21 + 56/56, doctor 11/11, harness selftest 16/16, contract diff empty | `evidence/generated/aql-300-qa-final-20261031T2332Z/` (`*.log`, `*.stderr.log`, `exit-codes.txt`, `environment.txt`) |
| 2026-10-31T23:34Z | AQL-300 (full evidence rerun after the fixture `try`-scope hardening so the SUT closes if `newContext` fails) | Same 16-command evidence set as the 23:32Z run, including two normal runs and two shuffled 4-worker runs | 0 across all 16 commands | PASS — current tree: 32/32 twice, 32/32 shuffled/parallel both seeds, 32 tests in 8 files, 28/28 requirements, typecheck 0, unit 29/29, contract 21/21 + 56/56, doctor 11/11, harness selftest 16/16, contract diff empty | `evidence/generated/aql-300-qa-final-20261031T2334Z/` (`*.log`, `*.stderr.log`, `exit-codes.txt`, `environment.txt`) |
| 2026-11-01 | AQL-300 | Independent review returned CHANGES_REQUESTED (session `ses_e6baf06ffffeO2nQ0BQyLCHkBS`); persisted review to `reviews/AQL-300.md`; TASKS.md REVIEW_REQUIRED → IN_PROGRESS | — | CHANGES_REQUESTED — MEDIUM 1 create/update validation equivalence, MEDIUM 2 404 status assertions, MEDIUM 3 deterministic tie, LOW discovery-based traceability; G3 not approved | `reviews/AQL-300.md`, `TASKS.md`, this log |
| 2026-10-31T23:48Z | AQL-300 (all review findings fixed; first post-fix evidence set) | Same 17-command set as the 23:52Z run | 0 across all 17 commands | PASS at the time; superseded by the 23:52Z run because QA-LIST-02 gained `total`/`items.length` assertions afterwards | `evidence/generated/aql-300-qa-review-fixes-20261031T2348Z/` (`*.log`, `*.stderr.log`, `exit-codes.txt`, `environment.txt`) |
| 2026-10-31T23:52Z | AQL-300 (final post-fix evidence rerun, including the QA-LIST-02 `total`/`items.length` assertions added after the 23:48Z run) | `npm run test:api` ×2; shuffled 4-worker seeds 20261101/20261102; `qa:traceability`; `qa:traceability --json`; `qa:traceability:selftest`; `typecheck`; `test:unit`; `contract:validate`; `contract:selftest`; `doctor`; `harness:selftest`; `git diff --exit-code -- contract/openapi.yaml`; `npm ls` | 0 across all 17 commands | PASS — 32/32 twice, 32/32 shuffled/parallel both seeds, 32 executable tests via Playwright discovery, 28/28 requirements, 9/9 traceability negative controls, typecheck 0, unit 29/29, contract 21/21 + 56/56, doctor 11/11, harness selftest 16/16, contract diff empty | `evidence/generated/aql-300-qa-review-fixes-20261031T2352Z/` (`*.log`, `*.stderr.log`, `exit-codes.txt`, `environment.txt`) |
| 2026-11-01 | AQL-300 | Independent re-review round 2 (same reviewer session `ses_e6baf06ffffeO2nQ0BQyLCHkBS`) | Reviewer: test:api twice 32/32; shuffle seed 20261101 fully parallel workers 4 32/32; qa:traceability 32/28/32; selftest 9/9; typecheck 0; unit 29/29; contract 21/21 + 56/56; contract diff unchanged; clock probe PASS | **APPROVED** — all four round-1 findings resolved; G3 meaningful tests PASS, trace PASS, two runs PASS, order independence PASS, assertion integrity PASS, unchanged contract/regressions PASS; G3 PASS locally | `reviews/AQL-300.md` (round-2 faithful summary, not verbatim), this log |
| 2026-11-01 | AQL-300 | Mark DONE (gate PASS + APPROVED + evidence recorded) | — | DONE — TASKS.md AQL-300 REVIEW_REQUIRED → DONE; next unblocked task AQL-400 TODO (not started); no commit or push | `TASKS.md`, `reviews/AQL-300.md` |
| 2026-11-01T03:10Z | AQL-400 | `npm run typecheck`; `npm run harness:eval:selftest`; `npm run harness:eval -- --evidence evidence/generated/aql-400-dev-20261101T0310Z` (development run) | 0, 0, 1 | FAIL (harness input defect, not SUT) — 3 mutations were applied and restored, but the failure signatures did not match: Playwright's JSON messages contain ANSI color escapes and the QA-VAL-07 signature was `expected a FieldError for price` instead of its actual `toBeGreaterThanOrEqual` assertion. Fixed by stripping ANSI before matching and pinning QA-VAL-07 to `toBeGreaterThanOrEqual`; no test or contract was changed. Superseded evidence directory removed after the fix. | terminal output |
| 2026-11-01T03:14Z | AQL-400 | Final evidence set (14 commands): `npm run typecheck`; `npm run harness:eval:selftest`; `npm run harness:eval -- --evidence <dir>/eval`; `npm run test:api`; `npm run test:unit`; `npm run contract:validate`; `npm run contract:selftest`; `npm run qa:traceability`; `npm run qa:traceability:selftest`; `npm run harness:doctor`; `npm run harness:selftest`; `git diff --exit-code -- contract/openapi.yaml`; `git status --short`; `npm ls --depth=0` | 0 across all 14 commands | PASS — harness selftest 22/22; harness:eval 3/3 mutations detected (`negative-price-accepted` → QA-VAL-02 + QA-VAL-07, `token-validation-skipped` → QA-AUTHZ-02, `cross-user-authorization-bypass` → QA-ISO-01), intended assertion signatures matched, SUT sha256 `c2f33ba4…` restored before and after, baseline-pre and baseline-post 32/32; test:api 32/32, unit 29/29, contract 21/21 + 56/56, traceability 32/28/32 + 9/9, doctor 11/11, harness selftest 16/16, contract diff empty, `npm ls` clean | `evidence/generated/aql-400-g4-20261101T0314Z/` (`*.log`, `*.stderr.log`, `exit-codes.txt`, `environment.txt`, `eval/summary.json`, `eval/*.log`, `eval/command-exit-codes.txt`, `eval/environment.txt`) |
| 2026-11-01 | AQL-400 | TASKS.md AQL-400 IN_PROGRESS → REVIEW_REQUIRED | — | REVIEW_REQUIRED — implementation and local G4 checks pass; independent review pending; not DONE; AQL-500 remains TODO | `TASKS.md`, this log |
| 2026-11-01 | AQL-400 | Independent review round 1 (reviewer session `ses_e6baf06ffffeO2nQ0BQyLCHkBS`) | Reviewer: selftest 22/22; typecheck 0; harness:eval `evidence/generated/aql-400-review-20261101/eval` baseline 32/32 twice, mutations had valid actual semantic outcomes, SUT restored `c2f33ba4…d2d7fd`; unit 29/29; traceability 32/28; contract 21/21; `npm ls` clean | **CHANGES_REQUESTED** — MEDIUM: broad assertion substrings accept HTTP 500 and wrong expected/received values; synthetic probe with expected ids plus negative-price HTTP 500 was accepted (`accepted: true`, `errors: []`); `CRASH_MARKERS` insufficient. G4 FAIL; other checked gates PASS. No reviewer edits, commits or pushes; remote CI NOT VERIFIED. | `reviews/AQL-400.md`, this log |
| 2026-11-01 | AQL-400 | TASKS.md AQL-400 REVIEW_REQUIRED → IN_PROGRESS | — | IN_PROGRESS — persist review, strengthen precise expected/received semantics, add HTTP-500/wrong-value negative controls, regenerate evidence; not DONE | `TASKS.md`, `reviews/AQL-400.md`, this log |
| 2026-11-01T03:27Z | AQL-400 (round-1 fix) | `npm run typecheck`; `npm run harness:eval:selftest`; `npm run harness:eval -- --evidence evidence/generated/aql-400-fix-dev-20261101T0327Z` (development run) | 0, 0, 0 | PASS — `evaluateMutationRun` now requires the exact Playwright `Expected:`/`Received:` pair (400→201, >=3→2, 401→200, 404→200), rejects HTTP 500 and missing/ambiguous values, and expands crash markers; QA-AUTHZ-02 now asserts status 401 before the challenge header; selftest 37/37 including HTTP-500 and wrong-received negatives for all four expected QA ids; harness dev run 3/3 with exact pairs and restore | terminal output; superseded dev evidence removed |
| 2026-11-01T03:28Z | AQL-400 (round-1 fix, final evidence) | Final evidence set (14 commands): `npm run typecheck`; `npm run harness:eval:selftest`; `npm run harness:eval -- --evidence <dir>/eval`; `npm run test:api`; `npm run test:unit`; `npm run contract:validate`; `npm run contract:selftest`; `npm run qa:traceability`; `npm run qa:traceability:selftest`; `npm run harness:doctor`; `npm run harness:selftest`; `git diff --exit-code -- contract/openapi.yaml`; `git status --short`; `npm ls --depth=0` | 0 across all 14 commands | PASS — selftest 37/37; harness:eval 3/3 with exact expected/received pairs (`QA-VAL-02` 400→201, `QA-VAL-07` >=3→2, `QA-AUTHZ-02` 401→200, `QA-ISO-01` 404→200), SUT sha256 `c2f33ba4…` restored before and after, baseline 32/32 twice; test:api 32/32, unit 29/29, contract 21/21 + 56/56, traceability 32/28/32 + 9/9, doctor 11/11, harness selftest 16/16, contract diff empty, `npm ls` clean | `evidence/generated/aql-400-g4-r2-20261101T0328Z/` (`*.log`, `*.stderr.log`, `exit-codes.txt`, `environment.txt`, `eval/summary.json`, `eval/*.log`, `eval/command-exit-codes.txt`, `eval/environment.txt`) |
| 2026-11-01 | AQL-400 | TASKS.md AQL-400 IN_PROGRESS → REVIEW_REQUIRED | — | REVIEW_REQUIRED — round-1 finding fixed and fresh evidence passes; independent re-review pending; not DONE; AQL-500 remains TODO | `TASKS.md`, `reviews/AQL-400.md`, this log |
| 2026-11-01 | AQL-400 | Independent re-review round 2 (reviewer session `ses_e6baf06ffffeO2nQ0BQyLCHkBS`) | Reviewer: selftest 37/37; typecheck 0; fresh harness:eval PASS with baseline 32/32 before and after; mutations exit 1 at QA-VAL-02 400→201 + QA-VAL-07 >=3→2, QA-AUTHZ-02 401→200, QA-ISO-01 404→200; per-mutation restore PASS; pre/post sha256 `c2f33ba4…d2d7fd`; unit 29/29; contract 21/21; traceability 32/28; contract diff unchanged; independent evidence `evidence/generated/aql-400-review-r2-20261101/eval/` matched the supplied `aql-400-g4-r2-20261101T0328Z` evidence | **APPROVED** — G4 PASS locally, no open blockers. Exact signature + unique Expected/Received + mutation-specific pairs verified; HTTP 500/wrong/missing/ambiguous rejected; QA-AUTHZ-02 status-before-header valid; 37 self-tests and independent adversarial probes PASS. No reviewer edits, commits or pushes; external changes preserved; remote CI NOT VERIFIED. | `reviews/AQL-400.md`, this log |
| 2026-11-01 | AQL-400 | TASKS.md AQL-400 REVIEW_REQUIRED → DONE | — | DONE — round-2 independent review APPROVED with G4 PASS locally; no implementation after the reviewer run; AQL-500 remains TODO and has not started | `TASKS.md`, `README.md`, `reviews/AQL-400.md`, this log |
| 2026-11-01 | AQL-500 | TASKS.md AQL-500 TODO → IN_PROGRESS; added `.github/workflows/qa.yml`, `harness/report-check.ts`, `--reports` support in `harness/eval.ts`, `reports:verify` / `reports:selftest` scripts, `reports/` ignore rule | — | IN_PROGRESS — one sequential CI job, HTML/JUnit per run, separate baseline/mutation report directories, report verifier, artifact uploads, hash-based SUT restore check | `TASKS.md`, `.github/workflows/qa.yml`, `harness/report-check.ts`, `harness/eval.ts`, `package.json`, `.gitignore` |
| 2026-11-01 | AQL-500 (development probe) | Playwright reporter probe with `PLAYWRIGHT_JUNIT_OUTPUT_NAME` and `--reporter=json,html,junit` | 0 | DEFECT FOUND (tooling usage, not product) — JUnit output was written relative to the Playwright config directory (`qa/evidence/...`) because that variable names a file inside the default output directory. Fixed by using `PLAYWRIGHT_JUNIT_OUTPUT_FILE` with an absolute path; HTML/JUnit/JSON then landed in the requested report directory and the probe tree was removed. | `evidence/generated/reporter-probe*/` (development probes, superseded) |
| 2026-11-01 | AQL-500 (workflow hardening) | `actionlint` 1.7.12 on `.github/workflows/qa.yml`; replaced the post-eval `git diff` check with a pre/post SHA-256 comparison recorded in `$RUNNER_TEMP` | 0 | PASS — workflow parses cleanly; the hash check verifies byte-for-byte SUT restoration without depending on a clean worktree (the local tree legitimately carries uncommitted AQL-300 changes) and still restores from git on mismatch | `.github/workflows/qa.yml`, terminal output |
| 2026-11-01T03:45Z | AQL-500 (final local CI-readiness evidence) | `npm run harness:doctor`; `typecheck`; `contract:validate`; `contract:selftest`; `test:unit`; `qa:traceability`; `qa:traceability:selftest`; `harness:selftest`; `harness:eval:selftest`; `reports:selftest`; API baseline with `--reporter=list,html,junit`; `harness:eval -- --evidence <dir>/eval --reports <dir>/reports/harness-eval`; `reports:verify -- --reports <dir>/reports`; `actionlint`; `git diff --exit-code -- contract/openapi.yaml`; `git status --short`; `npm ls --depth=0` | 0 across all 16 recorded commands | PASS (local) — doctor 11/11; unit 29/29; contract 21/21 + 56/56; traceability 32 tests/28 requirements/32 ids + selftest 9/9; harness selftest 16/16; eval selftest 37/37; reports selftest 8/8; API baseline 32/32 with JUnit 32/0 and HTML; harness:eval 3/3 mutations with exact pairs, SUT restored `c2f33ba4…d2d7fd`, baseline 32/32 twice; mutation JUnit counts 9/2, 2/1, 2/1; `reports:verify` PASS; `actionlint` 0; contract diff empty; `npm ls` clean. **Remote CI NOT VERIFIED — no commit/push/dispatch.** | `evidence/generated/aql-500-ci-20261101T0345Z/` (`*.log`, `*.stderr.log`, `exit-codes.txt`, `environment.txt`, `reports/api-baseline/`, `reports/harness-eval/`, `eval/`, `junit-summary.txt`, `report-files.txt`, `sut-hash-final.txt`, `git-status.txt`) |
| 2026-11-01 | AQL-500 | TASKS.md AQL-500 IN_PROGRESS → REVIEW_REQUIRED | — | REVIEW_REQUIRED — local workflow/report readiness PASS; G5 remote half NOT VERIFIED because no GitHub Actions run exists; independent review pending; AQL-600 not started | `TASKS.md`, this log |
| 2026-11-01T03:53Z | AQL-500 (fallback re-validation, no code change) | TASKS.md REVIEW_REQUIRED → IN_PROGRESS → REVIEW_REQUIRED; 17-command evidence set: `harness:doctor`; `typecheck`; `contract:validate`; `contract:selftest`; `test:unit`; `qa:traceability`; `qa:traceability:selftest`; `harness:selftest`; `harness:eval:selftest`; `reports:selftest`; API baseline with `--reporter=list,html,junit` to `<dir>/reports/api-baseline`; `harness:eval -- --evidence <dir>/eval --reports <dir>/reports/harness-eval`; `reports:verify -- --reports <dir>/reports`; workflow structural check; `git diff --exit-code -- contract/openapi.yaml`; `npm ls --depth=0`; `actionlint` 1.7.12 (prior session binary, no repo/global change) | 0 across all 17 commands | PASS (local) — doctor 11/11; unit 29/29; contract 21/21 + 56/56; traceability 32/28/32 + selftest 9/9; harness selftest 16/16; eval selftest 37/37; reports selftest 8/8; API baseline 32/32 with JUnit 32/0 and HTML; harness:eval 3/3 mutations with exact pairs, SUT `c2f33ba4…d2d7fd` before/during/after, baseline 32/32 twice; mutation JUnit 9/2, 2/1, 2/1 with intended QA ids; `reports:verify` PASS; contract diff empty; `npm ls` clean. Prior user deletions (`.opencode/*`, `opencode.json`) untouched; `contract/openapi.yaml` unchanged. **Remote CI NOT VERIFIED — no commit/push/dispatch.** | `evidence/generated/aql-500-ci-20261101T0348Z/` (`*.log`, `*.stderr.log`, `exit-codes.txt`, `environment.txt`, `reports/api-baseline/`, `reports/harness-eval/`, `eval/`, `junit-summary.txt`, `report-files.txt`, `sut-hash-before.txt`, `sut-hash-final.txt`, `git-status.txt`) |
| 2026-11-01T04:01Z | AQL-500 (round-1 fix: strengthened report verifier) | TASKS.md REVIEW_REQUIRED → IN_PROGRESS → REVIEW_REQUIRED; `harness/report-check.ts` rewritten (exact QA inventories, Playwright HTML markers, 14-case self-test); docs updated (`README.md`, `harness/README.md`, `docs/test-plan.md`, `DECISIONS.md` D018); 17-command evidence set into `evidence/generated/aql-500-ci-20261101T0400Z/` (same commands as the 03:53Z run); reviewer synthetic probe rebuilt in `/tmp/synth-probe` (unrelated 32-green + generic-HTML baselines, right-count/right-failing-id but wrong-inventory mutations) | 0 across all 17 commands; probe exit 1 | PASS (local) — typecheck 0; doctor 11/11; unit 29/29; contract 21/21 + 56/56; traceability 32/28/32 + selftest 9/9; harness selftest 16/16; eval selftest 37/37; reports selftest 14/14; API baseline 32/32 with JUnit 32/0; harness:eval 3/3 with exact pairs, SUT `c2f33ba4…d2d7fd` before/during/after, baseline 32/32 twice; `reports:verify` PASS on the real tree; synthetic probe FAILs with 24 errors (missing/unexpected ids + missing Playwright markers on all six report dirs); `actionlint` 1.7.12 exit 0; contract diff empty; `npm ls` clean. Only `harness/report-check.ts` + docs changed; tests, SUT, contract and workflow untouched. **Remote CI NOT VERIFIED — no commit/push/dispatch.** | `evidence/generated/aql-500-ci-20261101T0400Z/` (same layout as 0348Z); `reviews/AQL-500.md` (round-1 record + fix disposition) |
| 2026-11-01 | AQL-500 (round-2 re-review: APPROVED locally → BLOCKED) | Docs-only close-out, no implementation changes: persisted round-2 faithful summary in `reviews/AQL-500.md`; TASKS.md REVIEW_REQUIRED → BLOCKED; PROGRESS.md checkpoint/gate/journal updated; README.md status updated. Verified reviewer evidence `evidence/generated/aql-500-review-r2-20261101/eval/summary.json` (`ok: true`, 3/3 mutations, 32/32 pre/post, sha `c2f33ba4…d2d7fd` exact) | — (no commands run; evidence already recorded) | APPROVED locally, no open local blockers — HTML markers, exact 32 inventories, exact 9/2/2 mutation inventories + intended subsets, 14/14 self-tests, probe rejected exit 1/24 errors, fresh API 32/32, eval 3/3, reports:verify PASS (fresh + supplied), actionlint 0, unit 29/29, contract 21/21 unchanged, workflow sound. **G5 local PASS; G5 remote NOT VERIFIED.** Unblocks on explicit authorization for commit/push + one successful observed Actions run. No AQL-600 work, no commits or pushes. | `reviews/AQL-500.md`, `TASKS.md`, this log |
| 2026-11-01 | AQL-500 (remote verification: full G5 APPROVED PASS → DONE) | Docs-only close-out, no implementation changes: persisted remote-verification summary in `reviews/AQL-500.md`; TASKS.md BLOCKED → DONE; PROGRESS.md headers/gate/journal updated; README.md status updated. Verified reviewer evidence `evidence/generated/aql-500-remote-41271870930/harness-eval-evidence/summary.json` locally (`ok: true`, 3/3 mutations with exact failing sets, 32/32 pre/post, sha `c2f33ba4…d2d7fd` exact, `errors: []`); confirmed HEAD `9dad20e` and a clean implementation tree (only pre-existing external deletions outstanding) | — (no commands run; remote run 41271870930 is the evidence) | Run https://github.com/siberfaqih/api-quality-lab/actions/runs/41271870930 SUCCESS (attempt 1, push main, exact head `9dad20e`, all steps SUCCESS; Node 24.22.1, Playwright 1.64.1); remote gates match local (11/21+56/29/32/28+9/16/37/14/32/3/verify PASS); 4 artifacts present unexpired at exact head; archive hash matches GitHub digest. **G5 PASS local + remote. AQL-500 DONE.** Next: AQL-600 TODO (not started). No Builder-side commits or pushes; no AQL-600 work. | `reviews/AQL-500.md`, `TASKS.md`, this log |

### G0 status (local portion)
| Requirement | Status | Basis |
| --- | --- | --- |
| Node, npm, git inspected | PASS (local) | Node v24.19.0, npm 11.17.0, git 2.50.1, macOS 26.6.2 arm64 |
| Project prerequisites inspected | PASS (local) | 11/11 doctor checks |
| Setup runs without errors | PASS (local) | `npm install` exit 0, `npm run typecheck` exit 0, `npm run harness:doctor` exit 0 |
| Harness fails closed | PASS (local) | 16/16 selftest cases; four executable negative controls (weakened range, malformed range, Node-major override, `enum` under `erasableSyntaxOnly`) all exit 1 |
| Independent review | PASS | reviewer round 2: APPROVED, no blocking findings — `reviews/AQL-000.md` |

**G0: PASS (local).** Verified by actual command runs plus independent reviewer execution. Remote CI is out of scope for G0 and remains NOT VERIFIED.

## Handoff — AQL-000 (DONE)

- Scope: toolchain bootstrap + preflight doctor only. No contract, SUT or QA tests were created (those belong to AQL-100/AQL-200/AQL-300).
- New untracked files: `package.json`, `package-lock.json`, `tsconfig.json`, `harness/doctor.ts`, `harness/engine-range.ts`, `harness/doctor.selftest.ts`, `reviews/AQL-000.md`.
- Tracked modifications vs `9015b72`: `DECISIONS.md`, `PROGRESS.md`, `README.md`, `TASKS.md`. (This log is one of those files, so its own line count changes with every entry — no fixed insertion total is quoted.)
- Reproduce the diff composition exactly with:
  ```sh
  git diff --stat 9015b72        # tracked modifications only
  git status --porcelain         # untracked additions
  ```
- Verification commands: `npm run harness:doctor` (11/11), `npm run harness:selftest` (16/16), `npm run typecheck` (0), plus the negative controls in the journal.
- Review history: round 1 CHANGES_REQUESTED (1 MEDIUM, 2 LOW) → fixes → round 2 APPROVED. Full text in `reviews/AQL-000.md`.
- Not committed or pushed: awaiting user approval per `AGENTS.md` scope control.
- Known limitation: doctor checks are shallow in places (directory existence, literal ignore rules, dependency presence); they are preflight signals, not proof the full suite works.

## Script execution audit — 2026-10-31T08:52Z (user-requested, read-only verification)

Scope: run only scripts that actually exist in `package.json`; no script was added, renamed or stubbed to manufacture a result. `commit=9015b72`, `worktree_dirty=11`, Node v24.19.0, npm 11.17.0, tsc 7.0.2, git 2.50.1.

Evidence directory: `evidence/generated/aql-scripts-20261031T0852Z/` (matched by `.gitignore` rule `evidence/generated/`; confirmed absent from `git status`).

### Scripts that exist and were executed
| # | Command | Exit | Result | Evidence file |
| --- | --- | --- | --- | --- |
| 1 | `npm run` (inventory) | 0 | Lists exactly 3 scripts: `harness:doctor`, `harness:selftest`, `typecheck` | `npm-run-inventory.log` |
| 2 | `npm run harness:doctor` | 0 | PASS — 11 pass, 0 warn, 0 fail | `doctor.log` |
| 3 | `npm run harness:selftest` | 0 | PASS — 16 pass, 0 fail | `selftest.log` |
| 4 | `npm run typecheck` | 0 | PASS — `tsc --noEmit`, no diagnostics | `typecheck.log` |

### Scripts that do not exist (probed, not claimed as passing)
| # | Command | Exit | Observed output | Interpretation | Evidence file |
| --- | --- | --- | --- | --- | --- |
| 5 | `npm run test` | 1 | `npm error Missing script: "test"` | BLOCKED — unit test suite not implemented | `absent-test.log` |
| 6 | `npm run test:unit` | 1 | `npm error Missing script: "test:unit"` | BLOCKED — no unit tests | `absent-test-unit.log` |
| 7 | `npm run test:api` | 1 | `npm error Missing script: "test:api"` | BLOCKED — no API/Playwright tests | `absent-test-api.log` |
| 8 | `npm run harness:eval` | 1 | `npm error Missing script: "harness:eval"` | BLOCKED — evaluation/mutation harness not implemented | `absent-harness-eval.log` |
| 9 | `npm run lint` | 1 | `npm error Missing script: "lint"` | BLOCKED — not required by EVALUATION.md; no linter configured | `absent-lint.log` |

The exit code 1 in rows 5–9 is npm reporting a missing script, not a failing test. These are recorded as BLOCKED, never PASS.

### Gate status after this audit
| Gate | Status | Basis |
| --- | --- | --- |
| G0 — prerequisites, setup runs | PASS (local) | doctor 11/11, selftest 16/16, typecheck 0; independently approved in `reviews/AQL-000.md` |
| G1 — OpenAPI 3.1 contract parses | BLOCKED | `contract/` contains only `README.md`; no `openapi.yaml` yet |
| G2 — SUT starts/stops, unit tests pass | BLOCKED | `sut/` empty; no `test:unit` script |
| G3 — 22+ Playwright tests, 2 runs, order independence | BLOCKED | `qa/` empty; no Playwright dependency or `test:api` script |
| G4 — three mutations detected, clean restore | BLOCKED | no `harness:eval` script, no SUT or test suite to mutate |
| G5 — CI runs typecheck/unit/API/eval | BLOCKED / NOT VERIFIED | `.github/workflows/` contains no workflow; no remote run observed |
| G6 — reproducibility, real outputs, simulated defect | NOT VERIFIED | depends on G1–G5 artifacts that do not exist yet |

Remote CI: **NOT VERIFIED** — no workflow file exists and no GitHub Actions run was observed. No CI success is claimed.

> The G1–G6 rows above are the audit state **as of 2026-10-31T08:52Z** (historical, superseded): G1, G2 and the local G3 implementation have since been completed (see "Gate G1", "Gate G2" and "Gate G3" below). At that audit time, G2–G6 were BLOCKED / NOT VERIFIED. G3's independent review is still pending.

### What this audit does not prove
- That the SUT or test suite works — neither exists at `9015b72`.
- That the harness is complete — only the preflight doctor and its self-test exist.
- That typechecking covers future SUT/QA code — `tsconfig.json` includes `sut/**` and `qa/**`, but both are currently empty.

## Post-completion reviewer report — received 2026-10-31T09:03Z

- User supplied independent reviewer session `ses_e6ed62182ffelJnPvelUY0pkh7`; faithfully preserved in `reviews/AQL-000-post-completion.md`.
- Reviewer reported doctor exit 0 (11/11), selftest exit 0 (16/16), typecheck exit 0, and Node-major negative control exit 1. These are reviewer-reported executions, not new Builder runs; no fresh installation or remote CI was verified.
- Verdict: BLOCKED because no task was REVIEW_REQUIRED. This is a review-target selection blocker, not a newly established implementation failure.
- Disposition: this audit concerns post-completion AQL-000 verification. Prior round-2 APPROVED evidence remains in `reviews/AQL-000.md`; AQL-000 stays DONE. AQL-100 remains TODO, the next unblocked implementation task. No new implementation was requested or performed in this follow-up.
- Future review requests must explicitly name the task and its REVIEW_REQUIRED handoff. Remote CI remains NOT VERIFIED.

## Gate G1 — contract (AQL-100, REVIEW_REQUIRED)

Status: local checks PASS; independent review round 5 **APPROVED** — no open blocking findings. AQL-100 is **DONE**.

| G1 requirement | Status | Basis |
| --- | --- | --- |
| OpenAPI 3.1 contract parses | PASS | `contract:validate` check `contract.structure` runs swagger-parser meta-schema validation on `contract/openapi.yaml`; `contract.version` pins 3.1.x |
| Requirement IDs declared and linked | PASS | 28 requirements across 6 areas; each declares `appliesTo` (must be an array, including globals); 45 operation links must match the matrix exactly (missing and extra links both fail) |
| Validation and boundaries declared | PASS | `contract.boundaries` + `contract.instances`: create/update `name` 1–80 with `\S` pattern, price 0–1,000,000, quantity 0–10,000 integer, description ≤500/default "", category enum/default, limit integer 1–100 default 20, offset ≥0 default 0, update `minProperties: 1` and no required fields; 63 AJV 2020-12 instances (component + POST /items operation-level schemas, PATCH max-price/field-type probes) |
| Auth declared | PASS | root `bearerAuth`; health/login override to `security: []`; all five item operations require bearer and document 401 + `WWW-Authenticate: Bearer`; AUTH-04/05 applied to every protected operation |
| Cross-user isolation declared | PASS | 404 `item_not_found` is the single response for foreign and nonexistent ids (D009); REQ-ISO-01 (read/update/delete) and REQ-ISO-02 (list only) are separate assertions |
| Error semantics declared | PASS | `application/problem+json` `Problem`/`FieldError`; 8 registered codes; 16 error responses checked for media type, Problem `$ref`, registered code and matching status; orphan codes and missing 404/415/400 coverage rejected; `contract.error-schema` requires non-empty `errors[]` + exact `validation_failed` conditional (positive/negative instances) |
| Request/response shapes declared | PASS | `contract.requests` requires JSON-only bodies with exact `$ref` and no siblings (login/create/update); `contract.success-shapes` requires exact `$ref` with no siblings (health, login token, list, create+Location, get, patch) and empty 204; `contract.headers` requires exact `#/components/headers/*` refs at POST /items 201, login 401, shared Unauthorized and every protected 401 plus component semantics; `contract.examples` validates example status against its response |
| Fail-closed verification | PASS | `contract:selftest` 56/56 — 1 baseline + 55 targeted mutations each rejected **at the declared check id** (targeted subrules also assert a diagnostic substring); includes all round-1, round-2 and round-3 reviewer reproductions |
| Independent review | APPROVED (round 5) | No open blocking findings across rounds 1–5; R4-1 verified resolved; full text in `reviews/AQL-100.md` |

**G1: PASS (local checks + independent APPROVED).** Remote CI remains NOT VERIFIED.

### Handoff — AQL-100 (post round-1 fixes)

- Added: `contract/openapi.yaml`, `harness/contract-rules.ts`, `harness/contract-check.ts`, `harness/contract.selftest.ts`.
- Modified: `package.json` (two scripts + two devDependencies), `package-lock.json`, `contract/README.md`, `DECISIONS.md` (D008–D011), `PROGRESS.md`, `TASKS.md`.
- Review record: `reviews/AQL-100.md` (round 1 verbatim + finding-by-finding disposition).
- Evidence: `evidence/generated/aql-100-contract-r2-20261031T0925Z/` (gitignored) — `contract-validate.log`, `contract-validate.json`, `contract-selftest.log`, `typecheck.log`, `doctor.log`, `harness-selftest.log`, `exit-codes.txt`, `environment.txt`. The earlier `aql-100-contract-20261031T0917Z/` run is retained unedited as round-1 evidence.
- Reproduce with:
  ```sh
  npm run contract:validate    # 18 pass, 0 fail, exit 0
  npm run contract:selftest    # 36 pass, 0 fail, exit 0
  npm run typecheck            # exit 0
  ```

### Handoff — AQL-100 (post round-2 fixes, REVIEW_REQUIRED)

- Added since round 2: AJV `contract.instances` (40 probes), `contract.headers`, `contract.examples`; strict `appliesTo` array; JSON-only bodies; exact Problem conditional; `expectFailDetail` diagnostics; `ajv` devDependency + `contract:validate`/`contract:selftest` scripts already present.
- Modified: `contract/openapi.yaml`, `harness/contract-rules.ts`, `harness/contract.selftest.ts`, `package.json`, `package-lock.json`, `contract/README.md` (21 checks / 1 baseline + 48 controls, raw-value bounds), `DECISIONS.md` (D010 guarantee + AJV + history), `PROGRESS.md`, `reviews/AQL-100.md` (round-2 verbatim + disposition).
- Review record: `reviews/AQL-100.md` (rounds 1–2 verbatim + finding-by-finding dispositions for R2-1…R2-5).
- Evidence: `evidence/generated/aql-100-contract-r3-20261031T0932Z/` (gitignored) — `contract-validate.log` (21/21), `contract-validate.json` (`{pass:21,fail:0}`), `contract-selftest.log` (49/49), `builder-independent-mutation-probe.log` (11/11 reviewer-mutation reproductions REJECTED at intended checks), `typecheck.log`, `doctor.log` (11/11), `harness-selftest.log` (16/16), `exit-codes.txt` (all 0), `environment.txt`. Earlier `aql-100-contract-20261031T0917Z/` and `aql-100-contract-r2-20261031T0925Z/` retained unedited.
- Reproduce with:
  ```sh
  npm run contract:validate    # 21 pass, 0 fail, exit 0
  npm run contract:selftest    # 49 pass, 0 fail, exit 0
  npm run typecheck            # exit 0
  ```
- Not committed or pushed: awaiting user approval per `AGENTS.md`.
- Known limitations:
  - The validator checks the document, not SUT behavior. Nothing here proves an endpoint works.
  - `price` uses JSON Schema `multipleOf: 0.01` as documentation of intent; JSON Schema float `multipleOf` is unreliable for instance validation, so AQL-300 must assert 2-decimal rejection behaviorally against the SUT.
  - `x-requirements`/`x-error-codes` are OpenAPI extensions: generic tooling ignores them; this repository's validator is what enforces them.
  - `problem+json` field-level code vocabulary (`required`, `blank`, `too_long`, `wrong_type`, `out_of_range`, `too_many_decimals`, `invalid_enum`, `unknown_property`) is described in the schema but not enumerated as an `enum`; tests will pin the observed codes.
  - Operation coverage is an explicit constant: adding a contract endpoint requires updating the operation list, required error-status matrix, request-body and success-shape expectations together. This is deliberate, but it is not derived automatically.

### Handoff — AQL-100 (post round-3 fixes, REVIEW_REQUIRED)

- Added since round 3: exact header-reference enforcement at each applicable response, `$ref`-sibling rejection, POST /items operation-level instance schemas, PATCH max-price + numeric-description probes, Item response samples (63 instances total), 7 R3 regression controls (56 cases total).
- Modified: `harness/contract-rules.ts`, `harness/contract.selftest.ts`, `contract/README.md` (21 checks / 1 baseline + 55 controls, 63 instances, scoped claims), `DECISIONS.md` (D010 56-case + 63-instance + R3 history), `PROGRESS.md`, `reviews/AQL-100.md` (round-3 verbatim + disposition).
- Review record: `reviews/AQL-100.md` (rounds 1–3 verbatim + finding-by-finding dispositions for R3-1…R3-2).
- Evidence: `evidence/generated/aql-100-contract-r4-20261031T0940Z/` (gitignored) — `contract-validate.log` (21/21), `contract-validate.json` (`{pass:21,fail:0}`), `contract-selftest.log` (56/56), `builder-r3-mutation-probe.log` (7/7 R3 reproductions REJECTED at intended checks), `typecheck.log`, `doctor.log` (11/11), `harness-selftest.log` (16/16), `exit-codes.txt` (all 0), `environment.txt`. Earlier `aql-100-contract-20261031T0917Z/`, `aql-100-contract-r2-20261031T0925Z/`, `aql-100-contract-r3-20261031T0932Z/` retained unedited.
- Reproduce with:
  ```sh
  npm run contract:validate    # 21 pass, 0 fail, exit 0
  npm run contract:selftest    # 56 pass, 0 fail, exit 0
  npm run typecheck            # exit 0
  ```
- Not committed or pushed: awaiting user approval per `AGENTS.md`.
- Known limitations:
  - The validator checks the document, not SUT behavior. Nothing here proves an endpoint works.
  - `price` uses JSON Schema `multipleOf: 0.01` as documentation of intent; JSON Schema float `multipleOf` is unreliable for instance validation, so AQL-300 must assert 2-decimal rejection behaviorally against the SUT.
  - `x-requirements`/`x-error-codes` are OpenAPI extensions: generic tooling ignores them; this repository's validator is what enforces them.
  - `problem+json` field-level code vocabulary (`required`, `blank`, `too_long`, `wrong_type`, `out_of_range`, `too_many_decimals`, `invalid_enum`, `unknown_property`) is described in the schema but not enumerated as an `enum`; tests will pin the observed codes.
  - Operation coverage is an explicit constant: adding a contract endpoint requires updating the operation list, required error-status matrix, request-body and success-shape expectations together. This is deliberate, but it is not derived automatically.
  - The 63 instances establish their tested cases, not universal protection against every possible schema contradiction; unknown `format` values (`uuid`, `date-time`) are ignored by AJV without `ajv-formats` and are therefore documented, not instance-enforced.

### Handoff — AQL-100 (post round-4 evidence fix, REVIEW_REQUIRED)

- No code change from round-4: `contract/openapi.yaml`, `harness/*`, `contract/README.md`, `DECISIONS.md` unchanged (R3-1/R3-2 already approved in round-4 verbatim).
- Fixed: evidence capture now separates stdout/stderr; `contract-validate.json` is whole-file `JSON.parse`-clean.
- Review record: `reviews/AQL-100.md` (rounds 1–4 verbatim + dispositions for R3-1…R4-1).
- Evidence: `evidence/generated/aql-100-contract-r5-20261031T0947Z/` (gitignored) — `contract-validate.log` (21/21), `contract-validate.json` (pure JSON `{pass:21,fail:0}`), `contract-validate.stderr.log` (6 AJV warnings), `json-parse-check.log` (`JSON.parse OK`), `contract-selftest.log` (56/56) + `.stderr.log`, `typecheck.log`, `doctor.log` (11/11), `harness-selftest.log` (16/16), `builder-r3-mutation-probe.log` (7/7 REJECTED), `exit-codes.txt` (all 0), `environment.txt`. Earlier r1–r4 dirs retained unedited (r4 preserves the mixed-stream defect for audit).
- Reproduce with:
  ```sh
  npm run contract:validate    # 21 pass, 0 fail, exit 0
  npm run contract:selftest    # 56 pass, 0 fail, exit 0
  npm run typecheck            # exit 0
  node harness/contract-check.ts --json > /tmp/aql.json 2> /tmp/aql.stderr.log
  node -e 'JSON.parse(require("node:fs").readFileSync("/tmp/aql.json","utf8")); console.log("JSON OK")'
  ```
- Not committed or pushed: awaiting user approval per `AGENTS.md`.
- Known limitations: same as post round-3 handoff (document-only validator; `multipleOf` intent behavioral in AQL-300; `x-*` extensions enforced by this repo; field-error vocabulary not enum; explicit operation constants; 63 instances cover tested cases; `uuid`/`date-time` formats ignored without `ajv-formats` — warnings now isolated in `*.stderr.log`).

## Gate G2 — SUT (AQL-200, DONE)

Status: local checks PASS; independent review round 1 CHANGES_REQUESTED (R1–R6) → fixes → round 2 **APPROVED** (2 LOW non-blocking, corrected before publication). AQL-200 is **DONE**.

| G2 requirement | Status | Basis |
| --- | --- | --- |
| SUT implements the contract (health, login, item CRUD) | PASS | `sut/src/app.ts`: 7 operations from `contract/openapi.yaml`; problem+json errors with the 8 registered codes; bearer auth with `WWW-Authenticate: Bearer`; foreign/nonexistent ids share 404 `item_not_found` (D009) |
| SUT starts/stops reliably | PASS | Server smoke on ports 3107 and 3108: health 200, login/create/list round-trip, SIGTERM stop verified; the unit suite itself starts on an ephemeral port and closes cleanly twice in a row |
| Unit tests pass | PASS | `npm run test:unit` 29/29, two consecutive runs, exit 0 (`evidence/generated/aql-200-sut-r2-20261031T1115Z/test-unit*.log`); includes Unicode, price-precision, offset-overflow, empty-property, all-operations-auth, expiry and shape regressions |
| Contract not weakened | PASS | `contract:validate` 21/21, `contract:selftest` 56/56 unchanged; typecheck 0; doctor 11/11; harness:selftest 16/16 |
| Independent review | APPROVED (round 2) | Round 1 (4 MEDIUM + 2 LOW) → fixes → round 2 APPROVED with 2 LOW non-blocking observations, both corrected and re-verified (29/29) before publication; full text in `reviews/AQL-200.md` |

**G2: PASS (local checks + independent APPROVED).** Remote CI remains NOT VERIFIED.

### Handoff — AQL-200 (REVIEW_REQUIRED, historical — superseded by the DONE handoff at the end of this file)

- Added: `sut/src/app.ts` (dependency-free Node `http` SUT: routing, opaque-token auth with enforced 3600s expiry, contract validation, in-memory per-instance store, `reset()`), `sut/src/server.ts` (`PORT` entrypoint, graceful SIGINT/SIGTERM), `sut/app.test.ts` (29 tests titled by requirement ID; originally 22, +7 from review round-1 regressions), `sut/README.md` (run instructions, synthetic users, reset semantics).
- Modified: `package.json` (+`sut:start`, +`test:unit`; no new dependencies), `DECISIONS.md` (D012 synthetic credentials/in-memory design, D013 README-per-pushed-commit rule), `README.md` (GitHub status rewritten for AQL-200 per D013), `TASKS.md` (AQL-200 TODO → IN_PROGRESS → REVIEW_REQUIRED), `PROGRESS.md`.
- Verification: `npm run test:unit` 29/29 exit 0 (twice, post round-1 fixes); `npm run typecheck` 0; `npm run contract:validate` 21/21; `npm run contract:selftest` 56/56; `npm run harness:doctor` 11/11; `npm run harness:selftest` 16/16; server smokes on ports 3107/3108 (health/login/create/list + SIGTERM stop). The 22/22 counts in the 10:58–10:59Z journal rows are historical (pre-review suite).
- Evidence: `evidence/generated/aql-200-sut-20261031T1059Z/` (gitignored) — `test-unit.log`, `test-unit-run2.log`, `typecheck.log`, `contract-validate.log` (+stderr), `contract-selftest.log` (+stderr), `doctor.log`, `harness-selftest.log`, `exit-codes.txt` (all 0), `environment.txt`.
- Diff/commit reference: uncommitted increment on top of `7f99dd2` (plugin-removal cleanup already committed locally, not yet pushed); inspect with `git status --short`, `git diff --stat`. No commit/push performed for AQL-200 yet — user authorized commit+push only after reviewer approval.
- Known limitations:
  - Tokens, items and users live in memory; a restart wipes everything. This is the intended fixture-isolation design (D012), not persistence.
  - Field-error codes for fractional `quantity` and non-integer `limit`/`offset` use `wrong_type`; the contract describes the vocabulary without an enum (see AQL-100 handoff), so AQL-300 will pin these observed codes behaviorally.
  - PATCH checks ownership (404) before body media-type/validation so foreign ids stay indistinguishable; the contract does not order 404 against 400/415 for that combination.
  - `internal_error` (500) exists only as a leak-free catch-all for unexpected faults; it is not a contract code and no test triggers it.
  - Unit tests run over real HTTP on an ephemeral port but are SUT tests; the 22+ Playwright QA suite with traceability is AQL-300.
- Explicit request: independent `@reviewer` audit of AQL-200 (G2) — verify the SUT against `contract/openapi.yaml` requirement IDs, run the unit suite and start/stop independently, and return APPROVED / CHANGES_REQUESTED / BLOCKED with gate-by-gate PASS/FAIL/BLOCKED/NOT VERIFIED. Do not mark DONE here.

## Handoff — AQL-200 (DONE)

- Scope: minimal dependency-free Inventory SUT implementing the 7 contract operations, plus 29 requirement-titled unit/API tests. No Playwright suite, mutation harness or CI claimed.
- Files: `sut/src/app.ts`, `sut/src/server.ts`, `sut/app.test.ts`, `sut/README.md`; modified `package.json` (+`sut:start`, +`test:unit`, no new dependencies), `DECISIONS.md` (D012, D013), `README.md` (rewritten GitHub status per D013), `TASKS.md`, `PROGRESS.md`, `reviews/AQL-200.md`.
- Verification (final, post-approval corrections): `npm run test:unit` 29/29 exit 0 twice; `typecheck` 0; `contract:validate` 21/21; `contract:selftest` 56/56; `harness:doctor` 11/11; `harness:selftest` 16/16; server start/stop smoke PASS. Evidence: `evidence/generated/aql-200-sut-r3-20261031T1125Z/` (plus retained r1/r2 dirs).
- Review history: round 1 CHANGES_REQUESTED (4 MEDIUM: Unicode length, price precision, offset overflow, empty FieldError; 2 LOW) → all fixed with regression tests → round 2 APPROVED (2 LOW non-blocking: coverage breadth, stale counts) → both corrected before publication. Full verbatim in `reviews/AQL-200.md`.
- Known limitations: in-memory state only (intended fixture design, D012); fractional-quantity/non-integer-query field code is `wrong_type` from the contract's non-enumerated vocabulary (AQL-300 will pin observed codes); PATCH returns 404 before body validation for foreign ids (contract does not order combined failures); `internal_error` 500 catch-all is non-contract and untriggered; token expiry is covered by fake-clock test, not real-time waiting.
- Explicit request: independent `@reviewer` audit already returned APPROVED for AQL-200 (session `ses_e6e61ef7affd5sQUlo4cVS1JiF`); no further review pending for this task.

## Next action
AQL-400 is DONE after round-2 independent review APPROVED with G4 PASS locally. The classifier requires the exact Playwright `Expected:`/`Received:` pair for every expected failure and rejects HTTP 500 and missing/ambiguous values; the auth test asserts status 401 before the challenge header. Final evidence: `evidence/generated/aql-400-g4-r2-20261101T0328Z/` (selftest 37/37, 3/3 mutations with exact pairs, SUT restored, baseline 32/32 twice) and the reviewer's independent `evidence/generated/aql-400-review-r2-20261101/eval/`. AQL-500 (CI + HTML/JUnit reports) remains TODO and has not started. No commit or push was performed. Remote CI remains NOT VERIFIED (G5).

## Handoff — AQL-100 (DONE)

- Scope: normative OpenAPI 3.1 contract + fail-closed validator + 56-case self-test. No SUT, Playwright, mutation harness or CI claimed.
- Files: `contract/openapi.yaml` (28 reqs, 8 codes, 7 ops), `harness/contract-rules.ts`, `harness/contract-check.ts`, `harness/contract.selftest.ts`; modified `package.json` (+`yaml`, `swagger-parser`, `ajv`), `package-lock.json`, `contract/README.md`, `DECISIONS.md` (D008–D011), `PROGRESS.md`, `TASKS.md`.
- Verification: `npm run contract:validate` 21/21 exit 0; `npm run contract:selftest` 56/56 exit 0 (every reject asserts `expectFailCheck`, targeted assert `expectFailDetail`); `contract.instances` 63 probes; `npm run typecheck` 0; `npm run harness:doctor` 11/11; `npm run harness:selftest` 16/16; whole-file `JSON.parse` of `contract-validate.json` OK.
- Review history: round 1 CHANGES_REQUESTED (5 MEDIUM) → fixed; round 2 CHANGES_REQUESTED (2 MEDIUM+3 LOW) → fixed; round 3 CHANGES_REQUESTED (2 MEDIUM) → fixed; round 4 CHANGES_REQUESTED (evidence only R4-1) → fixed with separated streams; round 5 APPROVED. Full verbatim in `reviews/AQL-100.md`.
- Evidence: `evidence/generated/aql-100-contract-r5-20261031T0947Z/` (gitignored) + retained r1–r4 dirs (r4 preserves the mixed-stream defect for audit).
- Diff/commit reference: uncommitted increment at `f82a0c8` (no commit/push per scope control); inspect with `git status --short`, `git diff --stat`.
- Known limitations: validator is document-only; `multipleOf:0.01` intent needs behavioral AQL-300 tests; `x-*` extensions enforced only by this repo; field-error vocabulary not enum; explicit operation constants; 63 instances cover tested cases; `uuid`/`date-time` formats ignored (warnings in `*.stderr.log`).
- Explicit request: independent `@reviewer` audit already returned APPROVED for AQL-100 (session `ses_e6ebf0dfcffdnQiMXMTgC6G4p0`); no further review pending for this task. Do not pretend additional review ran beyond what is persisted in `reviews/AQL-100.md`.

## Gate G3 — QA suite (AQL-300, DONE)

Status: round-1 review returned **CHANGES_REQUESTED**; all four findings (MEDIUM 1–3, LOW) were fixed and local checks reran PASS. Round 2 of the same reviewer returned **APPROVED** with **G3 PASS locally**. AQL-300 is **DONE**. Remote CI remains NOT VERIFIED (G5).

| G3 requirement | Status | Basis |
| --- | --- | --- |
| At least 22 meaningful Playwright tests | PASS (local) | 32 tests in 8 spec files; every title carries a `QA-*` id and at least one contract `REQ-*` id; validation cases now cover create/update equivalence with unchanged state after each rejected PATCH; 404 PATCH/DELETE bodies are preceded by full `expectProblem` checks; ordering proves a deterministic three-item timestamp tie before ID assertions |
| Tests linked to contract requirements | PASS (local) | `npm run qa:traceability` reconciles Playwright `--list --reporter=json` discovery: 32 executable tests, 28/28 requirement ids, 32 unique QA ids, matrix current; `qa:traceability:selftest` 9/9 negative controls |
| Two consecutive passing runs | PASS (local) | `npm run test:api` 32/32 exit 0 in `api-run1.log` and `api-run2.log`; both with 1 worker |
| Order-independent behavior verified | PASS (local) | every test starts a fresh `createInventoryServer()` on an ephemeral loopback port; QA-LIST-02 uses `inventory.setNow()` for a proven `createdAt` tie; baseline `--list` recorded; `--shuffle=20261101 --workers=4 --fully-parallel` and `--shuffle=20261102 --workers=4 --fully-parallel` both 32/32 exit 0 |
| Contract not weakened | PASS (local) | `git diff --exit-code -- contract/openapi.yaml` exit 0 (empty); `contract:validate` 21/21; `contract:selftest` 56/56 |
| Existing gates remain green | PASS (local) | `typecheck` 0; `test:unit` 29/29; `doctor` 11/11; `harness:selftest` 16/16; `npm ls --depth=0` valid |
| Independent review | **APPROVED** (round 2, same session `ses_e6baf06ffffeO2nQ0BQyLCHkBS`) | `reviews/AQL-300.md`: round-1 findings verified resolved; reviewer's own runs 32/32 twice, shuffle 32/32, traceability 32/28/32, selftest 9/9, typecheck 0, unit 29/29, contract 21/21 + 56/56, contract diff unchanged, clock probe PASS |

**G3: PASS locally — meaningful tests, traceability, two consecutive runs, order independence, assertion integrity and unchanged contract/regressions all PASS; independent review APPROVED. Remote CI remains NOT VERIFIED (G5).**

### Handoff — AQL-300 (historical; approved in round 2)

- Scope: Playwright Test `APIRequestContext` suite against the local SUT, traceability, per-test fixture isolation and G3 order-independence evidence. No frontend, mutation harness or CI.
- Added:
  - `qa/playwright.config.ts` — test directory, 1 worker default, 15s timeout, list reporter.
  - `qa/fixtures/inventory.ts` — per-test fresh `createInventoryServer()` on an ephemeral port, `request.newContext({ baseURL })`, synthetic-user helpers, `expectItem`/`expectProblem` assertions, and `setNow()` for deterministic timestamps.
  - `qa/tests/health.spec.ts`, `auth.spec.ts`, `authz.spec.ts`, `items-crud.spec.ts`, `items-list.spec.ts`, `validation.spec.ts`, `isolation.spec.ts`, `errors.spec.ts` — 32 tests, including the review fixes below.
  - `qa/traceability.md` — test-to-requirement matrix for all 28 contract requirement ids.
  - `qa/traceability-check.ts` — Playwright-discovery/matrix reconciliation with `--json` output and 9 negative controls under `--self-test`.
  - `qa/README.md` — run instructions, isolation model, assertion style and limits.
- Modified: `package.json` (+`@playwright/test` 1.64.1 devDependency, +`test:api`, +`qa:traceability`, +`qa:traceability:selftest`), `package-lock.json`, `sut/src/app.ts` (injectable clock also governs item timestamps), `sut/README.md`, `DECISIONS.md` (D014–D016), `docs/test-plan.md`, `README.md`, `TASKS.md`, `PROGRESS.md`, `reviews/AQL-300.md`.
- Test inventory: 1 health, 5 auth, 2 authorization, 6 CRUD, 4 list/pagination, 9 validation, 2 isolation, 3 error-contract cases. All 28 requirements covered.
- Round-1 review fixes:
  - MEDIUM 1 — QA-VAL-01/02/03 now exercise valid and invalid PATCH forms for name, price and quantity, including blank/non-string name, negative/string price and fractional/out-of-range quantity, and re-read the item after every rejected PATCH.
  - MEDIUM 2 — QA-CRUD-05 and QA-ISO-01 call `expectProblem(response, 404, "item_not_found")` for GET, PATCH and DELETE before comparing bodies; successful item re-reads use `expectItem` (status + media type + exact body).
  - MEDIUM 3 — QA-LIST-02 sets a deterministic SUT clock, creates three items at one millisecond, proves the tie before asserting ascending-id order, and checks exact `createdAt` values plus both list calls.
  - LOW — `qa:traceability` now consumes Playwright's `--list --reporter=json` discovery instead of a source regex; `qa:traceability:selftest` adds 9 negative controls.
- Evidence: `evidence/generated/aql-300-qa-review-fixes-20261031T2352Z/` (gitignored, final post-fix rerun; includes the QA-LIST-02 `total`/`items.length` assertions added after the 23:48Z run) — `api-run1.log`, `api-run2.log`, `api-list.log`, `api-shuffle-seed-20261101.log`, `api-shuffle-seed-20261102.log`, `traceability.log`, `traceability-json.log`, `traceability-selftest.log`, `typecheck.log`, `test-unit.log`, `contract-validate.log` (+`.stderr.log`), `contract-selftest.log` (+`.stderr.log`), `doctor.log`, `harness-selftest.log`, `contract-diff.log` (0 bytes), `git-status.log`, `npm-ls.log`, `exit-codes.txt` (all 0), `environment.txt`. The earlier `aql-300-qa-review-fixes-20261031T2348Z/`, `aql-300-qa-final-20261031T2334Z/`, `aql-300-qa-final-20261031T2332Z/` and `aql-300-qa-20261031T2328Z/` runs are retained unedited as prior/development evidence.
- Reproduce with:
  ```sh
  npm run test:api
  npm run test:api
  npm run qa:traceability
  npm run qa:traceability:selftest
  npx playwright test --config qa/playwright.config.ts \
    --shuffle=20261101 --workers=4 --fully-parallel
  npm run typecheck
  ```
- Initial local failures (development history, not gate claims): first typecheck run failed on a TypeScript union in `isolation.spec.ts` (fixed by explicit query typing); first suite run was 29/32 because Playwright serialized raw malformed-JSON strings as JSON strings, so the SUT correctly returned `validation_failed` instead of `malformed_json` (fixed by sending `Buffer` bodies). Round 1 then returned CHANGES_REQUESTED; the four findings above were fixed and the full evidence set rerun. Final evidence is the 32/32 runs above.
- User deletions preserved: `.opencode/agents/builder.md`, `.opencode/agents/reviewer.md`, `.opencode/commands/*` and `opencode.json` remain deleted and were not restored. Role files are absent; the parent session is the reviewer.
- No commit or push was performed. Contract unchanged.
- Known limitations:
  - The per-test SUT is an in-process real HTTP listener, not a separate child process; AQL-200 covers process start/stop.
  - The suite does not calculate or claim line/branch coverage.
  - HTML/JUnit reporters, mutation testing and remote CI are later phases (G4/G5) and are not claimed.
  - Field-level error codes are pinned to observed SUT behavior where the contract defines the vocabulary but not a field-to-code map.
  - Playwright's default `test-results/` is gitignored; no report artifacts are published from this task.
- Review outcome: the same reviewer (`ses_e6baf06ffffeO2nQ0BQyLCHkBS`) re-reviewed on 2026-11-01 and returned **APPROVED** with G3 PASS locally; all four round-1 findings verified resolved. AQL-300 was then marked DONE. Remote CI remains NOT VERIFIED (G5); no commit or push.

## Gate G4 — mutation evaluation (AQL-400, DONE)

Status: round-1 independent review returned **CHANGES_REQUESTED** (G4 FAIL: broad assertion substrings accepted HTTP 500 and wrong expected/received semantics). The finding was fixed and a fresh local evidence set passed; round 2 of the same reviewer returned **APPROVED** with **G4 PASS locally** and no open blockers. AQL-400 is **DONE**. Remote CI remains NOT VERIFIED (G5).

| G4 requirement | Status | Basis |
| --- | --- | --- |
| Three isolated intentional mutations | PASS (local) | `negative-price-accepted` drops the `value < 0` bound in `validatePrice`; `token-validation-skipped` makes `authenticate()` return alice for any well-formed Bearer token; `cross-user-authorization-bypass` drops the `ownerId !== user.id` check in `ownedItem`. Each is an exact single-occurrence replacement in `sut/src/app.ts`; `applyMutation` fails closed on missing, ambiguous or no-op anchors. Tests and `contract/openapi.yaml` were not edited. |
| Relevant tests fail for the intended reason, not a crash | PASS (local) | Every mutation run exits `1` with exactly the expected failing set: QA-VAL-02 + QA-VAL-07, QA-AUTHZ-02, QA-ISO-01. The classifier now requires the exact Playwright `Expected:`/`Received:` pair: QA-VAL-02 `400`→`201`, QA-VAL-07 `>= 3`→`2`, QA-AUTHZ-02 `401`→`200`, QA-ISO-01 `404`→`200`. Missing/ambiguous values, HTTP 500, wrong received values, unexpected failures, runner errors, zero/partial discovery and setup/crash markers fail the evaluation. QA-AUTHZ-02 asserts status `401` before the challenge header so a wrong `500` is distinguishable. Spec discovery counts 9/9, 2/2 and 2/2. |
| SUT restored exactly | PASS (local) | Per-mutation `finally` restore with SHA-256 verification; final hash equals the baseline `c2f33ba463f9f6f5ffe2db312bc026b14045ea7088bc31c2d3b8d762e9d2d7fd`. SIGINT/SIGTERM handlers restore on interruption; a forced-restore fallback exists for a failed `finally`. |
| Baseline re-passes | PASS (local) | `baseline-pre` 32/32 exit 0 and `baseline-post` 32/32 exit 0 in the final evidence run. |
| Fail-closed evaluation with meaningful self-tests | PASS (local) | `npm run harness:eval:selftest` 37/37 controls: missing/ambiguous/no-op anchors, invalid JSON, ANSI stripping, exact expected/received parsing, missing/ambiguous values, wrong expected/received values, HTTP-500 negatives for every expected QA id, undetected mutation, expected test that passed, unexpected failure, wrong assertion, crash classification, runner errors, signal termination, zero/partial discovery, baseline exit/count checks, restore on normal return and on throw. |
| Evidence includes raw output and exit codes | PASS (local) | `eval/summary.json` (`ok: true`, per-mutation `tests` and `assertions` with `qaId`, `signature`, `expected`, `received`, `matched`, `actual` and message excerpt), per-run stdout/stderr logs, `eval/command-exit-codes.txt` (`baseline-pre 0`, three mutations `1`, `baseline-post 0`), `eval/environment.txt`; top-level `exit-codes.txt` records all 14 commands at `0`. |
| Existing gates remain green | PASS (local) | `typecheck` 0; `test:unit` 29/29; `contract:validate` 21/21; `contract:selftest` 56/56; `qa:traceability` 32 executable tests / 28/28 requirements / 32 unique QA ids; `qa:traceability:selftest` 9/9; `doctor` 11/11; `harness:selftest` 16/16; contract diff empty; `npm ls --depth=0` clean. |
| Independent review | **APPROVED** (round 2, same session `ses_e6baf06ffffeO2nQ0BQyLCHkBS`) | Round 1 found the MEDIUM semantics defect and classified G4 FAIL; the fix was verified by the reviewer. The reviewer confirmed the exact signature plus unique `Expected:`/`Received:` pair and mutation-specific values, rejection of HTTP 500/wrong/missing/ambiguous values, the QA-AUTHZ-02 status-before-header assertion, 37/37 self-tests and independent adversarial probes (intended accepted; 500/wrong/ambiguity rejected). Reviewer's own runs: selftest 37/37, typecheck 0, fresh harness:eval PASS (baseline 32/32 before and after; QA-VAL-02 400→201, QA-VAL-07 >=3→2, QA-AUTHZ-02 401→200, QA-ISO-01 404→200; per-mutation restore PASS; pre/post sha256 `c2f33ba4…d2d7fd`), unit 29/29, contract 21/21, traceability 32/28, contract diff unchanged. Independent evidence `evidence/generated/aql-400-review-r2-20261101/eval/` matched the supplied evidence. No reviewer edits, commits or pushes; remote CI NOT VERIFIED. |

**G4: PASS locally — three isolated mutations detected at the exact expected/received pairs, false positives rejected, SUT restored by hash, baseline re-passed, 37/37 self-tests and regressions green; independent review round 2 APPROVED with no open blockers. AQL-400 is DONE. Remote CI remains NOT VERIFIED (G5).**

### Handoff — AQL-400 (DONE)

- Scope: executable G4 mutation evaluation only. No CI workflow, HTML/JUnit report, simulated defect report or frontend work.
- Round-1 review finding: the classifier accepted broad assertion substrings and could accept HTTP 500 or wrong expected/received values (see `reviews/AQL-400.md`). Fixed by requiring the exact Playwright `Expected:`/`Received:` pair for each expected failure, rejecting HTTP 500 and missing/ambiguous values, expanding crash markers, and adding a status assertion before the challenge header in the auth test. The legitimate assertion was strengthened, not weakened.
- Added:
  - `harness/eval-lib.ts` — exact-anchor mutation application (missing/ambiguous/no-op rejection), Playwright JSON report parsing with ANSI stripping, exact expected/received parsing, mutation/baseline failure classification with HTTP-500 and crash-marker rejection, and the hash-verified restore helper.
  - `harness/eval.ts` — the three mutation definitions with exact expected/received pairs, baseline/mutation/baseline orchestration, evidence writing and exit codes.
  - `harness/eval.selftest.ts` — 37 positive/negative controls for the above without running Playwright, including HTTP-500 and wrong-received negatives for every expected QA id.
  - `harness/README.md` — mutation table with required semantics, flow, fail-closed rules and limits.
- Modified: `qa/tests/authz.spec.ts` (status 401 asserted before the challenge header in QA-AUTHZ-01 and QA-AUTHZ-02), `package.json` (+`harness:eval`, +`harness:eval:selftest`; no new dependencies, `package-lock.json` unchanged by this task), `DECISIONS.md` (D017), `README.md` (quick start, scripts table, layout, G4 status), `TASKS.md`, `PROGRESS.md`, `reviews/AQL-400.md`.
- Mutation → required failure semantics:
  - `negative-price-accepted` (`qa/tests/validation.spec.ts`, 9 tests) → QA-VAL-02 `400`→`201`; QA-VAL-07 `>= 3`→`2`.
  - `token-validation-skipped` (`qa/tests/authz.spec.ts`, 2 tests) → QA-AUTHZ-02 `401`→`200`.
  - `cross-user-authorization-bypass` (`qa/tests/isolation.spec.ts`, 2 tests) → QA-ISO-01 `404`→`200`.
- Evidence: `evidence/generated/aql-400-g4-r2-20261101T0328Z/` (gitignored) — `typecheck.log`, `eval-selftest.log`, `harness-eval.log` (+`.stderr.log`), `api-baseline.log`, `test-unit.log`, `contract-validate.log` (+`.stderr.log`), `contract-selftest.log` (+`.stderr.log`), `traceability.log`, `traceability-selftest.log`, `doctor.log`, `harness-selftest.log`, `contract-diff.log` (0 bytes), `git-status.log`, `npm-ls.log`, `exit-codes.txt` (all 0), `environment.txt`, and the harness's own `eval/` subdirectory (`summary.json`, `baseline-pre.*`, three mutation `*.log`/`*.stderr.log`, `baseline-post.*`, `command-exit-codes.txt`, `environment.txt`). The reviewer's independent evidence is `evidence/generated/aql-400-review-r2-20261101/eval/` (same expected/received pairs and restored hash). The earlier `aql-400-g4-20261101T0314Z` run is retained as superseded round-1 evidence.
- Documentation-only edits after the evidence capture: `TASKS.md`, `PROGRESS.md`, `README.md`, `reviews/AQL-400.md`; `harness/README.md` and `DECISIONS.md` were updated before it. No code, test, contract or package change followed the capture.
- Reproduce with:
  ```sh
  npm run typecheck
  npm run harness:eval:selftest     # 37/37
  npm run harness:eval              # 3/3 mutations with exact pairs, restore PASS, baseline 32/32 twice
  npm run test:api                 # 32/32
  npm run test:unit                # 29/29
  npm run contract:validate        # 21/21
  npm run contract:selftest        # 56/56
  npm run qa:traceability          # 32/28/32
  npm run qa:traceability:selftest # 9/9
  npm run harness:doctor           # 11/11
  npm run harness:selftest         # 16/16
  git diff --exit-code -- contract/openapi.yaml
  ```
- Development history (not a gate claim): the first `harness:eval` run failed because Playwright's JSON failure messages contain ANSI escapes and QA-VAL-07's signature had been guessed as `expected a FieldError for price`; the actual assertion is `toBeGreaterThanOrEqual`. Fixed by stripping ANSI before matching and pinning the real assertion. Round 1 then found the broad-substring/HTTP-500 defect; the exact semantics fix above was verified in the fresh run. No test, assertion or contract was weakened.
- User deletions preserved: `.opencode/agents/builder.md`, `.opencode/agents/reviewer.md`, `.opencode/commands/*` and `opencode.json` remain deleted and were not restored.
- No commit or push was performed. `contract/openapi.yaml` is unchanged.
- Known limitations:
  - The harness patches the real `sut/src/app.ts` in place (the tests import it directly); restoration is hash-verified rather than a separate copy. A hard `SIGKILL` cannot be intercepted, so the recorded baseline hash (`shasum -a 256 sut/src/app.ts`) is the recovery check. The file already carries legitimate uncommitted AQL-300 changes, so `git diff` is not a clean-tree check.
  - Mutation runs execute only the targeted spec; the full suite runs before and after all mutations, not during each one.
  - The baseline test count is pinned to the G3 suite (32); a deliberate suite change requires updating `BASELINE_TEST_COUNT`.
  - Exact expected/received parsing is deliberately limited to the scalar Playwright messages used by these four assertions; a message with missing or repeated `Expected:`/`Received:` lines fails closed.
  - No coverage percentage is claimed. Remote CI and HTML/JUnit reporting remain G5 and are not part of this task.
- Review outcome: the same reviewer (`ses_e6baf06ffffeO2nQ0BQyLCHkBS`) re-reviewed on 2026-11-01 and returned **APPROVED** with G4 PASS locally; the round-1 finding was verified resolved and no open blockers remain. AQL-400 was then marked DONE. Remote CI remains NOT VERIFIED (G5); no commit or push.

## Gate G5 — CI workflow and reports (AQL-500, DONE)

Status: **G5 PASS — local and remote.** Round-2 independent review APPROVED
the local half with no open blockers; after the user-authorized commit/push
of `9dad20e`, the same reviewer independently verified the successful GitHub
Actions run 41271870930 and returned full G5 APPROVED PASS. (The earlier
"no remote run" statements below are historical and describe the pre-push
state.)

| G5 requirement | Status | Basis |
| --- | --- | --- |
| CI runs typecheck, unit, API and harness evaluation | PASS (local workflow definition) | `.github/workflows/qa.yml` is one sequential `quality` job on `ubuntu-latest` with Node 24 and `npm ci`: doctor, typecheck, contract validate/selftest, unit, traceability/selftest, harness selftest, eval selftest, report selftest, API baseline, `harness:eval`, report verification and SUT-restore verification. Every command was also run locally with exit 0; the workflow itself has not executed on GitHub. |
| Real HTML and JUnit reports | PASS (local) | Playwright ran with `--reporter=json,html,junit`; JSON stays on stdout for harness parsing. Final evidence has six JUnit reports: API baseline 32 tests/0 failures; harness baseline-pre 32/0; baseline-post 32/0; `negative-price-accepted` 9/2 (`QA-VAL-02`, `QA-VAL-07`); `token-validation-skipped` 2/1 (`QA-AUTHZ-02`); `cross-user-authorization-bypass` 2/1 (`QA-ISO-01`). Each run also produced `html/index.html`. |
| Baseline and intentional-mutation reports separated | PASS (local) | `reports/api-baseline`, `reports/harness-eval/baseline-pre`, `reports/harness-eval/baseline-post` and `reports/harness-eval/mutations/<mutation-id>` are distinct directories; the workflow uploads them as four artifacts (API baseline, harness baselines, intentional mutations, raw harness evidence). |
| Reports are verified, not merely uploaded | PASS (local) | `harness/report-check.ts` parses JUnit counts/failures/errors/skipped, checks declared counts against `<testcase>`/`<failure>`/`<error>` elements, requires the exact QA testcase inventory for baselines (32 ids) and mutation specs (9/2/2) with the exact failing subset and no missing/extra/duplicated/substituted ids, and requires Playwright-specific HTML markers (report title plus embedded report data). `npm run reports:selftest` passes 14/14 controls; `npm run reports:verify` passes on the real report tree and fails (24 errors) on a synthetic unrelated tree. |
| Mutation evaluation is sequential and restores the SUT | PASS (local) | A single CI job with no parallel matrix step runs the API baseline and then `harness:eval`; `concurrency.cancel-in-progress` is `false` so a run is not cancelled mid-mutation. The workflow records `sha256sum sut/src/app.ts` before evaluation and compares it after, failing and restoring from git on mismatch. Locally the final hash equals the baseline `c2f33ba463f9f6f5ffe2db312bc026b14045ea7088bc31c2d3b8d762e9d2d7fd`. |
| Workflow syntax and expression validation | PASS (local) | `actionlint` 1.7.12 (built outside the repository; no global config added) exits 0 on `.github/workflows/qa.yml`. |
| Existing gates remain green | PASS (local) | Fresh evidence `aql-500-ci-20261101T0400Z`: typecheck 0; unit 29/29; contract 21/21 + selftest 56/56; traceability 32 tests/28 requirements/32 ids + selftest 9/9; doctor 11/11; harness selftest 16/16; eval selftest 37/37; reports selftest 14/14; API 32/32; harness:eval 3/3 with exact expected/received pairs and 32/32 baselines; contract diff empty; `npm ls --depth=0` clean. |
| Remote GitHub Actions PASS | **PASS (observed)** | Run https://github.com/siberfaqih/api-quality-lab/actions/runs/41271870930 — SUCCESS, attempt 1, push to main, exact head `9dad20e`, every job step SUCCESS (Node 24.22.1, Playwright 1.64.1). Remote results match the local gates: doctor 11/11, contract 21/21 + 56/56, unit 29/29, traceability 32/28/32 + 9/9, self-tests 16/16 + 37/37 + 14/14, API 32/32, eval 3/3 with 32/32 baselines, SUT sha exact, `reports:verify` PASS. All four artifacts present and unexpired at the exact head. |
| Independent review | **APPROVED locally (round 2) + full G5 APPROVED PASS on the remote run (same session `ses_e6baf06ffffeO2nQ0BQyLCHkBS`)** | Round 1 found the MEDIUM verifier-weakness defect (G5 local verifier FAIL); the fix was verified in round 2: HTML title + embedded marker, exact 32-id inventories, exact 9/2/2 mutation inventories with intended subsets, 14/14 self-tests, synthetic probe rejected (exit 1, 24 errors), fresh API 32/32, eval 3/3 with 32/32 baselines, SUT `c2f33ba4…d2d7fd` exact pre/post, `reports:verify` PASS on fresh and supplied trees, `actionlint` 0, unit 29/29, contract 21/21 unchanged. Reviewer evidence `evidence/generated/aql-500-review-r2-20261101/eval/` matched the supplied `aql-500-ci-20261101T0400Z`. Remote verification: reviewer observed run 41271870930 (SUCCESS, exact head `9dad20e`), confirmed all remote gate results, downloaded the evidence artifact to `evidence/generated/aql-500-remote-41271870930/harness-eval-evidence/` with a matching archive hash, and returned full G5 APPROVED PASS. No reviewer edits at any point; external deletions preserved. |

**G5: PASS local + remote; AQL-500 DONE.** The workflow, report generation
and verification are real and reproducible locally, and a committed run has
now been observed on GitHub Actions: run 41271870930 (SUCCESS, attempt 1,
push to `main`, exact head `9dad20e`), independently verified by the same
reviewer with full G5 APPROVED PASS. Details in the table and in
`reviews/AQL-500.md`.

### Handoff — AQL-500 (DONE)

- Scope: GitHub Actions workflow plus HTML/JUnit report generation, report
  verification and artifact separation. No commit, push, dispatch, external
  publication, AQL-600 work or agent spawn.
- Added:
  - `.github/workflows/qa.yml` — one sequential `quality` job: checkout, Node
    24 with npm cache, `npm ci`, doctor, typecheck, contract validate/selftest,
    unit, traceability/selftest, harness selftest, eval selftest, report
    selftest, API baseline with list/HTML/JUnit, pre-eval SUT hash,
    `harness:eval` with `--reports`, report verification, post-eval hash
    verification with git restore fallback, and four artifact uploads.
  - `harness/report-check.ts` — JUnit/HTML verifier plus 14-case self-test.
  - `harness/README.md` — `--reports` usage, report layout and limits.
- Modified:
  - `harness/eval.ts` — optional `--reports <dir>`; Playwright emits
    `json,html,junit` per run, with `PLAYWRIGHT_HTML_REPORT`,
    `PLAYWRIGHT_HTML_OPEN=never` and `PLAYWRIGHT_JUNIT_OUTPUT_FILE`; JSON
    remains on stdout and the existing parser/exit-code behavior is unchanged.
  - `package.json` — `reports:verify`, `reports:selftest`.
  - `.gitignore` — ignores generated `reports/`.
  - `README.md`, `TASKS.md`, `PROGRESS.md`, `DECISIONS.md` (D018),
    `docs/test-plan.md`, `qa/README.md`.
- Report layout (all under the chosen reports root):
  - `api-baseline/junit.xml`, `api-baseline/html/index.html`
  - `harness-eval/baseline-pre/...`, `harness-eval/baseline-post/...`
  - `harness-eval/mutations/<mutation-id>/...`
- Reproduce the local evidence:
  ```sh
  npm run typecheck
  npm run test:unit
  npm run contract:validate && npm run contract:selftest
  npm run qa:traceability && npm run qa:traceability:selftest
  npm run harness:selftest
  npm run harness:eval:selftest
  npm run reports:selftest
  PLAYWRIGHT_HTML_REPORT="$PWD/reports/api-baseline/html" \
  PLAYWRIGHT_HTML_OPEN=never \
  PLAYWRIGHT_JUNIT_OUTPUT_FILE="$PWD/reports/api-baseline/junit.xml" \
    npm run test:api -- --reporter=list,html,junit
  npm run harness:eval -- \
    --evidence evidence/generated/ci-harness-eval \
    --reports reports/harness-eval
  npm run reports:verify -- --reports reports
  actionlint .github/workflows/qa.yml
  git diff --exit-code -- contract/openapi.yaml
  ```
- Evidence: `evidence/generated/aql-500-ci-20261101T0345Z/` (gitignored) —
  `environment.txt`, `exit-codes.txt` (16 commands, all 0), per-command
  `*.log`/`*.stderr.log`, `reports/` (HTML + JUnit), `eval/summary.json` and
  per-run logs/exit codes, `junit-summary.txt`, `report-files.txt`,
  `sut-hash-final.txt`, `git-status.txt`, `npm-ls.log`. Development probes
  under `evidence/generated/reporter-probe*/` are retained but superseded.
  Fallback re-validation `evidence/generated/aql-500-ci-20261101T0348Z/`
  (2026-11-01T03:53Z, 17 commands all exit 0, no code change) reproduces every
  count and adds `workflow-check.log`, `sut-hash-before.txt` and the
  `harness-eval/baseline-post` report to the same layout. Round-1 fix evidence
  `evidence/generated/aql-500-ci-20261101T0400Z/` (2026-11-01T04:01Z, 17
  commands all exit 0) re-runs the full set against the strengthened verifier
  (`reports:selftest` 14/14) and records the synthetic-probe rejection.
  Remote evidence: GitHub Actions run 41271870930 (SUCCESS, attempt 1, push to
  `main`, exact head `9dad20e`; Node 24.22.1, Playwright 1.64.1) with all four
  artifacts present and unexpired; the reviewer downloaded the evidence
  artifact to `evidence/generated/aql-500-remote-41271870930/harness-eval-evidence/`
  (archive hash matches the GitHub digest) and returned full G5 APPROVED PASS.
- Development history (not a gate claim): the first reporter probe used
  `PLAYWRIGHT_JUNIT_OUTPUT_NAME`, which writes relative to the Playwright config
  directory; switching to `PLAYWRIGHT_JUNIT_OUTPUT_FILE` with an absolute path
  fixed the output location. The first workflow draft used
  `git diff --exit-code -- sut/src/app.ts` for the restore check; it was
  replaced with a pre/post SHA-256 comparison because the local worktree
  legitimately carries uncommitted AQL-300 changes, while CI still restores
  from git on mismatch. The legitimate assertions, tests and contract were not
  weakened.
- Known limitations:
  - **Remote run observed:** run 41271870930 (SUCCESS, exact head `9dad20e`)
    completed G5; see `reviews/AQL-500.md` for the independent verification.
  - Artifact upload and GitHub-side log rendering were exercised by that
    remote run (four artifacts present and unexpired); `actionlint` plus the
    local same-command runs remain the pre-push validation record.
  - `reports:verify` pins the baseline at 32 tests with the exact 32-id QA
    inventory, and the three mutation expectations with exact spec inventories
    (9/2/2) plus Playwright HTML markers; a deliberate suite/mutation change
    requires updating those constants from fresh discovery output.
  - The JUnit/HTML verifier checks structure, counts, exact testcase
    inventories, intended failing ids and Playwright-specific report markers;
    it is not a full XML-schema validator, and its checks are described as
    consistency/authenticity sanity checks, not cryptographic provenance.
  - `actionlint` was built into the session temp directory, not added to the
    repository or a global config.
- User deletions preserved: `.opencode/agents/builder.md`,
  `.opencode/agents/reviewer.md`, `.opencode/commands/*` and `opencode.json`
  remain deleted and were not restored.
- Local work committed and pushed as `9dad20e` (user-authorized; pre-existing
  external deletions excluded). `contract/openapi.yaml` is unchanged.
  AQL-600 has not started.
