import {
  ITEM_KEYS,
  expect,
  expectProblem,
  expectValidation,
  test,
  type Item,
} from "../fixtures/inventory.ts";

test("QA-LIST-01 REQ-ITEM-03: list returns the caller's items in the documented envelope with defaults", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  const first = await inventory.createItem(token, { name: "first" });
  const second = await inventory.createItem(token, { name: "second" });

  const response = await inventory.request.get("/items", {
    headers: inventory.auth(token),
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/json");
  const body = (await response.json()) as {
    items: Item[];
    total: number;
    limit: number;
    offset: number;
  };
  expect(Object.keys(body).sort()).toEqual(["items", "limit", "offset", "total"]);
  expect(body.total).toBe(2);
  expect(body.limit).toBe(20);
  expect(body.offset).toBe(0);
  expect(body.items).toHaveLength(2);
  expect(new Set(body.items.map((item) => item.id))).toEqual(new Set([first.id, second.id]));
  for (const item of body.items) {
    expect(Object.keys(item).sort()).toEqual([...ITEM_KEYS].sort());
    expect(item.ownerId).toBe("usr_alice");
  }
});

test("QA-LIST-02 REQ-ITEM-04: list order is deterministic by createdAt then id across repeated calls, including a proven timestamp tie", async ({
  inventory,
}) => {
  const base = Date.parse("2026-01-01T00:00:00.000Z");
  const tiedAt = new Date(base + 1000).toISOString();

  // Deterministic clock: one item before the tie, three at the same
  // millisecond, and one after it. The tie is proven before ID assertions.
  inventory.setNow(base);
  const token = await inventory.token("alice");
  const first = await inventory.createItem(token, { name: "one" });
  inventory.setNow(base + 1000);
  const tieA = await inventory.createItem(token, { name: "two" });
  const tieB = await inventory.createItem(token, { name: "three" });
  const tieC = await inventory.createItem(token, { name: "four" });
  inventory.setNow(base + 2000);
  const last = await inventory.createItem(token, { name: "five" });

  expect(first.createdAt).toBe(new Date(base).toISOString());
  expect(tieA.createdAt).toBe(tiedAt);
  expect(tieB.createdAt).toBe(tiedAt);
  expect(tieC.createdAt).toBe(tiedAt);
  expect(last.createdAt).toBe(new Date(base + 2000).toISOString());

  const firstList = await inventory.list(token);
  const secondList = await inventory.list(token);
  expect(secondList).toEqual(firstList);
  expect(firstList.total).toBe(5);
  expect(firstList.items).toHaveLength(5);

  const tied = firstList.items.filter((item) => item.createdAt === tiedAt);
  expect(tied.length).toBeGreaterThanOrEqual(2);
  expect(new Set(tied.map((item) => item.id))).toEqual(
    new Set([tieA.id, tieB.id, tieC.id]),
  );
  const tiedIds = tied.map((item) => item.id).sort();
  expect(tied.map((item) => item.id)).toEqual(tiedIds);

  const expected = [...firstList.items].sort((a, b) => {
    if (a.createdAt === b.createdAt) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
  expect(firstList.items).toEqual(expected);
  expect(firstList.items.map((item) => item.id)).toEqual([
    first.id,
    ...tiedIds,
    last.id,
  ]);

  for (let index = 1; index < firstList.items.length; index += 1) {
    const previous = firstList.items[index - 1] as Item;
    const current = firstList.items[index] as Item;
    expect(previous.createdAt <= current.createdAt).toBe(true);
    if (previous.createdAt === current.createdAt) {
      expect(previous.id < current.id).toBe(true);
    }
  }
});

test("QA-LIST-03 REQ-ITEM-05: limit and offset slice correctly and offset beyond total returns empty with unchanged total", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  for (const name of ["a", "b", "c", "d"]) {
    await inventory.createItem(token, { name });
  }
  const all = await inventory.list(token);

  const slice = await inventory.list(token, { limit: 2, offset: 1 });
  expect(slice.items).toEqual(all.items.slice(1, 3));
  expect(slice.total).toBe(4);
  expect(slice.limit).toBe(2);
  expect(slice.offset).toBe(1);

  const beyond = await inventory.list(token, { offset: 99 });
  expect(beyond.items).toEqual([]);
  expect(beyond.total).toBe(4);
  expect(beyond.limit).toBe(20);
  expect(beyond.offset).toBe(99);

  const one = await inventory.list(token, { limit: 1 });
  expect(one.items).toEqual(all.items.slice(0, 1));
  expect(one.total).toBe(4);

  const hundred = await inventory.list(token, { limit: 100 });
  expect(hundred.items).toEqual(all.items);
  expect(hundred.limit).toBe(100);
});

test("QA-LIST-04 REQ-ITEM-05: invalid limit and offset return 400 naming the field and leave items intact", async ({
  inventory,
}) => {
  const token = await inventory.token("alice");
  await inventory.createItem(token);

  const cases: Array<{ params: Record<string, string>; field: string }> = [
    { params: { limit: "0" }, field: "limit" },
    { params: { limit: "101" }, field: "limit" },
    { params: { limit: "abc" }, field: "limit" },
    { params: { limit: "1.5" }, field: "limit" },
    { params: { offset: "-1" }, field: "offset" },
    { params: { offset: "abc" }, field: "offset" },
    { params: { offset: "1.5" }, field: "offset" },
  ];

  for (const { params, field } of cases) {
    const response = await inventory.request.get("/items", {
      headers: inventory.auth(token),
      params,
    });
    const problem = await expectProblem(response, 400, "validation_failed");
    expectValidation(problem, [field]);
  }

  const list = await inventory.list(token);
  expect(list.total).toBe(1);
});
