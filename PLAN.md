# Project Plan — API Quality Lab

This is a bootstrap scaffold, not a completed or tested framework.

| Phase | Deliverable | Gate |
| --- | --- | --- |
| 0 | Inspect environment, initialize Node/TS and harness | G0 prerequisites verified |
| 1 | OpenAPI contract and requirement IDs | G1 OpenAPI validates; rules unambiguous |
| 2 | Minimal local Inventory API, synthetic users and isolated fixtures | G2 health and SUT unit tests pass |
| 3 | 22+ API tests and traceability matrix | G3 repeated runs pass and no order dependency |
| 4 | Executable evaluation harness and mutation checks | G4 three intended mutations detected; clean restore |
| 5 | CI workflow + HTML/JUnit/artifact upload | G5 local valid; remote verified separately |
| 6 | Simulated defect report, case study and reviewer-ready docs | G6 all evidence honest and reproducible |

## Ground rules
Contract before implementation. Focus on QA evidence, not a polished business UI. Prefer small increments with targeted verification. No phase passes based on prose-only claims.

## Proposed endpoints
- GET /health
- POST /auth/login
- GET/POST /items
- GET/PATCH/DELETE /items/{id}

## Expected artifacts
`contract/openapi.yaml`, `sut/`, `qa/`, `harness/`, `docs/`, `reviews/`, `.github/workflows/qa.yml`. Do not create empty deliverables solely to pad the tree.
