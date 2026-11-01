import type { APIRequestContext, APIResponse } from "@playwright/test";
import { expect, expectItem, expectProblem, test } from "../fixtures/inventory.ts";

type Operation =
  | { name: string; method: "GET"; path: string }
  | { name: string; method: "POST"; path: string; data: Record<string, unknown> }
  | { name: string; method: "PATCH"; path: string; data: Record<string, unknown> }
  | { name: string; method: "DELETE"; path: string };

function protectedOperations(itemId: string): Operation[] {
  return [
    { name: "GET /items", method: "GET", path: "/items" },
    {
      name: "POST /items",
      method: "POST",
      path: "/items",
      data: { name: "auth probe", price: 1, quantity: 1 },
    },
    { name: "GET /items/{id}", method: "GET", path: `/items/${itemId}` },
    {
      name: "PATCH /items/{id}",
      method: "PATCH",
      path: `/items/${itemId}`,
      data: { price: 2 },
    },
    { name: "DELETE /items/{id}", method: "DELETE", path: `/items/${itemId}` },
  ];
}

async function call(
  request: APIRequestContext,
  operation: Operation,
  headers: Record<string, string>,
): Promise<APIResponse> {
  switch (operation.method) {
    case "GET":
      return request.get(operation.path, { headers });
    case "POST":
      return request.post(operation.path, { headers, data: operation.data });
    case "PATCH":
      return request.patch(operation.path, { headers, data: operation.data });
    case "DELETE":
      return request.delete(operation.path, { headers });
  }
}

test("QA-AUTHZ-01 REQ-AUTH-04: all five protected operations reject a missing Authorization header", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const created = await inventory.createItem(token, { name: "protected target" });

  for (const operation of protectedOperations(created.id)) {
    const response = await call(inventory.request, operation, {
      "Content-Type": "application/json",
    });
    expect(response.status(), operation.name).toBe(401);
    expect(response.headers()["www-authenticate"], operation.name).toBe("Bearer");
    const problem = await expectProblem(response, 401, "missing_token");
    expect(problem, operation.name).not.toHaveProperty("items");
    expect(problem, operation.name).not.toHaveProperty("id");
    expect(problem, operation.name).not.toHaveProperty("ownerId");
  }

  const reread = await inventory.request.get(`/items/${created.id}`, {
    headers: inventory.auth(token),
  });
  await expectItem(reread, created);
});

test("QA-AUTHZ-02 REQ-AUTH-05: all five protected operations reject non-Bearer, empty and unknown tokens", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const created = await inventory.createItem(token, { name: "protected target" });

  for (const authorization of ["Basic abc123", "Bearer", "Bearer no-such-token"]) {
    for (const operation of protectedOperations(created.id)) {
      const response = await call(inventory.request, operation, {
        Authorization: authorization,
        "Content-Type": "application/json",
      });
      expect(response.status(), operation.name).toBe(401);
      expect(response.headers()["www-authenticate"], operation.name).toBe("Bearer");
      await expectProblem(response, 401, "invalid_token");
    }
  }

  const reread = await inventory.request.get(`/items/${created.id}`, {
    headers: inventory.auth(token),
  });
  await expectItem(reread, created);
});
