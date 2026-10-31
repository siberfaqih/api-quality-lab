# API Quality Lab — OpenCode Starter Scaffold

**Setup only.** This archive initializes OpenCode custom roles, project rules, commands, and persistent harness documents. It does NOT yet contain a functioning Inventory API, test suite, package.json, or working evaluator.

## First launch
1. Install stable OpenCode, Node.js 24 and Git.
2. Connect your selected provider in OpenCode (`/connect`), choose a model (`/models`).
3. From this repository directory, run `opencode agent list` and check for `builder` and `reviewer`.
4. Run `opencode` and enter `/aql-next` to implement Phase 0.
5. After a task is `REVIEW_REQUIRED`, use `/aql-review` to invoke the read-only Reviewer.
6. Builder saves the returned findings to `reviews/<task-id>.md`, fixes blocking findings, then re-checks the gate.
7. Use `/aql-resume` after interruption.

## Model selection
Model IDs are not hardcoded. Set the model interactively first. To assign a different model per role, add `model: provider/model-id` to that role's YAML frontmatter, using the exact ID from your OpenCode `/models` list. This avoids guessing provider availability.

## Scope
Node 24, TypeScript, Playwright APIRequestContext, minimal Inventory SUT, OpenAPI contract, 22+ meaningful tests, mutation verification, GitHub Actions and a case study grounded in real evidence.

## Quality reminder
A Markdown task status is not executable verification. Do not claim G0-G6 PASS before code and actual test runs substantiate the result.
