# API Quality Lab — Repository Instructions

This repository is a portfolio-oriented automated REST API test framework for the demo Inventory API. The quality of testing, evidence and honest defect analysis matters more than building application features.

## Harness instructions
Before work: read `PLAN.md`, `TASKS.md`, `PROGRESS.md`, and `EVALUATION.md`. If a contract exists, read `contract/openapi.yaml` before SUT or QA edits. Inspect `git status`; do not overwrite external changes.

### Roles
- `.opencode/agents/builder.md`: OpenCode primary coding agent.
- `.opencode/agents/reviewer.md`: read-only OpenCode review subagent.
- Builder performs implementation and checks, Reviewer independently audits.
- Reviewer returns findings to the Builder; Builder persists them in `reviews/<task-id>.md`. This avoids granting write access to the read-only reviewer.

### Gate cycle
`TODO -> IN_PROGRESS -> REVIEW_REQUIRED -> DONE`

If checks fail or the reviewer finds blocking issues, return to `IN_PROGRESS`; do not claim DONE. `BLOCKED` means there is a documented impediment. Verified means an actual command was run and its result was recorded.

### Source of truth
- Requirements/API behavior: `contract/openapi.yaml` (created before implementation).
- Tasks and gates: `TASKS.md` and `EVALUATION.md`.
- Checkpoint/log: `PROGRESS.md`.
- Decisions: `DECISIONS.md`.

### Technical expectations
- Node.js 24, TypeScript, Playwright Test APIRequestContext.
- Minimal local SUT, two synthetic users, auth and CRUD, resettable fixtures.
- At least 22 meaningful automated QA cases mapped to contract requirement IDs.
- Contract validation, unit, functional API tests, mutation detection, HTML/JUnit results, GitHub Actions.
- Do not invent coverage percentages, passing tests, remote CI status, bug findings or client work.
- Never alter or disable a legitimate failing assertion to force a green run.
- No network scanning or testing of third-party assets.

### Scope control
No frontend dashboard, cloud architecture or paid APIs are required. No commits, pushes or external publication without user approval.
