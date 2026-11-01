import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";

export const SUT_VERSION = "1.0.0";
export const TOKEN_EXPIRES_IN = 3600;

export interface SyntheticUser {
  id: string;
  username: string;
  password: string;
}

// Synthetic credentials only (DECISIONS D011/D012). Never real accounts.
export const SYNTHETIC_USERS: readonly SyntheticUser[] = [
  { id: "usr_alice", username: "alice", password: "alice-password" },
  { id: "usr_bob", username: "bob", password: "bob-password" },
];

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

interface FieldError {
  field: string;
  code: string;
  message: string;
}

interface TokenRecord {
  user: SyntheticUser;
  expiresAt: number;
}

const CATEGORIES = ["electronics", "books", "food", "other"] as const;
const TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  404: "Not Found",
  415: "Unsupported Media Type",
  500: "Internal Server Error",
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function sendProblem(
  res: ServerResponse,
  status: number,
  code: string,
  detail: string,
  errors?: FieldError[],
): void {
  const body: Record<string, unknown> = {
    type: "about:blank",
    title: TITLES[status] ?? "Error",
    status,
    code,
    detail,
  };
  if (errors !== undefined) body["errors"] = errors;
  res.writeHead(status, { "Content-Type": "application/problem+json" });
  res.end(JSON.stringify(body));
}

function sendAuthProblem(res: ServerResponse, code: "missing_token" | "invalid_token"): void {
  res.setHeader("WWW-Authenticate", "Bearer");
  const detail =
    code === "missing_token"
      ? "An Authorization header with a Bearer token is required."
      : "The bearer token is not recognized.";
  sendProblem(res, 401, code, detail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasAtMostTwoDecimals(value: number): boolean {
  // Round-trip through the two-decimal representation: valid cent amounts
  // parse back to the identical double, genuine fractional cents do not.
  // A fixed epsilon would wrongly accept tiny values such as 1e-12.
  return Number(value.toFixed(2)) === value;
}

function charLength(value: string): number {
  // JSON Schema string length counts Unicode characters, not UTF-16
  // code units (a supplementary character such as an emoji counts once).
  return [...value].length;
}

function displayField(key: string): string {
  // FieldError.field must be non-empty (Problem schema minLength 1), so an
  // empty property name needs an explicit, unambiguous representation.
  return key === "" ? "(empty property name)" : key;
}

function validateName(value: unknown, errors: FieldError[]): void {
  if (typeof value !== "string") {
    errors.push({ field: "name", code: "wrong_type", message: "name must be a string" });
  } else if (value.trim().length === 0) {
    errors.push({ field: "name", code: "blank", message: "name must contain a non-whitespace character" });
  } else if (charLength(value) > 80) {
    errors.push({ field: "name", code: "too_long", message: "name must be at most 80 characters" });
  }
}

function validatePrice(value: unknown, errors: FieldError[]): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push({ field: "price", code: "wrong_type", message: "price must be a number" });
  } else if (value < 0 || value > 1_000_000) {
    errors.push({ field: "price", code: "out_of_range", message: "price must be between 0 and 1000000" });
  } else if (!hasAtMostTwoDecimals(value)) {
    errors.push({ field: "price", code: "too_many_decimals", message: "price must have at most two decimal places" });
  }
}

function validateQuantity(value: unknown, errors: FieldError[]): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push({ field: "quantity", code: "wrong_type", message: "quantity must be a number" });
  } else if (!Number.isInteger(value)) {
    errors.push({ field: "quantity", code: "wrong_type", message: "quantity must be an integer" });
  } else if (value < 0 || value > 10_000) {
    errors.push({ field: "quantity", code: "out_of_range", message: "quantity must be between 0 and 10000" });
  }
}

function validateDescription(value: unknown, errors: FieldError[]): void {
  if (typeof value !== "string") {
    errors.push({ field: "description", code: "wrong_type", message: "description must be a string" });
  } else if (charLength(value) > 500) {
    errors.push({ field: "description", code: "too_long", message: "description must be at most 500 characters" });
  }
}

function validateCategory(value: unknown, errors: FieldError[]): void {
  if (typeof value !== "string") {
    errors.push({ field: "category", code: "wrong_type", message: "category must be a string" });
  } else if (!(CATEGORIES as readonly string[]).includes(value)) {
    errors.push({
      field: "category",
      code: "invalid_enum",
      message: "category must be one of electronics, books, food, other",
    });
  }
}

const ITEM_FIELDS = ["name", "description", "category", "price", "quantity"] as const;

function validateItemBody(body: unknown, mode: "create" | "update"): FieldError[] {
  if (!isRecord(body)) {
    return [{ field: "body", code: "wrong_type", message: "body must be an object" }];
  }
  const errors: FieldError[] = [];
  if (mode === "update" && Object.keys(body).length === 0) {
    return [{ field: "body", code: "required", message: "at least one field is required" }];
  }
  if (body["name"] !== undefined) validateName(body["name"], errors);
  else if (mode === "create") errors.push({ field: "name", code: "required", message: "name is required" });

  if (body["price"] !== undefined) validatePrice(body["price"], errors);
  else if (mode === "create") errors.push({ field: "price", code: "required", message: "price is required" });

  if (body["quantity"] !== undefined) validateQuantity(body["quantity"], errors);
  else if (mode === "create") errors.push({ field: "quantity", code: "required", message: "quantity is required" });

  if (body["description"] !== undefined) validateDescription(body["description"], errors);
  if (body["category"] !== undefined) validateCategory(body["category"], errors);

  for (const key of Object.keys(body)) {
    if (!(ITEM_FIELDS as readonly string[]).includes(key)) {
      const field = displayField(key);
      errors.push({ field, code: "unknown_property", message: `${field} is not a supported property` });
    }
  }
  return errors;
}

function validateLoginBody(body: unknown): FieldError[] {
  if (!isRecord(body)) {
    return [{ field: "body", code: "wrong_type", message: "body must be an object" }];
  }
  const errors: FieldError[] = [];
  const check = (field: "username" | "password", max: number): void => {
    const value = body[field];
    if (value === undefined) {
      errors.push({ field, code: "required", message: `${field} is required` });
    } else if (typeof value !== "string") {
      errors.push({ field, code: "wrong_type", message: `${field} must be a string` });
    } else if (value.trim().length === 0) {
      errors.push({ field, code: "blank", message: `${field} must contain a non-whitespace character` });
    } else if (charLength(value) > max) {
      errors.push({ field, code: "too_long", message: `${field} must be at most ${max} characters` });
    }
  };
  check("username", 32);
  check("password", 128);
  for (const key of Object.keys(body)) {
    if (key !== "username" && key !== "password") {
      const field = displayField(key);
      errors.push({ field, code: "unknown_property", message: `${field} is not a supported property` });
    }
  }
  return errors;
}

function nextTimestamp(afterIso: string, currentMs: number): string {
  const afterMs = Date.parse(afterIso);
  return new Date(currentMs > afterMs ? currentMs : afterMs + 1).toISOString();
}

type BodyResult =
  | { kind: "value"; value: unknown }
  | { kind: "empty" }
  | { kind: "malformed" }
  | { kind: "unsupported" };

async function readJsonBody(req: IncomingMessage): Promise<BodyResult> {
  const contentType = req.headers["content-type"];
  const mediaType = (contentType ?? "").split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") return { kind: "unsupported" };
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.trim().length === 0) return { kind: "empty" };
  try {
    return { kind: "value", value: JSON.parse(raw) as unknown };
  } catch {
    return { kind: "malformed" };
  }
}

export interface InventoryServer {
  server: Server;
  reset: () => void;
}

export interface InventoryServerOptions {
  /** Clock override for deterministic token-expiry tests. Defaults to Date.now. */
  now?: () => number;
  /** Token lifetime in seconds. Defaults to TOKEN_EXPIRES_IN. */
  tokenTtlSeconds?: number;
}

export function createInventoryServer(options: InventoryServerOptions = {}): InventoryServer {
  const now = options.now ?? Date.now;
  const tokenTtlSeconds = options.tokenTtlSeconds ?? TOKEN_EXPIRES_IN;
  const items = new Map<string, Item>();
  const tokens = new Map<string, TokenRecord>();

  function reset(): void {
    items.clear();
    tokens.clear();
  }

  function authenticate(req: IncomingMessage, res: ServerResponse): SyntheticUser | undefined {
    const header = req.headers["authorization"];
    if (header === undefined) {
      sendAuthProblem(res, "missing_token");
      return undefined;
    }
    const match = /^Bearer[ \t]+(\S+)$/i.exec(header.trim());
    if (match === null) {
      sendAuthProblem(res, "invalid_token");
      return undefined;
    }
    const record = tokens.get(match[1] as string);
    if (record === undefined || record.expiresAt <= now()) {
      if (record !== undefined) tokens.delete(match[1] as string);
      sendAuthProblem(res, "invalid_token");
      return undefined;
    }
    return record.user;
  }

  function ownedItem(id: string, user: SyntheticUser): Item | undefined {
    const item = items.get(id);
    if (item === undefined || item.ownerId !== user.id) return undefined;
    return item;
  }

  function sendItemNotFound(res: ServerResponse): void {
    sendProblem(res, 404, "item_not_found", "No item with this id exists for the authenticated user.");
  }

  async function handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (body.kind === "unsupported") {
      sendProblem(res, 415, "unsupported_media_type", "This endpoint accepts application/json only.");
      return;
    }
    if (body.kind === "malformed" || body.kind === "empty") {
      // An empty body is not valid JSON for login (PATCH empty-body is the
      // documented validation_failed exception, REQ-ITEM-09).
      sendProblem(res, 400, "malformed_json", "The request body is not valid JSON.");
      return;
    }
    const errors = validateLoginBody(body.value);
    if (errors.length > 0) {
      sendProblem(res, 400, "validation_failed", "The request body failed validation.", errors);
      return;
    }
    const record = body.value as Record<string, unknown>;
    const user = SYNTHETIC_USERS.find((candidate) => candidate.username === record["username"]);
    if (user === undefined || user.password !== record["password"]) {
      res.setHeader("WWW-Authenticate", "Bearer");
      sendProblem(res, 401, "invalid_credentials", "Invalid username or password.");
      return;
    }
    const token = randomBytes(32).toString("base64url");
    tokens.set(token, { user, expiresAt: now() + tokenTtlSeconds * 1000 });
    sendJson(res, 200, {
      token,
      tokenType: "Bearer",
      expiresIn: tokenTtlSeconds,
      user: { id: user.id, username: user.username },
    });
  }

  async function handleCreate(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const user = authenticate(req, res);
    if (user === undefined) return;
    const body = await readJsonBody(req);
    if (body.kind === "unsupported") {
      sendProblem(res, 415, "unsupported_media_type", "This endpoint accepts application/json only.");
      return;
    }
    if (body.kind === "malformed" || body.kind === "empty") {
      sendProblem(res, 400, "malformed_json", "The request body is not valid JSON.");
      return;
    }
    const errors = validateItemBody(body.value, "create");
    if (errors.length > 0) {
      sendProblem(res, 400, "validation_failed", "The request body failed validation.", errors);
      return;
    }
    const record = body.value as Record<string, unknown>;
    const createdAt = new Date(now()).toISOString();
    const item: Item = {
      id: randomUUID(),
      ownerId: user.id,
      name: (record["name"] as string).trim(),
      description: (record["description"] as string | undefined) ?? "",
      category: (record["category"] as string | undefined) ?? "other",
      price: record["price"] as number,
      quantity: record["quantity"] as number,
      createdAt,
      updatedAt: createdAt,
    };
    items.set(item.id, item);
    res.setHeader("Location", `/items/${item.id}`);
    sendJson(res, 201, item);
  }

  function handleList(req: IncomingMessage, res: ServerResponse, url: URL): void {
    const user = authenticate(req, res);
    if (user === undefined) return;
    const errors: FieldError[] = [];
    let limit = 20;
    let offset = 0;
    const rawLimit = url.searchParams.get("limit");
    if (rawLimit !== null) {
      if (!/^-?\d+$/.test(rawLimit)) {
        errors.push({ field: "limit", code: "wrong_type", message: "limit must be an integer" });
      } else {
        limit = Number(rawLimit);
        if (limit < 1 || limit > 100) {
          errors.push({ field: "limit", code: "out_of_range", message: "limit must be between 1 and 100" });
        }
      }
    }
    const rawOffset = url.searchParams.get("offset");
    if (rawOffset !== null) {
      if (!/^-?\d+$/.test(rawOffset)) {
        errors.push({ field: "offset", code: "wrong_type", message: "offset must be an integer" });
      } else {
        offset = Number(rawOffset);
        if (!Number.isSafeInteger(offset)) {
          // Digit strings beyond the safe-integer range (or overflowing to
          // Infinity) cannot be represented or echoed as a contract
          // integer; reject instead of serializing null. This is a
          // representability limit, not a contract maximum: every
          // safe integer remains accepted.
          errors.push({ field: "offset", code: "out_of_range", message: "offset is too large to represent" });
        } else if (offset < 0) {
          errors.push({ field: "offset", code: "out_of_range", message: "offset must be greater than or equal to 0" });
        }
      }
    }
    if (errors.length > 0) {
      sendProblem(res, 400, "validation_failed", "The request query failed validation.", errors);
      return;
    }
    const owned = [...items.values()]
      .filter((item) => item.ownerId === user.id)
      .sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.createdAt < b.createdAt ? -1 : 1));
    sendJson(res, 200, {
      items: owned.slice(offset, offset + limit),
      total: owned.length,
      limit,
      offset,
    });
  }

  function handleGet(req: IncomingMessage, res: ServerResponse, id: string): void {
    const user = authenticate(req, res);
    if (user === undefined) return;
    const item = ownedItem(id, user);
    if (item === undefined) {
      sendItemNotFound(res);
      return;
    }
    sendJson(res, 200, item);
  }

  async function handleUpdate(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
    const user = authenticate(req, res);
    if (user === undefined) return;
    // Ownership/existence is checked before body validation so a foreign id
    // is indistinguishable from a nonexistent id (D009, REQ-ISO-01).
    const item = ownedItem(id, user);
    if (item === undefined) {
      sendItemNotFound(res);
      return;
    }
    const body = await readJsonBody(req);
    if (body.kind === "unsupported") {
      sendProblem(res, 415, "unsupported_media_type", "This endpoint accepts application/json only.");
      return;
    }
    if (body.kind === "malformed") {
      sendProblem(res, 400, "malformed_json", "The request body is not valid JSON.");
      return;
    }
    if (body.kind === "empty") {
      sendProblem(res, 400, "validation_failed", "The request body failed validation.", [
        { field: "body", code: "required", message: "at least one field is required" },
      ]);
      return;
    }
    const errors = validateItemBody(body.value, "update");
    if (errors.length > 0) {
      sendProblem(res, 400, "validation_failed", "The request body failed validation.", errors);
      return;
    }
    const record = body.value as Record<string, unknown>;
    if (record["name"] !== undefined) item.name = (record["name"] as string).trim();
    if (record["description"] !== undefined) item.description = record["description"] as string;
    if (record["category"] !== undefined) item.category = record["category"] as string;
    if (record["price"] !== undefined) item.price = record["price"] as number;
    if (record["quantity"] !== undefined) item.quantity = record["quantity"] as number;
    item.updatedAt = nextTimestamp(item.updatedAt, now());
    sendJson(res, 200, item);
  }

  function handleDelete(req: IncomingMessage, res: ServerResponse, id: string): void {
    const user = authenticate(req, res);
    if (user === undefined) return;
    const item = ownedItem(id, user);
    if (item === undefined) {
      sendItemNotFound(res);
      return;
    }
    items.delete(id);
    res.writeHead(204);
    res.end();
  }

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        const path = url.pathname;
        const method = req.method ?? "";

        if (path === "/health" && method === "GET") {
          // Health must not evaluate credentials (REQ-ENV-01).
          sendJson(res, 200, { status: "ok", version: SUT_VERSION });
          return;
        }
        if (path === "/auth/login" && method === "POST") {
          await handleLogin(req, res);
          return;
        }
        if (path === "/items" && method === "GET") {
          handleList(req, res, url);
          return;
        }
        if (path === "/items" && method === "POST") {
          await handleCreate(req, res);
          return;
        }
        const itemMatch = /^\/items\/([^/]+)$/.exec(path);
        if (itemMatch !== null) {
          let id = itemMatch[1] as string;
          try {
            id = decodeURIComponent(id);
          } catch {
            // Keep the raw id; it simply matches nothing and yields 404.
          }
          if (method === "GET") {
            handleGet(req, res, id);
            return;
          }
          if (method === "PATCH") {
            await handleUpdate(req, res, id);
            return;
          }
          if (method === "DELETE") {
            handleDelete(req, res, id);
            return;
          }
        }
        sendProblem(res, 404, "route_not_found", "No route matches this request.");
      } catch {
        // Never leak stack traces, paths or internals (REQ-ERR-02).
        if (!res.headersSent) {
          sendProblem(res, 500, "internal_error", "An unexpected error occurred.");
        } else {
          res.end();
        }
      }
    })();
  });

  return { server, reset };
}
