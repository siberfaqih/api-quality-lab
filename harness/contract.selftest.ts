#!/usr/bin/env node
/**
 * contract:selftest — executable negative controls for `contract:validate`.
 *
 * The baseline must pass, and every mutated copy must fail **for the rule it
 * targets**: each reject case declares the check id that must report FAIL, so an
 * unrelated failure cannot make a mutation test look successful.
 *
 * Usage: node harness/contract.selftest.ts
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { validateContractDocument } from "./contract-rules.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CONTRACT_PATH = join(REPO_ROOT, "contract/openapi.yaml");

interface Case {
  readonly label: string;
  readonly expectOk: boolean;
  readonly expectFailCheck?: string;
  readonly expectFailDetail?: string;
  readonly mutate?: (document: any) => void;
  readonly input?: () => unknown;
}

const BASE: unknown = parse(readFileSync(CONTRACT_PATH, "utf8")) as unknown;

const CASES: readonly Case[] = [
  { label: "baseline contract", expectOk: true },
  { label: "non-mapping document", expectOk: false, expectFailCheck: "contract.structure", input: () => null },
  {
    label: "OpenAPI 3.0 downgrade",
    expectOk: false,
    expectFailCheck: "contract.version",
    mutate: (document) => {
      document.openapi = "3.0.3";
    },
  },
  {
    label: "root security removed",
    expectOk: false,
    expectFailCheck: "contract.security",
    mutate: (document) => {
      document.security = [];
    },
  },
  {
    label: "protected endpoint made public",
    expectOk: false,
    expectFailCheck: "contract.security",
    mutate: (document) => {
      document.paths["/items"].get.security = [];
    },
  },
  {
    label: "login endpoint made protected",
    expectOk: false,
    expectFailCheck: "contract.security",
    mutate: (document) => {
      document.paths["/auth/login"].post.security = [{ bearerAuth: [] }];
    },
  },
  {
    label: "missing 401 on delete",
    expectOk: false,
    expectFailCheck: "contract.auth-responses",
    mutate: (document) => {
      delete document.paths["/items/{id}"].delete.responses["401"];
    },
  },
  {
    label: "401 without challenge header",
    expectOk: false,
    expectFailCheck: "contract.auth-responses",
    mutate: (document) => {
      delete document.components.responses.Unauthorized.headers;
    },
  },
  {
    label: "operation without requirement ids",
    expectOk: false,
    expectFailCheck: "contract.requirement-links",
    mutate: (document) => {
      delete document.paths["/items"].post["x-requirement-ids"];
    },
  },
  {
    label: "unknown requirement reference",
    expectOk: false,
    expectFailCheck: "contract.requirement-links",
    mutate: (document) => {
      document.paths["/items"].post["x-requirement-ids"].push("REQ-NOPE-99");
    },
  },
  {
    label: "duplicate requirement id",
    expectOk: false,
    expectFailCheck: "contract.requirement-registry",
    mutate: (document) => {
      const first = document["x-requirements"][0];
      document["x-requirements"].push({
        id: first.id,
        area: "items",
        scope: "operation",
        statement: "Duplicate identifier probe that should never validate.",
        appliesTo: ["POST /items"],
      });
    },
  },
  {
    label: "deleted requirement entry",
    expectOk: false,
    expectFailCheck: "contract.requirement-links",
    mutate: (document) => {
      document["x-requirements"] = document["x-requirements"].filter(
        (entry: { id: string }) => entry.id !== "REQ-ISO-01",
      );
    },
  },
  {
    label: "requirement applicability drift",
    expectOk: false,
    expectFailCheck: "contract.requirement-links",
    mutate: (document) => {
      const operation = document.paths["/items"].post;
      operation["x-requirement-ids"] = operation["x-requirement-ids"].filter(
        (id: string) => id !== "REQ-AUTH-04",
      );
    },
  },
  {
    label: "external server url",
    expectOk: false,
    expectFailCheck: "contract.servers",
    mutate: (document) => {
      document.servers = [{ url: "https://api.example.com" }];
    },
  },
  {
    label: "operation-level server override",
    expectOk: false,
    expectFailCheck: "contract.servers",
    mutate: (document) => {
      document.paths["/items"].get.servers = [{ url: "https://example.invalid" }];
    },
  },
  {
    label: "path-level server override",
    expectOk: false,
    expectFailCheck: "contract.servers",
    mutate: (document) => {
      document.paths["/items"].servers = [{ url: "https://example.invalid" }];
    },
  },
  {
    label: "extra PUT operation",
    expectOk: false,
    expectFailCheck: "contract.operations",
    mutate: (document) => {
      document.paths["/items"].put = {
        security: [],
        responses: { "200": { description: "unexpected operation" } },
      };
    },
  },
  {
    label: "permissive Item schema",
    expectOk: false,
    expectFailCheck: "contract.schemas",
    mutate: (document) => {
      document.components.schemas.Item.additionalProperties = true;
    },
  },
  {
    label: "permissive Problem schema",
    expectOk: false,
    expectFailCheck: "contract.schemas",
    mutate: (document) => {
      document.components.schemas.Problem.additionalProperties = true;
    },
  },
  {
    label: "removed request body requirement",
    expectOk: false,
    expectFailCheck: "contract.requests",
    mutate: (document) => {
      document.paths["/items"].post.requestBody.required = false;
    },
  },
  {
    label: "removed name whitespace pattern",
    expectOk: false,
    expectFailCheck: "contract.boundaries",
    mutate: (document) => {
      delete document.components.schemas.ItemCreateRequest.properties.name.pattern;
    },
  },
  {
    label: "weakened name maximum",
    expectOk: false,
    expectFailCheck: "contract.boundaries",
    mutate: (document) => {
      document.components.schemas.ItemCreateRequest.properties.name.maxLength = 101;
    },
  },
  {
    label: "removed price upper bound",
    expectOk: false,
    expectFailCheck: "contract.boundaries",
    mutate: (document) => {
      delete document.components.schemas.ItemCreateRequest.properties.price.maximum;
    },
  },
  {
    label: "negative PATCH price bound",
    expectOk: false,
    expectFailCheck: "contract.boundaries",
    mutate: (document) => {
      document.components.schemas.ItemUpdateRequest.properties.price.minimum = -100;
    },
  },
  {
    label: "weakened item quantity",
    expectOk: false,
    expectFailCheck: "contract.boundaries",
    mutate: (document) => {
      document.components.schemas.Item.properties.quantity.maximum = 100000;
    },
  },
  {
    label: "weakened limit maximum",
    expectOk: false,
    expectFailCheck: "contract.boundaries",
    mutate: (document) => {
      delete document.components.parameters.Limit.schema.maximum;
    },
  },
  {
    label: "removed Location header",
    expectOk: false,
    expectFailCheck: "contract.success-shapes",
    mutate: (document) => {
      delete document.paths["/items"].post.responses["201"].headers;
    },
  },
  {
    label: "removed login token schema",
    expectOk: false,
    expectFailCheck: "contract.success-shapes",
    mutate: (document) => {
      delete document.paths["/auth/login"].post.responses["200"].content;
    },
  },
  {
    label: "204 with a body",
    expectOk: false,
    expectFailCheck: "contract.success-shapes",
    mutate: (document) => {
      document.paths["/items/{id}"].delete.responses["204"].content = {
        "application/json": { schema: { type: "object" } },
      };
    },
  },
  {
    label: "removed 404 coverage",
    expectOk: false,
    expectFailCheck: "contract.error-coverage",
    mutate: (document) => {
      delete document.paths["/items/{id}"].get.responses["404"];
    },
  },
  {
    label: "removed 415 coverage",
    expectOk: false,
    expectFailCheck: "contract.error-coverage",
    mutate: (document) => {
      delete document.paths["/items/{id}"].patch.responses["415"];
    },
  },
  {
    label: "removed Problem conditional",
    expectOk: false,
    expectFailCheck: "contract.error-schema",
    mutate: (document) => {
      delete document.components.schemas.Problem.allOf;
    },
  },
  {
    label: "404 answered as JSON",
    expectOk: false,
    expectFailCheck: "contract.error-responses",
    mutate: (document) => {
      document.components.responses.ItemNotFound.content = {
        "application/json": { schema: { $ref: "#/components/schemas/Problem" } },
      };
    },
  },
  {
    label: "error code status mismatch",
    expectOk: false,
    expectFailCheck: "contract.error-responses",
    mutate: (document) => {
      document["x-error-codes"].find((entry: { code: string }) => entry.code === "item_not_found").status = 400;
    },
  },
  {
    label: "orphan error code",
    expectOk: false,
    expectFailCheck: "contract.error-responses",
    mutate: (document) => {
      document["x-error-codes"].push({
        code: "teapot_conflict",
        status: 400,
        description: "Registered code that no response references.",
      });
    },
  },
  {
    label: "malformed global appliesTo",
    expectOk: false,
    expectFailCheck: "contract.requirement-registry",
    expectFailDetail: "must declare appliesTo as an array",
    mutate: (document) => {
      document["x-requirements"].find((entry: { id: string }) => entry.id === "REQ-ERR-01").appliesTo =
        "not-an-array";
    },
  },
  {
    label: "nullable PATCH body type",
    expectOk: false,
    expectFailCheck: "contract.instances",
    expectFailDetail: "update null body",
    mutate: (document) => {
      document.components.schemas.ItemUpdateRequest.type = ["object", "null"];
    },
  },
  {
    label: "numeric name accepted",
    expectOk: false,
    expectFailCheck: "contract.instances",
    expectFailDetail: "create numeric name",
    mutate: (document) => {
      document.components.schemas.ItemCreateRequest.properties.name.type = ["string", "number"];
    },
  },
  {
    label: "numeric description accepted",
    expectOk: false,
    expectFailCheck: "contract.instances",
    expectFailDetail: "create numeric description",
    mutate: (document) => {
      document.components.schemas.ItemCreateRequest.properties.description.type = ["string", "number"];
    },
  },
  {
    label: "price exclusive minimum",
    expectOk: false,
    expectFailCheck: "contract.instances",
    expectFailDetail: "create minimal valid item",
    mutate: (document) => {
      document.components.schemas.ItemCreateRequest.properties.price.exclusiveMinimum = 0;
    },
  },
  {
    label: "price conflicting maximum",
    expectOk: false,
    expectFailCheck: "contract.instances",
    expectFailDetail: "create maximal boundary item",
    mutate: (document) => {
      document.components.schemas.ItemCreateRequest.properties.price.allOf = [{ maximum: 999999 }];
    },
  },
  {
    label: "Location header optional",
    expectOk: false,
    expectFailCheck: "contract.headers",
    expectFailDetail: "ItemLocation header must be required",
    mutate: (document) => {
      document.components.headers.ItemLocation.required = false;
    },
  },
  {
    label: "Location fixed to /health",
    expectOk: false,
    expectFailCheck: "contract.headers",
    expectFailDetail: "ItemLocation header schema must only constrain",
    mutate: (document) => {
      document.components.headers.ItemLocation.schema = { type: "string", const: "/health" };
    },
  },
  {
    label: "Basic auth challenge",
    expectOk: false,
    expectFailCheck: "contract.headers",
    expectFailDetail: "WWWAuthenticate header must be the literal",
    mutate: (document) => {
      document.components.headers.WWWAuthenticate.schema.const = "Basic";
    },
  },
  {
    label: "extra text/plain request body",
    expectOk: false,
    expectFailCheck: "contract.requests",
    expectFailDetail: "must accept only application/json",
    mutate: (document) => {
      document.paths["/items"].post.requestBody.content["text/plain"] = { schema: { type: "string" } };
    },
  },
  {
    label: "Problem errors minItems zero",
    expectOk: false,
    expectFailCheck: "contract.error-schema",
    expectFailDetail: "Problem.errors must be a non-empty array",
    mutate: (document) => {
      document.components.schemas.Problem.properties.errors.minItems = 0;
    },
  },
  {
    label: "impossible Problem conditional",
    expectOk: false,
    expectFailCheck: "contract.error-schema",
    expectFailDetail: "Problem must require errors[]",
    mutate: (document) => {
      document.components.schemas.Problem.allOf[0].if.allOf = [
        { properties: { code: { const: "other" } } },
      ];
    },
  },
  {
    label: "example status mismatch",
    expectOk: false,
    expectFailCheck: "contract.examples",
    expectFailDetail: "example validation_failed has status 401",
    mutate: (document) => {
      document.paths["/auth/login"].post.responses["400"].content["application/problem+json"].examples.validation_failed.value.status = 401;
    },
  },
  {
    label: "inline Location replacement on POST 201",
    expectOk: false,
    expectFailCheck: "contract.headers",
    expectFailDetail: "POST /items 201 Location header must reference",
    mutate: (document) => {
      document.paths["/items"].post.responses["201"].headers.Location = {
        description: "Wrong",
        required: false,
        schema: { type: "string", const: "/health" },
      };
    },
  },
  {
    label: "Unauthorized challenge replaced",
    expectOk: false,
    expectFailCheck: "contract.headers",
    expectFailDetail: "components.responses.Unauthorized WWW-Authenticate header must reference",
    mutate: (document) => {
      document.components.responses.Unauthorized.headers["WWW-Authenticate"] = {
        description: "Wrong",
        schema: { type: "string", const: "Basic" },
      };
    },
  },
  {
    label: "login 401 challenge removed",
    expectOk: false,
    expectFailCheck: "contract.headers",
    expectFailDetail: "POST /auth/login 401 has no WWW-Authenticate header",
    mutate: (document) => {
      delete document.paths["/auth/login"].post.responses["401"].headers;
    },
  },
  {
    label: "POST request $ref sibling not:{}",
    expectOk: false,
    expectFailCheck: "contract.requests",
    expectFailDetail: "with no siblings",
    mutate: (document) => {
      document.paths["/items"].post.requestBody.content["application/json"].schema = {
        $ref: "#/components/schemas/ItemCreateRequest",
        not: {},
      };
    },
  },
  {
    label: "POST 201 response $ref sibling not:{}",
    expectOk: false,
    expectFailCheck: "contract.success-shapes",
    expectFailDetail: "with no siblings",
    mutate: (document) => {
      document.paths["/items"].post.responses["201"].content["application/json"].schema = {
        $ref: "#/components/schemas/Item",
        not: {},
      };
    },
  },
  {
    label: "PATCH price exclusive maximum",
    expectOk: false,
    expectFailCheck: "contract.instances",
    expectFailDetail: "update price maximum",
    mutate: (document) => {
      document.components.schemas.ItemUpdateRequest.properties.price.exclusiveMaximum = 1000000;
    },
  },
  {
    label: "PATCH numeric description accepted",
    expectOk: false,
    expectFailCheck: "contract.instances",
    expectFailDetail: "update numeric description",
    mutate: (document) => {
      document.components.schemas.ItemUpdateRequest.properties.description.type = ["string", "number"];
    },
  },
  {
    label: "empty requirement registry",
    expectOk: false,
    expectFailCheck: "contract.requirement-registry",
    mutate: (document) => {
      document["x-requirements"] = [];
    },
  },
];

let failures = 0;

for (const testCase of CASES) {
  const document = testCase.input ? testCase.input() : structuredClone(BASE);
  if (testCase.mutate) testCase.mutate(document);

  const verdict = await validateContractDocument(document);
  const matchedCheck =
    testCase.expectFailCheck !== undefined &&
    verdict.checks.some(
      (check) =>
        check.id === testCase.expectFailCheck &&
        check.status === "FAIL" &&
        (testCase.expectFailDetail === undefined || check.detail.includes(testCase.expectFailDetail)),
    );
  const passed = testCase.expectOk ? verdict.ok : !verdict.ok && matchedCheck;
  if (!passed) failures += 1;

  const expected = testCase.expectOk
    ? "accept"
    : `reject at ${testCase.expectFailCheck ?? "(unspecified)"}${
        testCase.expectFailDetail ? ` containing "${testCase.expectFailDetail}"` : ""
      }`;
  const firstFailure = verdict.checks.find((check) => check.status === "FAIL");
  const observed = testCase.expectOk
    ? `${verdict.checks.length} checks, ok=${verdict.ok}`
    : firstFailure
      ? `${firstFailure.id}: ${firstFailure.detail.slice(0, 110)}`
      : "accepted (no failing check)";
  console.log(`[${passed ? "PASS" : "FAIL"}] ${testCase.label.padEnd(38)} expected ${expected} — ${observed}`);
}

console.log("");
console.log(`Summary: ${CASES.length - failures} pass, ${failures} fail`);
process.exitCode = failures > 0 ? 1 : 0;
