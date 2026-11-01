# AQL-300 Traceability Matrix

Every test title carries a `QA-*` case id and one or more contract
requirement ids from `contract/openapi.yaml`. The executable check
`npm run qa:traceability` reconciles this matrix against Playwright's own
`--list --reporter=json` discovery, so only registered executable tests
count. It fails closed when a test has no QA/REQ id, when a contract
requirement has no test, or when this matrix omits or disagrees with a
test. `npm run qa:traceability:selftest` exercises the parser and
reconciliation with negative controls.

| Test ID | Contract requirement(s) | Spec file | Operation(s) | Kind | Main assertions |
| --- | --- | --- | --- | --- | --- |
| QA-ENV-01 | REQ-ENV-01 | `health.spec.ts` | `GET /health` | positive + auth negative | exact `{status:"ok", version:"1.0.0"}`, JSON media type, semver, invalid bearer is ignored |
| QA-AUTH-01 | REQ-AUTH-01, REQ-AUTH-06 | `auth.spec.ts` | `POST /auth/login` | positive | opaque non-JWT token, `Bearer`, positive `expiresIn`, exact alice user, no password material |
| QA-AUTH-02 | REQ-AUTH-06 | `auth.spec.ts` | `POST /auth/login`, `POST /items`, `GET /items` | positive | bob token identifies bob only; each token creates and lists only its owner's item |
| QA-AUTH-03 | REQ-AUTH-02 | `auth.spec.ts` | `POST /auth/login` | negative | unknown user and wrong password return identical 401 `invalid_credentials` + `WWW-Authenticate: Bearer`, no token |
| QA-AUTH-04 | REQ-AUTH-03 | `auth.spec.ts` | `POST /auth/login` | negative | missing, blank, non-string and unknown login fields return 400 naming the field, no token |
| QA-AUTH-05 | REQ-VAL-06, REQ-ERR-01 | `auth.spec.ts` | `POST /auth/login` | negative | malformed and empty JSON return 400 `malformed_json`; `text/plain` returns 415 `unsupported_media_type` |
| QA-AUTHZ-01 | REQ-AUTH-04 | `authz.spec.ts` | all five protected operations | negative | no `Authorization` returns 401 `missing_token` + challenge on every operation, item data absent, target item unchanged |
| QA-AUTHZ-02 | REQ-AUTH-05 | `authz.spec.ts` | all five protected operations | negative | non-Bearer, bare Bearer and unknown token return 401 `invalid_token` on every operation, item unchanged |
| QA-CRUD-01 | REQ-ITEM-01 | `items-crud.spec.ts` | `POST /items` | positive | 201, `Location: /items/{id}`, UUID, owner, trimmed name, defaults, exact item fields, equal timestamps, re-read equal |
| QA-CRUD-02 | REQ-ITEM-02 | `items-crud.spec.ts` | `GET /items/{id}` | positive | owned item is byte-for-byte the creation representation |
| QA-CRUD-03 | REQ-ITEM-06 | `items-crud.spec.ts` | `PATCH /items/{id}`, `GET /items/{id}` | positive | only supplied fields change; id/owner/createdAt/untouched fields preserved; updatedAt advances; persists |
| QA-CRUD-04 | REQ-ITEM-07 | `items-crud.spec.ts` | `DELETE /items/{id}`, `GET /items/{id}`, `GET /items` | positive + negative | 204 empty body; later GET and second DELETE return 404; other item remains |
| QA-CRUD-05 | REQ-ITEM-08 | `items-crud.spec.ts` | `GET`, `PATCH`, `DELETE /items/{id}` | negative | unknown id gives identical 404 `item_not_found`; PATCH/DELETE create and mutate nothing |
| QA-CRUD-06 | REQ-ITEM-09 | `items-crud.spec.ts` | `PATCH /items/{id}` | negative | `{}` and no body return 400 `validation_failed`; item unchanged |
| QA-LIST-01 | REQ-ITEM-03 | `items-list.spec.ts` | `GET /items` | positive | exact envelope, default limit 20 / offset 0, total equals owned count, exact item shape |
| QA-LIST-02 | REQ-ITEM-04 | `items-list.spec.ts` | `GET /items` | positive | deterministic injected clock proves a three-item timestamp tie; two calls agree; ascending createdAt with ascending id tie-break |
| QA-LIST-03 | REQ-ITEM-05 | `items-list.spec.ts` | `GET /items` | positive | limit/offset slice correctly; offset beyond total is empty with unchanged total; limit 1 and 100 boundaries |
| QA-LIST-04 | REQ-ITEM-05 | `items-list.spec.ts` | `GET /items` | negative | limit 0/101/abc/1.5 and offset -1/abc/1.5 return 400 naming the field; existing item remains |
| QA-VAL-01 | REQ-VAL-01 | `validation.spec.ts` | `POST`, `PATCH /items` | positive + negative | name required on create; blank/too-long/non-string rejected on create and update with exact FieldError codes; trim and 80-char bound on create and update; failed PATCH leaves the item unchanged |
| QA-VAL-02 | REQ-VAL-02 | `validation.spec.ts` | `POST`, `PATCH /items` | positive + negative | price negative/over-limit/over-precision/non-number rejected on create and update; 0, 19.99 and 1,000,000 accepted on both; failed PATCH leaves the item unchanged |
| QA-VAL-03 | REQ-VAL-03 | `validation.spec.ts` | `POST`, `PATCH /items` | positive + negative | quantity negative/fractional/over-limit/non-number rejected on create and update; 0 and 10,000 accepted on both; failed PATCH leaves the item unchanged |
| QA-VAL-04 | REQ-VAL-04 | `validation.spec.ts` | `POST`, `PATCH /items` | positive + negative | description/category defaults, 500-char bound, enum and type rejection; failed PATCH preserves the item |
| QA-VAL-05 | REQ-VAL-05 | `validation.spec.ts` | `POST`, `PATCH /items` | negative | unknown create/update properties rejected as `unknown_property`, never ignored; item unchanged |
| QA-VAL-06 | REQ-VAL-06 | `validation.spec.ts` | `POST`, `PATCH /items` | negative | malformed JSON 400 `malformed_json`; `text/plain` 415 `unsupported_media_type`; item unchanged |
| QA-VAL-07 | REQ-VAL-07 | `validation.spec.ts` | `POST`, `PATCH /items` | negative | one 400 lists every invalid field; no item created; failed PATCH mutates nothing |
| QA-VAL-08 | REQ-VAL-01, REQ-VAL-04 | `validation.spec.ts` | `POST`, `PATCH /items` | boundary | Unicode code-point bounds: 80/500 accepted, 81/501 rejected |
| QA-VAL-09 | REQ-VAL-02 | `validation.spec.ts` | `POST`, `PATCH /items` | boundary | tiny fractional-cent and near-cent prices rejected on create and patch; item unchanged |
| QA-ISO-01 | REQ-ISO-01 | `isolation.spec.ts` | `GET`, `PATCH`, `DELETE /items/{id}`, `GET /items` | negative | bob gets the same 404 as a nonexistent id on read/update/delete; alice's item is unchanged; bob's list is empty |
| QA-ISO-02 | REQ-ISO-02 | `isolation.spec.ts` | `GET /items` | negative | bob's list never contains alice's items at default/1/100/offset 5; after bob creates, each user sees only their own |
| QA-ERR-01 | REQ-ERR-01 | `errors.spec.ts` | all error paths | contract | every representative error is `problem+json` with status equal to HTTP status and a code registered in `x-error-codes` |
| QA-ERR-02 | REQ-ERR-02 | `errors.spec.ts` | all error paths | contract | no stack traces, filesystem paths, SQL or synthetic credentials; exact Problem/FieldError keys |
| QA-ERR-03 | REQ-ERR-03 | `errors.spec.ts` | unmatched routes/methods | negative | `GET /no-such-route`, `PUT /items`, `POST /health`, `DELETE /auth/login`, `PATCH /items` all return 404 `route_not_found` problem+json |

## Requirement coverage summary

| Area | Requirements | Covered by |
| --- | --- | --- |
| environment | REQ-ENV-01 | QA-ENV-01 |
| auth | REQ-AUTH-01 … REQ-AUTH-06 | QA-AUTH-01, QA-AUTH-02, QA-AUTH-03, QA-AUTH-04, QA-AUTHZ-01, QA-AUTHZ-02 |
| items | REQ-ITEM-01 … REQ-ITEM-09 | QA-CRUD-01 … QA-CRUD-06, QA-LIST-01 … QA-LIST-04 |
| validation | REQ-VAL-01 … REQ-VAL-07 | QA-VAL-01 … QA-VAL-09, QA-AUTH-04, QA-AUTH-05 |
| isolation | REQ-ISO-01, REQ-ISO-02 | QA-ISO-01, QA-ISO-02 |
| errors | REQ-ERR-01 … REQ-ERR-03 | QA-ERR-01, QA-ERR-02, QA-ERR-03, QA-AUTH-05 |

All 28 requirement ids declared in `contract/openapi.yaml` are referenced
by at least one executable test title. The matrix is verified mechanically;
it is not a claim of line or branch coverage.
