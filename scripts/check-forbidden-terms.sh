#!/usr/bin/env bash
# Wächter gegen Anbieter-Namen im öffentlichen Repo (Task G4).
#
# Prüft Dateien und/oder eine Commit-Nachricht gegen eine Begriffsliste, die
# absichtlich NICHT im Repo steht:
#   - lokal:  .claude/local/forbidden-terms.txt (gitignored, eine Zeile je
#     Regex, `#`-Kommentare und Leerzeilen werden ignoriert)
#   - in CI:  Umgebungsvariable FORBIDDEN_TERMS (zeilengetrennt)
#
# Fehlt die Liste lokal, wird nur gewarnt (exit 0) — damit auch Rechner ohne
# diese Datei committen können. Fehlt sie in CI (FORBIDDEN_TERMS leer/unset),
# schlägt der Check fehl (exit 1) — ein übersprungener Check darf nie grün sein.
#
# Verwendung:
#   scripts/check-forbidden-terms.sh --staged           # gestagte Dateien (pre-commit)
#   scripts/check-forbidden-terms.sh --message <datei>  # Commit-Nachricht (commit-msg)
#   scripts/check-forbidden-terms.sh --tree             # ganzer Arbeitsbaum (CI)
#   scripts/check-forbidden-terms.sh --text "<text>"    # beliebiger Text, z. B. PR-Titel (CI)
#
# Treffer werden NIE im Klartext ausgegeben, nur als "Datei:Zeile" bzw.
# "<Quelle>: Treffer in Zeile <n>".
#
# Bewusst POSIX-/bash-3.2-kompatibel gehalten (kein `mapfile`, keine Arrays
# unter `set -u`), weil macOS standardmäßig bash 3.2 ausliefert.

set -eu

LOCAL_TERMS_FILE="${FORBIDDEN_TERMS_FILE:-.claude/local/forbidden-terms.txt}"
IS_CI="${CI:-}"

# Ausnahmeliste: genau die zwei Dateien mit Daniels eigenen, noch nicht
# committeten Änderungen (siehe
# .superpowers/sdd/2026-09-24-llm-gateway/task-G2-G4-report.md, lokal und
# gitignored, für den vollen Hintergrund). Temporär, bis diese Änderungen
# eingecheckt sind. Diese Datei hier nennt selbst keine Anbieter-Begriffe.
is_exempt() {
  case "$1" in
    ".claude/commands/coherence-review.md"|"docs/TODO.md") return 0 ;;
    *) return 1 ;;
  esac
}

TERMS_RAW=""
if [ -n "${FORBIDDEN_TERMS:-}" ]; then
  TERMS_RAW="$(printf '%s\n' "$FORBIDDEN_TERMS" | grep -vE '^\s*(#|$)' || true)"
elif [ -f "$LOCAL_TERMS_FILE" ]; then
  TERMS_RAW="$(grep -vE '^\s*(#|$)' "$LOCAL_TERMS_FILE" || true)"
fi

if [ -z "$TERMS_RAW" ]; then
  if [ -n "$IS_CI" ]; then
    echo "FEHLER: Keine Begriffsliste gefunden (Secret FORBIDDEN_TERMS fehlt oder ist leer)." >&2
    echo "Ein übersprungener Check darf nie grün sein — Job schlägt fehl." >&2
    exit 1
  else
    echo "WARNUNG: Keine lokale Begriffsliste ($LOCAL_TERMS_FILE) gefunden — Begriffs-Check übersprungen." >&2
    exit 0
  fi
fi

# Ein einziges Alternationsmuster bauen (ERE).
PATTERN="$(printf '%s\n' "$TERMS_RAW" | paste -sd '|' -)"

MODE="${1:-}"
FOUND=0
HITFILE="$(mktemp)"
trap 'rm -f "$HITFILE"' EXIT

check_files_from_stdin() {
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ -f "$f" ] || continue
    is_exempt "$f" && continue
    # Binärdateien überspringen
    if grep -Iq . "$f" 2>/dev/null; then
      if grep -noE "$PATTERN" -- "$f" > "$HITFILE" 2>/dev/null; then
        while IFS=: read -r lineno _rest; do
          echo "$f:$lineno"
        done < "$HITFILE"
        FOUND=1
      fi
    fi
  done
}

case "$MODE" in
  --staged)
    check_files_from_stdin < <(git diff --cached --name-only --diff-filter=ACMR)
    ;;
  --tree)
    check_files_from_stdin < <(git ls-files)
    ;;
  --message)
    MSG_FILE="${2:?Pfad zur Commit-Message-Datei fehlt}"
    if grep -noE "$PATTERN" -- "$MSG_FILE" > "$HITFILE" 2>/dev/null; then
      echo "commit-message: Treffer in Zeile $(head -1 "$HITFILE" | cut -d: -f1)"
      FOUND=1
    fi
    ;;
  --text)
    TEXT="${2:?Text fehlt}"
    if printf '%s\n' "$TEXT" | grep -noE "$PATTERN" > "$HITFILE" 2>/dev/null; then
      echo "text: Treffer in Zeile $(head -1 "$HITFILE" | cut -d: -f1)"
      FOUND=1
    fi
    ;;
  *)
    echo "Verwendung: $0 --staged | --tree | --message <datei> | --text <text>" >&2
    exit 2
    ;;
esac

if [ "$FOUND" -eq 1 ]; then
  echo "" >&2
  echo "FEHLER: Verbotener Begriff gefunden (siehe Treffer oben, Datei:Zeile)." >&2
  echo "Anbieter-Namen dürfen im öffentlichen Repo nicht auftauchen. Neutral: \"LLM-Gateway\"." >&2
  exit 1
fi

exit 0
