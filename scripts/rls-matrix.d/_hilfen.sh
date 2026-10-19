# shellcheck shell=bash
#
# rls-matrix.d/_hilfen.sh — gemeinsame Hilfen der Spur-Dateien (A-11, brief-A-11.md R-A11-4). Wird vom Hauptskript
# scripts/rls-role-matrix.sh per `source` VOR spur-*.sh eingebunden (Glob-Reihenfolge: `_` vor `s`); nutzt
# CONTAINER_NAME und zaehlt in TOTAL/MISMATCHES.
a11_mark() {
  local label="$1" got="$2" exp="$3"
  TOTAL=$((TOTAL + 1))
  if [[ "$got" == "$exp" ]]; then
    echo "$label: $got"
  else
    echo "$label: ${got}!=${exp}"
    MISMATCHES=$((MISMATCHES + 1))
  fi
}

# a11_probe <rolle authenticated|anon> <user-id oder leer> <sichtbar-SQL> <schreib-SQL> <pruef-SQL> [vorbereitung-SQL]
# Eine nie committete Transaktion: (optional) Vorbereitung als Superuser, dann als Client-Rolle "sichtbar" (Zahl),
# dann Schreiben, dann RESET ROLE und Pruefwert als Superuser. Ausgabe: "<sichtbar>|<zeilen>|<pruefwert>";
# <zeilen> ist die Zahl aus dem Befehls-Tag (UPDATE n / DELETE n / INSERT 0 n) oder "fehler" (RLS-/Trigger-Fehler).
a11_probe() {
  local role="$1" uid="$2" visible_sql="$3" write_sql="$4" check_sql="$5" setup_sql="${6:-}"
  local sub_line="" out ec visible rows check
  [[ -n "$uid" ]] && sub_line="SET LOCAL request.jwt.claim.sub = '$uid';"
  set +e
  out="$(docker exec -i "$CONTAINER_NAME" psql -U postgres -X -A -v ON_ERROR_STOP=0 <<SQL 2>&1
BEGIN;
$setup_sql
SET LOCAL ROLE $role;
$sub_line
SELECT 'a11sichtbar:' || ($visible_sql);
SAVEPOINT a11_schreiben;
SELECT 'a11schreiben:ab-hier';
$write_sql
\\if :ERROR
ROLLBACK TO SAVEPOINT a11_schreiben;
\\endif
RESET ROLE;
SELECT 'a11pruef:' || coalesce(($check_sql)::text, 'NULL');
ROLLBACK;
SQL
)"
  ec=$?
  set -e
  visible="$( (grep -m1 '^a11sichtbar:' <<<"$out" || true) | sed 's/^a11sichtbar://')"
  check="$( (grep -m1 '^a11pruef:' <<<"$out" || true) | sed 's/^a11pruef://')"
  # Nur die Befehls-Tags NACH der Marke zaehlen (die Vorbereitung als Superuser meldet eigene Tags).
  local written
  written="$(sed -n '/^a11schreiben:ab-hier$/,$p' <<<"$out")"
  if grep -qE '^ERROR:' <<<"$out"; then
    rows="fehler"
  else
    rows="$( (grep -E '^(UPDATE|DELETE) [0-9]+$|^INSERT 0 [0-9]+$' <<<"$written" || true) | awk '{s += $NF} END {print s + 0}')"
  fi
  [[ "$ec" -ne 0 ]] && rows="fehler"
  echo "${visible:-?}|${rows}|${check:-?}"
}

# Hilfe fuer die Ablehnungs-Zeilen: "sichtbar>0, 0 Zeilen oder Fehler, Wert unveraendert" -> "abgelehnt".
a11_denied_verdict() {
  local result="$1" unchanged_value="$2"
  local visible rows check
  IFS='|' read -r visible rows check <<<"$result"
  if [[ "$visible" =~ ^[0-9]+$ && "$visible" -gt 0 && ( "$rows" == "0" || "$rows" == "fehler" ) && "$check" == "$unchanged_value" ]]; then
    echo "abgelehnt"
  else
    echo "nicht-abgelehnt(sichtbar=$visible,zeilen=$rows,wert=$check)"
  fi
}

a11_allowed_verdict() {
  local result="$1" expected_rows="$2" expected_value="$3"
  local visible rows check
  IFS='|' read -r visible rows check <<<"$result"
  if [[ "$rows" == "$expected_rows" && "$check" == "$expected_value" ]]; then
    echo "gelingt"
  else
    echo "gelingt-nicht(sichtbar=$visible,zeilen=$rows,wert=$check)"
  fi
}
