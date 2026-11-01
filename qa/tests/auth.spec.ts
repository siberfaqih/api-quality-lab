import {
  CREDENTIALS,
  expect,
  expectProblem,
  expectValidation,
  test,
  type LoginBody,
  type Problem,
} from "../fixtures/inventory.ts";

test("QA-AUTH-01 REQ-AUTH-01/REQ-AUTH-06: alice login returns an opaque Bearer token and her own user summary", async ({
  inventory,
}) => {
  const response = await inventory.request.post("/auth/login", {
    data: { username: "alice", password: "alice-password" },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/json");

  const body = (await response.json()) as LoginBody;
  expect(Object.keys(body).sort()).toEqual(["expiresIn", "token", "tokenType", "user"]);
  expect(body.tokenType).toBe("Bearer");
  expect(body.token.length).toBeGreaterThanOrEqual(16);
  // Opaque token, not a JWT with three client-readable segments.
  expect(body.token).not.toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  expect(body.expiresIn).toBeGreaterThan(0);
  expect(body.expiresIn).toBeLessThanOrEqual(86_400);
  expect(body.user).toEqual({ id: "usr_alice", username: "alice" });

  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("alice-password");
  expect("password" in body).toBe(false);
  expect("passwordHash" in body).toBe(false);
});

test("QA-AUTH-02 REQ-AUTH-06: each synthetic user's token identifies exactly that user", async ({
  inventory,
}) => {
  const alice = await inventory.login("alice");
  const bob = await inventory.login("bob");
  expect(alice.user).toEqual({ id: "usr_alice", username: "alice" });
  expect(bob.user).toEqual({ id: "usr_bob", username: "bob" });
  expect(alice.token).not.toBe(bob.token);

  const aliceItem = await inventory.createItem(alice.token);
  const bobItem = await inventory.createItem(bob.token);
  expect(aliceItem.ownerId).toBe("usr_alice");
  expect(bobItem.ownerId).toBe("usr_bob");

  const aliceList = await inventory.list(alice.token);
  const bobList = await inventory.list(bob.token);
  expect(aliceList.items.map((item) => item.id)).toEqual([aliceItem.id]);
  expect(bobList.items.map((item) => item.id)).toEqual([bobItem.id]);
});

test("QA-AUTH-03 REQ-AUTH-02: unknown username and wrong password return identical 401 invalid_credentials", async ({
  inventory,
}) => {
  const attempts: Problem[] = [];
  for (const credentials of [
    { username: "mallory", password: "whatever-pass" },
    { username: "alice", password: "wrong-password" },
  ]) {
    const response = await inventory.request.post("/auth/login", { data: credentials });
    expect(response.headers()["www-authenticate"]).toBe("Bearer");
    attempts.push(await expectProblem(response, 401, "invalid_credentials"));
  }

  expect(attempts[0]).toEqual(attempts[1]);
  expect(attempts[0]?.status).toBe(401);
  expect(JSON.stringify(attempts[0])).not.toContain("token");
});

test("QA-AUTH-04 REQ-AUTH-03: login validation names missing, blank, non-string and unknown fields", async ({
  inventory,
}) => {
  const cases: Array<{
    payload: Record<string, unknown>;
    field: string;
    code: string;
  }> = [
    { payload: { password: "x" }, field: "username", code: "required" },
    { payload: { username: "   ", password: "x" }, field: "username", code: "blank" },
    { payload: { username: 42, password: "x" }, field: "username", code: "wrong_type" },
    {
      payload: { username: "alice", password: "alice-password", admin: true },
      field: "admin",
      code: "unknown_property",
    },
  ];

  for (const { payload, field, code } of cases) {
    const response = await inventory.request.post("/auth/login", { data: payload });
    const problem = await expectProblem(response, 400, "validation_failed");
    expectValidation(problem, [field]);
    const entry = (problem.errors ?? []).find((candidate) => candidate.field === field);
    expect(entry?.code, `FieldError.code for ${field}`).toBe(code);
    expect(JSON.stringify(problem)).not.toContain('"token"');
  }
});

test("QA-AUTH-05 REQ-VAL-06/REQ-ERR-01: login rejects malformed and empty JSON as 400, non-JSON media as 415", async ({
  inventory,
}) => {
  const malformed = await inventory.request.post("/auth/login", {
    headers: { "Content-Type": "application/json" },
    data: Buffer.from("{not-json", "utf8"),
  });
  await expectProblem(malformed, 400, "malformed_json");

  const empty = await inventory.request.post("/auth/login", {
    headers: { "Content-Type": "application/json" },
    data: Buffer.alloc(0),
  });
  await expectProblem(empty, 400, "malformed_json");

  const plain = await inventory.request.post("/auth/login", {
    headers: { "Content-Type": "text/plain" },
    data: `username=${CREDENTIALS.alice.username}`,
  });
  await expectProblem(plain, 415, "unsupported_media_type");
});
