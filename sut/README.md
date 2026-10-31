# Inventory SUT

Intentionally simple local system under test for the API Quality Lab QA
framework. It implements `contract/openapi.yaml` and nothing more: no
database, no frontend, no external services.

## Run

```sh
npm run sut:start          # http://127.0.0.1:3000
PORT=3100 npm run sut:start
```

Stop with `Ctrl-C` (`SIGINT`/`SIGTERM` close the server gracefully).
The server binds to `127.0.0.1` only.

## Synthetic users

| username | password         | user id    |
| -------- | ---------------- | ---------- |
| `alice`  | `alice-password` | `usr_alice` |
| `bob`    | `bob-password`   | `usr_bob`   |

These are local synthetic fixtures (DECISIONS D011/D012), not real
credentials. `POST /auth/login` returns an opaque bearer token
(`expiresIn` 3600 seconds, enforced); send it as
`Authorization: Bearer <token>`.

## Pagination representability

`limit` and `offset` accept every integer in their contract ranges.
Digit strings too large to represent as a safe JavaScript integer
(for example a 400-digit offset, which would overflow to `Infinity`)
return `400 validation_failed` naming the field instead of a
schema-invalid success response. This is a representability limit of
the runtime, not an additional contract maximum.

## State and reset

All state (items and tokens) lives in memory inside one server
instance. Restarting the server — or calling the exported `reset()`
from `createInventoryServer()` in tests — returns to an empty
fixture. That restart is the isolation boundary the QA suite will use
(AQL-300, not yet implemented); there is deliberately no reset
endpoint in the contract.

## Files

| File           | Purpose                                          |
| -------------- | ------------------------------------------------ |
| `src/app.ts`   | `createInventoryServer()` — routes, auth, validation, in-memory store |
| `src/server.ts`| Entrypoint: `PORT` env (default 3000), graceful shutdown |
| `app.test.ts`  | SUT unit/API tests (`npm run test:unit`), titled by requirement ID |

## Tests

```sh
npm run test:unit   # node --test sut/app.test.ts (ephemeral port)
npm run typecheck
```
