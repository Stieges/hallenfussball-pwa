# apply_patch State-Inkonsistenz — Investigate-Befund

**Datum:** 2026-05-10
**Trigger:** F-243 Live-Run hatte `fix_applied=false` im JSONL, aber `git diff` zeigte 3 substanzielle Änderungen in `src/features/auth/components/LoginScreen.tsx`.

## Datenpunkte

Aus `.claude/logs/finding-fixes.jsonl` (gefiltert auf F-243):

```json
// Run 1 (HIGH severity routing → claude-sonnet-4-6 → 401)
{"model":"sonnet-4-6","provider":"claude","fix_applied":false,
 "fallback_used":false,"tool_call_errors":2,"planned_changes_count":0}

// Run 2 (mit override model_routing=qwen-3.5-122b-sovereign)
{"model":"qwen3-coder-480b","provider":"aihub","fix_applied":false,
 "fallback_used":true,"tool_call_errors":0,
 "planned_changes_count":5,"patch_errors_count":1}
```

Working-Tree nach Run 2:

```diff
- setApiError(result.error ?? AUTH_ERRORS.LOGIN_FAILED);
+ setApiError(AUTH_ERRORS.LOGIN_FAILED);
- setApiError(result.error ?? AUTH_ERRORS.GOOGLE_LOGIN_FAILED);
+ setApiError(AUTH_ERRORS.GOOGLE_LOGIN_FAILED);
- setApiError(result.error ?? AUTH_ERRORS.PASSWORD_RESET_FAILED);
+ setApiError(AUTH_ERRORS.PASSWORD_RESET_FAILED);
```

3 substanzielle Änderungen, die **inhaltlich exakt** zum F-243-Akzeptanzkriterium passen ("Alle Login-Fehler zeigen identische Meldung"). 1 patch_error (`replace_text non-unique`) blockierte op #2 von 5.

## Code-Analyse

### Atomicity der Patch-Anwendung

[`apply_patch.py:50-62`](../../scripts/findings/dag_nodes/apply_patch.py#L50-L62):

```python
file_content = target.read_text(encoding="utf-8")
result = apply_changes(file_content, state.planned_changes, file_path=state.path_resolved)
state.patch_warnings = result.warnings
if result.success:
    target.write_text(result.new_content, encoding="utf-8")  # ← write only on success
    state.patched_content = result.new_content
    state.fix_applied = True
    state.patch_errors = []
else:
    state.fix_applied = False
    state.patch_errors = result.errors
```

[`code_patcher.py:265-338`](../../scripts/findings/lib/code_patcher.py#L265-L338): `apply_changes()` arbeitet auf einer In-Memory-`current_lines: list[str]`, returns `success=False, new_content=None` bei der ersten gescheiterten op. Kein Disk-I/O zwischen ops.

**Conclusion:** apply_patch ist atomar im aktuellen Code-Stand. Bei `result.success=False` wird die Ziel-Datei NICHT geschrieben.

### Fallback-Flow Reset

[`finding_fix.py:117-143`](../../scripts/findings/finding_fix.py#L117-L143): Bei `should_fallback`:

```python
state.fallback_used = True
state.routing = fb
# Reset ALL partial state from previous attempt
state.planned_changes = []
state.fix_applied = False
state.tests_pass = None
state.patched_content = None
state.patch_errors = []
state.patch_warnings = []
state.review_verdict = None
...
state = plan_changes(state, repo_root=repo_root)
if state.planned_changes:
    state = apply_patch(state, repo_root=repo_root)
```

**Lücke:** Der Reset-Block resettet `state.*`, aber **NICHT die Datei auf Disk**. Falls primary-run `apply_patch` erfolgreich war (Datei modifiziert), und der Fallback dann mit anderen Operationen scheitert, bleibt die primary-run-Modifikation auf Disk — aber `state.fix_applied=False` und `state.patched_content=None` (post-Reset) signalisieren dem Logger / nachgelagerten Schritten "nichts passiert".

## Vermutete Ursache F-243-Run-2

Hypothese (am Code plausibel, aber ohne saubere Repro nicht 100% bewiesen):

1. **Primary-Run** mit `qwen-3.5-122b-sovereign`:
   - `plan_changes` lieferte z.B. 3 ops (die 3 substanziellen Änderungen)
   - `apply_patch` war **erfolgreich** → Datei geschrieben, `fix_applied=True`, `tool_call_errors > 0` (z.B. aus `judge_necessity` HTTP-Slowdown? oder review_patch fail?) — alternative Trigger
   - Irgendein nachgelagerter Schritt scheiterte → fallback-condition matched
2. **Fallback-Run** mit `qwen3-coder-480b`:
   - State resettet (`fix_applied=False`, `planned_changes=[]`, …)
   - `plan_changes` lieferte diesmal 5 ops
   - `apply_patch` scheiterte an op #2 (non-unique replace) → `fix_applied=False`
   - `state.fix_applied` bleibt False, JSONL-Logger schreibt finalen State

**File-Disk-State** ist die primary-run-Modifikation. **JSONL** ist der fallback-State.

Alternative (weniger wahrscheinlich): Ein op-Handler in `code_patcher.py` schreibt doch direkt — sollte beim review separat verifiziert werden.

## Empfehlung für Folge-Plan

**Option A (empfohlen): File-Snapshot vor apply_patch + Restore-on-not-fix-applied**

In `apply_patch.py` vor dem `read_text`:

```python
original_bytes = target.read_bytes()  # snapshot
file_content = target.read_text(encoding="utf-8")
result = apply_changes(...)
if result.success:
    target.write_text(result.new_content, ...)
    state.fix_applied = True
else:
    # explicit no-op restore (idempotent — nothing was written if atomic)
    target.write_bytes(original_bytes)
    state.fix_applied = False
```

Plus im Fallback-Reset (`finding_fix.py`): Vor dem Fallback-Run einen **frischen Snapshot** machen, so dass am Ende des gesamten DAG-Laufs die Datei garantiert in einem von `state.fix_applied` reflektierten Zustand ist.

**Aufwand:** ~20 LoC Code + 2-3 Tests.

**Garantie:** Working-Tree nach `_run_dag` ist immer konsistent mit `state.fix_applied`.

**Option B: git-stash-basiert**

Vor `_run_dag`: `git stash --keep-index --include-untracked`. Nach Run: bei `fix_applied=False` `git stash pop`, sonst `git stash drop`.

**Vorteil:** Schwerere Atomicity-Garantie auch bei Op-Handler-Bugs.
**Nachteil:** Externer State (git), Edge-Cases bei Untracked-Files, schwer testbar in pytest.

**Option C: Caller-Verantwortung dokumentieren**

In CLAUDE.md / `/finding-fix`-Doku: "Nach jedem Run `git status` prüfen; bei NEEDS_HUMAN/REJECTED `git checkout -- <file>` aufrufen."

**Vorteil:** Null Code-Änderung.
**Nachteil:** Manuelle Prozessdisziplin, fehleranfällig — heutiger F-243-Run war ein Fall in dem genau das passiert ist.

**Empfehlung:** Option A. Klein, deterministisch, vollständig in Python testbar, schließt die Lücke ohne externe Abhängigkeiten.

## Akzeptanz dieses Investigate-Befunds

- ✅ Code-Pfad analysiert: `apply_patch` und `apply_changes` sind atomar
- ✅ Lücke benannt: Fallback-Reset bezieht das File-System nicht ein
- ✅ Drei Lösungsoptionen mit Trade-offs
- ⏭ Folge-Plan separat (nicht Teil dieses Investigate)

## Notes

- Das Routing-Bug von Run 1 (sonnet-4-6 nicht in Allowlist) ist ein anderer Befund und out-of-scope dieser Investigation.
- F-243 wurde im finally-Block via `git checkout -- src/features/auth/components/LoginScreen.tsx` manuell zurückgesetzt; kein File-Schaden im Working-Tree-Master-State.
