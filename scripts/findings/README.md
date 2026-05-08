# Findings Backlog System

> Spec: `docs/superpowers/specs/2026-03-17-findings-backlog-system-design.md`
> Plan: `docs/superpowers/plans/2026-03-17-findings-backlog-system-implementation.md`

## Was ist das?

Ein automatisiertes System, das Bot-Reviews aus `reviews/` in einen aktionierbaren
Backlog (`docs/findings/INDEX.md`) verwandelt und einzelne Findings via `/finding-fix F-XXX`
durch ein deterministisches DAG fixt — mit Sovereign-First-Routing für maximale
Token-Effizienz.

## Quick Start

```bash
# 1. Backlog initial füllen — variant A (alle Reviews auf einmal):
npm run findings:extract
# WARNUNG: Sequenzielle LLM-Calls (~30-90s pro Review × 30+ Reviews = 15-45 min).
# Bei Hangs: Strg+C, dann auf Single-File-Mode wechseln (siehe unten).

# 1b. Backlog initial füllen — variant B (resilient, Datei für Datei):
PYTHONPATH=scripts python3 -m findings.extract_findings reviews/ \
  --findings-dir docs/findings \
  --single reviews/2026-05-07_2053_architecture.md
# Wiederhole für jede Review-Datei einzeln. Hängende Calls killbar mit Strg+C.

# 2. Status anschauen
npm run findings:status

# 3. Einen Fix anwenden (in Claude Code)
/finding-fix F-042
# Hard-Timeout: 300s (R7). Bei hängenden LLM-Calls bricht das DAG ab.

# 4. Nach 4 Wochen: Routing-Statistik
npm run findings:routing-stats
```

## Architecture

- **Pure Python + Pydantic** (kein Framework-Lock-in)
- **Map-Reduce-Manage**: parallel children (Bots) + single-threaded manager (Extractor)
- **Deterministischer DAG** für `/finding-fix` (kein autonomer ReAct-Loop)

### DAG-Pipeline für /finding-fix

```
load_finding → verify_path → read_affected_files → judge_necessity
                                                    │
                                                    ▼
                                              apply_fix
                                                    │
                                                    ▼
                                              run_tests
                                                    │
                                              ┌─────┴─────┐
                                            pass         fail
                                              │           │
                                              ▼           ▼
                                        update_index   fallback
                                                          │
                                                          ▼
                                                  retry with claude-haiku-4-5
```

## Modell-Routing

| Severity | Modell | Tier |
|----------|--------|------|
| low/medium | qwen-3.5-122b-sovereign | FREE |
| high | claude-sonnet-4-6 | $ |
| critical | claude-opus-4-6 + Mensch-Review | $$ |

Auto-Fallback bei Tool-Fail: Sovereign → claude-haiku-4-5.

## Sampling-Parameter (Spec 4.0)

| Modell | temp | top_p | top_k | thinking |
|--------|------|-------|-------|----------|
| qwen-3.5-122b-sovereign | 0.6 | 0.95 | 20 | True |
| qwen3-coder-480b | 1.0 | 0.95 | 20 | True |
| claude-* | 0.5–0.7 | 0.95 | – | – |

⚠️ Niemals greedy decoding (temp=0) bei Qwen3 — endless repetitions.

## Spec-Referenzen

- D3: AKs Pflicht ab severity=medium
- D13: Map-Reduce-Manage
- D14: Deterministic DAG
- D15: Pure Python + Pydantic (kein LangGraph)
- D16: Sampling-Parameter pro Modell
- D18: SELF_CHECK in System-Prompts
- D19/D20: Sichtfeld-Klausel + erweiterte focus_dirs
- D21: Sub-Agent liest echten Code, nicht Bot-Beschreibung
- D22: Symbol-Search-Fallback bei Pfad-Ungenauigkeit

## Module-Übersicht

- `lib/models.py` — Pydantic Models (Severity, Status, Finding, FindingFixState)
- `lib/aihub_client.py` — AI Hub LiteLLM-Proxy mit modell-spezifischen Sampling-Params
- `lib/routing.py` — Severity → Modell-Mapping mit Auto-Fallback
- `lib/jsonl_logger.py` — JSONL-Logger für Audit-Log
- `lib/git_helpers.py` — git rev-parse / diff Wrapper
- `lib/symbol_search.py` — grep-Fallback bei Pfad-Ungenauigkeit (D22)
- `lib/frontmatter.py` — YAML-Frontmatter Parser/Writer
- `dag_nodes/` — DAG-Knoten für /finding-fix
- `extract_findings.py` — Phase 1 Extractor
- `validate_review_freshness.py` — Phase 0a Stale-Detection
- `finding_fix.py` — DAG-Orchestrator
- `findings_status.py` + `findings_routing_stats.py` — Dashboards

## Operationelle Caveats

### Sequenzielle Extraction
`extract_findings.py` ruft pro Review-File EINEN LLM-Call sequenziell auf. Bei 30+ Reviews
und qwen-3.5-122b-sovereign mit Thinking-Mode (~30-90s pro Call) läuft die volle Extraction
**15-45 Minuten**. Es gibt keine Parallelität — bewusst, weil:

1. Map-Reduce-Manage (D13): paralleles Schreiben in INDEX.md würde Race Conditions schaffen
2. AI Hub Free-Tier hat Throttling-Limits, die Parallel-Calls blockieren würden (404er, 504er Gateway-Timeouts)

**Recovery bei Hang**: Strg+C, dann mit `--single <file>` Datei für Datei nachholen.

### /finding-fix Hard-Timeout
`HARD_TIMEOUT_S = 300` (5 Min) im DAG-Orchestrator. Hängende LLM-Calls werden nach 5 Min
abgebrochen — Finding bleibt im Status `open`, kein partieller Commit. Logs landen in
`.claude/logs/finding-fixes.jsonl`.

## Bot-Qualitäts-Baseline (empirisch, n=12)

- Code-Befund verifiziert: **75 %**
- Severity-Einstufung korrekt: **42 %**
- Pfad-Genauigkeit: **83 %**
- Echte Halluzination: **0 %**
- Critical False Positives: **~8 %** (durch Sichtfeld-Beschränkung — D19 mitigates)

→ Phase-2-Quality-Check ist Pflicht (Mensch korrigiert Severity vor `status: open`).
