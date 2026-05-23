---
description: Run a coherence review against a feature scope using the sovereign LLM proxy. Detects interface drift, missing consumption, AC duplication, orphaned deliverables, cross-feature handoff gaps.
---

# Coherence Review

Delegates the analysis to `scripts/coherence_review.py`, which runs against
qwen-3.5-122b-sovereign via the AI Hub (free, sovereign-hosted, Thinking-Mode).
Claude does not consume tokens for the analysis itself — only for orchestration
and presenting findings back to the user.

## Argument

`$ARGUMENTS` is the scope — either a path or a feature slug, e.g.:
- `src/features/tournament-creation/`
- `src/core/repositories/`
- `live-cockpit` (resolved to `src/components/live-cockpit/` plus its hook)

## Steps

1. **Verify env vars are set:**
   ```bash
   [ -z "$AI_HUB_API_KEY" ] && echo "AI_HUB_API_KEY not set — source .env.local" && exit 1
   [ -z "$AI_HUB_BASE_URL" ] && echo "AI_HUB_BASE_URL not set — source .env.local" && exit 1
   ```

2. **Run the reviewer:**
   ```bash
   python scripts/coherence_review.py "$ARGUMENTS"
   ```

3. **Present the report** structured by severity (critical → important → advisory).
   The script writes a Markdown report to stdout.

## What it detects (6 violation classes)

1. **Reimplementation** — same logic in `core/repositories/*` and a hook/component.
2. **Missing consumption** — a new repository method exists but no hook calls it.
3. **Interface mismatch** — type drift between `src/types/supabase.ts`,
   `src/types/tournament.ts`, and `core/repositories/mappers/*`.
4. **AC duplication** — the same test path appears in multiple `__tests__/*.test.ts`.
5. **Orphaned deliverables** — files in `src/core/` with no import reference elsewhere.
6. **Cross-feature handoff gaps** — e.g., Wizard Step 3 output is not consumed
   in the form Step 4 expects.

## When NOT to use
- For single-file code review → use `code-critic` subagent instead.
- For UI/UX review → use `ux-reviewer`.
- For architecture review → use `architecture-judge`.
- Coherence is about **cross-file consistency**, not per-file quality.

## Reference
Pattern adapted from external SDLC framework "Phase 2.4 Coherence Review",
mapped to this project's actual layering (core / hooks / features / components).
