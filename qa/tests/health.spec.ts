import { expect, test } from "../fixtures/inventory.ts";

test("QA-ENV-01 REQ-ENV-01: health returns ok and semver without evaluating credentials", async ({
  inventory,
}) => {
  const plain = await inventory.request.get("/health");
  expect(plain.status()).toBe(200);
  expect(plain.headers()["content-type"]).toBe("application/json");
  const body = (await plain.json()) as { status: string; version: string };
  expect(body).toEqual({ status: "ok", version: "1.0.0" });
  expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);

  const invalidBearer = await inventory.request.get("/health", {
    headers: { Authorization: "Bearer definitely-not-a-real-token" },
  });
  expect(invalidBearer.status()).toBe(200);
  expect(await invalidBearer.json()).toEqual({ status: "ok", version: "1.0.0" });
});
