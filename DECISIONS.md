# Architecture Decisions

- **D001 (proposed):** OpenCode stable v1 per-project agent files live in `.opencode/agents/`, not in plain `agents/`.
- **D002 (proposed):** Builder is primary; Reviewer is read-only subagent, invoked on demand.
- **D003 (proposed):** Reviewer returns a report in its response; Builder saves it to `reviews/` to preserve edit-denied review isolation.
- **D004 (proposed):** Contract first; no false-positive testing aligned to buggy implementation.
- **D005 (proposed):** No real external API is required for this first portfolio project.
- **D006 (adopted for AQL-000):** Run `.ts` sources directly with Node 24's built-in type stripping instead of adding `ts-node`/`tsx`; TypeScript stays a devDependency used only for `tsc --noEmit` typechecking.
  - Alternatives: `tsx` (fast but extra runtime dependency), `ts-node` (loader friction with ESM), or a `tsc` build step producing `dist/` (extra artifact to keep in sync).
  - Rationale: no build step or runtime transpiler to maintain; CI and local runs execute identical files. Verified on Node v24.19.0 — a probe file `.probe.ts` containing a typed declaration ran with `node .probe.ts` → exit 0, output `ts-strip-ok 42` (probe deleted afterwards).
  - Constraint: type stripping erases types only. `erasableSyntaxOnly` is enabled so typechecking rejects non-erasable syntax (`enum`, `namespace`, parameter properties, decorators); `verbatimModuleSyntax` is enabled separately so type-only imports are explicit rather than silently elided by the compiler.
- **D007 (adopted for AQL-000 review fix):** Validate `engines.node` with `semver` (`validRange` + `subset(range, ">=24.0.0")`) instead of a regex.
  - Alternatives: narrow hand-written format parser (simpler, but easy to under-approximate and hard to explain); regex over the raw string (rejected — a substring such as `>=24` passes inside `garbage >=24` and inside `>=24.0.0 || >=18.0.0`).
  - Rationale: `subset` answers the actual question — does this range permit any version below the project minimum? — and rejects malformed input via `validRange === null`. Reviewer regression cases are pinned in `harness/doctor.selftest.ts`.

Record material deviations with alternatives, rationale and evidence.
