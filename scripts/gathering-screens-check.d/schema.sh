# shellcheck shell=bash
#
# gathering-screens-check.d/schema.sh — Kategorien S (Schema und Rechte), W (zweites Einspielen) und X (Rueckweg, Fail-fast).
# Laeuft als letzter Teil (X setzt die Datenbank zurueck). W entfaellt in der Gegenprobe (SKIP_W=1), X ebenso (SKIP_X=1).

fn_ok() { # fn_ok <regprocedure> <definer t|f> -> t, wenn SECURITY DEFINER wie erwartet und search_path fest
  q "SELECT coalesce((SELECT p.prosecdef = '$2'::boolean AND p.proconfig = ARRAY['search_path=public, pg_temp']
                         FROM pg_proc p WHERE p.oid = to_regprocedure('$1')), false);"
}
API_FNS=("public.create_gathering_screen(uuid,text,jsonb,jsonb)" "public.update_gathering_screen(uuid,text,jsonb,jsonb)"
         "public.rotate_gathering_screen_key(uuid)" "public.delete_gathering_screen(uuid)"
         "public.adopt_tournament_monitor(uuid,uuid,text)" "public.set_gathering_screen_location(uuid,text)"
         "public.set_gathering_on_screen(uuid,boolean)" "public.gathering_screen_status(uuid)"
         "public.gathering_screens_overview(uuid)")
ANON_FNS=("public.gathering_screen_display(text,bigint)" "public.gathering_screen_final_standings(text)" "public.public_gathering(text)")
INTERNAL_DEFINER=("public.gathering_screen_reason(uuid,uuid)" "public.gathering_tournament_list(uuid)"
                  "public.tournaments_clear_on_screen()" "public.gathering_clear_ineligible_on_screen(uuid)"
                  "public.gathering_lock_for_screens(uuid)" "public.gathering_on_screen_for_caller(uuid)"
                  "public.gathering_screen_tournament_or_fail(uuid)" "public.gathering_public_on_screen(uuid)")
INTERNAL_INVOKER=("public.gathering_location_key(text)" "public.gathering_screen_config_check(jsonb,jsonb)"
                  "public.gathering_screen_new_key()")
for f in "${API_FNS[@]}" "${ANON_FNS[@]}" "${INTERNAL_DEFINER[@]}"; do
  check S "$f: SECURITY DEFINER, search_path = public, pg_temp" "t" "$(fn_ok "$f" t)"
done
for f in "${INTERNAL_INVOKER[@]}"; do
  check S "$f: SECURITY INVOKER, search_path = public, pg_temp" "t" "$(fn_ok "$f" f)"
done
exec_of() { q "SELECT coalesce((SELECT string_agg(r || '=' || has_function_privilege(r, '$1', 'EXECUTE')::text, ',' ORDER BY r)
                                  || ',public=' || EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = to_regprocedure('$1') AND a.grantee = 0)::text
                                  FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r
                                 WHERE to_regprocedure('$1') IS NOT NULL), 'fehlt');"; }
for f in "${API_FNS[@]}"; do
  check S "$f: EXECUTE nur authenticated" "anon=false,authenticated=true,service_role=false,public=false" "$(exec_of "$f")"
done
for f in "${ANON_FNS[@]}"; do
  check S "$f: EXECUTE anon, authenticated, service_role (nicht PUBLIC)" "anon=true,authenticated=true,service_role=true,public=false" "$(exec_of "$f")"
done
for f in "${INTERNAL_DEFINER[@]}" "${INTERNAL_INVOKER[@]}"; do
  check S "$f: kein EXECUTE fuer Client-Rollen" "anon=false,authenticated=false,service_role=false,public=false" "$(exec_of "$f")"
done
tab_privs() { q "SELECT coalesce((SELECT string_agg(r || ':' || concat_ws('',
                  CASE WHEN has_table_privilege(r, '$1', 'SELECT') THEN 'S' END, CASE WHEN has_table_privilege(r, '$1', 'INSERT') THEN 'I' END,
                  CASE WHEN has_table_privilege(r, '$1', 'UPDATE') THEN 'U' END, CASE WHEN has_table_privilege(r, '$1', 'DELETE') THEN 'D' END,
                  CASE WHEN has_table_privilege(r, '$1', 'TRUNCATE') THEN 'T' END, CASE WHEN has_table_privilege(r, '$1', 'MAINTAIN') THEN 'M' END), ',' ORDER BY r)
                  FROM unnest(ARRAY['anon', 'authenticated', 'ci_schema_reader']) AS r WHERE to_regclass('$1') IS NOT NULL), 'fehlt');"; }
check S "gathering_screens: anon/authenticated nichts, ci_schema_reader SELECT" "anon:,authenticated:,ci_schema_reader:S" "$(tab_privs public.gathering_screens)"
check S "gatherings: weiter anon nichts, authenticated nur SELECT (neue Spalten schreibt nur der Server)" "anon:,authenticated:S,ci_schema_reader:S" "$(tab_privs public.gatherings)"
check S "gathering_screens: RLS an, keine Policy" "true|0" \
  "$(q "SELECT coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.gathering_screens')), 'fehlt') || '|' ||
              (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gathering_screens');")"
check S "Trigger aktiv: tournaments_clear_on_screen (AFTER UPDATE ohne Spaltenliste), _delete (AFTER DELETE), gathering_screens_updated_at" \
  "gathering_screens_updated_at:BU,tournaments_clear_on_screen:AU,tournaments_clear_on_screen_delete:AD" \
  "$(q "SELECT coalesce(string_agg(tgname || ':' || CASE WHEN (tgtype & 2) = 2 THEN 'B' ELSE 'A' END
                                    || CASE WHEN (tgtype & 16) = 16 THEN 'U' WHEN (tgtype & 8) = 8 THEN 'D' ELSE '?' END
                                    || CASE WHEN tgattr::text <> '' THEN '(Spalten)' ELSE '' END, ',' ORDER BY tgname), 'keine')
          FROM pg_trigger WHERE NOT tgisinternal AND tgenabled = 'O'
          AND tgname IN ('tournaments_clear_on_screen', 'tournaments_clear_on_screen_delete', 'gathering_screens_updated_at');")"
check S "FK: nur gathering_screens.gathering_id -> gatherings (CASCADE); keiner der neuen Spalten auf tournaments (Abschluss-Sperre)" \
  "gathering_screens:gatherings:c" \
  "$(q "SELECT coalesce(string_agg(conrelid::regclass::text || ':' || confrelid::regclass::text || ':' || confdeltype::text, ',' ORDER BY conname), 'fehlt')
          FROM pg_constraint WHERE contype = 'f' AND (conrelid = to_regclass('public.gathering_screens')
            OR (conrelid = to_regclass('public.gatherings') AND confrelid = to_regclass('public.tournaments')));")"
# public_gathering woertlich aus 20261119_001: ohne die zwei markierten Zeilen md5-gleich mit der A1-Fassung.
q "SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.public_gathering(text)');" > "$WORK/pg_src.txt"
check S "public_gathering = Fassung 20261119_001 + nur der Block on_screen (Kennzeichen 20261120_002)" "b1e18d7eaf2714409eba33103ac47915" \
  "$(python3 -c '
import sys, re, hashlib
s = open(sys.argv[1], encoding="utf-8").read()
if s.endswith("\n"): s = s[:-1]
s2 = re.sub(r"\)\n      -- 20261120_002 \(@VA-045[^\n]*\n      \|\| coalesce\([^\n]*\);\n", ");\n", s, count=1)
print(hashlib.md5(s2.encode("utf-8")).hexdigest())' "$WORK/pg_src.txt")"
check S "Sicherheitskern (public_view.*, public_tournament, display_tournament, display_final_standings, final_standings_payload) unveraendert" \
  "$(cat "$WORK/vorher_core.txt")" "$(q "$CORE_SQL")"
check S "Bestand: keine Veranstaltung mit Turnier in der Halle, kein Bildschirm" "0|0" \
  "$(q "SELECT (SELECT count(*) FROM public.gatherings WHERE (to_jsonb(gatherings) ->> 'on_screen_tournament_id') IS NOT NULL) || '|' ||
              coalesce((SELECT count(*) FROM public.gathering_screens WHERE gathering_id NOT IN ('$GS', '$GS2'))::text, 'fehlt');")"
PRIV_OUT="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } \
  | docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 2>&1 || true)"
PRIV_RED="$( (grep -v '|t$' <<<"$PRIV_OUT" || true) | head -5 | tr '\n' ';')"
PRIV_GS="$( (grep -E '^gathering-screens-[a-z-]+\|t$' <<<"$PRIV_OUT" || true) | grep -c . || true)"
check S "db_privilege_assertions.sql als ci_schema_reader: jede Zeile |t, darunter die drei gathering-screens-*" "keine|3" "${PRIV_RED:-keine}|$PRIV_GS"

# --- W: zweites Einspielen -------------------------------------------------------------------------------------------
if [[ "${WITH_MIGRATION:-1}" -eq 1 && "${SKIP_W:-0}" -ne 1 ]]; then
  stop_rest
  schema_dump > "$WORK/schema_nach1.sql"
  if psql_stdin < "${MUTANT_FILE:-$TARGET_FILE}" >/dev/null 2>"$WORK/w.err"; then w="ok"; else w="fehler: $(tail -2 "$WORK/w.err")"; fi
  schema_dump > "$WORK/schema_nach2.sql"
  sort "$WORK/schema_nach1.sql" > "$WORK/schema_nach1.sorted"; sort "$WORK/schema_nach2.sql" > "$WORK/schema_nach2.sorted"
  check W "zweites Einspielen ohne Fehler, Schema unveraendert" "ok|gleich" \
    "$w|$(diff -q "$WORK/schema_nach1.sorted" "$WORK/schema_nach2.sorted" >/dev/null && echo gleich || { diff "$WORK/schema_nach1.sorted" "$WORK/schema_nach2.sorted" | head -20; echo verschieden; })"
fi

# --- X: Rueckweg und Fail-fast -----------------------------------------------------------------------------------------
if [[ "${SKIP_X:-0}" -ne 1 && "${WITH_MIGRATION:-1}" -eq 1 ]]; then
  stop_rest
  q "SELECT pg_get_functiondef('public.public_gathering(text)'::regprocedure);" > "$WORK/pg_eigen.sql"
  psql_stdin <<<"$(sed 's/^BEGIN$/BEGIN -- 20261120_002 spaetere Fassung/' "$WORK/pg_eigen.sql");" >/dev/null
  check X "Fail-fast: public_gathering in fremder Fassung (auch mit Stempel 20261120_002) -> erneutes Einspielen bricht ab" \
    "abgebrochen|unbekannte Fassung" \
    "$(psql_stdin < "$TARGET_FILE" >/dev/null 2>"$WORK/f0.err" && echo gelaufen || echo abgebrochen)|$(grep -o 'unbekannte Fassung' "$WORK/f0.err" | head -1)"
  check X "Rueckweg mit fremder Fassung von public_gathering: bricht ohne Aenderung ab" "abgebrochen|t" \
    "$(psql_stdin < "$ROLLBACK_FILE" >/dev/null 2>&1 && echo gelaufen || echo abgebrochen)|$(q "SELECT to_regclass('public.gathering_screens') IS NOT NULL;")"
  psql_stdin <<<"$(cat "$WORK/pg_eigen.sql");" >/dev/null
  if psql_stdin < "$ROLLBACK_FILE" >/dev/null 2>"$WORK/x.err"; then x="ok"; else x="fehler: $(tail -2 "$WORK/x.err")"; fi
  schema_dump > "$WORK/schema_zurueck.sql"
  check X "Rueckweg laeuft in einem Block, Schema (public, public_view) = vor der Migration" "ok|gleich" \
    "$x|$(diff -q "$WORK/schema_vorher.sql" "$WORK/schema_zurueck.sql" >/dev/null && echo gleich || { diff "$WORK/schema_vorher.sql" "$WORK/schema_zurueck.sql" | head -20; echo verschieden; })"
  check X "nach dem Rueckweg: public_gathering wieder genau die Fassung 20261119_001" "b1e18d7eaf2714409eba33103ac47915" \
    "$(q "SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.public_gathering(text)'::regprocedure;")"
  check X "Rueckweg ein zweites Mal: bricht ohne Aenderung ab" "abgebrochen" \
    "$(psql_stdin < "$ROLLBACK_FILE" >/dev/null 2>&1 && echo gelaufen || echo abgebrochen)"
  check X "nach dem Rueckweg laesst sich die Migration wieder einspielen" "ok" \
    "$(psql_stdin < "$TARGET_FILE" >/dev/null 2>"$WORK/x2.err" && echo ok || tail -2 "$WORK/x2.err")"
fi
