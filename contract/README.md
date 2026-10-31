# Contract

`openapi.yaml` is the normative contract for the local Inventory API. It was written
before the SUT and the QA suite (AQL-100); both must conform to it. The contract is
never weakened to turn a failing test green — a mismatch is either a SUT defect or a
test defect, decided by reading the contract, not by editing it until green.

## Files

| File | Purpose |
| --- | --- |
| `openapi.yaml` | OpenAPI 3.1 contract, requirement IDs and error-code registry |
| `../harness/contract-check.ts` | `contract:validate` CLI — parses and validates the contract |
| `../harness/contract-rules.ts` | Pure rule set used by the CLI and the self-test |
| `../harness/contract.selftest.ts` | `contract:selftest` — 1 baseline + 55 negative controls with asserted check ids |

## Conventions

- **Requirement IDs** — `REQ-<AREA>-<NN>`, declared in the top-level `x-requirements`
  array with `id`, `area`, `scope`, `statement` and `appliesTo`. `appliesTo` is the
  definitive applicability matrix: every operation's `x-requirement-ids` must match it
  exactly (missing and extra links both fail). `scope: global` marks rules that apply
  across the API (all error responses, unmatched routes); those entries list no
  operations. Areas: `environment`, `auth`, `items`, `validation`, `isolation`, `errors`.
- **Error codes** — every error response uses `application/problem+json` (RFC 9457)
  with `type`, `title`, `status`, `code`, `detail` and, for `validation_failed`, an
  `errors[]` array of `{field, code, message}`. Codes are registered in
  `x-error-codes` with their fixed HTTP status. Each operation lists its possible codes
  in the response-level `x-error-codes`; a registered non-global code must be used by at
  least one response.
- **Authentication** — `POST /auth/login` returns an opaque bearer token. All item
  endpoints require `Authorization: Bearer <token>` and answer 401 with
  `WWW-Authenticate: Bearer` when it is missing or invalid.
- **Cross-user isolation** — two synthetic users exist (`alice`, `bob`). An item owned
  by another user is indistinguishable from a nonexistent item: `GET`, `PATCH` and
  `DELETE` return 404 `item_not_found`, never 403. See `DECISIONS.md` D009.
- **Boundaries** — `name` (supplied value) 1–80 chars containing a non-whitespace
  character, trimmed before storage; `price` 0–1,000,000 with at most two decimals;
  `quantity` integer 0–10,000; `description` ≤ 500 chars; `category` in
  `electronics|books|food|other`; `limit` 1–100 (default 20); `offset` ≥ 0 (default 0).
- **Ordering** — `GET /items` returns items by ascending `createdAt`, ties broken by
  ascending `id`, so pagination assertions are deterministic.

## Verification

```sh
npm run contract:validate   # 21 checks: schema, auth, errors, headers, examples, instances, boundaries
npm run contract:selftest   # 56 cases: 1 baseline + 55 mutations, each rejected at its declared check
npm run typecheck
```

`contract:validate` exits 0 only when every check passes. It fails closed on a missing
file, invalid YAML, a non-3.1 document, an external or overridden `servers` URL, an
extra operation or method, an operation without requirement links, links that disagree
with `appliesTo`, malformed `appliesTo`, an unregistered/orphan/mis-statused error
code, a missing required error response, a missing or non-JSON request body, a `$ref`
schema with siblings, a missing login token schema, a header that does not reference
its approved `#/components/headers/*` definition at its applicable response, a wrong
header/status/example, a permissive object schema, content on a 204, a non-problem
error media type, a missing or weakened `Problem` conditional, or a boundary that any
of the 63 tested instances would violate (component plus POST /items operation-level
schemas, PATCH max-price and field-type probes included). The 63 instances establish
their tested cases, not universal protection against every possible schema contradiction.

Reject cases in `contract:selftest` assert the exact check id that must fail. Cases
targeting a specific subrule additionally assert a diagnostic substring
(`expectFailDetail`); the remaining cases guarantee check-level attribution only.


QA tests in `qa/` must cite requirement IDs in their titles or annotations so
`docs/test-plan.md` and the results can be traced back to this contract.
