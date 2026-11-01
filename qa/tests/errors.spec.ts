import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { APIResponse } from "@playwright/test";
import {
  expect,
  expectItem,
  expectNoLeak,
  expectProblem,
  expectProblemKeys,
  test,
  type Problem,
} from "../fixtures/inventory.ts";

interface ContractDocument {
  "x-error-codes": Array<{ code: string; status: number }>;
}

function loadRegisteredCodes(): Map<string, number> {
  const raw = readFileSync(
    new URL("../../contract/openapi.yaml", import.meta.url),
    "utf8",
  );
  const document = parseYaml(raw) as ContractDocument;
  return new Map(
    document["x-error-codes"].map(({ code, status }) => [code, status] as const),
  );
}

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

test("QA-ERR-01 REQ-ERR-01: every error response is problem+json with the documented status and registered code", async ({
  inventory,
}) => {
  const registered = loadRegisteredCodes();
  expect(registered.size).toBe(8);

  const token = await inventory.token("alice");
  const created = await inventory.createItem(token);

  const cases: Array<{ label: string; response: APIResponse; code: string }> = [];
  cases.push({
    label: "login validation",
    code: "validation_failed",
    response: await inventory.request.post("/auth/login", {
      data: { password: "x" },
    }),
  });
  cases.push({
    label: "login malformed json",
    code: "malformed_json",
    response: await inventory.request.post("/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from("{broken", "utf8"),
    }),
  });
  cases.push({
    label: "login bad credentials",
    code: "invalid_credentials",
    response: await inventory.request.post("/auth/login", {
      data: { username: "mallory", password: "wrong" },
    }),
  });
  cases.push({
    label: "missing token",
    code: "missing_token",
    response: await inventory.request.get("/items"),
  });
  cases.push({
    label: "invalid token",
    code: "invalid_token",
    response: await inventory.request.get("/items", {
      headers: { Authorization: "Bearer no-such-token" },
    }),
  });
  cases.push({
    label: "unknown item",
    code: "item_not_found",
    response: await inventory.request.get(`/items/${UNKNOWN_ID}`, {
      headers: inventory.auth(token),
    }),
  });
  cases.push({
    label: "unsupported media type",
    code: "unsupported_media_type",
    response: await inventory.request.post("/items", {
      headers: { ...inventory.auth(token), "Content-Type": "text/plain" },
      data: "name=Widget",
    }),
  });
  cases.push({
    label: "unmatched route",
    code: "route_not_found",
    response: await inventory.request.get("/no-such-route"),
  });

  for (const { label, response, code } of cases) {
    const status = registered.get(code);
    expect(status, `${label}: ${code} must be registered in the contract`).toBeDefined();
    const problem = await expectProblem(response, status as number, code);
    expect(problem.status, label).toBe(response.status());
    expectProblemKeys(problem);
  }

  // A successful response still works after the error probes.
  const reread = await inventory.request.get(`/items/${created.id}`, {
    headers: inventory.auth(token),
  });
  await expectItem(reread, created);
});

test("QA-ERR-02 REQ-ERR-02: error bodies expose no stack traces, paths, SQL or synthetic credentials", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  await inventory.createItem(token);

  const problems: Problem[] = [];
  problems.push(
    await expectProblem(
      await inventory.request.post("/auth/login", { data: { password: "x" } }),
      400,
      "validation_failed",
    ),
  );
  problems.push(
    await expectProblem(await inventory.request.get("/items"), 401, "missing_token"),
  );
  const badLogin = await expectProblem(
    await inventory.request.post("/auth/login", {
      data: { username: "alice", password: "wrong-password" },
    }),
    401,
    "invalid_credentials",
  );
  expect(JSON.stringify(badLogin)).not.toContain("wrong-password");
  problems.push(badLogin);
  problems.push(
    await expectProblem(
      await inventory.request.get(`/items/${UNKNOWN_ID}`, {
        headers: inventory.auth(token),
      }),
      404,
      "item_not_found",
    ),
  );
  problems.push(
    await expectProblem(
      await inventory.request.get("/no-such-route"),
      404,
      "route_not_found",
    ),
  );
  problems.push(
    await expectProblem(
      await inventory.request.post("/items", {
        headers: { ...inventory.auth(token), "Content-Type": "text/plain" },
        data: "name=Widget",
      }),
      415,
      "unsupported_media_type",
    ),
  );

  for (const problem of problems) {
    expectNoLeak(problem);
    expectProblemKeys(problem);
    for (const entry of problem.errors ?? []) {
      expect(Object.keys(entry).sort()).toEqual(["code", "field", "message"]);
    }
  }
});

test("QA-ERR-03 REQ-ERR-03: unmatched routes and methods return 404 route_not_found problem+json", async ({
  inventory,
}) => {
  const cases: Array<{ method: string; path: string }> = [
    { method: "GET", path: "/no-such-route" },
    { method: "PUT", path: "/items" },
    { method: "POST", path: "/health" },
    { method: "DELETE", path: "/auth/login" },
    { method: "PATCH", path: "/items" },
  ];

  for (const { method, path } of cases) {
    let response: APIResponse;
    switch (method) {
      case "GET":
        response = await inventory.request.get(path);
        break;
      case "PUT":
        response = await inventory.request.put(path);
        break;
      case "POST":
        response = await inventory.request.post(path);
        break;
      case "DELETE":
        response = await inventory.request.delete(path);
        break;
      case "PATCH":
        response = await inventory.request.patch(path);
        break;
      default:
        throw new Error(`unsupported method ${method}`);
    }

    const problem = await expectProblem(response, 404, "route_not_found");
    expect(problem.status).toBe(404);
    expect(response.headers()["content-type"]).not.toContain("text/html");
    expect(JSON.stringify(problem).length).toBeGreaterThan(0);
  }
});
