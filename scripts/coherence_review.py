#!/usr/bin/env python3
"""Cross-file coherence reviewer for a feature scope.

Delegates the analytical work to qwen-3.5-122b-sovereign via the AI Hub
(thinking-mode). Claude orchestrates and presents — the LLM does the
heavy lifting. See .claude/commands/coherence-review.md for the slash-
command wrapper.

Usage:
    python scripts/coherence_review.py <scope>
    python scripts/coherence_review.py src/features/tournament-creation/
    python scripts/coherence_review.py src/core/repositories/

Env:
    AI_HUB_API_KEY    (required)
    AI_HUB_BASE_URL   (required, set in .env.local)

Output: Markdown report to stdout, severity-ranked.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Local import — AIHubClient is the sanitised client added in setup-evolution C0a
sys.path.insert(0, str(Path(__file__).resolve().parent / "findings" / "lib"))
from aihub_client import AIHubClient, AIHubError  # noqa: E402

MODEL = "qwen-3.5-122b-sovereign"
MAX_TOKENS_OUT = 8000  # report is markdown, doesn't need to be huge
CHAR_BUDGET = 200_000  # ~50k tokens input — well under the model window


SYSTEM_PROMPT = """You are a senior software architect performing a cross-file
coherence review. You analyse a slice of a React/TypeScript PWA codebase
(Hallenfussball tournament management) and detect six specific violation
classes:

1. **Reimplementation** — the same business logic appears in two layers
   (e.g. once in `core/repositories/*` and again inlined in a hook or
   component). Cite both locations.

2. **Missing consumption** — a repository method or service function is
   defined but no caller exists in `src/hooks/`, `src/features/`, or
   `src/components/`. Dead code or premature export.

3. **Interface mismatch** — type drift between the supabase schema
   (`src/types/supabase.ts`), the domain model (`src/types/tournament.ts`),
   and the mapper layer (`src/core/repositories/mappers/*`). E.g. nullable
   in one, required in another, or different field name spellings.

4. **AC duplication** — the same acceptance criterion is tested in two
   or more `__tests__/*.test.ts` files. Tests should be canonical.

5. **Orphaned deliverables** — files in `src/core/` that are exported but
   never imported by `src/hooks/`, `src/features/`, or `src/components/`.

6. **Cross-feature handoff gaps** — e.g., the tournament-creation wizard's
   Step 3 output shape does not match what Step 4 expects to consume.

For every finding, output:
- Severity: 🔴 critical (data corruption risk) / 🟠 important (silent
  behaviour drift) / 🟡 advisory (cleanup / clarity).
- Class: one of the six above.
- Locations: `file:line` references (use the line numbers from the
  pasted source).
- One-sentence description.
- One-sentence remediation suggestion (no code).

Do not invent issues. If you see none of a class, omit that section.
Do not propose architectural rewrites — only point out coherence violations.
Output strict Markdown. No preamble. Start directly with `# Coherence Review`.
"""


def collect_scope_files(scope: str, project_root: Path) -> list[Path]:
    """Resolve scope argument to a list of .ts/.tsx files."""
    scope_path = project_root / scope if not Path(scope).is_absolute() else Path(scope)

    if scope_path.is_dir():
        return sorted(
            p
            for p in scope_path.rglob("*")
            if p.suffix in (".ts", ".tsx") and "node_modules" not in p.parts
        )

    if scope_path.is_file():
        return [scope_path]

    # Try as feature slug — search src/features/<slug>/ and src/components/<slug>/
    candidates = [
        project_root / "src" / "features" / scope,
        project_root / "src" / "components" / scope,
    ]
    for c in candidates:
        if c.is_dir():
            return sorted(
                p
                for p in c.rglob("*")
                if p.suffix in (".ts", ".tsx") and "node_modules" not in p.parts
            )

    raise ValueError(f"Scope not found: {scope}")


def collect_context_files(project_root: Path) -> list[Path]:
    """Always-included context: type definitions and mapper layer."""
    out = []
    for sub in ("src/types", "src/core/repositories/mappers"):
        d = project_root / sub
        if d.is_dir():
            out.extend(
                p
                for p in d.rglob("*")
                if p.suffix in (".ts", ".tsx") and "node_modules" not in p.parts
            )
    return sorted(out)


def build_payload(files: list[Path], project_root: Path) -> tuple[str, int]:
    """Assemble file dump, honouring CHAR_BUDGET. Returns (payload, n_files_included)."""
    parts = []
    total = 0
    included = 0
    for f in files:
        try:
            content = f.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        rel = f.relative_to(project_root)
        block = f"\n\n--- FILE: {rel} ---\n{content}"
        if total + len(block) > CHAR_BUDGET:
            parts.append(f"\n\n--- TRUNCATED: {len(files) - included} more files omitted ---\n")
            break
        parts.append(block)
        total += len(block)
        included += 1
    return "".join(parts), included


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python scripts/coherence_review.py <scope>", file=sys.stderr)
        return 2

    scope = sys.argv[1]
    project_root = Path(__file__).resolve().parent.parent

    try:
        scope_files = collect_scope_files(scope, project_root)
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    context_files = collect_context_files(project_root)
    # Deduplicate while preserving order (scope first)
    seen = set()
    all_files = []
    for f in scope_files + context_files:
        if f not in seen:
            seen.add(f)
            all_files.append(f)

    payload, n_included = build_payload(all_files, project_root)

    user_prompt = (
        f"Scope: `{scope}`\n"
        f"Files included: {n_included} of {len(all_files)} candidate(s)\n"
        f"{payload}"
    )

    try:
        client = AIHubClient()
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        print("Hint: source .env.local first.", file=sys.stderr)
        return 2

    try:
        result = client.chat(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=MAX_TOKENS_OUT,
        )
    except AIHubError as e:
        print(f"AI Hub error: {e}", file=sys.stderr)
        return 1

    print(result["content"])
    print(
        f"\n\n---\n_tokens: {result['tokens_in']} in, {result['tokens_out']} out_",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
