# Architecture Decisions

- **D001 (proposed):** OpenCode stable v1 per-project agent files live in `.opencode/agents/`, not in plain `agents/`.
- **D002 (proposed):** Builder is primary; Reviewer is read-only subagent, invoked on demand.
- **D003 (proposed):** Reviewer returns a report in its response; Builder saves it to `reviews/` to preserve edit-denied review isolation.
- **D004 (proposed):** Contract first; no false-positive testing aligned to buggy implementation.
- **D005 (proposed):** No real external API is required for this first portfolio project.

Record material deviations with alternatives, rationale and evidence.
