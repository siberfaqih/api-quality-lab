import {
  expect,
  expectFieldCode,
  expectItem,
  expectItemResponse,
  expectProblem,
  expectValidation,
  test,
} from "../fixtures/inventory.ts";

test("QA-VAL-01 REQ-VAL-01: name is required, non-blank, 1-80 characters, a string, and trimmed on create and update", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const base = { price: 1, quantity: 1 };
  const invalidCreateCases: Array<{
    payload: Record<string, unknown>;
    field: string;
    code: string;
  }> = [
    { payload: base, field: "name", code: "required" },
    { payload: { ...base, name: "   " }, field: "name", code: "blank" },
    { payload: { ...base, name: "x".repeat(81) }, field: "name", code: "too_long" },
    { payload: { ...base, name: 42 }, field: "name", code: "wrong_type" },
  ];

  for (const { payload, field, code } of invalidCreateCases) {
    const response = await inventory.request.post("/items", {
      headers: inventory.auth(token),
      data: payload,
    });
    const problem = await expectProblem(response, 400, "validation_failed");
    expectValidation(problem, [field]);
    expectFieldCode(problem, field, code);
  }
  expect((await inventory.list(token)).total).toBe(0);

  const padded = await inventory.createItem(token, { name: "  Padded Name  " });
  expect(padded.name).toBe("Padded Name");

  const atBound = await inventory.createItem(token, { name: "x".repeat(80) });
  expect(atBound.name).toHaveLength(80);

  const target = await inventory.createItem(token, { name: "Patch target" });
  const invalidPatchCases: Array<{ payload: Record<string, unknown>; code: string }> = [
    { payload: { name: "" }, code: "blank" },
    { payload: { name: "   " }, code: "blank" },
    { payload: { name: 42 }, code: "wrong_type" },
    { payload: { name: "x".repeat(81) }, code: "too_long" },
  ];
  for (const { payload, code } of invalidPatchCases) {
    const response = await inventory.request.patch(`/items/${target.id}`, {
      headers: inventory.auth(token),
      data: payload,
    });
    const problem = await expectProblem(response, 400, "validation_failed");
    expectValidation(problem, ["name"]);
    expectFieldCode(problem, "name", code);
    await expectItem(
      await inventory.request.get(`/items/${target.id}`, {
        headers: inventory.auth(token),
      }),
      target,
    );
  }

  const paddedPatch = await inventory.request.patch(`/items/${target.id}`, {
    headers: inventory.auth(token),
    data: { name: "  Updated Name  " },
  });
  const updated = await expectItemResponse(paddedPatch);
  expect(updated.name).toBe("Updated Name");
  await expectItem(
    await inventory.request.get(`/items/${target.id}`, {
      headers: inventory.auth(token),
    }),
    updated,
  );

  const atBoundPatch = await inventory.request.patch(`/items/${target.id}`, {
    headers: inventory.auth(token),
    data: { name: "y".repeat(80) },
  });
  const boundUpdated = await expectItemResponse(atBoundPatch);
  expect(boundUpdated.name).toHaveLength(80);
  await expectItem(
    await inventory.request.get(`/items/${target.id}`, {
      headers: inventory.auth(token),
    }),
    boundUpdated,
  );
});

test("QA-VAL-02 REQ-VAL-02: price is bounded 0-1,000,000 with at most two decimals and must be numeric on create and update", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const invalidCases: Array<{ price: unknown; code: string }> = [
    { price: -0.01, code: "out_of_range" },
    { price: 1_000_000.01, code: "out_of_range" },
    { price: 1.005, code: "too_many_decimals" },
    { price: 0.001, code: "too_many_decimals" },
    { price: "9.99", code: "wrong_type" },
  ];

  for (const { price, code } of invalidCases) {
    const response = await inventory.request.post("/items", {
      headers: inventory.auth(token),
      data: { name: "price probe", price, quantity: 1 },
    });
    const problem = await expectProblem(response, 400, "validation_failed");
    expectValidation(problem, ["price"]);
    expectFieldCode(problem, "price", code);
  }
  expect((await inventory.list(token)).total).toBe(0);

  for (const price of [0, 19.99, 1_000_000]) {
    const item = await inventory.createItem(token, { price });
    expect(item.price).toBe(price);
  }

  const target = await inventory.createItem(token, { price: 19.99 });
  for (const { price, code } of invalidCases) {
    const response = await inventory.request.patch(`/items/${target.id}`, {
      headers: inventory.auth(token),
      data: { price },
    });
    const problem = await expectProblem(response, 400, "validation_failed");
    expectValidation(problem, ["price"]);
    expectFieldCode(problem, "price", code);
    await expectItem(
      await inventory.request.get(`/items/${target.id}`, {
        headers: inventory.auth(token),
      }),
      target,
    );
  }

  for (const price of [0, 19.99, 1_000_000]) {
    const response = await inventory.request.patch(`/items/${target.id}`, {
      headers: inventory.auth(token),
      data: { price },
    });
    const updated = await expectItemResponse(response);
    expect(updated.price).toBe(price);
    await expectItem(
      await inventory.request.get(`/items/${target.id}`, {
        headers: inventory.auth(token),
      }),
      updated,
    );
  }
});

test("QA-VAL-03 REQ-VAL-03: quantity is an integer in 0-10,000 on create and update", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const invalidCases: Array<{ quantity: unknown; code: string }> = [
    { quantity: -1, code: "out_of_range" },
    { quantity: 10_001, code: "out_of_range" },
    { quantity: 1.5, code: "wrong_type" },
    { quantity: "5", code: "wrong_type" },
  ];

  for (const { quantity, code } of invalidCases) {
    const response = await inventory.request.post("/items", {
      headers: inventory.auth(token),
      data: { name: "quantity probe", price: 1, quantity },
    });
    const problem = await expectProblem(response, 400, "validation_failed");
    expectValidation(problem, ["quantity"]);
    expectFieldCode(problem, "quantity", code);
  }
  expect((await inventory.list(token)).total).toBe(0);

  for (const quantity of [0, 10_000]) {
    const item = await inventory.createItem(token, { quantity });
    expect(item.quantity).toBe(quantity);
  }

  const target = await inventory.createItem(token, { quantity: 5 });
  for (const { quantity, code } of invalidCases) {
    const response = await inventory.request.patch(`/items/${target.id}`, {
      headers: inventory.auth(token),
      data: { quantity },
    });
    const problem = await expectProblem(response, 400, "validation_failed");
    expectValidation(problem, ["quantity"]);
    expectFieldCode(problem, "quantity", code);
    await expectItem(
      await inventory.request.get(`/items/${target.id}`, {
        headers: inventory.auth(token),
      }),
      target,
    );
  }

  for (const quantity of [0, 10_000]) {
    const response = await inventory.request.patch(`/items/${target.id}`, {
      headers: inventory.auth(token),
      data: { quantity },
    });
    const updated = await expectItemResponse(response);
    expect(updated.quantity).toBe(quantity);
    await expectItem(
      await inventory.request.get(`/items/${target.id}`, {
        headers: inventory.auth(token),
      }),
      updated,
    );
  }
});

test("QA-VAL-04 REQ-VAL-04: description and category defaults and bounds are enforced on create and update", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const minimal = await inventory.createItem(token, { name: "defaults" });
  expect(minimal.description).toBe("");
  expect(minimal.category).toBe("other");

  const atDescriptionBound = await inventory.createItem(token, {
    description: "d".repeat(500),
  });
  expect(atDescriptionBound.description).toHaveLength(500);

  const tooLongDescription = await inventory.request.post("/items", {
    headers: inventory.auth(token),
    data: { name: "too long", price: 1, quantity: 1, description: "d".repeat(501) },
  });
  const descriptionProblem = await expectProblem(
    tooLongDescription,
    400,
    "validation_failed",
  );
  expectValidation(descriptionProblem, ["description"]);
  expectFieldCode(descriptionProblem, "description", "too_long");

  const invalidCategory = await inventory.request.post("/items", {
    headers: inventory.auth(token),
    data: { name: "bad category", price: 1, quantity: 1, category: "toys" },
  });
  const categoryProblem = await expectProblem(invalidCategory, 400, "validation_failed");
  expectValidation(categoryProblem, ["category"]);
  expectFieldCode(categoryProblem, "category", "invalid_enum");

  const nonStringCategory = await inventory.request.post("/items", {
    headers: inventory.auth(token),
    data: { name: "bad category type", price: 1, quantity: 1, category: 42 },
  });
  expectFieldCode(
    await expectProblem(nonStringCategory, 400, "validation_failed"),
    "category",
    "wrong_type",
  );

  const badPatch = await inventory.request.patch(`/items/${minimal.id}`, {
    headers: inventory.auth(token),
    data: { description: "d".repeat(501), category: "toys" },
  });
  const patchProblem = await expectProblem(badPatch, 400, "validation_failed");
  expectValidation(patchProblem, ["description", "category"]);

  const reread = await inventory.request.get(`/items/${minimal.id}`, {
    headers: inventory.auth(token),
  });
  await expectItem(reread, minimal);
});

test("QA-VAL-05 REQ-VAL-05: unknown create and update properties are rejected, never ignored", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const cases: Array<{ payload: Record<string, unknown>; field: string }> = [
    { payload: { name: "owner injection", price: 1, quantity: 1, ownerId: "usr_bob" }, field: "ownerId" },
    { payload: { name: "extra", price: 1, quantity: 1, extra: true }, field: "extra" },
  ];

  for (const { payload, field } of cases) {
    const response = await inventory.request.post("/items", {
      headers: inventory.auth(token),
      data: payload,
    });
    const problem = await expectProblem(response, 400, "validation_failed");
    expectValidation(problem, [field]);
    expectFieldCode(problem, field, "unknown_property");
  }
  expect((await inventory.list(token)).total).toBe(0);

  const created = await inventory.createItem(token);
  const patch = await inventory.request.patch(`/items/${created.id}`, {
    headers: inventory.auth(token),
    data: { ownerId: "usr_bob", createdAt: "2000-01-01T00:00:00.000Z" },
  });
  const patchProblem = await expectProblem(patch, 400, "validation_failed");
  expectValidation(patchProblem, ["ownerId", "createdAt"]);
  expectFieldCode(patchProblem, "ownerId", "unknown_property");
  expectFieldCode(patchProblem, "createdAt", "unknown_property");

  const reread = await inventory.request.get(`/items/${created.id}`, {
    headers: inventory.auth(token),
  });
  await expectItem(reread, created);
});

test("QA-VAL-06 REQ-VAL-06: malformed JSON and non-JSON media types are rejected on create and patch", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const created = await inventory.createItem(token);

  const malformedCreate = await inventory.request.post("/items", {
    headers: { ...inventory.auth(token), "Content-Type": "application/json" },
    data: Buffer.from("{broken", "utf8"),
  });
  await expectProblem(malformedCreate, 400, "malformed_json");

  const malformedPatch = await inventory.request.patch(`/items/${created.id}`, {
    headers: { ...inventory.auth(token), "Content-Type": "application/json" },
    data: Buffer.from("{broken", "utf8"),
  });
  await expectProblem(malformedPatch, 400, "malformed_json");

  const plainCreate = await inventory.request.post("/items", {
    headers: { ...inventory.auth(token), "Content-Type": "text/plain" },
    data: "name=Widget",
  });
  await expectProblem(plainCreate, 415, "unsupported_media_type");

  const plainPatch = await inventory.request.patch(`/items/${created.id}`, {
    headers: { ...inventory.auth(token), "Content-Type": "text/plain" },
    data: "price=2",
  });
  await expectProblem(plainPatch, 415, "unsupported_media_type");

  const reread = await inventory.request.get(`/items/${created.id}`, {
    headers: inventory.auth(token),
  });
  await expectItem(reread, created);
});

test("QA-VAL-07 REQ-VAL-07: multi-field validation returns one 400 with an entry per field and mutates nothing", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const create = await inventory.request.post("/items", {
    headers: inventory.auth(token),
    data: { name: "", price: -1, quantity: -2 },
  });
  const createProblem = await expectProblem(create, 400, "validation_failed");
  expectValidation(createProblem, ["name", "price", "quantity"]);
  expect((await inventory.list(token)).total).toBe(0);

  const created = await inventory.createItem(token);
  const patch = await inventory.request.patch(`/items/${created.id}`, {
    headers: inventory.auth(token),
    data: { price: -5, quantity: 99_999, extra: true },
  });
  const patchProblem = await expectProblem(patch, 400, "validation_failed");
  expectValidation(patchProblem, ["price", "quantity", "extra"]);

  const reread = await inventory.request.get(`/items/${created.id}`, {
    headers: inventory.auth(token),
  });
  await expectItem(reread, created);
});

test("QA-VAL-08 REQ-VAL-01/REQ-VAL-04: Unicode code-point lengths enforce the 80/500 character boundaries", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const emoji = "😀";
  const atNameBound = await inventory.createItem(token, { name: emoji.repeat(80) });
  expect(atNameBound.name).toBe(emoji.repeat(80));

  const overNameBound = await inventory.request.post("/items", {
    headers: inventory.auth(token),
    data: { name: emoji.repeat(81), price: 1, quantity: 1 },
  });
  expectFieldCode(
    await expectProblem(overNameBound, 400, "validation_failed"),
    "name",
    "too_long",
  );

  const atDescriptionBound = await inventory.createItem(token, {
    description: emoji.repeat(500),
  });
  expect(atDescriptionBound.description).toBe(emoji.repeat(500));

  const overDescriptionBound = await inventory.request.post("/items", {
    headers: inventory.auth(token),
    data: { name: "unicode", price: 1, quantity: 1, description: emoji.repeat(501) },
  });
  expectFieldCode(
    await expectProblem(overDescriptionBound, 400, "validation_failed"),
    "description",
    "too_long",
  );

  const patchAtBound = await inventory.request.patch(`/items/${atNameBound.id}`, {
    headers: inventory.auth(token),
    data: { name: emoji.repeat(80), description: emoji.repeat(500) },
  });
  expect(patchAtBound.status()).toBe(200);

  const patchOverBound = await inventory.request.patch(`/items/${atNameBound.id}`, {
    headers: inventory.auth(token),
    data: { name: emoji.repeat(81) },
  });
  expectFieldCode(
    await expectProblem(patchOverBound, 400, "validation_failed"),
    "name",
    "too_long",
  );
});

test("QA-VAL-09 REQ-VAL-02: tiny fractional-cent and near-cent prices are rejected on create and patch", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const created = await inventory.createItem(token, { price: 19.99 });

  for (const price of [0.000000000001, 19.999, 1.005]) {
    const create = await inventory.request.post("/items", {
      headers: inventory.auth(token),
      data: { name: "precision", price, quantity: 1 },
    });
    expectFieldCode(
      await expectProblem(create, 400, "validation_failed"),
      "price",
      "too_many_decimals",
    );

    const patch = await inventory.request.patch(`/items/${created.id}`, {
      headers: inventory.auth(token),
      data: { price },
    });
    expectFieldCode(
      await expectProblem(patch, 400, "validation_failed"),
      "price",
      "too_many_decimals",
    );
  }

  const reread = await inventory.request.get(`/items/${created.id}`, {
    headers: inventory.auth(token),
  });
  await expectItem(reread, created);
});
