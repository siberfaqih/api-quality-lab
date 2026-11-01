# Tasks

Use statuses: TODO, IN_PROGRESS, REVIEW_REQUIRED, BLOCKED, DONE.

| Task ID | Title | Status | Gate |
| --- | --- | --- | --- |
| AQL-000 | Bootstrap Node/TypeScript, inspect environment, create harness:doctor | DONE | G0 |
| AQL-100 | Design OpenAPI contract and expected behaviors | DONE | G1 |
| AQL-200 | Implement local Inventory SUT and SUT unit tests | DONE | G2 |
| AQL-300 | Implement 22+ Playwright tests and traceability | DONE | G3 |
| AQL-400 | Implement harness:eval and three controlled mutations | DONE | G4 |
| AQL-500 | Implement GitHub Actions and reports | DONE | G5 |
| AQL-600 | Document simulated defect, case study and reproducibility | TODO | G6 |

Each DONE task requires: implementation evidence, relevant gate PASS, reviewer approval with no open blocking findings. Record verified command/results in `PROGRESS.md`.

AQL-300 is DONE. Round 1 returned CHANGES_REQUESTED (MEDIUM 1–3 and
one LOW); all four findings were fixed and a fresh evidence set passed.
The same reviewer session re-reviewed and returned APPROVED with G3 PASS
locally. The review, disposition and re-review summary are in
`reviews/AQL-300.md`. AQL-400 was started afterwards and is now DONE.

AQL-300 status history: TODO → IN_PROGRESS (2026-10-31T23:05Z) →
REVIEW_REQUIRED (2026-10-31T23:29Z) → IN_PROGRESS (2026-11-01, review
CHANGES_REQUESTED) → REVIEW_REQUIRED (2026-11-01, fixes + fresh evidence)
→ DONE (2026-11-01, re-review APPROVED).

AQL-400 is DONE. Round 1 returned CHANGES_REQUESTED (MEDIUM: broad assertion
substrings accepted HTTP 500 and wrong expected/received semantics; see
`reviews/AQL-400.md`). The classifier was strengthened to require the exact
Playwright `Expected:`/`Received:` pair for every expected failure, reject HTTP
500 and missing/ambiguous values; the auth test asserts status 401 before the
challenge header, and the self-test has 37 controls including HTTP-500 and
wrong-received negatives for every expected QA id. A fresh evidence set passed,
and the same reviewer session re-reviewed and returned APPROVED with G4 PASS
locally.

AQL-500 is DONE. Round-2 review returned APPROVED locally (G5 local PASS, no
open local blockers). After the user-authorized commit/push of `9dad20e`,
the same reviewer independently verified the successful GitHub Actions run
https://github.com/siberfaqih/api-quality-lab/actions/runs/41271870930
(SUCCESS, attempt 1, push to main, exact head `9dad20e`) and returned full G5
APPROVED PASS: Node 24.22.1 / Playwright 1.64.1; doctor 11/11; contract 21/21
+ selftest 56/56; unit 29/29; traceability 32/28/32 + selftest 9/9; harness
selftest 16/16; eval selftest 37/37; reports selftest 14/14; API 32/32 with
HTML/JUnit; `harness:eval` 3/3 with correct semantics and baselines 32/32
twice; SUT sha `c2f33ba463f9f6f5ffe2db312bc026b14045ea7088bc31c2d3b8d762e9d2d7fd`
exact before/after; `reports:verify` PASS; all four artifacts present and
unexpired at the exact head. Reviewer evidence:
`evidence/generated/aql-500-remote-41271870930/harness-eval-evidence/`
(archive hash matches GitHub digest). Full record in `reviews/AQL-500.md`.

AQL-400 status history: TODO → IN_PROGRESS (2026-11-01) → REVIEW_REQUIRED
(2026-11-01, evidence `aql-400-g4-20261101T0314Z`) → IN_PROGRESS (2026-11-01,
review CHANGES_REQUESTED) → REVIEW_REQUIRED (2026-11-01, fixes + fresh evidence
`aql-400-g4-r2-20261101T0328Z`) → DONE (2026-11-01, re-review APPROVED).

AQL-500 status history: TODO → IN_PROGRESS (2026-11-01) → REVIEW_REQUIRED
(2026-11-01, local evidence `aql-500-ci-20261101T0345Z`; G5 remote NOT VERIFIED)
→ IN_PROGRESS (2026-11-01, fallback re-validation) → REVIEW_REQUIRED
(2026-11-01, fresh evidence `aql-500-ci-20261101T0348Z`, 17/17 exit 0, no code
change; G5 remote still NOT VERIFIED)
→ IN_PROGRESS (2026-11-01, round-1 review CHANGES_REQUESTED) →
REVIEW_REQUIRED (2026-11-01, verifier strengthened + fresh evidence
`aql-500-ci-20261101T0400Z`, 17/17 exit 0; round-2 review pending, G5 remote
still NOT VERIFIED) → BLOCKED (2026-11-01, round-2 review APPROVED locally,
G5 local PASS, no open local blockers; unblocks on authorized commit/push +
successful observed Actions run; never DONE before that) → DONE (2026-11-01,
user-authorized commit/push `9dad20e`, remote run 41271870930 SUCCESS,
reviewer full G5 APPROVED PASS).
