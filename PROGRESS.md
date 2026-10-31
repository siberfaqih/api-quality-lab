# Progress Log

Current phase: 2 — SUT complete; next is phase 3 (QA suite)
Current task: AQL-300 (TODO) — 22+ Playwright tests and traceability (G3)
Last verified checkpoint: 2026-10-31T11:25Z — AQL-200 DONE: independent reviewer APPROVED (round 2, after round-1 CHANGES_REQUESTED fixes R1–R6 and non-blocking R2-1/R2-2 corrections); test:unit 29/29 twice, typecheck 0, contract:validate 21/21, contract:selftest 56/56, doctor 11/11, harness:selftest 16/16, server start/stop smoke PASS

## Important distinction
The OpenCode role configuration and documentation scaffold were prepared externally. As of AQL-000, `harness/doctor.ts` has actually been executed locally and its output recorded below. **No Playwright tests, mutation harness or remote GitHub Actions have been executed yet.** The local Inventory SUT and its unit tests were executed for AQL-200 (journal below); no gate beyond G2's local portion is claimed for it.

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

> The G1–G6 rows above are the audit state **as of 2026-10-31T08:52Z** (historical, superseded): G1 has since been implemented (see "Gate G1" below) and G2 has since been implemented (see "Gate G2" below). At that audit time, G2–G6 were BLOCKED / NOT VERIFIED.

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
AQL-200 is DONE. Start AQL-300 — implement the 22+ Playwright API tests and traceability matrix against this SUT (G3). Commit + push of the AQL-200 increment was authorized by the user after APPROVED (2026-10-31); see git log for the resulting commit.

## Handoff — AQL-100 (DONE)

- Scope: normative OpenAPI 3.1 contract + fail-closed validator + 56-case self-test. No SUT, Playwright, mutation harness or CI claimed.
- Files: `contract/openapi.yaml` (28 reqs, 8 codes, 7 ops), `harness/contract-rules.ts`, `harness/contract-check.ts`, `harness/contract.selftest.ts`; modified `package.json` (+`yaml`, `swagger-parser`, `ajv`), `package-lock.json`, `contract/README.md`, `DECISIONS.md` (D008–D011), `PROGRESS.md`, `TASKS.md`.
- Verification: `npm run contract:validate` 21/21 exit 0; `npm run contract:selftest` 56/56 exit 0 (every reject asserts `expectFailCheck`, targeted assert `expectFailDetail`); `contract.instances` 63 probes; `npm run typecheck` 0; `npm run harness:doctor` 11/11; `npm run harness:selftest` 16/16; whole-file `JSON.parse` of `contract-validate.json` OK.
- Review history: round 1 CHANGES_REQUESTED (5 MEDIUM) → fixed; round 2 CHANGES_REQUESTED (2 MEDIUM+3 LOW) → fixed; round 3 CHANGES_REQUESTED (2 MEDIUM) → fixed; round 4 CHANGES_REQUESTED (evidence only R4-1) → fixed with separated streams; round 5 APPROVED. Full verbatim in `reviews/AQL-100.md`.
- Evidence: `evidence/generated/aql-100-contract-r5-20261031T0947Z/` (gitignored) + retained r1–r4 dirs (r4 preserves the mixed-stream defect for audit).
- Diff/commit reference: uncommitted increment at `f82a0c8` (no commit/push per scope control); inspect with `git status --short`, `git diff --stat`.
- Known limitations: validator is document-only; `multipleOf:0.01` intent needs behavioral AQL-300 tests; `x-*` extensions enforced only by this repo; field-error vocabulary not enum; explicit operation constants; 63 instances cover tested cases; `uuid`/`date-time` formats ignored (warnings in `*.stderr.log`).
- Explicit request: independent `@reviewer` audit already returned APPROVED for AQL-100 (session `ses_e6ebf0dfcffdnQiMXMTgC6G4p0`); no further review pending for this task. Do not pretend additional review ran beyond what is persisted in `reviews/AQL-100.md`.
