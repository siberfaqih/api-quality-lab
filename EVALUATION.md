# Evaluation Specification

## Status semantics
- PASS: check executed and passed, with result/evidence.
- FAIL: executed and failed.
- BLOCKED: not executable due to known prerequisite.
- NOT VERIFIED: not executed, insufficient evidence, or remote status unknown.

## Mandatory gates
- **G0:** Node, npm, git and project prerequisites inspected; setup runs without errors.
- **G1:** OpenAPI 3.1 contract parses and declares validation, auth, cross-user isolation, error semantics and boundaries.
- **G2:** Local SUT starts/stops reliably and unit tests pass.
- **G3:** At least 22 meaningful Playwright tests linked to contract requirements. Two consecutive passing runs and order-independent behavior verified.
- **G4:** Three isolated intentional mutations: negative price accepted, token validation skipped, cross-user authorization bypass. Relevant tests must fail for intended reason, not server/setup crash; SUT restored and baseline re-passes.
- **G5:** Typecheck/unit/API/harness evaluation in GitHub Actions. Remote CI PASS must be supported by an actual successful run, otherwise NOT VERIFIED.
- **G6:** Full reproducibility instructions, real outputs, simulated defect clearly labeled, documentation reflects verified code.

## Required proof per task
Command line, exit status, meaningful results, timestamp or checkpoint, and evidence location. Reviewer should inspect source and run independent checks where feasible. Only accept after no blocking findings remain.

## Security gates
Synthetic credentials only; no sensitive client data; no third-party scans; contract cannot be weakened to mask a failed assertion.
