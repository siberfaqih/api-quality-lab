import {
  ITEM_KEYS,
  expect,
  expectItem,
  expectProblem,
  test,
  type Item,
} from "../fixtures/inventory.ts";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

test("QA-CRUD-01 REQ-ITEM-01: create returns 201, Location, server-owned fields and defaults", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const response = await inventory.request.post("/items", {
    headers: inventory.auth(token),
    data: {
      name: "  Blue Widget  ",
      description: "A widget",
      category: "books",
      price: 19.99,
      quantity: 5,
    },
  });

  expect(response.status()).toBe(201);
  expect(response.headers()["content-type"]).toBe("application/json");
  const body = (await response.json()) as Item;
  expect(response.headers()["location"]).toBe(`/items/${body.id}`);
  expect(Object.keys(body).sort()).toEqual([...ITEM_KEYS].sort());
  expect(body.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  expect(body.ownerId).toBe("usr_alice");
  expect(body.name).toBe("Blue Widget");
  expect(body.description).toBe("A widget");
  expect(body.category).toBe("books");
  expect(body.price).toBe(19.99);
  expect(body.quantity).toBe(5);
  expect(body.createdAt).toBe(body.updatedAt);
  expect(Number.isNaN(Date.parse(body.createdAt))).toBe(false);

  const fetched = await inventory.request.get(response.headers()["location"] as string, {
    headers: inventory.auth(token),
  });
  await expectItem(fetched, body);

  const defaulted = await inventory.createItem(token, { name: "Defaults" });
  expect(defaulted.description).toBe("");
  expect(defaulted.category).toBe("other");
});

test("QA-CRUD-02 REQ-ITEM-02: GET of an owned item returns exactly the creation representation", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const created = await inventory.createItem(token, {
    name: "Readable",
    description: "read me",
    category: "food",
    price: 3.5,
    quantity: 12,
  });

  const response = await inventory.request.get(`/items/${created.id}`, {
    headers: inventory.auth(token),
  });
  await expectItem(response, created);
});

test("QA-CRUD-03 REQ-ITEM-06: PATCH changes only supplied fields, preserves immutable fields, advances updatedAt and persists", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const created = await inventory.createItem(token, {
    name: "Original",
    description: "keep me",
    category: "books",
    price: 10.5,
    quantity: 2,
  });

  const response = await inventory.request.patch(`/items/${created.id}`, {
    headers: inventory.auth(token),
    data: { price: 42.5, quantity: 7 },
  });
  expect(response.status()).toBe(200);
  const updated = (await response.json()) as Item;
  expect(updated.id).toBe(created.id);
  expect(updated.ownerId).toBe(created.ownerId);
  expect(updated.name).toBe(created.name);
  expect(updated.description).toBe(created.description);
  expect(updated.category).toBe(created.category);
  expect(updated.price).toBe(42.5);
  expect(updated.quantity).toBe(7);
  expect(updated.createdAt).toBe(created.createdAt);
  expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));

  const reread = await inventory.request.get(`/items/${created.id}`, {
    headers: inventory.auth(token),
  });
  await expectItem(reread, updated);
});

test("QA-CRUD-04 REQ-ITEM-07: DELETE returns 204 with no body, then GET and a second DELETE return 404", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const doomed = await inventory.createItem(token, { name: "doomed" });
  const survivor = await inventory.createItem(token, { name: "survivor" });

  const deleted = await inventory.request.delete(`/items/${doomed.id}`, {
    headers: inventory.auth(token),
  });
  expect(deleted.status()).toBe(204);
  expect(await deleted.text()).toBe("");

  const after = await inventory.request.get(`/items/${doomed.id}`, {
    headers: inventory.auth(token),
  });
  await expectProblem(after, 404, "item_not_found");

  const second = await inventory.request.delete(`/items/${doomed.id}`, {
    headers: inventory.auth(token),
  });
  await expectProblem(second, 404, "item_not_found");

  const list = await inventory.list(token);
  expect(list.total).toBe(1);
  expect(list.items.map((item) => item.id)).toEqual([survivor.id]);
});

test("QA-CRUD-05 REQ-ITEM-08: unknown ids return identical 404s and PATCH/DELETE mutate nothing", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const get = await inventory.request.get(`/items/${UNKNOWN_ID}`, {
    headers: inventory.auth(token),
  });
  const gotProblem = await expectProblem(get, 404, "item_not_found");

  const patch = await inventory.request.patch(`/items/${UNKNOWN_ID}`, {
    headers: inventory.auth(token),
    data: { price: 1 },
  });
  const patchProblem = await expectProblem(patch, 404, "item_not_found");
  expect(patchProblem).toEqual(gotProblem);

  const del = await inventory.request.delete(`/items/${UNKNOWN_ID}`, {
    headers: inventory.auth(token),
  });
  const deleteProblem = await expectProblem(del, 404, "item_not_found");
  expect(deleteProblem).toEqual(gotProblem);

  const list = await inventory.list(token);
  expect(list.total).toBe(0);
  expect(list.items).toEqual([]);
});

test("QA-CRUD-06 REQ-ITEM-09: PATCH with an empty object or no body is rejected and does not mutate", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const created = await inventory.createItem(token, { name: "unchanged" });

  const emptyObject = await inventory.request.patch(`/items/${created.id}`, {
    headers: inventory.auth(token),
    data: {},
  });
  const emptyProblem = await expectProblem(emptyObject, 400, "validation_failed");
  expect(emptyProblem.errors?.some((entry) => entry.field === "body")).toBe(true);

  const noBody = await inventory.request.patch(`/items/${created.id}`, {
    headers: { ...inventory.auth(token), "Content-Type": "application/json" },
  });
  const noBodyProblem = await expectProblem(noBody, 400, "validation_failed");
  expect(noBodyProblem.errors?.some((entry) => entry.field === "body")).toBe(true);

  const reread = await inventory.request.get(`/items/${created.id}`, {
    headers: inventory.auth(token),
  });
  await expectItem(reread, created);
});
