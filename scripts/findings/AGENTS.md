# Findings-Subsystem — Hinweise für Sub-Agents

Dieses Verzeichnis enthält das Findings-Backlog-System.

## Wichtige Regeln (aus Spec D-Entscheidungen)

- Pure Python + Pydantic, KEIN LangGraph/LlamaIndex/CrewAI (D15)
- Map-Reduce-Manage-Pattern: parallel children, single-threaded manager (D13)
- /finding-fix ist ein deterministischer DAG, KEIN ReAct-Loop (D14)
- Sovereign-First Routing mit Auto-Fallback (D4)
- Sichtfeld-Klausel in Prompts: "fehlt komplett" → Severity Low + Tag (D19)
- Sub-Agent muss IMMER Code aus echtem File lesen, nicht Bot-Beschreibung trauen (D21)
- Symbol-Suche als Pfad-Fallback (D22)
- AKs Pflicht ab severity=medium (D3)

## Datenfluss

```
reviews/*.md (Bot-Output)  →  extract_findings.py  →  docs/findings/F-*.md + INDEX.md
                                                              │
                                                              ▼
                                                       /finding-fix F-042
                                                              │
                                                              ▼
                                       finding_fix.py (DAG-Orchestrator)
                                                              │
                              ┌───────────────────────────────┤
                              ▼                               │
                      verify_path → read_affected_files       │
                              │                               │
                              ▼                               │
                      judge_necessity → apply_fix             │
                              │                               │
                              ▼                               │
                      run_tests → update_index ──── commit ───┘
```

## Modell-Routing (4.1 im Spec)

| Severity | Default | Fallback bei Tool-Fail |
|----------|---------|------------------------|
| low      | qwen-3.5-122b-sovereign FREE | claude-haiku-4-5 |
| medium   | qwen-3.5-122b-sovereign FREE | claude-haiku-4-5 |
| high     | claude-sonnet-4-6 | (kein Fallback nötig) |
| critical | claude-opus-4-6 + Mensch-Review | – |

## Sampling-Parameter (4.0 im Spec)

| Modell | temp | top_p | top_k | enable_thinking |
|--------|------|-------|-------|-----------------|
| qwen-3.5-122b-sovereign | 0.6 | 0.95 | 20 | True |
| qwen3-coder-480b | 1.0 | 0.95 | 20 | True |
| claude-haiku/sonnet/opus | 0.5–0.7 | 0.95 | – | – |

WARNUNG: Greedy-Decoding (temp=0) bei Qwen3 vermeiden — endless repetitions.
