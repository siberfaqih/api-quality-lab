#!/usr/bin/env node
/**
 * contract:validate — Gate G1 check for `contract/openapi.yaml`.
 *
 * Parses the YAML contract, validates it as OpenAPI 3.1 and enforces the
 * project-specific rules in `harness/contract-rules.ts`. Any parse, structure or
 * rule failure exits 1; there is no partial pass.
 *
 * Usage:
 *   node harness/contract-check.ts [--json] [--file=contract/openapi.yaml]
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { validateContractDocument, type ContractCheck } from "./contract-rules.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_FILE = "contract/openapi.yaml";

interface Options {
  readonly json: boolean;
  readonly file: string;
}

function parseArgs(argv: readonly string[]): Options {
  let json = false;
  let file = DEFAULT_FILE;

  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
    } else if (arg.startsWith("--file=")) {
      const value = arg.slice("--file=".length).trim();
      if (value.length === 0) {
        console.error("Invalid --file value: empty path");
        process.exit(2);
      }
      file = value;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node harness/contract-check.ts [--json] [--file=contract/openapi.yaml]");
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }

  return { json, file };
}

function printHuman(file: string, version: string | undefined, checks: readonly ContractCheck[]): void {
  console.log("API Quality Lab — contract:validate");
  console.log(`repo      ${REPO_ROOT}`);
  console.log(`file      ${file}`);
  console.log(`openapi   ${version ?? "unknown"}`);
  console.log("");

  const width = Math.max(...checks.map((check) => check.id.length));
  for (const check of checks) {
    console.log(`[${check.status}] ${check.id.padEnd(width)}  ${check.detail}`);
  }

  const passed = checks.filter((check) => check.status === "PASS").length;
  const failed = checks.length - passed;
  console.log("");
  console.log(`Summary: ${passed} pass, ${failed} fail`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const absolutePath = resolve(REPO_ROOT, options.file);

  const fail = (detail: string): never => {
    const checks: readonly ContractCheck[] = [{ id: "contract.file", status: "FAIL", detail }];
    if (options.json) {
      console.log(JSON.stringify({ generatedAt: new Date().toISOString(), file: absolutePath, checks, ok: false }, null, 2));
    } else {
      printHuman(options.file, undefined, checks);
    }
    process.exit(1);
  };

  if (!existsSync(absolutePath)) {
    fail(`file not found: ${absolutePath}`);
  }

  let document: unknown;
  try {
    document = parse(readFileSync(absolutePath, "utf8")) as unknown;
  } catch (error) {
    fail(`YAML parse error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const version =
    typeof document === "object" && document !== null && !Array.isArray(document)
      ? (document as Record<string, unknown>)["openapi"]
      : undefined;

  const verdict = await validateContractDocument(document);
  const passed = verdict.checks.filter((check) => check.status === "PASS").length;
  const failed = verdict.checks.length - passed;

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          file: absolutePath,
          version: typeof version === "string" ? version : undefined,
          checks: verdict.checks,
          summary: { pass: passed, fail: failed },
          ok: verdict.ok,
        },
        null,
        2,
      ),
    );
  } else {
    printHuman(options.file, typeof version === "string" ? version : undefined, verdict.checks);
  }

  process.exitCode = verdict.ok ? 0 : 1;
}

await main();
