import { expect, expectItem, expectProblem, test } from "../fixtures/inventory.ts";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

test("QA-ISO-01 REQ-ISO-01: bob cannot read, update or delete alice's item and sees the same 404 as a nonexistent id", async ({
  inventory,
}) => {
  const aliceToken = await inventory.token("alice");
  const bobToken = await inventory.token("bob");
  const created = await inventory.createItem(aliceToken, { name: "Alice only" });

  const get = await inventory.request.get(`/items/${created.id}`, {
    headers: inventory.auth(bobToken),
  });
  const getProblem = await expectProblem(get, 404, "item_not_found");

  const patch = await inventory.request.patch(`/items/${created.id}`, {
    headers: inventory.auth(bobToken),
    data: { name: "Hijacked" },
  });
  const patchProblem = await expectProblem(patch, 404, "item_not_found");
  expect(patchProblem).toEqual(getProblem);

  const del = await inventory.request.delete(`/items/${created.id}`, {
    headers: inventory.auth(bobToken),
  });
  const deleteProblem = await expectProblem(del, 404, "item_not_found");
  expect(deleteProblem).toEqual(getProblem);

  const unknown = await inventory.request.get(`/items/${UNKNOWN_ID}`, {
    headers: inventory.auth(bobToken),
  });
  const unknownProblem = await expectProblem(unknown, 404, "item_not_found");
  expect(unknownProblem).toEqual(getProblem);

  const reread = await inventory.request.get(`/items/${created.id}`, {
    headers: inventory.auth(aliceToken),
  });
  await expectItem(reread, created);

  const bobList = await inventory.list(bobToken);
  expect(bobList.total).toBe(0);
  expect(bobList.items).toEqual([]);
});

test("QA-ISO-02 REQ-ISO-02: bob's list never contains alice's items at any limit or offset", async ({
  inventory,
}) => {
  const aliceToken = await inventory.token("alice");
  const bobToken = await inventory.token("bob");
  const aliceItems = [
    await inventory.createItem(aliceToken, { name: "alice one" }),
    await inventory.createItem(aliceToken, { name: "alice two" }),
  ];

  const listQueries: Array<Record<string, string | number> | undefined> = [
    undefined,
    { limit: 1 },
    { limit: 100 },
    { offset: 5 },
  ];
  for (const params of listQueries) {
    const list = await inventory.list(bobToken, params);
    expect(list.total).toBe(0);
    expect(list.items).toEqual([]);
  }

  const bobItem = await inventory.createItem(bobToken, { name: "bob one" });
  const bobList = await inventory.list(bobToken);
  expect(bobList.total).toBe(1);
  expect(bobList.items.map((item) => item.id)).toEqual([bobItem.id]);

  const aliceList = await inventory.list(aliceToken);
  expect(aliceList.total).toBe(2);
  expect(new Set(aliceList.items.map((item) => item.id))).toEqual(
    new Set(aliceItems.map((item) => item.id)),
  );

  const bobWide = await inventory.list(bobToken, { limit: 100 });
  expect(bobWide.items.map((item) => item.id)).toEqual([bobItem.id]);
});
