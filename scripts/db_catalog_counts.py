#!/usr/bin/env python3
"""
db_catalog_counts.py — Katalogzählung aus einem pg_dump-Schema-Text (--schema-only).

Zweck: Der Drift-Check (.github/workflows/supabase-drift-check.yml) vergleicht das Live-Schema
gegen die rekonstruierte Baseline auf zwei Beinen — Textdiff UND Katalogzählung (siehe
supabase/migrations/README.md). Ein Textdiff übersieht semantisch Gleiches (z.B. Whitespace/
Reihenfolge), eine Zählung übersieht Detailabweichungen. Beide zusammen sind der Check.

Dieses Skript zählt sieben Dimensionen aus REINEM SQL-TEXT (kein DB-Zugriff nötig), damit dieselbe
Methode auf zwei völlig unterschiedlich beschafften Dumps läuft:
  - "live": `supabase db dump --schema public --linked` (kein DB-Passwort, per CLI)
  - "reconstructed": pg_dump --schema-only aus dem lokalen Vergleichscontainer

Die Zähl-Patterns sind keine Vermutung — sie wurden gegen die Baseline-Datei selbst verifiziert
(supabase/migrations/00000000000000_baseline_live_schema.sql) und treffen dort exakt die vom
Controller unabhängig über pg_catalog gemessenen Werte (Stand 2026-09-21):
  13 Tabellen, 233 Spalten, 44 Policies, 28 Funktionen, 23 Trigger, 57 Indizes, 13 RLS-Tabellen.

Wichtig zu Triggern: pg_dump exportiert NIE interne/System-Trigger (z.B. für Fremdschlüssel-
Constraints) — jedes "CREATE TRIGGER"/"CREATE OR REPLACE TRIGGER" im Dump-Text ist bereits ein
"echter" Trigger im Sinne von `pg_trigger.tgisinternal = false`. Ein zusätzlicher Filter ist hier
nicht nötig.

Wichtig zu Indizes: pg_dump schreibt PRIMARY-KEY- und UNIQUE-Constraints NICHT als CREATE INDEX,
sondern als `ALTER TABLE ... ADD CONSTRAINT ... PRIMARY KEY/UNIQUE (...)`. Beide legen aber intern
einen Index an. Die Gesamtzahl "Indizes" ist deshalb: explizite CREATE INDEX-Statements PLUS
PRIMARY-KEY-Constraints PLUS UNIQUE-Constraints.

Nutzung:
    python3 scripts/db_catalog_counts.py <dump.sql> [--json]

Exit-Code ist immer 0 (reines Zähl-Tool). Der Vergleich zweier Zählungen passiert im aufrufenden
Shell-Skript (scripts/db-drift-check.sh), nicht hier.
"""

from __future__ import annotations

import argparse
import json
import re
import sys

TABLE_RE = re.compile(r'^CREATE TABLE(?: IF NOT EXISTS)?\s+"?(?:public"?\."?)?([A-Za-z0-9_]+)"?\s*\(', re.MULTILINE)
POLICY_RE = re.compile(r'^CREATE POLICY\b', re.MULTILINE)
FUNCTION_RE = re.compile(r'^CREATE (?:OR REPLACE )?FUNCTION\b', re.MULTILINE)
TRIGGER_RE = re.compile(r'^CREATE (?:OR REPLACE )?TRIGGER\b', re.MULTILINE)
EXPLICIT_INDEX_RE = re.compile(r'^CREATE (?:UNIQUE )?INDEX\b', re.MULTILINE)
PK_CONSTRAINT_RE = re.compile(r'ADD CONSTRAINT\s+"?[A-Za-z0-9_]+"?\s+PRIMARY KEY', re.MULTILINE)
UQ_CONSTRAINT_RE = re.compile(r'ADD CONSTRAINT\s+"?[A-Za-z0-9_]+"?\s+UNIQUE', re.MULTILINE)
RLS_RE = re.compile(r'^ALTER TABLE\s+"?(?:public"?\."?)?[A-Za-z0-9_]+"?\s+ENABLE ROW LEVEL SECURITY', re.MULTILINE)

NON_COLUMN_PREFIXES = (
    "constraint",
    "primary key",
    "unique",
    "check",
    "foreign key",
    "exclude",
    "like ",
)


def _find_matching_paren(text: str, open_idx: int) -> int:
    """Findet die Position der schließenden Klammer, die zur öffnenden an open_idx gehört."""
    depth = 0
    i = open_idx
    in_single_quote = False
    in_dollar_quote = False
    while i < len(text):
        ch = text[i]
        if in_dollar_quote:
            if text.startswith("$$", i):
                in_dollar_quote = False
                i += 2
                continue
        elif in_single_quote:
            if ch == "'":
                in_single_quote = False
        else:
            if ch == "'":
                in_single_quote = True
            elif text.startswith("$$", i):
                in_dollar_quote = True
                i += 2
                continue
            elif ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    raise ValueError("Keine schließende Klammer gefunden — Dump-Text unvollständig?")


def _split_top_level(body: str) -> list[str]:
    """Teilt den Inhalt einer CREATE-TABLE-Klammer an Top-Level-Kommas (ignoriert verschachtelte Klammern)."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    in_single_quote = False
    i = 0
    while i < len(body):
        ch = body[i]
        if in_single_quote:
            current.append(ch)
            if ch == "'":
                in_single_quote = False
            i += 1
            continue
        if ch == "'":
            in_single_quote = True
            current.append(ch)
        elif ch == "(":
            depth += 1
            current.append(ch)
        elif ch == ")":
            depth -= 1
            current.append(ch)
        elif ch == "," and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(ch)
        i += 1
    if current and "".join(current).strip():
        parts.append("".join(current))
    return parts


def count_columns(text: str) -> int:
    total = 0
    for match in TABLE_RE.finditer(text):
        open_paren_idx = match.end() - 1  # match endet direkt nach "("
        close_paren_idx = _find_matching_paren(text, open_paren_idx)
        body = text[open_paren_idx + 1:close_paren_idx]
        entries = _split_top_level(body)
        for entry in entries:
            stripped = entry.strip().lstrip('\n')
            if not stripped:
                continue
            lowered = stripped.lower()
            if lowered.startswith(NON_COLUMN_PREFIXES):
                continue
            total += 1
    return total


def count_all(text: str) -> dict[str, int]:
    return {
        "tables": len(TABLE_RE.findall(text)),
        "columns": count_columns(text),
        "policies": len(POLICY_RE.findall(text)),
        "functions": len(FUNCTION_RE.findall(text)),
        "triggers": len(TRIGGER_RE.findall(text)),
        "indexes": (
            len(EXPLICIT_INDEX_RE.findall(text))
            + len(PK_CONSTRAINT_RE.findall(text))
            + len(UQ_CONSTRAINT_RE.findall(text))
        ),
        "rls_tables": len(RLS_RE.findall(text)),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dump_file", help="Pfad zu einer pg_dump --schema-only SQL-Datei")
    args = parser.parse_args()

    with open(args.dump_file, "r", encoding="utf-8") as fh:
        text = fh.read()

    counts = count_all(text)
    print(json.dumps(counts, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
