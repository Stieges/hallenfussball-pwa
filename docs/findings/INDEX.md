# Findings Backlog

> Auto-managed by `scripts/findings/extract_findings.py` and `/finding-fix`.
> Last sync: <pending — first extraction>

| ID | Sev | Area | Title | File | Effort | Status |
|----|-----|------|-------|------|--------|--------|

## Stats

- Total: 0
- Critical: 0 / High: 0 / Medium: 0 / Low: 0
- Open: 0 / In-Progress: 0 / Fixed: 0 / Archived: 0

## Workflow

1. **Extract:** `python3 scripts/findings/extract_findings.py reviews/`
2. **Status:** `python3 scripts/findings/findings_status.py`
3. **Fix:** `/finding-fix F-001`  (Slash-Command in Claude Code)
4. **Routing-Stats (after 4 weeks):** `python3 scripts/findings/findings_routing_stats.py`

## Severity Legend

| | Stufe | SLA |
|--|-------|-----|
| ⚫ | critical | <24 h |
| 🔴 | high | <1 Woche |
| 🟠 | medium | <1 Monat |
| 🟡 | low | Backlog |
