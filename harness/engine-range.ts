/**
 * Node engine-range validation for harness:doctor.
 *
 * A range only passes when every version it allows also satisfies the project
 * minimum. This rejects malformed strings and disjunctive ranges that quietly
 * re-admit unsupported Node versions (e.g. ">=24.0.0 || >=18.0.0").
 */
import semver from "semver";

export const REQUIRED_NODE_RANGE = ">=24.0.0";

export interface EngineRangeVerdict {
  readonly ok: boolean;
  readonly detail: string;
}

export function validateNodeEngines(range: unknown): EngineRangeVerdict {
  if (typeof range !== "string" || range.trim().length === 0) {
    return { ok: false, detail: "engines.node must be a non-empty semver range string" };
  }

  const trimmed = range.trim();
  const normalized = semver.validRange(trimmed);
  if (normalized === null) {
    return { ok: false, detail: `engines.node is not a valid semver range: ${JSON.stringify(trimmed)}` };
  }

  if (!semver.subset(normalized, REQUIRED_NODE_RANGE)) {
    return {
      ok: false,
      detail: `engines.node ${JSON.stringify(trimmed)} permits versions below ${REQUIRED_NODE_RANGE}`,
    };
  }

  return { ok: true, detail: `engines.node = ${trimmed} guarantees ${REQUIRED_NODE_RANGE}` };
}
