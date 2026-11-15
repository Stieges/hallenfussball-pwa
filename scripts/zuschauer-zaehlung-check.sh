#!/usr/bin/env bash
#
# zuschauer-zaehlung-check.sh -- Container-Beweis fuer supabase/migrations/20261124_003_zuschauer_zaehlung.sql
# (Zuschauer-Seite zaehlen, intern, Stufe 1: @RZ-024, @RZ-025, @RZ-028, @RZ-030; Record
# docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md). Muster: gatherings-check.sh (Wegwerf-Container
# supabase/postgres, Baseline + Migrationen seit Baseline, trap). Ohne PostgREST: die Rollen anon/authenticated
# werden per SET ROLE gespielt (dieselben Rechte wie ueber die Schnittstelle).
#
#   bash scripts/zuschauer-zaehlung-check.sh                 normaler Lauf, Exit 0 nur ohne Abweichung
#   bash scripts/zuschauer-zaehlung-check.sh --without-migration   Gegenprobe: ohne die Migration muessen Z, R rot sein
#   bash scripts/zuschauer-zaehlung-check.sh --gegenprobe    je Mutation ein Lauf; Exit 0 nur, wenn JEDE eine Pruefung rot macht
#
# Betriebsnotiz (live seit 2026-11-24): Schalter am Turniertag
# Zaehlung abstellen, ohne Zahlen zu verlieren:
#   REVOKE EXECUTE ON FUNCTION public.count_public_view(text,text,text,text,boolean) FROM anon, authenticated;
# Der Client bleibt dabei still (401/404 wird verschluckt, durch Test belegt). Wieder einschalten:
#   GRANT EXECUTE ON FUNCTION public.count_public_view(text,text,text,text,boolean) TO anon, authenticated;
# ACHTUNG: Das REVOKE laesst die Zusicherung "zuschauer-zaehlung-rpc-definer-anon" auf f springen; der naechtliche
# Drift-Check auf main wird dann rot, bis das GRANT wieder gesetzt ist.
#
# Aendert NICHTS an der Produktionsdatenbank und nichts am lokalen Supabase-Stack: eigener Container, am Ende entfernt.
set -euo pipefail

MODE="normal"
case "${1:-}" in
  "") ;;
  --without-migration) MODE="without-migration" ;;
  --gegenprobe) MODE="gegenprobe" ;;
  *) echo "::error::Unbekannte Option: $1" >&2; exit 2 ;;
esac

POSTGRES_IMAGE="supabase/postgres:17.6.1.063"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BASELINE_FILE="$MIGRATIONS_DIR/00000000000000_baseline_live_schema.sql"
TARGET_NAME="20261124_003_zuschauer_zaehlung.sql"
TARGET_FILE="$MIGRATIONS_DIR/$TARGET_NAME"
ROLLBACK_FILE="$REPO_ROOT/supabase/rollbacks/20261124_003_zuschauer_zaehlung_rollback.sql"
C="zaehlung-check-$$-db"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/zaehlung-check.XXXXXX")"
[[ -f "$TARGET_FILE" ]] || { echo "::error::$TARGET_NAME fehlt." >&2; exit 1; }

source "$REPO_ROOT/scripts/lib/migrations-since-baseline.sh"
# Spaetere Migration mit eigenem Harness (hallenton-check.sh): sie aendert hall_speaker_heartbeat und stuende nach dem Rueckweg als
# Unterschied zu "vorher" da (Pruefung R "Schema wie vorher"); hier ohne Belang, weil sie die Zaehlung nicht beruehrt.
OWN_HARNESS_LATER="20261125_001_hallenton_ausgang_zustaende.sql"
BEFORE=()
AFTER=()
SEEN=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if [[ "$(basename "$line")" == "$TARGET_NAME" ]]; then SEEN=1
  elif [[ "$SEEN" -eq 0 ]]; then BEFORE+=("$line")
  elif [[ "$(basename "$line")" == "$OWN_HARNESS_LATER" ]]; then :
  else AFTER+=("$line"); fi
done <<< "$(migrations_newer_than_baseline "$MIGRATIONS_DIR" "$BASELINE_FILE")"
[[ "$SEEN" -eq 1 ]] || { echo "::error::$TARGET_NAME nicht in der Liste 'neuer als Baseline'." >&2; exit 1; }

cleanup() {
  local rc=$?
  docker rm -f "$C" >/dev/null 2>&1 || true
  rm -rf "$WORK"
  exit "$rc"
}
trap cleanup EXIT

psql_stdin() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -v ON_ERROR_STOP=1 -q "$@"; }
q() {
  local out
  out="$(docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -q -tA -v ON_ERROR_STOP=0 2>&1 <<<"$1" || true)"
  if grep -q '^ERROR' <<<"$out"; then grep -m1 '^ERROR' <<<"$out"; else tail -1 <<<"$out"; fi
}
as_role() { q "SET ROLE $1; $2"; }  # letzte Ausgabezeile des Aufrufers
schema_dump() { docker exec "$C" pg_dump -U postgres --schema-only --schema=public postgres | grep -vE '^\\(un)?restrict '; }

CATS=(Z S R)   # Z zaehlen/nicht zaehlen, S Schema/Rechte, R Rueckweg/idempotent
DEVS=(0 0 0)
OKS=(0 0 0)
cat_index() { local i; for i in "${!CATS[@]}"; do [[ "${CATS[$i]}" == "$1" ]] && { echo "$i"; return 0; }; done; exit 2; }
check() { # check <Kategorie> <Name> <erwartet> <erhalten>
  local i; i="$(cat_index "$1")"
  if [[ "$3" == "$4" ]]; then
    OKS[i]=$((OKS[i] + 1)); [[ "${QUIET:-0}" == "1" ]] || echo "OK          [$1] $2"
  else
    DEVS[i]=$((DEVS[i] + 1)); echo "ABWEICHUNG  [$1] $2"; echo "    erwartet: $3"; echo "    erhalten: ${4:0:300}"
  fi
}
total_dev() { local s=0 d; for d in "${DEVS[@]}"; do s=$((s + d)); done; echo "$s"; }
reset_counts() { DEVS=(0 0 0); OKS=(0 0 0); }

U='00000000-0000-4000-8000-0000000000a1'
T_PUB='00000000-0000-4000-8000-0000000000b1'
T_PRIV='00000000-0000-4000-8000-0000000000b2'
T_TRASH='00000000-0000-4000-8000-0000000000b3'
T_FIN='00000000-0000-4000-8000-0000000000b4'

prepare() {
  docker run -d --name "$C" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
  local ready=0
  for _ in $(seq 1 90); do
    if [[ "$(docker logs "$C" 2>&1 | grep -c "database system is ready to accept connections" || true)" -ge 2 ]]; then ready=1; break; fi
    sleep 1
  done
  [[ "$ready" -eq 1 ]] || { echo "::error::Container nicht bereit." >&2; exit 1; }
  for _ in $(seq 1 30); do docker exec "$C" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
  echo "Baseline + ${#BEFORE[@]} Migrationen vor $TARGET_NAME einspielen ..." >&2
  psql_stdin < "$BASELINE_FILE" >/dev/null
  local f; for f in "${BEFORE[@]}"; do psql_stdin < "$f" >/dev/null; done
  docker exec -i -e PGPASSWORD=postgres "$C" psql -h localhost -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 \
    <<<"ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;"
  psql_stdin <<SQL
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '$U', 'authenticated', 'authenticated', 'olli@zaehlung.test', 'x', now(), '{}', '{}', now(), now());
SQL
  schema_dump > "$WORK/schema_vorher.sql"
}

seed_tournaments() {
  psql_stdin <<SQL
DELETE FROM public.tournaments WHERE id IN ('$T_PUB', '$T_PRIV', '$T_TRASH', '$T_FIN');
INSERT INTO public.tournaments (id, owner_id, title, date, start_time, number_of_teams, number_of_fields, group_phase_duration,
                                location_name, location_city, status, is_public, share_code, config, deleted_at)
VALUES ('$T_PUB',   '$U', 'Nikolaus-Turnier', current_date, '09:00', 2, 1, 10, 'Halle', 'Waging', 'published', true,  'NIKO26', '{"publishedAt":"2026-11-01T00:00:00.000Z"}', NULL),
       ('$T_PRIV',  '$U', 'Privat',           current_date, '09:00', 2, 1, 10, 'Halle', 'Waging', 'published', false, 'PRIV01', '{}', NULL),
       ('$T_TRASH', '$U', 'Papierkorb',       current_date, '09:00', 2, 1, 10, 'Halle', 'Waging', 'published', true,  'TRASH1', '{"publishedAt":"2026-11-01T00:00:00.000Z"}', now()),
       ('$T_FIN',   '$U', 'Abgeschlossen',    current_date, '09:00', 2, 1, 10, 'Halle', 'Waging', 'published', true,  'FIN001', '{"publishedAt":"2026-11-01T00:00:00.000Z"}', NULL);
-- Abschluss wie in der Server-Funktion finish_tournament: Schalter app.lifecycle_write (transaktionslokal, nur ausserhalb der Client-Rollen)
BEGIN;
SET LOCAL app.lifecycle_write = 'on';
UPDATE public.tournaments SET lifecycle_status = 'finished', finished_at = now() WHERE id = '$T_FIN';
COMMIT;
SQL
}
apply_target() { # <datei|leer>
  if [[ -n "$1" ]]; then psql_stdin < "$1" >/dev/null; fi
  local f; for f in ${AFTER[@]+"${AFTER[@]}"}; do psql_stdin < "$f" >/dev/null; done
}

count() { q "SELECT $2 FROM public.public_view_counts WHERE tournament_id = '$1';"; }
zaehle() { as_role "${6:-anon}" "SELECT 1 FROM (SELECT public.count_public_view('$1', '$2', '$3', '$4', $5)) x;" >/dev/null; }

run_checks() {
  local ROW="coalesce(sum(views),0) || '/' || coalesce(sum(heartbeats),0) || '/' || count(*)"
  seed_tournaments
  q "TRUNCATE public.public_view_counts;" >/dev/null

  # @RZ-024 Aufruf zaehlt, je Beispielzeile eine Kombination
  zaehle NIKO26 aufruf qr handy false
  check Z "@RZ-024 Aufruf (QR, Handy, nicht installiert) zaehlt eine Summe" "1/0/1" "$(count $T_PUB "$ROW")"
  check Z "@RZ-024 Zeile traegt Kanal qr, Geraeteart handy, installiert false" "qr|handy|false" \
    "$(q "SELECT channel||'|'||device_class||'|'||installed FROM public.public_view_counts WHERE tournament_id='$T_PUB';")"
  zaehle NIKO26 aufruf qr handy false authenticated
  check Z "@RZ-024 derselbe Schluessel im Fenster erhoeht die Summe (auch fuer authenticated), keine zweite Zeile" "2/0/1" "$(count $T_PUB "$ROW")"
  zaehle NIKO26 aufruf link gross false
  zaehle NIKO26 aufruf direkt handy true
  zaehle NIKO26 aufruf irgendwas tablet false
  check Z "@RZ-024 vier Beispielzeilen = vier Schluessel" "5/0/4" "$(count $T_PUB "$ROW")"
  check Z "@RZ-024 unbekannter Kanal wird direkt, Tablet bleibt Tablet" "direkt|tablet|false" \
    "$(q "SELECT channel||'|'||device_class||'|'||installed FROM public.public_view_counts WHERE tournament_id='$T_PUB' AND device_class='tablet';")"
  zaehle niko26 aufruf direkt handy false
  check Z "@RZ-024 Code in Kleinbuchstaben gilt wie die Zuschauer-Adresse (normalisiert)" "6/0/5" "$(count $T_PUB "$ROW")"

  # @RZ-025 Lebenszeichen
  zaehle NIKO26 lebenszeichen qr handy false
  check Z "@RZ-025 Lebenszeichen zaehlt in derselben Zeile als heartbeats, nicht als Aufruf" "6/1/5" "$(count $T_PUB "$ROW")"

  # Abgeschlossenes Turnier: Zuschauer sehen den Endstand weiter an, also zaehlt der Aufruf weiter (kein Sperr-Trigger, kein Abweisen)
  check Z "Vorbedingung: das Turnier FIN001 ist abgeschlossen (lifecycle_status finished)" "finished" \
    "$(q "SELECT lifecycle_status FROM public.tournaments WHERE id = '$T_FIN';")"
  zaehle FIN001 aufruf qr handy false
  zaehle FIN001 lebenszeichen qr handy false
  check Z "@RZ-024 abgeschlossenes Turnier (finished): Aufruf und Lebenszeichen zaehlen weiter, ohne Fehler" "1/1/1" "$(count $T_FIN "$ROW")"
  check Z "abgeschlossenes Turnier: kein Fehler 55000 fuer anon" "1" \
    "$(as_role anon "SELECT 1 FROM (SELECT public.count_public_view('FIN001','aufruf','link','tablet',false)) x;")"

  # Fenster
  check Z "@RZ-024 Fensterbeginn liegt auf voller 5-Minuten-Marke (kein genauerer Zeitpunkt)" "0" \
    "$(q "SELECT count(*) FILTER (WHERE (extract(epoch FROM window_start)::bigint % 300) <> 0) FROM public.public_view_counts;")"

  # @RZ-028 nicht gezaehlt
  q "TRUNCATE public.public_view_counts;" >/dev/null
  zaehle PRIV01 aufruf qr handy false
  zaehle TRASH1 aufruf qr handy false
  zaehle NOPE99 aufruf qr handy false
  zaehle NIKO26 aufruf qr smartwatch false
  zaehle NIKO26 anderes qr handy false
  zaehle "" aufruf qr handy false
  zaehle "NIKO26;DROP" aufruf qr handy false
  check Z "@RZ-028 nicht oeffentliches Turnier, Papierkorb, unbekannter Code, falsche Geraeteart/Art, leerer/zu langer Code: nichts gezaehlt" "0" \
    "$(q "SELECT count(*) FROM public.public_view_counts;")"
  check Z "@RZ-028 unbekannter Code wirft keinen Fehler (still)" "1" \
    "$(as_role anon "SELECT 1 FROM (SELECT public.count_public_view('NOPE99','aufruf','qr','handy',false)) x;")"
  check Z "@RZ-024 unbekannte Geraeteart und unbekannte Art werden ohne Fehler abgelehnt" "1|1" \
    "$(as_role anon "SELECT (SELECT 1 FROM (SELECT public.count_public_view('NIKO26','aufruf','qr','smartwatch',false)) x) || '|' || (SELECT 1 FROM (SELECT public.count_public_view('NIKO26','anderes','qr','handy',false)) y);")"
  check Z "@RZ-028 NULL-Werte werfen keinen Fehler" "1" \
    "$(as_role anon "SELECT 1 FROM (SELECT public.count_public_view(NULL,NULL,NULL,NULL,NULL)) x;")"
  zaehle NIKO26 aufruf qr handy NULL
  check Z "installiert NULL zaehlt als nein" "f" "$(q "SELECT installed FROM public.public_view_counts WHERE tournament_id='$T_PUB';")"

  # @RZ-030 niemand liest ueber die Schnittstelle
  check S "@RZ-030 anon kann die Tabelle nicht lesen" "ERROR:  permission denied for table public_view_counts" \
    "$(as_role anon "SELECT count(*) FROM public.public_view_counts;")"
  check S "@RZ-030 authenticated kann die Tabelle nicht lesen" "ERROR:  permission denied for table public_view_counts" \
    "$(as_role authenticated "SELECT count(*) FROM public.public_view_counts;")"
  check S "@RZ-030 anon kann nicht schreiben" "ERROR:  permission denied for table public_view_counts" \
    "$(as_role anon "INSERT INTO public.public_view_counts VALUES ('$T_PUB', now(), 'qr', 'handy', false, 99, 99);")"
  check S "@RZ-030 anon kann Zahlen nicht aendern oder loeschen" "ERROR:  permission denied for table public_view_counts" \
    "$(as_role anon "DELETE FROM public.public_view_counts;")"
  check S "RLS ist an, keine Policy auf der Tabelle" "true|0" \
    "$(q "SELECT relrowsecurity || '|' || (SELECT count(*) FROM pg_policies WHERE tablename='public_view_counts') FROM pg_class WHERE oid='public.public_view_counts'::regclass;")"
  check S "Funktion: SECURITY DEFINER, fester search_path, nur anon/authenticated/service_role duerfen sie rufen" "true|{\"search_path=public, pg_temp\"}|true|true|false" \
    "$(q "SELECT prosecdef || '|' || proconfig::text || '|' || has_function_privilege('anon', oid, 'EXECUTE') || '|' || has_function_privilege('authenticated', oid, 'EXECUTE') || '|' || has_function_privilege('public', oid, 'EXECUTE') FROM pg_proc WHERE oid = to_regprocedure('public.count_public_view(text,text,text,text,boolean)');")"
  check S "Funktion gibt nichts zurueck (void)" "void" "$(q "SELECT prorettype::regtype FROM pg_proc WHERE proname='count_public_view';")"
  check S "Tabelle traegt keine Spalte fuer IP, Kennung oder genauen Zeitpunkt" "tournament_id,window_start,channel,device_class,installed,views,heartbeats" \
    "$(q "SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='public_view_counts';")"

  # @RZ-030 letzte Zeile: endgueltiges Loeschen nimmt die Zahlen mit; Papierkorb nicht
  q "TRUNCATE public.public_view_counts;" >/dev/null
  zaehle NIKO26 aufruf qr handy false
  q "UPDATE public.tournaments SET deleted_at = now() WHERE id = '$T_PUB';" >/dev/null
  check Z "Papierkorb (deleted_at) laesst die bisherigen Zahlen stehen" "1" "$(q "SELECT count(*) FROM public.public_view_counts;")"
  zaehle NIKO26 aufruf qr handy false
  check Z "im Papierkorb zaehlt nichts mehr dazu" "1" "$(q "SELECT sum(views) FROM public.public_view_counts;")"
  q "DELETE FROM public.tournaments WHERE id = '$T_PUB';" >/dev/null
  check Z "@RZ-030 endgueltiges Loeschen des Turniers loescht seine Zahlen" "0" "$(q "SELECT count(*) FROM public.public_view_counts;")"

  # Rechte-Assertionen: db_privilege_assertions.sql vollstaendig als ci_schema_reader, jede Zeile |t (darunter die zwei neuen;
  # die Ausnahme in lifecycle-guard-triggers-complete haengt an ihnen)
  local priv red own
  priv="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } \
    | docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 2>&1 || true)"
  # Die zwei hallenton-*-Zeilen von 20261125_001 sind hier ausser Betracht (Migration laeuft in hallenton-check.sh, siehe OWN_HARNESS_LATER)
  red="$( (grep -v '|t$' <<<"$priv" | grep -vE '^hallenton-(output-states-heartbeat|speaker-unassign-rpc-authenticated-only)\|f$' || true) | head -5 | tr '\n' ';')"
  own="$( (grep -E '^zuschauer-zaehlung-[a-z-]+\|t$' <<<"$priv" || true) | grep -c . || true)"
  check S "db_privilege_assertions.sql als ci_schema_reader: jede Zeile |t, darunter die zwei zuschauer-zaehlung-*" "keine|2" "${red:-keine}|$own"
}

run_rueckweg() {
  check R "zweites Einspielen der Migration laeuft sauber (idempotent)" "0" "$(psql_stdin < "$TARGET_FILE" >/dev/null 2>&1; echo $?)"
  check R "Rueckweg laeuft sauber" "0" "$(psql_stdin < "$ROLLBACK_FILE" >/dev/null 2>&1; echo $?)"
  schema_dump > "$WORK/schema_nachher.sql"
  check R "nach dem Rueckweg ist das Schema wie vorher" "" "$(diff "$WORK/schema_vorher.sql" "$WORK/schema_nachher.sql" || true)"
  check R "nach dem Rueckweg gibt es weder Tabelle noch Funktion" "||" \
    "$(q "SELECT coalesce(to_regclass('public.public_view_counts')::text,'') || '|' || coalesce(to_regprocedure('public.count_public_view(text,text,text,text,boolean)')::text,'') || '|';")"
  psql_stdin < "$TARGET_FILE" >/dev/null   # wieder herstellen
}

summary() { local i; echo ""; for i in "${!CATS[@]}"; do echo "[${CATS[$i]}] ${OKS[$i]} ok, ${DEVS[$i]} Abweichung(en)"; done; }

# Mutationen (Gegenprobe): jede muss mindestens eine Pruefung rot machen. sed-Ausdruecke auf Kopien der Migration.
MUTATIONEN=(
  "M1|s/AND t.deleted_at IS NULL;/;/"
  "M2|s/coalesce(t.is_public, false) AND //"
  "M3|s/ON DELETE CASCADE/ON DELETE NO ACTION/"
  "M4|s/GRANT SELECT ON TABLE public.public_view_counts TO service_role;/GRANT SELECT ON TABLE public.public_view_counts TO service_role, anon;/"
  "M5|s/v_kanal := CASE WHEN p_kanal IN ('qr', 'link', 'direkt') THEN p_kanal ELSE 'direkt' END;/v_kanal := coalesce(p_kanal, 'direkt');/"
  "M6|s/v_views := 0; v_beats := 1;/v_views := 1; v_beats := 1;/"
  "M7|s/date_bin('5 minutes', now(), timestamptz '2000-01-01 00:00:00+00')/now()/"
  "M8|s/IF v_id IS NULL THEN RETURN; END IF;/IF v_id IS NULL THEN RAISE EXCEPTION 'x'; END IF;/"
  "M9|s/ALTER TABLE public.public_view_counts ENABLE ROW LEVEL SECURITY;/ALTER TABLE public.public_view_counts DISABLE ROW LEVEL SECURITY;\nGRANT SELECT ON public.public_view_counts TO anon;/"
  "M10|s/IF p_geraet IS NULL OR p_geraet NOT IN ('handy', 'tablet', 'gross') THEN RETURN; END IF;//"
  "M11|s/^COMMIT;/CREATE TRIGGER public_view_counts_guard_closed BEFORE INSERT OR UPDATE OR DELETE ON public.public_view_counts FOR EACH ROW EXECUTE FUNCTION public.guard_closed_tournament('tournament_id');\nCOMMIT;/"
  "M12|s/AND t.deleted_at IS NULL;/AND t.deleted_at IS NULL AND t.lifecycle_status <> 'finished';/"
)

prepare
case "$MODE" in
  normal)
    apply_target "$TARGET_FILE"
    run_checks
    run_rueckweg
    summary
    [[ "$(total_dev)" -eq 0 ]] || { echo "::error::$(total_dev) Abweichung(en)." >&2; exit 1; }
    echo "zuschauer-zaehlung-check: alles gruen."
    ;;
  without-migration)
    apply_target ""
    QUIET=1 run_checks
    summary
    [[ "$(total_dev)" -gt 0 ]] || { echo "::error::ohne Migration nicht rot." >&2; exit 1; }
    echo "zuschauer-zaehlung-check --without-migration: ohne die Migration rot (erwartet)."
    ;;
  gegenprobe)
    failed=0
    for m in "${MUTATIONEN[@]}"; do
      id="${m%%|*}"; expr="${m#*|}"
      q "DROP TABLE IF EXISTS public.public_view_counts CASCADE; DROP FUNCTION IF EXISTS public.count_public_view(text,text,text,text,boolean);" >/dev/null
      reset_counts
      sed "$expr" "$TARGET_FILE" > "$WORK/mutant.sql"
      if cmp -s "$TARGET_FILE" "$WORK/mutant.sql"; then echo "::error::Mutation $id aendert nichts (sed greift nicht)." >&2; failed=1; continue; fi
      if ! psql_stdin < "$WORK/mutant.sql" >/dev/null 2>"$WORK/apply.log"; then
        echo "Mutation $id: Einspielen scheitert ($(tail -1 "$WORK/apply.log")) -- gilt als rot"; continue
      fi
      QUIET=1 run_checks > "$WORK/run-$id.log" 2>&1 || true
      if [[ "$(total_dev)" -gt 0 ]]; then
        [[ -z "${ZAEHLUNG_DEBUG:-}" ]] || head -12 "$WORK/run-$id.log"
        echo "Mutation $id: rot ($(total_dev) Abweichung(en), z. B. $(grep -m1 '^ABWEICHUNG' "$WORK/run-$id.log" || echo '?'))"
      else
        echo "::error::Mutation $id bleibt gruen -- keine Pruefung faengt sie." >&2; failed=1
      fi
    done
    [[ "$failed" -eq 0 ]] || exit 1
    echo "zuschauer-zaehlung-check --gegenprobe: jede Mutation faerbt mindestens eine Pruefung rot."
    ;;
esac
