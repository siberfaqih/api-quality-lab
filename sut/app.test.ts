import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createInventoryServer } from "./src/app.ts";

interface ProblemBody {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  errors?: Array<{ field: string; code: string; message: string }>;
}

interface ItemBody {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

let server: Server;
let reset: () => void;
let baseUrl: string;

before(async () => {
  const inventory = createInventoryServer();
  server = inventory.server;
  reset = inventory.reset;
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  baseUrl = `http://127.0.0.1:${(address as { port: number }).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
});

beforeEach(() => {
  reset();
});

async function login(username = "alice", password = "alice-password"): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { token: string };
  return body.token;
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function createItem(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ response: Response; body: ItemBody }> {
  const response = await fetch(`${baseUrl}/items`, {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ name: "Widget", price: 19.99, quantity: 5, ...overrides }),
  });
  const body = (await response.json()) as ItemBody;
  return { response, body };
}

function errorFields(problem: ProblemBody): string[] {
  return (problem.errors ?? []).map((entry) => entry.field);
}

describe("AQL-200 SUT unit tests", () => {
  it("REQ-ENV-01: GET /health returns ok + semver without evaluating credentials", async () => {
    const plain = await fetch(`${baseUrl}/health`);
    assert.equal(plain.status, 200);
    assert.equal(plain.headers.get("content-type"), "application/json");
    assert.deepEqual(await plain.json(), { status: "ok", version: "1.0.0" });

    const bogusAuth = await fetch(`${baseUrl}/health`, {
      headers: { Authorization: "Bearer not-a-real-token" },
    });
    assert.equal(bogusAuth.status, 200);
    assert.deepEqual(await bogusAuth.json(), { status: "ok", version: "1.0.0" });
  });

  it("REQ-AUTH-01/06: login returns opaque Bearer token and matching user, no password material", async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "alice-password" }),
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(typeof body["token"], "string");
    assert.ok((body["token"] as string).length >= 16);
    assert.equal(body["tokenType"], "Bearer");
    assert.equal(typeof body["expiresIn"], "number");
    assert.ok((body["expiresIn"] as number) > 0);
    assert.deepEqual(body["user"], { id: "usr_alice", username: "alice" });
    assert.equal(JSON.stringify(body).includes("alice-password"), false);
    assert.equal("password" in body, false);
  });

  it("REQ-AUTH-06: bob login identifies bob only", async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bob", password: "bob-password" }),
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { user: { id: string; username: string } };
    assert.deepEqual(body.user, { id: "usr_bob", username: "bob" });
  });

  it("REQ-AUTH-02: unknown user and wrong password return identical 401 invalid_credentials", async () => {
    const attempts: ProblemBody[] = [];
    for (const credentials of [
      { username: "mallory", password: "whatever-pass" },
      { username: "alice", password: "wrong-password" },
    ]) {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("content-type"), "application/problem+json");
      assert.equal(response.headers.get("www-authenticate"), "Bearer");
      attempts.push((await response.json()) as ProblemBody);
    }
    assert.deepEqual(attempts[0], attempts[1]);
    assert.equal(attempts[0]?.code, "invalid_credentials");
    assert.equal(attempts[0]?.status, 401);
  });

  it("REQ-AUTH-03: login validation names missing, blank and unknown fields", async () => {
    const cases: Array<{ payload: unknown; fields: string[] }> = [
      { payload: { password: "x" }, fields: ["username"] },
      { payload: { username: "   ", password: "x" }, fields: ["username"] },
      { payload: { username: "alice", password: "alice-password", admin: true }, fields: ["admin"] },
      { payload: { username: 42, password: "x" }, fields: ["username"] },
    ];
    for (const { payload, fields } of cases) {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      assert.equal(response.status, 400);
      const problem = (await response.json()) as ProblemBody;
      assert.equal(problem.code, "validation_failed");
      for (const field of fields) assert.ok(errorFields(problem).includes(field), `expected ${field}`);
    }
  });

  it("REQ-VAL-06: login rejects malformed JSON with 400 and non-JSON media type with 415", async () => {
    const malformed = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    assert.equal(malformed.status, 400);
    assert.equal(((await malformed.json()) as ProblemBody).code, "malformed_json");

    const plain = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "username=alice",
    });
    assert.equal(plain.status, 415);
    assert.equal(plain.headers.get("content-type"), "application/problem+json");
    assert.equal(((await plain.json()) as ProblemBody).code, "unsupported_media_type");
  });

  it("REQ-AUTH-04: protected endpoints without Authorization return 401 missing_token + challenge", async () => {
    for (const path of ["/items", "/items/00000000-0000-4000-8000-000000000000"]) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("www-authenticate"), "Bearer");
      const problem = (await response.json()) as ProblemBody;
      assert.equal(problem.code, "missing_token");
    }
  });

  it("REQ-AUTH-05: non-Bearer scheme, bare Bearer and unknown token return 401 invalid_token", async () => {
    for (const header of ["Basic abc123", "Bearer", "Bearer no-such-token"]) {
      const response = await fetch(`${baseUrl}/items`, { headers: { Authorization: header } });
      assert.equal(response.status, 401, header);
      assert.equal(response.headers.get("www-authenticate"), "Bearer");
      assert.equal(((await response.json()) as ProblemBody).code, "invalid_token");
    }
  });

  it("REQ-ITEM-01: create returns 201, Location, UUID id, owner, equal timestamps and defaults", async () => {
    const token = await login();
    const { response, body } = await createItem(token);
    assert.equal(response.status, 201);
    assert.match(response.headers.get("location") ?? "", /^\/items\/[0-9a-f-]{36}$/);
    assert.equal(response.headers.get("location"), `/items/${body.id}`);
    assert.match(body.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.equal(body.ownerId, "usr_alice");
    assert.equal(body.description, "");
    assert.equal(body.category, "other");
    assert.equal(body.createdAt, body.updatedAt);
  });

  it("REQ-VAL-01: create trims surrounding whitespace from name before storage", async () => {
    const token = await login();
    const { response, body } = await createItem(token, { name: "  Padded Name  " });
    assert.equal(response.status, 201);
    assert.equal(body.name, "Padded Name");
  });

  it("REQ-ITEM-02: GET own item returns values identical to creation response", async () => {
    const token = await login();
    const { body: created } = await createItem(token, { description: "blue", category: "books" });
    const response = await fetch(`${baseUrl}/items/${created.id}`, { headers: auth(token) });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()) as ItemBody, created);
  });

  it("REQ-ITEM-03/04/05: list envelope, deterministic ordering, slicing and offset beyond total", async () => {
    const token = await login();
    const createdIds: string[] = [];
    for (const name of ["first", "second", "third"]) {
      const { body } = await createItem(token, { name });
      createdIds.push(body.id);
    }

    const all = await fetch(`${baseUrl}/items`, { headers: auth(token) });
    assert.equal(all.status, 200);
    const list = (await all.json()) as { items: ItemBody[]; total: number; limit: number; offset: number };
    assert.equal(list.total, 3);
    assert.equal(list.limit, 20);
    assert.equal(list.offset, 0);
    const expectedOrder = [...list.items].sort((a, b) =>
      a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1,
    );
    assert.deepEqual(list.items, expectedOrder);
    assert.deepEqual(new Set(list.items.map((item) => item.id)), new Set(createdIds));

    const slice = await fetch(`${baseUrl}/items?limit=2&offset=2`, { headers: auth(token) });
    const sliceBody = (await slice.json()) as { items: ItemBody[]; total: number; limit: number; offset: number };
    assert.equal(sliceBody.items.length, 1);
    assert.deepEqual(sliceBody.items[0], expectedOrder[2]);
    assert.equal(sliceBody.total, 3);
    assert.equal(sliceBody.limit, 2);
    assert.equal(sliceBody.offset, 2);

    const beyond = await fetch(`${baseUrl}/items?offset=99`, { headers: auth(token) });
    const beyondBody = (await beyond.json()) as { items: ItemBody[]; total: number };
    assert.deepEqual(beyondBody.items, []);
    assert.equal(beyondBody.total, 3);
  });

  it("REQ-ITEM-05: invalid limit and offset return 400 naming the field", async () => {
    const token = await login();
    for (const [query, field] of [
      ["limit=0", "limit"],
      ["limit=101", "limit"],
      ["limit=abc", "limit"],
      ["limit=1.5", "limit"],
      ["offset=-1", "offset"],
      ["offset=1.5", "offset"],
    ] as const) {
      const response = await fetch(`${baseUrl}/items?${query}`, { headers: auth(token) });
      assert.equal(response.status, 400, query);
      const problem = (await response.json()) as ProblemBody;
      assert.equal(problem.code, "validation_failed");
      assert.ok(errorFields(problem).includes(field), query);
    }
  });

  it("REQ-ITEM-06: PATCH applies only supplied fields, preserves createdAt/ownerId, advances updatedAt and persists", async () => {
    const token = await login();
    const { body: created } = await createItem(token, { description: "keep me" });
    const response = await fetch(`${baseUrl}/items/${created.id}`, {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ price: 42.5 }),
    });
    assert.equal(response.status, 200);
    const updated = (await response.json()) as ItemBody;
    assert.equal(updated.price, 42.5);
    assert.equal(updated.name, created.name);
    assert.equal(updated.description, "keep me");
    assert.equal(updated.createdAt, created.createdAt);
    assert.equal(updated.ownerId, created.ownerId);
    assert.ok(updated.updatedAt > created.updatedAt, "updatedAt must strictly advance");

    const reread = await fetch(`${baseUrl}/items/${created.id}`, { headers: auth(token) });
    assert.deepEqual((await reread.json()) as ItemBody, updated);
  });

  it("REQ-ITEM-09: PATCH with empty object and with no body returns 400 validation_failed", async () => {
    const token = await login();
    const { body: created } = await createItem(token);

    const emptyObject = await fetch(`${baseUrl}/items/${created.id}`, {
      method: "PATCH",
      headers: auth(token),
      body: "{}",
    });
    assert.equal(emptyObject.status, 400);
    assert.equal(((await emptyObject.json()) as ProblemBody).code, "validation_failed");

    const noBody = await fetch(`${baseUrl}/items/${created.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    assert.equal(noBody.status, 400);
    assert.equal(((await noBody.json()) as ProblemBody).code, "validation_failed");
  });

  it("REQ-ITEM-07: DELETE returns 204 empty body, then GET and second DELETE return 404", async () => {
    const token = await login();
    const { body: created } = await createItem(token);

    const deleted = await fetch(`${baseUrl}/items/${created.id}`, {
      method: "DELETE",
      headers: auth(token),
    });
    assert.equal(deleted.status, 204);
    assert.equal(await deleted.text(), "");

    const after = await fetch(`${baseUrl}/items/${created.id}`, { headers: auth(token) });
    assert.equal(after.status, 404);
    assert.equal(((await after.json()) as ProblemBody).code, "item_not_found");

    const second = await fetch(`${baseUrl}/items/${created.id}`, {
      method: "DELETE",
      headers: auth(token),
    });
    assert.equal(second.status, 404);
  });

  it("REQ-ITEM-08: GET, PATCH and DELETE on unknown id return identical 404 and mutate nothing", async () => {
    const token = await login();
    const unknownId = "00000000-0000-4000-8000-000000000000";
    const got = await fetch(`${baseUrl}/items/${unknownId}`, { headers: auth(token) });
    assert.equal(got.status, 404);
    const gotProblem = (await got.json()) as ProblemBody;

    const patched = await fetch(`${baseUrl}/items/${unknownId}`, {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ price: 1 }),
    });
    assert.equal(patched.status, 404);
    assert.deepEqual((await patched.json()) as ProblemBody, gotProblem);

    const deleted = await fetch(`${baseUrl}/items/${unknownId}`, {
      method: "DELETE",
      headers: auth(token),
    });
    assert.equal(deleted.status, 404);

    const list = await fetch(`${baseUrl}/items`, { headers: auth(token) });
    assert.equal(((await list.json()) as { total: number }).total, 0);
  });

  it("REQ-ISO-01/02: bob cannot read, patch or delete alice's item and never lists it", async () => {
    const aliceToken = await login("alice", "alice-password");
    const { body: created } = await createItem(aliceToken, { name: "Alice only" });
    const bobToken = await login("bob", "bob-password");

    const got = await fetch(`${baseUrl}/items/${created.id}`, { headers: auth(bobToken) });
    assert.equal(got.status, 404);
    assert.equal(((await got.json()) as ProblemBody).code, "item_not_found");

    const patched = await fetch(`${baseUrl}/items/${created.id}`, {
      method: "PATCH",
      headers: auth(bobToken),
      body: JSON.stringify({ name: "Hijacked" }),
    });
    assert.equal(patched.status, 404);

    const deleted = await fetch(`${baseUrl}/items/${created.id}`, {
      method: "DELETE",
      headers: auth(bobToken),
    });
    assert.equal(deleted.status, 404);

    const bobList = await fetch(`${baseUrl}/items`, { headers: auth(bobToken) });
    const bobListBody = (await bobList.json()) as { items: ItemBody[]; total: number };
    assert.equal(bobListBody.total, 0);
    assert.deepEqual(bobListBody.items, []);

    const reread = await fetch(`${baseUrl}/items/${created.id}`, { headers: auth(aliceToken) });
    assert.equal(reread.status, 200);
    assert.equal(((await reread.json()) as ItemBody).name, "Alice only");
  });

  it("REQ-VAL-01..05/07: create validation boundaries and multi-field errors create nothing", async () => {
    const token = await login();
    const invalidCases: Array<{ payload: Record<string, unknown>; field: string }> = [
      { payload: { price: 1, quantity: 1 }, field: "name" },
      { payload: { name: "   ", price: 1, quantity: 1 }, field: "name" },
      { payload: { name: "x".repeat(81), price: 1, quantity: 1 }, field: "name" },
      { payload: { name: "ok", price: -0.01, quantity: 1 }, field: "price" },
      { payload: { name: "ok", price: 1.005, quantity: 1 }, field: "price" },
      { payload: { name: "ok", price: "9.99", quantity: 1 }, field: "price" },
      { payload: { name: "ok", price: 1, quantity: 1.5 }, field: "quantity" },
      { payload: { name: "ok", price: 1, quantity: 10001 }, field: "quantity" },
      { payload: { name: "ok", price: 1, quantity: 1, description: "d".repeat(501) }, field: "description" },
      { payload: { name: "ok", price: 1, quantity: 1, category: "toys" }, field: "category" },
      { payload: { name: "ok", price: 1, quantity: 1, ownerId: "usr_bob" }, field: "ownerId" },
    ];
    for (const { payload, field } of invalidCases) {
      const response = await fetch(`${baseUrl}/items`, {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify(payload),
      });
      assert.equal(response.status, 400, JSON.stringify(payload));
      const problem = (await response.json()) as ProblemBody;
      assert.equal(problem.code, "validation_failed");
      assert.ok(errorFields(problem).includes(field), `expected ${field} in ${JSON.stringify(problem)}`);
    }

    const multi = await fetch(`${baseUrl}/items`, {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ name: "", price: -1, quantity: -2 }),
    });
    assert.equal(multi.status, 400);
    const multiProblem = (await multi.json()) as ProblemBody;
    assert.deepEqual(new Set(errorFields(multiProblem)), new Set(["name", "price", "quantity"]));

    const boundary = await createItem(token, { name: "edges", price: 1000000, quantity: 10000 });
    assert.equal(boundary.response.status, 201);
    const zero = await createItem(token, { name: "zero", price: 0, quantity: 0 });
    assert.equal(zero.response.status, 201);

    const list = await fetch(`${baseUrl}/items`, { headers: auth(token) });
    assert.equal(((await list.json()) as { total: number }).total, 2);
  });

  it("REQ-VAL-06/07: create rejects malformed JSON and non-JSON media type; patch multi-error mutates nothing", async () => {
    const token = await login();
    const { body: created } = await createItem(token);

    const malformed = await fetch(`${baseUrl}/items`, {
      method: "POST",
      headers: auth(token),
      body: "{broken",
    });
    assert.equal(malformed.status, 400);
    assert.equal(((await malformed.json()) as ProblemBody).code, "malformed_json");

    const plain = await fetch(`${baseUrl}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
      body: "name=Widget",
    });
    assert.equal(plain.status, 415);
    assert.equal(((await plain.json()) as ProblemBody).code, "unsupported_media_type");

    const badPatch = await fetch(`${baseUrl}/items/${created.id}`, {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ price: -5, quantity: 99999, extra: true }),
    });
    assert.equal(badPatch.status, 400);
    const problem = (await badPatch.json()) as ProblemBody;
    assert.deepEqual(new Set(errorFields(problem)), new Set(["price", "quantity", "extra"]));

    const reread = await fetch(`${baseUrl}/items/${created.id}`, { headers: auth(token) });
    assert.deepEqual((await reread.json()) as ItemBody, created);
  });

  it("REQ-ERR-01/02/03: unmatched routes return problem+json route_not_found without leaked internals", async () => {
    for (const [method, path] of [
      ["GET", "/no-such-route"],
      ["PUT", "/items"],
      ["POST", "/health"],
    ] as const) {
      const response = await fetch(`${baseUrl}${path}`, { method });
      assert.equal(response.status, 404, `${method} ${path}`);
      assert.equal(response.headers.get("content-type"), "application/problem+json");
      const problem = (await response.json()) as ProblemBody & Record<string, unknown>;
      assert.equal(problem.code, "route_not_found");
      assert.equal(problem.status, 404);
      assert.deepEqual(Object.keys(problem).sort(), ["code", "detail", "status", "title", "type"]);
      assert.equal(JSON.stringify(problem).includes("node_modules"), false);
      assert.equal(JSON.stringify(problem).includes(" at "), false);
    }
  });

  it("state isolation: reset() clears items and tokens", async () => {
    const token = await login();
    await createItem(token);
    reset();
    const response = await fetch(`${baseUrl}/items`, { headers: auth(token) });
    assert.equal(response.status, 401);
    assert.equal(((await response.json()) as ProblemBody).code, "invalid_token");

    const freshToken = await login();
    const list = await fetch(`${baseUrl}/items`, { headers: auth(freshToken) });
    const listBody = (await list.json()) as { items: ItemBody[]; total: number };
    assert.equal(listBody.total, 0);
    assert.deepEqual(listBody.items, []);
  });

  it("REQ-VAL-01/04: Unicode code-point lengths accept 80-char names and 500-char descriptions, reject beyond", async () => {
    const token = await login();
    const emojiName = await createItem(token, { name: "😀".repeat(80) });
    assert.equal(emojiName.response.status, 201);
    assert.equal(emojiName.body.name, "😀".repeat(80));

    const tooLongName = await fetch(`${baseUrl}/items`, {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ name: "😀".repeat(81), price: 1, quantity: 1 }),
    });
    assert.equal(tooLongName.status, 400);
    assert.ok(errorFields((await tooLongName.json()) as ProblemBody).includes("name"));

    const emojiDescription = await createItem(token, { description: "😀".repeat(500) });
    assert.equal(emojiDescription.response.status, 201);

    const tooLongDescription = await fetch(`${baseUrl}/items`, {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ name: "ok", price: 1, quantity: 1, description: "😀".repeat(501) }),
    });
    assert.equal(tooLongDescription.status, 400);
    assert.ok(errorFields((await tooLongDescription.json()) as ProblemBody).includes("description"));

    const patched = await fetch(`${baseUrl}/items/${emojiName.body.id}`, {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ name: "😀".repeat(80) }),
    });
    assert.equal(patched.status, 200);

    const patchedDescription = await fetch(`${baseUrl}/items/${emojiName.body.id}`, {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ description: "😀".repeat(500) }),
    });
    assert.equal(patchedDescription.status, 200);
    const tooLongPatchDescription = await fetch(`${baseUrl}/items/${emojiName.body.id}`, {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ description: "😀".repeat(501) }),
    });
    assert.equal(tooLongPatchDescription.status, 400);

    const unicodeLoginAtBound = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "😀".repeat(32), password: "x" }),
    });
    assert.equal(unicodeLoginAtBound.status, 401);
    const unicodeLoginBeyond = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "😀".repeat(33), password: "x" }),
    });
    assert.equal(unicodeLoginBeyond.status, 400);
    assert.ok(errorFields((await unicodeLoginBeyond.json()) as ProblemBody).includes("username"));
  });

  it("REQ-VAL-02: tiny fractional-cent and near-cent prices are rejected on create and patch, state unchanged", async () => {
    const token = await login();
    const { body: created } = await createItem(token, { price: 19.99 });
    assert.equal(created.price, 19.99);

    for (const price of [0.000000000001, 19.999, 1.005]) {
      const response = await fetch(`${baseUrl}/items`, {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify({ name: "precision", price, quantity: 1 }),
      });
      assert.equal(response.status, 400, String(price));
      assert.ok(errorFields((await response.json()) as ProblemBody).includes("price"));
    }

    for (const price of [0.001, 0.000000000001, 19.999, 1.005]) {
      const badPatch = await fetch(`${baseUrl}/items/${created.id}`, {
        method: "PATCH",
        headers: auth(token),
        body: JSON.stringify({ price }),
      });
      assert.equal(badPatch.status, 400, String(price));
      assert.ok(errorFields((await badPatch.json()) as ProblemBody).includes("price"));
    }

    const list = await fetch(`${baseUrl}/items`, { headers: auth(token) });
    assert.equal(((await list.json()) as { total: number }).total, 1);
    const reread = await fetch(`${baseUrl}/items/${created.id}`, { headers: auth(token) });
    assert.deepEqual((await reread.json()) as ItemBody, created);
  });

  it("REQ-ITEM-05: offset overflowing the safe-integer range returns 400, never a null offset", async () => {
    const token = await login();
    await createItem(token);
    const response = await fetch(`${baseUrl}/items?offset=${"9".repeat(400)}`, { headers: auth(token) });
    assert.equal(response.status, 400);
    const problem = (await response.json()) as ProblemBody;
    assert.equal(problem.code, "validation_failed");
    assert.ok(errorFields(problem).includes("offset"));

    const hugeLimit = await fetch(`${baseUrl}/items?limit=${"9".repeat(400)}`, { headers: auth(token) });
    assert.equal(hugeLimit.status, 400);
  });

  it("REQ-ERR-01: empty unknown property is reported with a non-empty FieldError field on login, create and patch", async () => {
    const token = await login();
    const { body: created } = await createItem(token);

    const payloads: Array<{ url: string; method: string; headers: Record<string, string>; payload: Record<string, unknown> }> = [
      {
        url: `${baseUrl}/auth/login`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        payload: { username: "alice", password: "alice-password", "": true },
      },
    ];
    for (const attempt of payloads) {
      const response = await fetch(attempt.url, {
        method: attempt.method,
        headers: attempt.headers,
        body: JSON.stringify(attempt.payload),
      });
      assert.equal(response.status, 400);
      const problem = (await response.json()) as ProblemBody;
      const entry = (problem.errors ?? []).find((candidate) => candidate.code === "unknown_property");
      assert.notEqual(entry, undefined);
      assert.ok((entry?.field.length ?? 0) >= 1);
      assert.equal(entry?.field, "(empty property name)");
    }

    const create = await fetch(`${baseUrl}/items`, {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ name: "ok", price: 1, quantity: 1, "": true }),
    });
    assert.equal(create.status, 400);
    const createProblem = (await create.json()) as ProblemBody;
    for (const entry of createProblem.errors ?? []) {
      assert.deepEqual(Object.keys(entry).sort(), ["code", "field", "message"]);
      assert.ok(entry.field.length >= 1);
      assert.ok(entry.message.length >= 1);
    }

    const patch = await fetch(`${baseUrl}/items/${created.id}`, {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ "": true }),
    });
    assert.equal(patch.status, 400);
    const patchProblem = (await patch.json()) as ProblemBody;
    for (const entry of patchProblem.errors ?? []) {
      assert.deepEqual(Object.keys(entry).sort(), ["code", "field", "message"]);
      assert.ok(entry.field.length >= 1);
      assert.ok(entry.message.length >= 1);
    }
    const reread = await fetch(`${baseUrl}/items/${created.id}`, { headers: auth(token) });
    assert.deepEqual((await reread.json()) as ItemBody, created);
  });

  it("REQ-AUTH-04/05: missing and invalid tokens are rejected on all five protected operations", async () => {
    const token = await login();
    const { body: created } = await createItem(token);
    const operations: Array<{ method: string; path: string; body?: string }> = [
      { method: "GET", path: "/items" },
      { method: "POST", path: "/items", body: JSON.stringify({ name: "x", price: 1, quantity: 1 }) },
      { method: "GET", path: `/items/${created.id}` },
      { method: "PATCH", path: `/items/${created.id}`, body: JSON.stringify({ price: 2 }) },
      { method: "DELETE", path: `/items/${created.id}` },
    ];
    for (const operation of operations) {
      const missing = await fetch(`${baseUrl}${operation.path}`, {
        method: operation.method,
        headers: { "Content-Type": "application/json" },
        body: operation.body,
      });
      assert.equal(missing.status, 401, `${operation.method} ${operation.path} missing`);
      assert.equal(((await missing.json()) as ProblemBody).code, "missing_token");

      const invalid = await fetch(`${baseUrl}${operation.path}`, {
        method: operation.method,
        headers: { Authorization: "Bearer no-such-token", "Content-Type": "application/json" },
        body: operation.body,
      });
      assert.equal(invalid.status, 401, `${operation.method} ${operation.path} invalid`);
      assert.equal(((await invalid.json()) as ProblemBody).code, "invalid_token");
    }
    const reread = await fetch(`${baseUrl}/items/${created.id}`, { headers: auth(token) });
    assert.equal(reread.status, 200);
  });

  it("REQ-AUTH-01: expired tokens are rejected (deterministic fake clock) and fresh instances share no state", async () => {
    let fakeNow = 1_700_000_000_000;
    const inventory = createInventoryServer({ now: () => fakeNow, tokenTtlSeconds: 60 });
    const second = inventory.server;
    await new Promise<void>((resolve) => {
      second.listen(0, "127.0.0.1", resolve);
    });
    try {
      const address = second.address() as { port: number };
      const secondBase = `http://127.0.0.1:${address.port}`;

      const mainToken = await login();
      await createItem(mainToken, { name: "main instance only" });
      const crossInstance = await fetch(`${secondBase}/items`, { headers: auth(mainToken) });
      assert.equal(crossInstance.status, 401);

      const loginResponse = await fetch(`${secondBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "alice-password" }),
      });
      assert.equal(loginResponse.status, 200);
      const { token } = (await loginResponse.json()) as { token: string };

      const beforeExpiry = await fetch(`${secondBase}/items`, { headers: auth(token) });
      assert.equal(beforeExpiry.status, 200);
      const secondList = (await (await fetch(`${secondBase}/items`, { headers: auth(token) })).json()) as {
        items: ItemBody[];
        total: number;
      };
      assert.equal(secondList.total, 0);
      assert.deepEqual(secondList.items, []);

      fakeNow += 61_000;
      const afterExpiry = await fetch(`${secondBase}/items`, { headers: auth(token) });
      assert.equal(afterExpiry.status, 401);
      assert.equal(((await afterExpiry.json()) as ProblemBody).code, "invalid_token");
    } finally {
      await new Promise<void>((resolve, reject) => {
        second.close((error) => (error === undefined ? resolve() : reject(error)));
      });
    }
  });

  it("REQ-ITEM-01: created item exposes exactly the contract fields", async () => {
    const token = await login();
    const { body } = await createItem(token);
    assert.deepEqual(Object.keys(body).sort(), [
      "category",
      "createdAt",
      "description",
      "id",
      "name",
      "ownerId",
      "price",
      "quantity",
      "updatedAt",
    ]);
  });
});
