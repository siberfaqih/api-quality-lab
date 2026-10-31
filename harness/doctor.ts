#!/usr/bin/env node
/**
 * harness:doctor — preflight inspection for Gate G0.
 *
 * Verifies the local toolchain and repository scaffold without touching the
 * network or mutating project files. Exits 0 when every mandatory check passes
 * (warnings allowed) and 1 when at least one check fails.
 *
 * Usage:
 *   node harness/doctor.ts [--json] [--min-node-major=24]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateNodeEngines } from "./engine-range.ts";

type Status = "PASS" | "WARN" | "FAIL";

interface Check {
  readonly id: string;
  readonly status: Status;
  readonly detail: string;
}

interface Summary {
  readonly pass: number;
  readonly warn: number;
  readonly fail: number;
}

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const REQUIRED_FILES: readonly string[] = [
  "AGENTS.md",
  "PLAN.md",
  "TASKS.md",
  "PROGRESS.md",
  "EVALUATION.md",
  "DECISIONS.md",
  "README.md",
  ".gitignore",
  "package.json",
  "tsconfig.json",
  "harness/doctor.ts",
];

const REQUIRED_DIRS: readonly string[] = [
  ".github/workflows",
  "contract",
  "docs",
  "evidence",
  "harness",
  "qa",
  "reviews",
  "sut",
];

/** Ignore rules whose absence would leak dependencies, secrets or local reports. */
const REQUIRED_GITIGNORE_PATTERNS: readonly string[] = [
  "node_modules/",
  "dist/",
  "coverage/",
  ".env",
  "playwright-report/",
  "test-results/",
  "evidence/generated/",
];

const DEFAULT_MIN_NODE_MAJOR = 24;

interface Options {
  readonly json: boolean;
  readonly minNodeMajor: number;
}

function parseArgs(argv: readonly string[]): Options {
  let json = false;
  let minNodeMajor = DEFAULT_MIN_NODE_MAJOR;

  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
    } else if (arg.startsWith("--min-node-major=")) {
      const raw = arg.slice("--min-node-major=".length);
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        console.error(`Invalid --min-node-major value: ${raw}`);
        process.exit(2);
      }
      minNodeMajor = parsed;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node harness/doctor.ts [--json] [--min-node-major=24]");
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }

  return { json, minNodeMajor };
}

function runCommand(command: string, args: readonly string[]): { ok: boolean; output: string } {
  try {
    const output = execFileSync(command, [...args], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { ok: true, output };
  } catch (error) {
    return { ok: false, output: error instanceof Error ? error.message : String(error) };
  }
}

function readText(relativePath: string): string | undefined {
  const absolute = join(REPO_ROOT, relativePath);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : undefined;
}

function parseJson(relativePath: string): unknown {
  const text = readText(relativePath);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nodeCheck(minNodeMajor: number): Check {
  const version = process.versions.node;
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);
  const satisfied = Number.isInteger(major) && major >= minNodeMajor;
  return {
    id: "runtime.node",
    status: satisfied ? "PASS" : "FAIL",
    detail: satisfied
      ? `Node v${version} satisfies >= ${minNodeMajor}`
      : `Node v${version} does not satisfy >= ${minNodeMajor}`,
  };
}

function toolCheck(id: string, command: string, args: readonly string[]): Check {
  const result = runCommand(command, args);
  return {
    id,
    status: result.ok ? "PASS" : "FAIL",
    detail: result.ok ? result.output.split("\n")[0] ?? result.output : `not runnable: ${result.output}`,
  };
}

function gitWorktreeCheck(): Check {
  const result = runCommand("git", ["rev-parse", "--is-inside-work-tree"]);
  const inside = result.ok && result.output === "true";
  return {
    id: "repo.git-worktree",
    status: inside ? "PASS" : "FAIL",
    detail: inside ? `inside work tree (${REPO_ROOT})` : "not inside a git work tree",
  };
}

function requiredFilesCheck(): Check {
  const missing = REQUIRED_FILES.filter((file) => !existsSync(join(REPO_ROOT, file)));
  return {
    id: "repo.required-files",
    status: missing.length === 0 ? "PASS" : "FAIL",
    detail:
      missing.length === 0
        ? `${REQUIRED_FILES.length} scaffold files present`
        : `missing: ${missing.join(", ")}`,
  };
}

function requiredDirsCheck(): Check {
  const missing = REQUIRED_DIRS.filter((dir) => !existsSync(join(REPO_ROOT, dir)));
  return {
    id: "repo.required-dirs",
    status: missing.length === 0 ? "PASS" : "FAIL",
    detail:
      missing.length === 0 ? `${REQUIRED_DIRS.length} scaffold dirs present` : `missing: ${missing.join(", ")}`,
  };
}

function gitignoreCheck(): Check {
  const content = readText(".gitignore");
  if (content === undefined) {
    return { id: "repo.gitignore", status: "FAIL", detail: ".gitignore is missing" };
  }
  const entries = content.split("\n").map((line) => line.trim());
  const missing = REQUIRED_GITIGNORE_PATTERNS.filter((pattern) => !entries.includes(pattern));
  return {
    id: "repo.gitignore",
    status: missing.length === 0 ? "PASS" : "FAIL",
    detail:
      missing.length === 0
        ? `${REQUIRED_GITIGNORE_PATTERNS.length} required ignore rules present`
        : `missing rules: ${missing.join(", ")}`,
  };
}

function trackedSecretsCheck(): Check {
  const result = runCommand("git", ["ls-files"]);
  if (!result.ok) {
    return { id: "repo.no-tracked-env", status: "FAIL", detail: `git ls-files failed: ${result.output}` };
  }
  const tracked = result.output.split("\n").filter((line) => line.length > 0);
  const offenders = tracked.filter((path) => {
    const name = basename(path);
    return name === ".env" || (name.startsWith(".env.") && name !== ".env.example");
  });
  return {
    id: "repo.no-tracked-env",
    status: offenders.length === 0 ? "PASS" : "FAIL",
    detail:
      offenders.length === 0
        ? `${tracked.length} tracked files, no .env secrets`
        : `tracked env files: ${offenders.join(", ")}`,
  };
}

function packageEnginesCheck(): Check {
  const pkg = parseJson("package.json");
  if (!isRecord(pkg)) {
    return { id: "config.package-engines", status: "FAIL", detail: "package.json is missing or invalid JSON" };
  }
  const engines = pkg["engines"];
  const nodeRange = isRecord(engines) ? engines["node"] : undefined;
  const verdict = validateNodeEngines(nodeRange);
  return {
    id: "config.package-engines",
    status: verdict.ok ? "PASS" : "FAIL",
    detail: verdict.detail,
  };
}

function tsconfigCheck(): Check {
  const config = parseJson("tsconfig.json");
  if (!isRecord(config)) {
    return { id: "config.tsconfig-strict", status: "FAIL", detail: "tsconfig.json is missing or invalid JSON" };
  }
  const options = config["compilerOptions"];
  if (!isRecord(options)) {
    return { id: "config.tsconfig-strict", status: "FAIL", detail: "tsconfig.json has no compilerOptions object" };
  }
  const problems: string[] = [];
  if (options["strict"] !== true) problems.push("strict must be true");
  if (options["noEmit"] !== true) problems.push("noEmit must be true");
  if (options["module"] !== "nodenext") problems.push("module must be nodenext");
  if (problems.length > 0) {
    return { id: "config.tsconfig-strict", status: "FAIL", detail: problems.join("; ") };
  }
  return {
    id: "config.tsconfig-strict",
    status: "PASS",
    detail: "strict=true, noEmit=true, module=nodenext",
  };
}

function typescriptDependencyCheck(): Check {
  const installed = existsSync(join(REPO_ROOT, "node_modules/typescript/package.json"));
  return {
    id: "deps.typescript",
    status: installed ? "PASS" : "WARN",
    detail: installed ? "typescript installed locally" : "typescript not installed; run `npm install` before `npm run typecheck`",
  };
}

function summarize(checks: readonly Check[]): Summary {
  return {
    pass: checks.filter((check) => check.status === "PASS").length,
    warn: checks.filter((check) => check.status === "WARN").length,
    fail: checks.filter((check) => check.status === "FAIL").length,
  };
}

function printHuman(options: Options, checks: readonly Check[], summary: Summary): void {
  const gitVersion = runCommand("git", ["--version"]);
  const npmVersion = runCommand("npm", ["--version"]);

  console.log("API Quality Lab — harness:doctor");
  console.log(`repo      ${REPO_ROOT}`);
  console.log(`platform  ${process.platform} ${process.arch}`);
  console.log(`node      v${process.versions.node}`);
  console.log(`npm       ${npmVersion.ok ? npmVersion.output : "not found"}`);
  console.log(`git       ${gitVersion.ok ? gitVersion.output : "not found"}`);
  console.log(`min node  ${options.minNodeMajor}`);
  console.log("");

  const width = Math.max(...checks.map((check) => check.id.length));
  for (const check of checks) {
    console.log(`[${check.status}] ${check.id.padEnd(width)}  ${check.detail}`);
  }

  console.log("");
  console.log(`Summary: ${summary.pass} pass, ${summary.warn} warn, ${summary.fail} fail`);
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  const checks: readonly Check[] = [
    nodeCheck(options.minNodeMajor),
    toolCheck("runtime.npm", "npm", ["--version"]),
    toolCheck("runtime.git", "git", ["--version"]),
    gitWorktreeCheck(),
    requiredFilesCheck(),
    requiredDirsCheck(),
    gitignoreCheck(),
    trackedSecretsCheck(),
    packageEnginesCheck(),
    tsconfigCheck(),
    typescriptDependencyCheck(),
  ];

  const summary = summarize(checks);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          repoRoot: REPO_ROOT,
          environment: {
            node: process.versions.node,
            platform: process.platform,
            arch: process.arch,
          },
          options,
          checks,
          summary,
        },
        null,
        2,
      ),
    );
  } else {
    printHuman(options, checks, summary);
  }

  process.exitCode = summary.fail > 0 ? 1 : 0;
}

main();
