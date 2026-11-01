# Tasks

Use statuses: TODO, IN_PROGRESS, REVIEW_REQUIRED, BLOCKED, DONE.

| Task ID | Title | Status | Gate |
| --- | --- | --- | --- |
| AQL-000 | Bootstrap Node/TypeScript, inspect environment, create harness:doctor | DONE | G0 |
| AQL-100 | Design OpenAPI contract and expected behaviors | DONE | G1 |
| AQL-200 | Implement local Inventory SUT and SUT unit tests | DONE | G2 |
| AQL-300 | Implement 22+ Playwright tests and traceability | DONE | G3 |
| AQL-400 | Implement harness:eval and three controlled mutations | DONE | G4 |
| AQL-500 | Implement GitHub Actions and reports | BLOCKED | G5 |
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

AQL-500 is BLOCKED (not DONE). Round-2 review (`reviews/AQL-500.md`, same
reviewer session) returned APPROVED locally with no open local blockers:
HTML title + embedded-marker check, exact 32-id QA inventories, exact
mutation spec inventories (9/2/2) with intended failing subsets, and the
14-case self-test all verified; the previous generic/`QA-FAKE` bypass probe is
rejected (exit 1, 24 errors); typecheck 0, unit 29/29, contract 21/21,
traceability 32/28/32, fresh API 32/32 with HTML/JUnit, `harness:eval` 3/3
with baselines 32/32 twice, fresh and supplied `reports:verify` PASS,
`actionlint` 0, contract unchanged, final SUT sha
`c2f33ba463f9f6f5ffe2db312bc026b14045ea7088bc31c2d3b8d762e9d2d7fd` exact
pre/post. Reviewer evidence: `evidence/generated/aql-500-review-r2-20261101/eval/`.
**G5 local PASS; G5 remote NOT VERIFIED.** Unblocking requires explicit user
authorization for commit/push plus one successful observed GitHub Actions
run; AQL-500 must never go directly DONE before that.

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
successful observed Actions run; never DONE before that).
