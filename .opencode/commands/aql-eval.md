---
description: Run available quality gates, report actual results, and never invent successes
agent: builder
---
Inspect package.json and EVALUATION.md. Run only real scripts that exist, including typecheck, unit, API and harness evaluation as applicable. Do not claim a missing script succeeded. Record each command, exit code and evidence location in PROGRESS.md, then summarize PASS/FAIL/BLOCKED/NOT VERIFIED. No remote CI success claim without actual GitHub Actions evidence.
