/**
 * Contract rules for Gate G1.
 *
 * `validateContractDocument` is a pure, fail-closed assessment of a parsed
 * OpenAPI document. It first asks swagger-parser to validate the document
 * against the OpenAPI 3.1 meta-schema, then enforces project-specific rules:
 * requirement-ID referential integrity, error-envelope consistency, auth
 * coverage, cross-user isolation semantics, schema strictness and boundaries.
 *
 * A document only passes when every check passes. Missing or malformed input is
 * a failure, never a warning.
 */
import SwaggerParser from "@apidevtools/swagger-parser";
import { Ajv2020 } from "ajv/dist/2020.js";

export type CheckStatus = "PASS" | "FAIL";

export interface ContractCheck {
  readonly id: string;
  readonly status: CheckStatus;
  readonly detail: string;
}

export interface ContractVerdict {
  readonly ok: boolean;
  readonly checks: readonly ContractCheck[];
}

interface OperationRef {
  readonly method: string;
  readonly path: string;
}

const REQUIRED_OPERATIONS: readonly OperationRef[] = [
  { method: "get", path: "/health" },
  { method: "post", path: "/auth/login" },
  { method: "get", path: "/items" },
  { method: "post", path: "/items" },
  { method: "get", path: "/items/{id}" },
  { method: "patch", path: "/items/{id}" },
  { method: "delete", path: "/items/{id}" },
];

const PUBLIC_OPERATIONS: readonly OperationRef[] = [
  { method: "get", path: "/health" },
  { method: "post", path: "/auth/login" },
];

const PROTECTED_OPERATIONS: readonly OperationRef[] = [
  { method: "get", path: "/items" },
  { method: "post", path: "/items" },
  { method: "get", path: "/items/{id}" },
  { method: "patch", path: "/items/{id}" },
  { method: "delete", path: "/items/{id}" },
];

const HTTP_METHODS: readonly string[] = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];
const AREAS: readonly string[] = ["environment", "auth", "items", "validation", "isolation", "errors"];
const REQUIRED_REQUIREMENT_COUNT = 22;
const REQUIREMENT_ID_PATTERN = /^REQ-[A-Z]+-\d{2}$/;
const ERROR_CODE_PATTERN = /^[a-z][a-z0-9_]*$/;
const LOCAL_HOSTS: readonly string[] = ["127.0.0.1", "localhost", "::1", "[::1]"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function asArray(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function resolvePointer(root: Record<string, unknown>, ref: string): unknown {
  if (!ref.startsWith("#/")) return undefined;
  let current: unknown = root;
  for (const raw of ref.slice(2).split("/")) {
    const record = asRecord(current);
    if (!record) return undefined;
    const key = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!(key in record)) return undefined;
    current = record[key];
  }
  return current;
}

/** Follow local `$ref` chains (no external refs are permitted). */
function resolveLocal(root: Record<string, unknown>, value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 8; depth += 1) {
    const record = asRecord(current);
    if (!record) return current;
    const ref = asString(record["$ref"]);
    if (ref === undefined) return record;
    current = resolvePointer(root, ref);
    if (current === undefined) return undefined;
  }
  return undefined;
}

function getPathItem(root: Record<string, unknown>, path: string): Record<string, unknown> | undefined {
  const paths = asRecord(root["paths"]);
  return paths ? asRecord(paths[path]) : undefined;
}

function getOperation(root: Record<string, unknown>, ref: OperationRef): Record<string, unknown> | undefined {
  const pathItem = getPathItem(root, ref.path);
  return pathItem ? asRecord(pathItem[ref.method]) : undefined;
}

function operationLabel(ref: OperationRef): string {
  return `${ref.method.toUpperCase()} ${ref.path}`;
}

function isBearerOnly(value: unknown): boolean {
  const entries = asArray(value);
  if (!entries || entries.length !== 1) return false;
  const entry = asRecord(entries[0]);
  if (!entry) return false;
  const keys = Object.keys(entry);
  return keys.length === 1 && keys[0] === "bearerAuth" && asArray(entry["bearerAuth"])?.length === 0;
}

async function structureCheck(document: unknown): Promise<ContractCheck> {
  if (!isRecord(document)) {
    return { id: "contract.structure", status: "FAIL", detail: "contract document is not a mapping" };
  }
  try {
    // Validate a clone: swagger-parser may dereference the document it receives.
    // The input is deliberately `unknown` here; swagger-parser decides validity.
    await SwaggerParser.validate(structuredClone(document) as never);
    return { id: "contract.structure", status: "PASS", detail: "OpenAPI document validates against its meta-schema" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { id: "contract.structure", status: "FAIL", detail: message.replaceAll("\n", " | ").slice(0, 400) };
  }
}

function versionCheck(root: Record<string, unknown>): ContractCheck {
  const version = asString(root["openapi"]);
  const ok = version !== undefined && /^3\.1\.\d+$/.test(version);
  return {
    id: "contract.version",
    status: ok ? "PASS" : "FAIL",
    detail: ok ? `openapi ${version}` : `expected an OpenAPI 3.1.x version, found ${JSON.stringify(version)}`,
  };
}

function serverCheck(root: Record<string, unknown>): ContractCheck {
  const servers = asArray(root["servers"]);
  if (!servers || servers.length === 0) {
    return { id: "contract.servers", status: "FAIL", detail: "no servers declared" };
  }
  const problems: string[] = [];
  for (const [index, entry] of servers.entries()) {
    const url = asString(asRecord(entry)?.["url"]);
    if (url === undefined) {
      problems.push(`server[${index}] has no url`);
      continue;
    }
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      problems.push(`server[${index}] url is not absolute: ${url}`);
      continue;
    }
    if (!LOCAL_HOSTS.includes(hostname)) {
      problems.push(`server[${index}] must be local-only, found ${hostname}`);
    }
  }

  // Path-item and operation-level server overrides could route traffic elsewhere.
  const paths = asRecord(root["paths"]);
  if (paths) {
    for (const [path, rawItem] of Object.entries(paths)) {
      const item = asRecord(rawItem);
      if (!item) continue;
      if (item["servers"] !== undefined) {
        problems.push(`${path} must not override servers`);
      }
      for (const method of HTTP_METHODS) {
        const operation = asRecord(item[method]);
        if (operation && operation["servers"] !== undefined) {
          problems.push(`${method.toUpperCase()} ${path} must not override servers`);
        }
      }
    }
  }

  return {
    id: "contract.servers",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail:
      problems.length === 0
        ? `${servers.length} local root server(s), no overrides`
        : problems.join("; "),
  };
}

function operationsCheck(root: Record<string, unknown>): ContractCheck {
  const paths = asRecord(root["paths"]);
  if (!paths) {
    return { id: "contract.operations", status: "FAIL", detail: "no paths object" };
  }
  const actual: string[] = [];
  for (const [path, rawItem] of Object.entries(paths)) {
    const item = asRecord(rawItem);
    if (!item) continue;
    for (const method of HTTP_METHODS) {
      if (asRecord(item[method]) !== undefined) actual.push(`${method.toUpperCase()} ${path}`);
    }
  }
  const expected = REQUIRED_OPERATIONS.map(operationLabel).sort();
  const sortedActual = [...actual].sort();
  const missing = expected.filter((entry) => !sortedActual.includes(entry));
  const unexpected = sortedActual.filter((entry) => !expected.includes(entry));
  const ok = missing.length === 0 && unexpected.length === 0;
  return {
    id: "contract.operations",
    status: ok ? "PASS" : "FAIL",
    detail: ok
      ? `${expected.length} required operations present, no extras`
      : `missing: [${missing.join(", ")}]; unexpected: [${unexpected.join(", ")}]`,
  };
}

function securitySchemeCheck(root: Record<string, unknown>): ContractCheck {
  const components = asRecord(root["components"]);
  const schemes = components ? asRecord(components["securitySchemes"]) : undefined;
  const bearer = schemes ? asRecord(schemes["bearerAuth"]) : undefined;
  const ok = bearer !== undefined && bearer["type"] === "http" && bearer["scheme"] === "bearer";
  return {
    id: "contract.security-scheme",
    status: ok ? "PASS" : "FAIL",
    detail: ok ? "bearerAuth is type http / scheme bearer" : "components.securitySchemes.bearerAuth must be HTTP bearer",
  };
}

function securityCheck(root: Record<string, unknown>): ContractCheck {
  const problems: string[] = [];
  if (!isBearerOnly(root["security"])) {
    problems.push("root security must default to bearerAuth only");
  }
  for (const ref of PUBLIC_OPERATIONS) {
    const operation = getOperation(root, ref);
    const security = operation ? (operation["security"] ?? root["security"]) : undefined;
    if (asArray(security)?.length !== 0) {
      problems.push(`${operationLabel(ref)} must declare security: []`);
    }
  }
  for (const ref of PROTECTED_OPERATIONS) {
    const operation = getOperation(root, ref);
    const security = operation ? (operation["security"] ?? root["security"]) : undefined;
    if (!isBearerOnly(security)) {
      problems.push(`${operationLabel(ref)} must require bearerAuth only`);
    }
  }
  return {
    id: "contract.security",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail: problems.length === 0 ? "health/login public; item endpoints bearer-only" : problems.join("; "),
  };
}

interface RequirementEntry {
  readonly id: string;
  readonly area: string;
  readonly scope: string;
  readonly statement: string;
  readonly appliesTo: readonly string[];
}

const KNOWN_OPERATION_LABELS: readonly string[] = REQUIRED_OPERATIONS.map(operationLabel);

function readRequirements(root: Record<string, unknown>): { entries: readonly RequirementEntry[]; problems: readonly string[] } {
  const raw = asArray(root["x-requirements"]);
  if (!raw) {
    return { entries: [], problems: ["x-requirements must be a non-empty array"] };
  }
  const problems: string[] = [];
  const entries: RequirementEntry[] = [];
  const seen = new Set<string>();
  for (const [index, item] of raw.entries()) {
    const record = asRecord(item);
    const id = asString(record?.["id"]);
    const area = asString(record?.["area"]);
    const scope = asString(record?.["scope"]);
    const statement = asString(record?.["statement"]);
    if (id === undefined || !REQUIREMENT_ID_PATTERN.test(id)) {
      problems.push(`x-requirements[${index}] has an invalid id`);
      continue;
    }
    if (seen.has(id)) {
      problems.push(`duplicate requirement id ${id}`);
      continue;
    }
    seen.add(id);
    if (area === undefined || !AREAS.includes(area)) {
      problems.push(`${id} has an unknown area ${JSON.stringify(area)}`);
    }
    if (scope !== "operation" && scope !== "global") {
      problems.push(`${id} has an invalid scope ${JSON.stringify(scope)}`);
    }
    if (statement === undefined || statement.trim().length < 20) {
      problems.push(`${id} needs a substantive statement`);
    }

    const rawAppliesTo = record?.["appliesTo"];
    if (!Array.isArray(rawAppliesTo)) {
      problems.push(`${id} must declare appliesTo as an array`);
    }
    const appliesToList: readonly unknown[] = Array.isArray(rawAppliesTo) ? rawAppliesTo : [];
    const appliesTo: string[] = [];
    for (const rawLabel of appliesToList) {
      const label = asString(rawLabel);
      if (label === undefined || !KNOWN_OPERATION_LABELS.includes(label)) {
        problems.push(`${id} appliesTo contains unknown operation ${JSON.stringify(rawLabel)}`);
        continue;
      }
      if (appliesTo.includes(label)) {
        problems.push(`${id} appliesTo repeats ${label}`);
        continue;
      }
      appliesTo.push(label);
    }
    if (scope === "global" && appliesTo.length > 0) {
      problems.push(`${id} is global and must not list appliesTo operations`);
    }
    if (scope === "operation" && appliesTo.length === 0) {
      problems.push(`${id} must list at least one appliesTo operation`);
    }

    entries.push({
      id,
      area: area ?? "",
      scope: scope ?? "",
      statement: statement ?? "",
      appliesTo,
    });
  }
  if (entries.length < REQUIRED_REQUIREMENT_COUNT) {
    problems.push(`at least ${REQUIRED_REQUIREMENT_COUNT} requirements are required, found ${entries.length}`);
  }
  for (const area of AREAS) {
    if (!entries.some((entry) => entry.area === area)) {
      problems.push(`no requirements declared for area ${area}`);
    }
  }
  return { entries, problems };
}

function requirementRegistryCheck(root: Record<string, unknown>): ContractCheck {
  const { entries, problems } = readRequirements(root);
  return {
    id: "contract.requirement-registry",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail:
      problems.length === 0
        ? `${entries.length} unique requirements across ${AREAS.length} areas`
        : problems.join("; "),
  };
}

function requirementLinksCheck(root: Record<string, unknown>): ContractCheck {
  const { entries } = readRequirements(root);
  const known = new Set(entries.map((entry) => entry.id));
  const problems: string[] = [];

  // Requirement applicability is declared once per requirement (`appliesTo`);
  // operation links must match that matrix exactly, in both directions.
  const expectedByOperation = new Map<string, Set<string>>();
  for (const label of KNOWN_OPERATION_LABELS) expectedByOperation.set(label, new Set<string>());
  for (const entry of entries) {
    if (entry.scope === "global") continue;
    for (const label of entry.appliesTo) {
      expectedByOperation.get(label)?.add(entry.id);
    }
  }

  let linkCount = 0;
  for (const ref of REQUIRED_OPERATIONS) {
    const label = operationLabel(ref);
    const operation = getOperation(root, ref);
    const rawIds = asArray(operation?.["x-requirement-ids"]);
    const actual = new Set<string>();
    if (!rawIds || rawIds.length === 0) {
      problems.push(`${label} has no x-requirement-ids`);
    } else {
      for (const rawId of rawIds) {
        const id = asString(rawId);
        if (id === undefined) {
          problems.push(`${label} references a non-string requirement id`);
          continue;
        }
        if (!known.has(id)) {
          problems.push(`${label} references unknown requirement ${id}`);
        }
        actual.add(id);
      }
    }
    const expected = expectedByOperation.get(label) ?? new Set<string>();
    const missing = [...expected].filter((id) => !actual.has(id));
    const extra = [...actual].filter((id) => known.has(id) && !expected.has(id));
    if (missing.length > 0) {
      problems.push(`${label} is missing applicable requirements: ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      problems.push(`${label} links non-applicable requirements: ${extra.join(", ")}`);
    }
    linkCount += actual.size;
  }

  return {
    id: "contract.requirement-links",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail:
      problems.length === 0
        ? `${linkCount} operation links match the declared appliesTo matrix`
        : problems.join("; "),
  };
}

interface ErrorCodeEntry {
  readonly code: string;
  readonly status: number;
  readonly scope: string;
}

function readErrorCodes(root: Record<string, unknown>): { entries: readonly ErrorCodeEntry[]; problems: readonly string[] } {
  const raw = asArray(root["x-error-codes"]);
  if (!raw) {
    return { entries: [], problems: ["x-error-codes must be a non-empty array"] };
  }
  const problems: string[] = [];
  const entries: ErrorCodeEntry[] = [];
  const seen = new Set<string>();
  for (const [index, item] of raw.entries()) {
    const record = asRecord(item);
    const code = asString(record?.["code"]);
    const status = asNumber(record?.["status"]);
    const description = asString(record?.["description"]);
    const scope = asString(record?.["scope"]) ?? "response";
    if (code === undefined || !ERROR_CODE_PATTERN.test(code)) {
      problems.push(`x-error-codes[${index}] has an invalid code`);
      continue;
    }
    if (seen.has(code)) {
      problems.push(`duplicate error code ${code}`);
      continue;
    }
    seen.add(code);
    if (status === undefined || !Number.isInteger(status) || status < 400 || status > 599) {
      problems.push(`${code} has an invalid status`);
    }
    if (description === undefined || description.trim().length === 0) {
      problems.push(`${code} has no description`);
    }
    if (scope !== "response" && scope !== "global") {
      problems.push(`${code} has an invalid scope ${JSON.stringify(scope)}`);
    }
    entries.push({ code, status: status ?? 0, scope });
  }
  return { entries, problems };
}

function errorRegistryCheck(root: Record<string, unknown>): ContractCheck {
  const { entries, problems } = readErrorCodes(root);
  return {
    id: "contract.error-registry",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail: problems.length === 0 ? `${entries.length} error codes registered` : problems.join("; "),
  };
}

function errorResponsesCheck(root: Record<string, unknown>): ContractCheck {
  const { entries: registry } = readErrorCodes(root);
  const statusByCode = new Map(registry.map((entry) => [entry.code, entry.status]));
  const usedCodes = new Set<string>();
  const problems: string[] = [];
  let inspected = 0;

  for (const ref of REQUIRED_OPERATIONS) {
    const operation = getOperation(root, ref);
    if (!operation) continue;
    const responses = asRecord(operation["responses"]);
    if (!responses) {
      problems.push(`${operationLabel(ref)} has no responses`);
      continue;
    }
    for (const [statusKey, rawResponse] of Object.entries(responses)) {
      const status = Number.parseInt(statusKey, 10);
      if (!Number.isInteger(status) || status < 400) continue;
      inspected += 1;
      const label = `${operationLabel(ref)} ${statusKey}`;
      const response = asRecord(resolveLocal(root, rawResponse));
      if (!response) {
        problems.push(`${label} cannot be resolved`);
        continue;
      }
      const content = asRecord(response["content"]);
      const problemMedia = content ? asRecord(content["application/problem+json"]) : undefined;
      if (!problemMedia) {
        problems.push(`${label} must answer application/problem+json`);
        continue;
      }
      const media = asRecord(resolveLocal(root, problemMedia));
      const schemaRef = asString(asRecord(media?.["schema"])?.["$ref"]);
      if (schemaRef !== "#/components/schemas/Problem") {
        problems.push(`${label} schema must be Problem, found ${JSON.stringify(schemaRef)}`);
      }
      const codes = asArray(response["x-error-codes"]);
      if (!codes || codes.length === 0) {
        problems.push(`${label} declares no x-error-codes`);
        continue;
      }
      for (const rawCode of codes) {
        const code = asString(rawCode);
        if (code === undefined || !statusByCode.has(code)) {
          problems.push(`${label} uses unregistered code ${JSON.stringify(rawCode)}`);
          continue;
        }
        if (statusByCode.get(code) !== status) {
          problems.push(`${label} code ${code} registered with status ${statusByCode.get(code)}`);
        }
        usedCodes.add(code);
      }
    }
  }

  for (const entry of registry) {
    if (entry.scope !== "global" && !usedCodes.has(entry.code)) {
      problems.push(`error code ${entry.code} is registered but no error response uses it`);
    }
  }

  return {
    id: "contract.error-responses",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail:
      problems.length === 0
        ? `${inspected} error responses use problem+json and registered codes`
        : problems.join("; "),
  };
}

function authResponsesCheck(root: Record<string, unknown>): ContractCheck {
  const problems: string[] = [];
  for (const ref of PROTECTED_OPERATIONS) {
    const operation = getOperation(root, ref);
    const responses = operation ? asRecord(operation["responses"]) : undefined;
    const unauthorized = asRecord(resolveLocal(root, responses?.["401"]));
    if (!unauthorized) {
      problems.push(`${operationLabel(ref)} has no 401 response`);
      continue;
    }
    const headers = asRecord(unauthorized["headers"]);
    const hasChallenge =
      headers !== undefined && Object.keys(headers).some((key) => key.toLowerCase() === "www-authenticate");
    if (!hasChallenge) {
      problems.push(`${operationLabel(ref)} 401 has no WWW-Authenticate header`);
    }
  }
  return {
    id: "contract.auth-responses",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail:
      problems.length === 0
        ? `${PROTECTED_OPERATIONS.length} protected operations document 401 with a challenge header`
        : problems.join("; "),
  };
}

const REQUIRED_JSON_BODIES: readonly { ref: OperationRef; schema: string }[] = [
  { ref: { method: "post", path: "/auth/login" }, schema: "#/components/schemas/LoginRequest" },
  { ref: { method: "post", path: "/items" }, schema: "#/components/schemas/ItemCreateRequest" },
  { ref: { method: "patch", path: "/items/{id}" }, schema: "#/components/schemas/ItemUpdateRequest" },
];

function requestBodiesCheck(root: Record<string, unknown>): ContractCheck {
  const problems: string[] = [];
  for (const expectation of REQUIRED_JSON_BODIES) {
    const label = operationLabel(expectation.ref);
    const operation = getOperation(root, expectation.ref);
    const body = operation ? asRecord(operation["requestBody"]) : undefined;
    if (!body) {
      problems.push(`${label} has no requestBody`);
      continue;
    }
    if (body["required"] !== true) {
      problems.push(`${label} requestBody must be required`);
    }
    const content = asRecord(body["content"]);
    if (content && !sameSet(Object.keys(content), ["application/json"])) {
      problems.push(`${label} requestBody must accept only application/json`);
    }
    const media = content ? asRecord(content["application/json"]) : undefined;
    if (!media) {
      problems.push(`${label} requestBody must accept application/json`);
      continue;
    }
    const schemaObject = asRecord(media["schema"]);
    const schemaRef = asString(schemaObject?.["$ref"]);
    if (schemaRef !== expectation.schema) {
      problems.push(`${label} requestBody schema is ${JSON.stringify(schemaRef)}, expected ${expectation.schema}`);
    }
    if (schemaObject !== undefined && !sameSet(Object.keys(schemaObject), ["$ref"])) {
      problems.push(`${label} requestBody schema must be exactly $ref ${expectation.schema} with no siblings`);
    }
  }
  return {
    id: "contract.requests",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail:
      problems.length === 0
        ? `${REQUIRED_JSON_BODIES.length} required JSON request bodies verified`
        : problems.join("; "),
  };
}

const REQUIRED_ERROR_STATUSES: readonly { ref: OperationRef; statuses: readonly string[] }[] = [
  { ref: { method: "post", path: "/auth/login" }, statuses: ["400", "401", "415"] },
  { ref: { method: "get", path: "/items" }, statuses: ["400", "401"] },
  { ref: { method: "post", path: "/items" }, statuses: ["400", "401", "415"] },
  { ref: { method: "get", path: "/items/{id}" }, statuses: ["401", "404"] },
  { ref: { method: "patch", path: "/items/{id}" }, statuses: ["400", "401", "404", "415"] },
  { ref: { method: "delete", path: "/items/{id}" }, statuses: ["401", "404"] },
];

function errorCoverageCheck(root: Record<string, unknown>): ContractCheck {
  const problems: string[] = [];
  let requiredCount = 0;
  for (const expectation of REQUIRED_ERROR_STATUSES) {
    const label = operationLabel(expectation.ref);
    const operation = getOperation(root, expectation.ref);
    const responses = operation ? asRecord(operation["responses"]) : undefined;
    for (const status of expectation.statuses) {
      requiredCount += 1;
      if (!responses || responses[status] === undefined) {
        problems.push(`${label} has no ${status} response`);
      }
    }
  }
  return {
    id: "contract.error-coverage",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail:
      problems.length === 0
        ? `${requiredCount} required error responses documented`
        : problems.join("; "),
  };
}

function errorSchemaCheck(root: Record<string, unknown>): ContractCheck {
  const problem = getSchemas(root)["Problem"];
  const allOf = asArray(problem?.["allOf"]);
  const problems: string[] = [];

  const errors = propertyOf(problem, "errors");
  if (errors?.["type"] !== "array" || errors["minItems"] !== 1) {
    problems.push("Problem.errors must be a non-empty array");
  }
  if (asString(asRecord(errors?.["items"])?.["$ref"]) !== "#/components/schemas/FieldError") {
    problems.push("Problem.errors items must reference FieldError");
  }

  let conditional = false;
  if (allOf) {
    for (const rawEntry of allOf) {
      const entry = asRecord(rawEntry);
      const condition = asRecord(entry?.["if"]);
      const conditionCode = asRecord(asRecord(condition?.["properties"])?.["code"]);
      const consequence = asRecord(entry?.["then"]);
      const required = requireList(consequence?.["required"]);
      const conditionExact =
        condition !== undefined &&
        sameSet(Object.keys(condition), ["properties", "required"]) &&
        sameSet(Object.keys(asRecord(condition["properties"]) ?? {}), ["code"]) &&
        conditionCode !== undefined &&
        sameSet(Object.keys(conditionCode), ["const"]);
      const consequenceExact =
        consequence !== undefined && sameSet(Object.keys(consequence), ["required"]);
      if (conditionExact && consequenceExact && conditionCode?.["const"] === "validation_failed" && required.includes("errors")) {
        conditional = true;
        break;
      }
    }
  }
  if (!conditional) {
    problems.push("Problem must require errors[] when code is validation_failed");
  }

  return {
    id: "contract.error-schema",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail:
      problems.length === 0
        ? "Problem.errors is required and well-formed for validation_failed"
        : problems.join("; "),
  };
}

function responseSchemaObject(
  root: Record<string, unknown>,
  ref: OperationRef,
  statusKey: string,
): Record<string, unknown> | undefined {
  const operation = getOperation(root, ref);
  const responses = operation ? asRecord(operation["responses"]) : undefined;
  const response = asRecord(resolveLocal(root, responses?.[statusKey]));
  const content = response ? asRecord(response["content"]) : undefined;
  const media = content ? asRecord(resolveLocal(root, content["application/json"])) : undefined;
  return media ? asRecord(media["schema"]) : undefined;
}

function responseSchemaRef(root: Record<string, unknown>, ref: OperationRef, statusKey: string): string | undefined {
  return asString(responseSchemaObject(root, ref, statusKey)?.["$ref"]);
}

function successShapesCheck(root: Record<string, unknown>): ContractCheck {
  const problems: string[] = [];
  const expected: readonly { ref: OperationRef; status: string; schema: string }[] = [
    { ref: { method: "get", path: "/health" }, status: "200", schema: "#/components/schemas/HealthResponse" },
    { ref: { method: "post", path: "/auth/login" }, status: "200", schema: "#/components/schemas/LoginResponse" },
    { ref: { method: "get", path: "/items" }, status: "200", schema: "#/components/schemas/ItemList" },
    { ref: { method: "post", path: "/items" }, status: "201", schema: "#/components/schemas/Item" },
    { ref: { method: "get", path: "/items/{id}" }, status: "200", schema: "#/components/schemas/Item" },
    { ref: { method: "patch", path: "/items/{id}" }, status: "200", schema: "#/components/schemas/Item" },
  ];
  for (const item of expected) {
    const schemaObject = responseSchemaObject(root, item.ref, item.status);
    const actual = asString(schemaObject?.["$ref"]);
    if (actual !== item.schema) {
      problems.push(`${operationLabel(item.ref)} ${item.status} schema is ${JSON.stringify(actual)}, expected ${item.schema}`);
    }
    if (schemaObject !== undefined && !sameSet(Object.keys(schemaObject), ["$ref"])) {
      problems.push(`${operationLabel(item.ref)} ${item.status} schema must be exactly $ref ${item.schema} with no siblings`);
    }
  }

  const create = getOperation(root, { method: "post", path: "/items" });
  const created = asRecord(resolveLocal(root, asRecord(create?.["responses"])?.["201"]));
  const headers = created ? asRecord(created["headers"]) : undefined;
  if (headers === undefined || !("Location" in headers)) {
    problems.push("POST /items 201 has no Location header");
  } else if (asRecord(resolveLocal(root, headers["Location"])) === undefined) {
    problems.push("POST /items Location header cannot be resolved");
  }

  const deleteOp = getOperation(root, { method: "delete", path: "/items/{id}" });
  const noContent = asRecord(resolveLocal(root, asRecord(deleteOp?.["responses"])?.["204"]));
  if (!noContent) {
    problems.push("DELETE /items/{id} has no 204 response");
  } else {
    const content = asRecord(noContent["content"]);
    if (content !== undefined && Object.keys(content).length > 0) {
      problems.push("DELETE /items/{id} 204 must not declare content");
    }
  }

  return {
    id: "contract.success-shapes",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail: problems.length === 0 ? "success schemas, Location header and 204 no-content verified" : problems.join("; "),
  };
}

function schemaStrictnessCheck(root: Record<string, unknown>): ContractCheck {
  const components = asRecord(root["components"]);
  const schemas = components ? asRecord(components["schemas"]) : undefined;
  if (!schemas) {
    return { id: "contract.schemas", status: "FAIL", detail: "no components.schemas object" };
  }
  const problems: string[] = [];
  for (const [name, rawSchema] of Object.entries(schemas)) {
    const schema = asRecord(rawSchema);
    if (!schema || schema["type"] !== "object") continue;
    if (schema["additionalProperties"] !== false) {
      problems.push(`${name} must set additionalProperties: false`);
    }
  }
  return {
    id: "contract.schemas",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail:
      problems.length === 0
        ? "all object schemas reject unknown properties"
        : problems.join("; "),
  };
}

interface SchemaMap {
  readonly [name: string]: Record<string, unknown> | undefined;
}

function getSchemas(root: Record<string, unknown>): SchemaMap {
  const components = asRecord(root["components"]);
  const raw = components ? asRecord(components["schemas"]) : undefined;
  const result: Record<string, Record<string, unknown> | undefined> = {};
  if (raw) {
    for (const [name, value] of Object.entries(raw)) {
      result[name] = asRecord(value);
    }
  }
  return result;
}

function propertyOf(schema: Record<string, unknown> | undefined, name: string): Record<string, unknown> | undefined {
  const properties = schema ? asRecord(schema["properties"]) : undefined;
  return properties ? asRecord(properties[name]) : undefined;
}

function requireList(value: unknown): readonly string[] {
  const items = asArray(value) ?? [];
  return items.filter((item): item is string => typeof item === "string");
}

function sameSet(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every((value) => actual.includes(value));
}

function checkPriceBounds(problems: string[], label: string, schema: Record<string, unknown> | undefined): void {
  if (schema?.["type"] !== "number" || schema["minimum"] !== 0 || schema["maximum"] !== 1000000 || schema["multipleOf"] !== 0.01) {
    problems.push(`${label} must be a number 0..1000000 with 2 decimals`);
  }
}

function checkQuantityBounds(problems: string[], label: string, schema: Record<string, unknown> | undefined): void {
  if (schema?.["type"] !== "integer" || schema["minimum"] !== 0 || schema["maximum"] !== 10000) {
    problems.push(`${label} must be an integer 0..10000`);
  }
}

function checkNameBounds(problems: string[], label: string, schema: Record<string, unknown> | undefined): void {
  if (schema?.["minLength"] !== 1 || schema["maxLength"] !== 80) {
    problems.push(`${label} must be 1-80 characters`);
  }
}

function boundariesCheck(root: Record<string, unknown>): ContractCheck {
  const schemas = getSchemas(root);
  const problems: string[] = [];

  const create = schemas["ItemCreateRequest"];
  if (create?.["type"] !== "object") problems.push("ItemCreateRequest.type must be object");
  const createRequired = requireList(create?.["required"]);
  if (!sameSet(createRequired, ["name", "price", "quantity"])) {
    problems.push("ItemCreateRequest.required must be exactly name, price, quantity");
  }
  if (create?.["additionalProperties"] !== false) problems.push("ItemCreateRequest must reject unknown properties");
  checkNameBounds(problems, "ItemCreateRequest.name", propertyOf(create, "name"));
  if (propertyOf(create, "name")?.["pattern"] !== "\\S") {
    problems.push("ItemCreateRequest.name must require a non-whitespace character");
  }
  checkPriceBounds(problems, "ItemCreateRequest.price", propertyOf(create, "price"));
  checkQuantityBounds(problems, "ItemCreateRequest.quantity", propertyOf(create, "quantity"));
  const description = propertyOf(create, "description");
  if (description?.["maxLength"] !== 500) problems.push("ItemCreateRequest.description must be at most 500 characters");
  if (description?.["default"] !== "") problems.push('ItemCreateRequest.description must default to ""');
  const createCategory = propertyOf(create, "category");
  if (createCategory?.["$ref"] !== "#/components/schemas/Category") {
    problems.push("ItemCreateRequest.category must reference Category");
  }
  if (createCategory?.["default"] !== "other") {
    problems.push('ItemCreateRequest.category must default to "other"');
  }

  const category = schemas["Category"];
  const categoryEnum = requireList(category?.["enum"]);
  const expectedCategories = ["electronics", "books", "food", "other"];
  if (!sameSet(categoryEnum, expectedCategories)) {
    problems.push("Category enum must be electronics|books|food|other");
  }

  const update = schemas["ItemUpdateRequest"];
  if (update?.["type"] !== "object") problems.push("ItemUpdateRequest.type must be object");
  if (update?.["minProperties"] !== 1) problems.push("ItemUpdateRequest.minProperties must be 1");
  if (update?.["additionalProperties"] !== false) problems.push("ItemUpdateRequest must reject unknown properties");
  if (requireList(update?.["required"]).length > 0) problems.push("ItemUpdateRequest must not require any field");
  checkNameBounds(problems, "ItemUpdateRequest.name", propertyOf(update, "name"));
  if (propertyOf(update, "name")?.["pattern"] !== "\\S") {
    problems.push("ItemUpdateRequest.name must require a non-whitespace character");
  }
  checkPriceBounds(problems, "ItemUpdateRequest.price", propertyOf(update, "price"));
  checkQuantityBounds(problems, "ItemUpdateRequest.quantity", propertyOf(update, "quantity"));
  if (propertyOf(update, "description")?.["maxLength"] !== 500) {
    problems.push("ItemUpdateRequest.description must be at most 500 characters");
  }
  if (propertyOf(update, "category")?.["$ref"] !== "#/components/schemas/Category") {
    problems.push("ItemUpdateRequest.category must reference Category");
  }

  const item = schemas["Item"];
  if (item?.["type"] !== "object") problems.push("Item.type must be object");
  const itemRequired = requireList(item?.["required"]);
  if (
    !sameSet(itemRequired, [
      "id",
      "ownerId",
      "name",
      "description",
      "category",
      "price",
      "quantity",
      "createdAt",
      "updatedAt",
    ])
  ) {
    problems.push("Item.required must be exactly the nine documented fields");
  }
  if (item?.["additionalProperties"] !== false) problems.push("Item must reject unknown properties");
  checkNameBounds(problems, "Item.name", propertyOf(item, "name"));
  checkPriceBounds(problems, "Item.price", propertyOf(item, "price"));
  checkQuantityBounds(problems, "Item.quantity", propertyOf(item, "quantity"));
  if (propertyOf(item, "description")?.["maxLength"] !== 500) {
    problems.push("Item.description must be at most 500 characters");
  }

  const problem = schemas["Problem"];
  const problemRequired = requireList(problem?.["required"]);
  if (!sameSet(problemRequired, ["type", "title", "status", "code", "detail"])) {
    problems.push("Problem.required must be exactly type, title, status, code, detail");
  }
  if (problem?.["additionalProperties"] !== false) problems.push("Problem must reject unknown properties");
  const fieldError = schemas["FieldError"];
  const fieldErrorRequired = requireList(fieldError?.["required"]);
  if (!sameSet(fieldErrorRequired, ["field", "code", "message"])) {
    problems.push("FieldError.required must be exactly field, code, message");
  }

  const components = asRecord(root["components"]);
  const parameters = components ? asRecord(components["parameters"]) : undefined;
  const limit = parameters ? asRecord(parameters["Limit"]) : undefined;
  const limitSchema = limit ? asRecord(limit["schema"]) : undefined;
  if (limitSchema?.["type"] !== "integer" || limitSchema["minimum"] !== 1 || limitSchema["maximum"] !== 100 || limitSchema["default"] !== 20) {
    problems.push("Limit parameter must be integer 1..100 defaulting to 20");
  }
  const offset = parameters ? asRecord(parameters["Offset"]) : undefined;
  const offsetSchema = offset ? asRecord(offset["schema"]) : undefined;
  if (offsetSchema?.["type"] !== "integer" || offsetSchema["minimum"] !== 0 || offsetSchema["default"] !== 0) {
    problems.push("Offset parameter must be integer >= 0 defaulting to 0");
  }
  const itemId = parameters ? asRecord(parameters["ItemId"]) : undefined;
  if (itemId?.["in"] !== "path" || itemId?.["required"] !== true) {
    problems.push("ItemId parameter must be a required path parameter");
  }

  return {
    id: "contract.boundaries",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail: problems.length === 0 ? "validation bounds, defaults and enums match G1" : problems.join("; "),
  };
}

function pathParametersCheck(root: Record<string, unknown>): ContractCheck {
  const pathItem = getPathItem(root, "/items/{id}");
  const parameters = pathItem ? asArray(pathItem["parameters"]) : undefined;
  if (!parameters || parameters.length === 0) {
    return { id: "contract.path-parameters", status: "FAIL", detail: "/items/{id} declares no path parameters" };
  }
  for (const rawParameter of parameters) {
    const parameter = asRecord(resolveLocal(root, rawParameter));
    if (parameter?.["name"] === "id" && parameter["in"] === "path" && parameter["required"] === true) {
      return { id: "contract.path-parameters", status: "PASS", detail: "/items/{id} declares required id path parameter" };
    }
  }
  return { id: "contract.path-parameters", status: "FAIL", detail: "/items/{id} has no required id path parameter" };
}

const UUID_LOCATION_PATTERN =
  "^/items/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

function headersCheck(root: Record<string, unknown>): ContractCheck {
  const components = asRecord(root["components"]);
  const headers = components ? asRecord(components["headers"]) : undefined;
  if (!headers) {
    return { id: "contract.headers", status: "FAIL", detail: "components.headers is missing" };
  }
  const problems: string[] = [];

  const location = asRecord(headers["ItemLocation"]);
  const locationSchema = asRecord(location?.["schema"]);
  if (location?.["required"] !== true) problems.push("ItemLocation header must be required");
  if (locationSchema?.["type"] !== "string" || locationSchema["pattern"] !== UUID_LOCATION_PATTERN) {
    problems.push("ItemLocation header must be a /items/{uuid} string");
  }
  if (!sameSet(Object.keys(locationSchema ?? {}), ["type", "pattern"])) {
    problems.push("ItemLocation header schema must only constrain type and pattern");
  }

  const challenge = asRecord(headers["WWWAuthenticate"]);
  const challengeSchema = asRecord(challenge?.["schema"]);
  if (challenge?.["required"] !== true) problems.push("WWWAuthenticate header must be required");
  if (challengeSchema?.["type"] !== "string" || challengeSchema["const"] !== "Bearer") {
    problems.push('WWWAuthenticate header must be the literal "Bearer"');
  }
  if (!sameSet(Object.keys(challengeSchema ?? {}), ["type", "const"])) {
    problems.push("WWWAuthenticate header schema must only constrain type and const");
  }

  const requireHeaderRef = (
    holderLabel: string,
    headers: Record<string, unknown> | undefined,
    headerName: string,
    expectedRef: string,
  ): void => {
    if (headers === undefined || !(headerName in headers)) {
      problems.push(`${holderLabel} has no ${headerName} header`);
      return;
    }
    const actualRef = asString(asRecord(headers[headerName])?.["$ref"]);
    if (actualRef !== expectedRef) {
      problems.push(`${holderLabel} ${headerName} header must reference ${expectedRef}`);
    }
  };

  const create = getOperation(root, { method: "post", path: "/items" });
  const created = asRecord(resolveLocal(root, asRecord(create?.["responses"])?.["201"]));
  requireHeaderRef(
    "POST /items 201",
    created ? asRecord(created["headers"]) : undefined,
    "Location",
    "#/components/headers/ItemLocation",
  );

  const componentsResponses = components ? asRecord(components["responses"]) : undefined;
  const unauthorized = asRecord(componentsResponses?.["Unauthorized"]);
  requireHeaderRef(
    "components.responses.Unauthorized",
    unauthorized ? asRecord(unauthorized["headers"]) : undefined,
    "WWW-Authenticate",
    "#/components/headers/WWWAuthenticate",
  );

  const login = getOperation(root, { method: "post", path: "/auth/login" });
  const login401 = asRecord(resolveLocal(root, asRecord(login?.["responses"])?.["401"]));
  requireHeaderRef(
    "POST /auth/login 401",
    login401 ? asRecord(login401["headers"]) : undefined,
    "WWW-Authenticate",
    "#/components/headers/WWWAuthenticate",
  );

  for (const ref of PROTECTED_OPERATIONS) {
    const operation = getOperation(root, ref);
    const responses = operation ? asRecord(operation["responses"]) : undefined;
    const response401 = asRecord(resolveLocal(root, responses?.["401"]));
    requireHeaderRef(
      `${operationLabel(ref)} 401`,
      response401 ? asRecord(response401["headers"]) : undefined,
      "WWW-Authenticate",
      "#/components/headers/WWWAuthenticate",
    );
  }

  return {
    id: "contract.headers",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail: problems.length === 0 ? "Location and WWW-Authenticate semantics verified" : problems.join("; "),
  };
}

function examplesCheck(root: Record<string, unknown>): ContractCheck {
  const problems: string[] = [];
  let inspected = 0;

  for (const ref of REQUIRED_OPERATIONS) {
    const operation = getOperation(root, ref);
    const responses = operation ? asRecord(operation["responses"]) : undefined;
    if (!responses) continue;
    for (const [statusKey, rawResponse] of Object.entries(responses)) {
      const status = Number.parseInt(statusKey, 10);
      if (!Number.isInteger(status) || status < 400) continue;
      const response = asRecord(resolveLocal(root, rawResponse));
      const content = response ? asRecord(response["content"]) : undefined;
      const media = content ? asRecord(resolveLocal(root, content["application/problem+json"])) : undefined;
      const examples = media ? asRecord(media["examples"]) : undefined;
      if (!examples) continue;
      for (const [name, rawExample] of Object.entries(examples)) {
        const example = asRecord(rawExample);
        const value = asRecord(resolveLocal(root, example?.["value"]));
        const exampleStatus = asNumber(value?.["status"]);
        inspected += 1;
        if (exampleStatus !== status) {
          problems.push(
            `${operationLabel(ref)} ${statusKey} example ${name} has status ${JSON.stringify(exampleStatus)}`,
          );
        }
      }
    }
  }

  return {
    id: "contract.examples",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail:
      problems.length === 0
        ? `${inspected} problem examples match their response status`
        : problems.join("; "),
  };
}

/** Inline local `$ref`s so a single schema can be compiled as a standalone validator. */
function dereference(root: Record<string, unknown>, value: unknown, depth = 0): unknown {
  if (depth > 12) return value;
  if (Array.isArray(value)) return value.map((entry) => dereference(root, entry, depth + 1));
  const record = asRecord(value);
  if (!record) return value;
  const ref = asString(record["$ref"]);
  if (ref !== undefined) {
    const resolved = asRecord(dereference(root, resolvePointer(root, ref), depth + 1));
    const siblings = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "$ref"));
    const merged = { ...(resolved ?? {}), ...(asRecord(dereference(root, siblings, depth + 1)) ?? {}) };
    return merged;
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    result[key] = dereference(root, entry, depth + 1);
  }
  return result;
}

interface InstanceSample {
  readonly label: string;
  readonly sample: unknown;
  readonly valid: boolean;
}

function runInstances(
  problems: string[],
  root: Record<string, unknown>,
  schemaLabel: string,
  schema: Record<string, unknown> | undefined,
  samples: readonly InstanceSample[],
): void {
  if (!schema) {
    problems.push(`${schemaLabel} schema is missing`);
    return;
  }
  const ajv = new Ajv2020({ strict: false, allErrors: true, multipleOfPrecision: 6 });
  let validate: (sample: unknown) => boolean;
  try {
    validate = ajv.compile(dereference(root, schema) as object) as (sample: unknown) => boolean;
  } catch (error) {
    problems.push(`${schemaLabel} cannot be compiled: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  for (const sample of samples) {
    const actual = validate(sample.sample);
    if (actual !== sample.valid) {
      problems.push(`${sample.label}: expected ${sample.valid ? "valid" : "invalid"} but schema says ${actual ? "valid" : "invalid"}`);
    }
  }
}

const CREATE_SAMPLES: readonly InstanceSample[] = [
  { label: "create minimal valid item", sample: { name: "Widget", price: 0, quantity: 0 }, valid: true },
  { label: "create maximal boundary item", sample: { name: "Widget", price: 1000000, quantity: 10000 }, valid: true },
  { label: "create padded name", sample: { name: " Widget ", price: 19.99, quantity: 1, description: "", category: "other" }, valid: true },
  { label: "create price with 2 decimals", sample: { name: "Widget", price: 0.07, quantity: 5 }, valid: true },
  { label: "create blank name", sample: { name: "", price: 1, quantity: 1 }, valid: false },
  { label: "create whitespace name", sample: { name: "   ", price: 1, quantity: 1 }, valid: false },
  { label: "create 81-char name", sample: { name: "a".repeat(81), price: 1, quantity: 1 }, valid: false },
  { label: "create numeric name", sample: { name: 123, price: 1, quantity: 1 }, valid: false },
  { label: "create negative price", sample: { name: "Widget", price: -1, quantity: 1 }, valid: false },
  { label: "create price over limit", sample: { name: "Widget", price: 1000000.01, quantity: 1 }, valid: false },
  { label: "create 3-decimal price", sample: { name: "Widget", price: 0.001, quantity: 1 }, valid: false },
  { label: "create string price", sample: { name: "Widget", price: "9.99", quantity: 1 }, valid: false },
  { label: "create negative quantity", sample: { name: "Widget", price: 1, quantity: -1 }, valid: false },
  { label: "create fractional quantity", sample: { name: "Widget", price: 1, quantity: 1.5 }, valid: false },
  { label: "create quantity over limit", sample: { name: "Widget", price: 1, quantity: 10001 }, valid: false },
  { label: "create unknown property", sample: { name: "Widget", price: 1, quantity: 1, extra: true }, valid: false },
  { label: "create numeric description", sample: { name: "Widget", price: 1, quantity: 1, description: 42 }, valid: false },
  { label: "create invalid category", sample: { name: "Widget", price: 1, quantity: 1, category: "toys" }, valid: false },
  { label: "create missing quantity", sample: { name: "Widget", price: 1 }, valid: false },
];

const UPDATE_SAMPLES: readonly InstanceSample[] = [
  { label: "update name only", sample: { name: "Widget" }, valid: true },
  { label: "update price zero", sample: { price: 0 }, valid: true },
  { label: "update price maximum", sample: { price: 1000000 }, valid: true },
  { label: "update quantity zero", sample: { quantity: 0 }, valid: true },
  { label: "update description and category", sample: { description: "x", category: "food" }, valid: true },
  { label: "update empty object", sample: {}, valid: false },
  { label: "update null body", sample: null, valid: false },
  { label: "update blank name", sample: { name: "   " }, valid: false },
  { label: "update negative price", sample: { price: -1 }, valid: false },
  { label: "update fractional quantity", sample: { quantity: 1.5 }, valid: false },
  { label: "update numeric description", sample: { description: 42 }, valid: false },
  { label: "update unknown property", sample: { unknown: 1 }, valid: false },
];

const PROBLEM_SAMPLES: readonly InstanceSample[] = [
  {
    label: "problem validation_failed with errors",
    sample: {
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      code: "validation_failed",
      detail: "invalid",
      errors: [{ field: "name", code: "required", message: "name is required" }],
    },
    valid: true,
  },
  {
    label: "problem validation_failed without errors",
    sample: { type: "about:blank", title: "Bad Request", status: 400, code: "validation_failed", detail: "invalid" },
    valid: false,
  },
  {
    label: "problem empty errors",
    sample: { type: "about:blank", title: "Bad Request", status: 400, code: "validation_failed", detail: "invalid", errors: [] },
    valid: false,
  },
  {
    label: "problem item_not_found without errors",
    sample: { type: "about:blank", title: "Not Found", status: 404, code: "item_not_found", detail: "missing" },
    valid: true,
  },
];

const LIMIT_SAMPLES: readonly InstanceSample[] = [
  { label: "limit default", sample: 20, valid: true },
  { label: "limit minimum", sample: 1, valid: true },
  { label: "limit maximum", sample: 100, valid: true },
  { label: "limit zero", sample: 0, valid: false },
  { label: "limit 101", sample: 101, valid: false },
  { label: "limit fractional", sample: 1.5, valid: false },
  { label: "limit string", sample: "20", valid: false },
];

const ITEM_SAMPLE: Record<string, unknown> = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  ownerId: "usr_abc123",
  name: "Widget",
  description: "",
  category: "other",
  price: 19.99,
  quantity: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const ITEM_SAMPLES: readonly InstanceSample[] = [
  { label: "item valid response", sample: ITEM_SAMPLE, valid: true },
  { label: "item negative price", sample: { ...ITEM_SAMPLE, price: -1 }, valid: false },
];

function operationRequestRaw(root: Record<string, unknown>, ref: OperationRef): Record<string, unknown> | undefined {
  const operation = getOperation(root, ref);
  const body = asRecord(resolveLocal(root, operation?.["requestBody"]));
  const content = body ? asRecord(body["content"]) : undefined;
  const media = content ? asRecord(content["application/json"]) : undefined;
  return media ? asRecord(media["schema"]) : undefined;
}

function operationResponseRaw(
  root: Record<string, unknown>,
  ref: OperationRef,
  statusKey: string,
): Record<string, unknown> | undefined {
  const operation = getOperation(root, ref);
  const responses = operation ? asRecord(operation["responses"]) : undefined;
  const response = asRecord(resolveLocal(root, responses?.[statusKey]));
  const content = response ? asRecord(response["content"]) : undefined;
  const media = content ? asRecord(resolveLocal(root, content["application/json"])) : undefined;
  return media ? asRecord(media["schema"]) : undefined;
}

function instancesCheck(root: Record<string, unknown>): ContractCheck {
  const schemas = getSchemas(root);
  const components = asRecord(root["components"]);
  const parameters = components ? asRecord(components["parameters"]) : undefined;
  const limitSchema = parameters ? asRecord(asRecord(parameters["Limit"])?.["schema"]) : undefined;

  const problems: string[] = [];
  runInstances(problems, root, "ItemCreateRequest", schemas["ItemCreateRequest"], CREATE_SAMPLES);
  runInstances(problems, root, "ItemUpdateRequest", schemas["ItemUpdateRequest"], UPDATE_SAMPLES);
  runInstances(problems, root, "Problem", schemas["Problem"], PROBLEM_SAMPLES);
  runInstances(problems, root, "Limit", limitSchema, LIMIT_SAMPLES);
  const createRequestOp = operationRequestRaw(root, { method: "post", path: "/items" });
  if (!createRequestOp) {
    problems.push("POST /items operation request schema is missing");
  } else {
    runInstances(problems, root, "POST /items request", createRequestOp, CREATE_SAMPLES);
  }
  const createResponseOp = operationResponseRaw(root, { method: "post", path: "/items" }, "201");
  if (!createResponseOp) {
    problems.push("POST /items 201 operation response schema is missing");
  } else {
    runInstances(problems, root, "POST /items 201 response", createResponseOp, ITEM_SAMPLES);
  }

  const total =
    CREATE_SAMPLES.length +
    UPDATE_SAMPLES.length +
    PROBLEM_SAMPLES.length +
    LIMIT_SAMPLES.length +
    CREATE_SAMPLES.length +
    ITEM_SAMPLES.length;
  return {
    id: "contract.instances",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail:
      problems.length === 0
        ? `${total} effective-schema instances behave as declared`
        : problems.join("; "),
  };
}

function summarize(checks: readonly ContractCheck[]): ContractVerdict {
  return { ok: checks.every((check) => check.status === "PASS"), checks };
}

export async function validateContractDocument(document: unknown): Promise<ContractVerdict> {
  // Cheap pre-checks run before the structural gate so a version downgrade is
  // attributed to the version rule even when the meta-schema also rejects it.
  const earlyVersion = isRecord(document) ? versionCheck(document) : undefined;
  const structure = await structureCheck(document);
  if (structure.status === "FAIL") {
    return summarize(earlyVersion ? [earlyVersion, structure] : [structure]);
  }
  const root = document as Record<string, unknown>;
  const checks: readonly ContractCheck[] = [
    structure,
    earlyVersion ?? versionCheck(root),
    serverCheck(root),
    operationsCheck(root),
    securitySchemeCheck(root),
    securityCheck(root),
    requirementRegistryCheck(root),
    requirementLinksCheck(root),
    errorRegistryCheck(root),
    errorResponsesCheck(root),
    authResponsesCheck(root),
    errorCoverageCheck(root),
    errorSchemaCheck(root),
    requestBodiesCheck(root),
    successShapesCheck(root),
    headersCheck(root),
    examplesCheck(root),
    instancesCheck(root),
    schemaStrictnessCheck(root),
    boundariesCheck(root),
    pathParametersCheck(root),
  ];
  return summarize(checks);
}
