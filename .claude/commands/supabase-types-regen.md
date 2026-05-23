---
description: Regenerate src/types/supabase.ts from the live database schema and verify nothing broke.
---

# Regenerate Supabase Types

Argument `$ARGUMENTS` is unused (script is self-contained).

## Steps

1. **Pull current schema as TypeScript types via MCP:**
   ```
   mcp__supabase__generate_typescript_types(project_id: "amtlqicosscsjnnthvzm")
   ```

2. **Write the result to `src/types/supabase.ts`** (overwrite).

3. **Show the diff so the user can review schema changes:**
   ```bash
   git diff src/types/supabase.ts
   ```

4. **Verification gates (all must pass):**
   ```bash
   npm run lint
   npx tsc --noEmit
   npx vitest run src/core/repositories/__tests__/
   ```

5. **On green: propose a commit.** Conventional commit format:
   ```
   chore(supabase): regenerate types from live schema (YYYY-MM-DD)
   ```
   Body should list which tables changed (visible in the diff).

## When NOT to use
- If schema changes are part of an unmerged migration → run the migration first, then regen.
- If the diff is large and surprising → STOP, surface to user, don't auto-commit.

## Reference workflow
PR #142 (`chore(supabase): regenerate types from live schema (2026-05-23)`)
established this pattern. PR #143 extended the mapper coverage that depends on it.
