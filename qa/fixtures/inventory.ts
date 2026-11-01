import {
  expect,
  request as playwrightRequest,
  test as base,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";
import type { AddressInfo } from "node:net";
import { createInventoryServer } from "../../sut/src/app.ts";

export interface Item {
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

export interface ItemList {
  items: Item[];
  total: number;
  limit: number;
  offset: number;
}

export interface UserSummary {
  id: string;
  username: string;
}

export interface LoginBody {
  token: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: UserSummary;
}

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  errors?: FieldError[];
}

export const CREDENTIALS = {
  alice: { username: "alice", password: "alice-password", id: "usr_alice" },
  bob: { username: "bob", password: "bob-password", id: "usr_bob" },
} as const;

export type UserName = keyof typeof CREDENTIALS;

export interface InventoryApi {
  baseURL: string;
  request: APIRequestContext;
  auth(token: string): Record<string, string>;
  login(username?: UserName, password?: string): Promise<LoginBody>;
  token(username?: UserName): Promise<string>;
  createItem(token: string, overrides?: Record<string, unknown>): Promise<Item>;
  list(token: string, params?: Record<string, string | number>): Promise<ItemList>;
  problem(response: APIResponse): Promise<Problem>;
  /** Override the SUT clock for deterministic timestamps; undefined restores real time. */
  setNow(ms: number | undefined): void;
}

export const ITEM_KEYS = [
  "id",
  "ownerId",
  "name",
  "description",
  "category",
  "price",
  "quantity",
  "createdAt",
  "updatedAt",
] as const;

const PROBLEM_KEYS = ["type", "title", "status", "code", "detail"] as const;

/** Assert a successful item response (status + JSON media type) and return its body. */
export async function expectItemResponse(response: APIResponse): Promise<Item> {
  expect(response.status(), "expected HTTP 200 for an item response").toBe(200);
  expect(response.headers()["content-type"], "content-type for an item response").toBe(
    "application/json",
  );
  return (await response.json()) as Item;
}

/** Assert a GET re-read returns exactly the expected item representation. */
export async function expectItem(response: APIResponse, expected: Item): Promise<Item> {
  const body = await expectItemResponse(response);
  expect(body).toEqual(expected);
  return body;
}

/** Assert the RFC 9457 Problem envelope and return the parsed body. */
export async function expectProblem(
  response: APIResponse,
  status: number,
  code: string,
): Promise<Problem> {
  expect(response.status(), `expected HTTP ${status} for ${code}`).toBe(status);
  expect(response.headers()["content-type"], `content-type for ${code}`).toBe(
    "application/problem+json",
  );
  const body = (await response.json()) as Problem;
  expect(body.type, `problem type for ${code}`).toBe("about:blank");
  expect(body.status, `problem status for ${code}`).toBe(status);
  expect(body.code, `problem code for ${code}`).toBe(code);
  expect(body.title.length).toBeGreaterThan(0);
  expect(body.detail.length).toBeGreaterThan(0);
  expectProblemKeys(body);
  return body;
}

/** Problem has exactly the contract fields; errors[] appears only for validation_failed. */
export function expectProblemKeys(problem: Problem): void {
  const expected =
    problem.code === "validation_failed"
      ? [...PROBLEM_KEYS, "errors"].sort()
      : [...PROBLEM_KEYS].sort();
  expect(Object.keys(problem).sort()).toEqual(expected);
  if (problem.code === "validation_failed") {
    expect(problem.errors?.length ?? 0).toBeGreaterThan(0);
  }
}

/** Assert a validation_failed problem names every expected field and has well-formed FieldErrors. */
export function expectValidation(problem: Problem, fields: string[]): void {
  expect(problem.code).toBe("validation_failed");
  const errors = problem.errors ?? [];
  expect(errors.length).toBeGreaterThanOrEqual(fields.length);
  for (const field of fields) {
    expect(
      errors.some((entry) => entry.field === field),
      `expected a FieldError for ${field}`,
    ).toBe(true);
  }
  for (const entry of errors) {
    expect(Object.keys(entry).sort()).toEqual(["code", "field", "message"]);
    expect(entry.field.length).toBeGreaterThan(0);
    expect(entry.code).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(entry.message.length).toBeGreaterThan(0);
  }
}

/** Assert the exact documented FieldError code for a field (pins observed vocabulary). */
export function expectFieldCode(problem: Problem, field: string, code: string): void {
  const entry = (problem.errors ?? []).find((candidate) => candidate.field === field);
  expect(entry, `expected a FieldError for ${field}`).toBeDefined();
  expect(entry?.code, `FieldError.code for ${field}`).toBe(code);
}

const LEAK_MARKERS = [
  "node_modules",
  "/Users/",
  "    at ",
  "Error:",
  "SELECT ",
  "INSERT ",
  "alice-password",
  "bob-password",
] as const;

/** Assert an error body does not expose internals or synthetic credentials. */
export function expectNoLeak(problem: Problem): void {
  const serialized = JSON.stringify(problem);
  for (const marker of LEAK_MARKERS) {
    expect(serialized, `error body leaked ${marker}`).not.toContain(marker);
  }
}

function createApi(
  context: APIRequestContext,
  baseURL: string,
  setNow: (ms: number | undefined) => void,
): InventoryApi {
  const auth = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });

  const login = async (username: UserName = "alice", password?: string): Promise<LoginBody> => {
    const credentials = CREDENTIALS[username];
    const response = await context.post("/auth/login", {
      data: { username: credentials.username, password: password ?? credentials.password },
    });
    expect(response.status(), `login as ${username}`).toBe(200);
    return (await response.json()) as LoginBody;
  };

  const token = async (username: UserName = "alice"): Promise<string> => {
    return (await login(username)).token;
  };

  const createItem = async (
    tokenValue: string,
    overrides: Record<string, unknown> = {},
  ): Promise<Item> => {
    const response = await context.post("/items", {
      headers: auth(tokenValue),
      data: { name: "Widget", price: 19.99, quantity: 5, ...overrides },
    });
    expect(response.status(), `create item with ${JSON.stringify(overrides)}`).toBe(201);
    return (await response.json()) as Item;
  };

  const list = async (
    tokenValue: string,
    params?: Record<string, string | number>,
  ): Promise<ItemList> => {
    const response = await context.get("/items", { headers: auth(tokenValue), params });
    expect(response.status(), "list items").toBe(200);
    return (await response.json()) as ItemList;
  };

  const problem = async (response: APIResponse): Promise<Problem> => {
    expect(response.headers()["content-type"]).toBe("application/problem+json");
    return (await response.json()) as Problem;
  };

  return { baseURL, request: context, auth, login, token, createItem, list, problem, setNow };
}

/**
 * Every test gets a fresh SUT process-in-memory instance on an ephemeral
 * loopback port, so tests share no items or tokens. That is the isolation
 * boundary used to prove order independence in G3.
 */
export const test = base.extend<{ inventory: InventoryApi }>({
  inventory: async ({}, use) => {
    let clock: number | undefined;
    const sut = createInventoryServer({ now: () => clock ?? Date.now() });
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => reject(error);
      sut.server.once("error", onError);
      sut.server.listen(0, "127.0.0.1", () => {
        sut.server.off("error", onError);
        resolve();
      });
    });

    const address = sut.server.address();
    if (address === null || typeof address === "string") {
      sut.server.close();
      throw new Error("Inventory SUT did not bind to a TCP port");
    }
    const baseURL = `http://127.0.0.1:${(address as AddressInfo).port}`;
    let context: APIRequestContext | undefined;

    try {
      context = await playwrightRequest.newContext({ baseURL });
      await use(
        createApi(context, baseURL, (ms) => {
          clock = ms;
        }),
      );
    } finally {
      if (context !== undefined) await context.dispose();
      await new Promise<void>((resolve, reject) => {
        sut.server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
    }
  },
});

export { expect };
