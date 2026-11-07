# shellcheck shell=bash
#
# gatherings-check.d/30-schema.sh — Kategorien S (Schema und Rechte), W (zweites Einspielen) und X (Rueckweg, Fail-fast).
# X laeuft nicht in der Gegenprobe (SKIP_X=1), weil es die Datenbank zuruecksetzt.

fn_ok() { # fn_ok <regprocedure> <definer t|f> -> t, wenn SECURITY DEFINER wie erwartet und search_path fest
  q "SELECT coalesce((SELECT p.prosecdef = '$2'::boolean AND p.proconfig = ARRAY['search_path=public, pg_temp']
                         FROM pg_proc p WHERE p.oid = to_regprocedure('$1')), false);"
}
for f in "public.has_gathering_permission(uuid,text):t" "public.create_gathering(text):t" "public.rename_gathering(uuid,text):t" \
         "public.delete_gathering(uuid):t" "public.set_gathering_tournaments(uuid,uuid[],uuid[]):t" "public.public_gathering(text):t" \
         "public.tournaments_touch_gathering():t" "public.tournaments_protect_gathering_id():f" "public.gathering_members_guard():f" \
         "public.gathering_name_or_fail(text):f"; do
  check S "${f%:*}: SECURITY $([[ "${f##*:}" == t ]] && echo DEFINER || echo INVOKER), search_path = public, pg_temp" "t" "$(fn_ok "${f%:*}" "${f##*:}")"
done
exec_of() { q "SELECT coalesce((SELECT string_agg(r || '=' || has_function_privilege(r, '$1', 'EXECUTE')::text, ',' ORDER BY r)
                                  || ',public=' || EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = to_regprocedure('$1') AND a.grantee = 0)::text
                                  FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r
                                 WHERE to_regprocedure('$1') IS NOT NULL), 'fehlt');"; }
for f in "public.has_gathering_permission(uuid,text)" "public.create_gathering(text)" "public.rename_gathering(uuid,text)" \
         "public.delete_gathering(uuid)" "public.set_gathering_tournaments(uuid,uuid[],uuid[])"; do
  check S "$f: EXECUTE nur authenticated" "anon=false,authenticated=true,service_role=false,public=false" "$(exec_of "$f")"
done
check S "public_gathering: EXECUTE anon, authenticated, service_role (nicht PUBLIC)" \
  "anon=true,authenticated=true,service_role=true,public=false" "$(exec_of "public.public_gathering(text)")"
for f in "public.tournaments_touch_gathering()" "public.tournaments_protect_gathering_id()" "public.gathering_members_guard()" \
         "public.gathering_name_or_fail(text)"; do
  check S "$f: kein EXECUTE fuer Client-Rollen" "anon=false,authenticated=false,service_role=false,public=false" "$(exec_of "$f")"
done
tab_privs() { q "SELECT coalesce((SELECT string_agg(r || ':' || concat_ws('',
                  CASE WHEN has_table_privilege(r, '$1', 'SELECT') THEN 'S' END, CASE WHEN has_table_privilege(r, '$1', 'INSERT') THEN 'I' END,
                  CASE WHEN has_table_privilege(r, '$1', 'UPDATE') THEN 'U' END, CASE WHEN has_table_privilege(r, '$1', 'DELETE') THEN 'D' END,
                  CASE WHEN has_table_privilege(r, '$1', 'TRUNCATE') THEN 'T' END, CASE WHEN has_table_privilege(r, '$1', 'MAINTAIN') THEN 'M' END), ',' ORDER BY r)
                  FROM unnest(ARRAY['anon', 'authenticated', 'ci_schema_reader']) AS r WHERE to_regclass('$1') IS NOT NULL), 'fehlt');"; }
check S "gatherings: anon nichts, authenticated nur SELECT, ci_schema_reader SELECT" "anon:,authenticated:S,ci_schema_reader:S" "$(tab_privs public.gatherings)"
check S "gathering_members: anon/authenticated nichts, ci_schema_reader SELECT" "anon:,authenticated:,ci_schema_reader:S" "$(tab_privs public.gathering_members)"
check S "RLS an (beide), genau eine Policy (gatherings_select, nur authenticated, readGathering), keine auf gathering_members" \
  "true|true|gatherings_select:{authenticated}:true" \
  "$(q "SELECT coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.gatherings')), 'fehlt') || '|' ||
              coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.gathering_members')), 'fehlt') || '|' ||
              coalesce((SELECT string_agg(policyname || ':' || roles::text || ':' || (qual LIKE '%has_gathering_permission(id, ''readGathering''::text)%')::text, ',')
                          FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('gatherings', 'gathering_members')), 'keine');")"
check S "Trigger aktiv: protect (BEFORE INSERT/UPDATE), touch (AFTER UPDATE OF deleted_at, AFTER DELETE), members_guard, updated_at" \
  "gathering_members_guard,gatherings_updated_at,tournaments_protect_gathering_id,tournaments_touch_gathering_delete,tournaments_touch_gathering_trash" \
  "$(q "SELECT coalesce(string_agg(tgname, ',' ORDER BY tgname), 'keine') FROM pg_trigger WHERE NOT tgisinternal AND tgenabled = 'O'
          AND tgname IN ('gathering_members_guard', 'gatherings_updated_at', 'tournaments_protect_gathering_id',
                         'tournaments_touch_gathering_delete', 'tournaments_touch_gathering_trash');")"
check S "FK tournaments.gathering_id -> gatherings ON DELETE SET NULL" "f:n" \
  "$(q "SELECT coalesce((SELECT contype::text || ':' || confdeltype::text FROM pg_constraint WHERE conrelid = 'public.tournaments'::regclass
          AND confrelid = to_regclass('public.gatherings')), 'fehlt');")"
# Woertlich uebernommen (GATE 2 Nr. 1, Nr. 16): ohne die markierten Ergaenzungen ist der Text md5-gleich mit dem Bestand.
check S "tournaments_guard_lifecycle = Fassung 20261113_003 + nur gathering_id in c_free" "a7ce4fa88b5e62997bf26bcecdfc9a0a" \
  "$(q "SELECT md5(replace(replace(prosrc, E'  -- 20261119_001 (@VA-019, @VA-015): gathering_id frei -- Zuordnen, Loesen und Loeschen der Veranstaltung auch nach dem Abschluss.\n', ''),
                           ', ''gathering_id''];', '];')) FROM pg_proc WHERE oid = 'public.tournaments_guard_lifecycle()'::regprocedure;")"
check S "public_view.public_payload = Fassung 20261117_104 + nur der Block gathering_code" "9a606911268600767bd20c5ad7e6f66d" \
  "$(q "SELECT md5(regexp_replace(prosrc, E'      -- 20261119_001 \\\\(@VA-013, @VA-014\\\\)[^\n]*\n      ''gathering_code''[^\n]*\n[^\n]*END,\n', ''))
          FROM pg_proc WHERE oid = 'public_view.public_payload(uuid,bigint,text,text)'::regprocedure;")"
check S "public_view: weiter 12 Funktionen im Sicherheitskern, keine neue (public-read-core-unchanged zieht nur die md5 nach)" \
  "12|7544746eff25aabcb93314c5c159b56a" \
  "$(q "SELECT count(*) || '|' || md5(string_agg(pg_get_functiondef(p.oid), E'\n' ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)))
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public_view' OR p.oid IN (to_regprocedure('public.public_tournament(text,bigint)'),
               to_regprocedure('public.display_tournament(uuid,text,bigint)'), to_regprocedure('public.is_reading_member(uuid)'));")"
check S "Bestand: kein Turnier gehoert nach dem Einspielen zu einer Veranstaltung" "0" \
  "$(q "SELECT count(*) FROM public.tournaments WHERE (to_jsonb(tournaments) ->> 'gathering_id') IS NOT NULL;")"

# Rechte-Assertions des Drift-Checks (scripts/db_privilege_assertions.sql) als ci_schema_reader, wie live (Review #449 🔴1):
# jede Zeile "|t", darunter die fuenf gatherings-* und public-read-core-unchanged.
PRIV_OUT="$( { echo "GRANT ci_schema_reader TO postgres; SET ROLE ci_schema_reader;"; cat "$REPO_ROOT/scripts/db_privilege_assertions.sql"; } \
  | docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -X -q -tA -v ON_ERROR_STOP=1 2>&1 || true)"
PRIV_RED="$( (grep -v '|t$' <<<"$PRIV_OUT" || true) | head -5 | tr '\n' ';')"
PRIV_GA="$( (grep -E '^(gatherings-[a-z-]+|public-read-core-unchanged)\|t$' <<<"$PRIV_OUT" || true) | grep -c . || true)"
check S "db_privilege_assertions.sql als ci_schema_reader: jede Zeile |t (gatherings-* und public-read-core-unchanged dabei)" \
  "keine|6" "${PRIV_RED:-keine}|$PRIV_GA"

# --- W: zweites Einspielen -------------------------------------------------------------------------------------------
if [[ "${WITH_MIGRATION:-1}" -eq 1 ]]; then
  schema_dump > "$WORK/schema_nach1.sql"
  if psql_stdin < "${MUTANT_FILE:-$TARGET_FILE}" >/dev/null 2>"$WORK/w.err"; then w="ok"; else w="fehler: $(tail -2 "$WORK/w.err")"; fi
  schema_dump > "$WORK/schema_nach2.sql"
  # Sortiert verglichen: nach REVOKE/GRANT kann pg_dump die Rechte-Zeilen einer Tabelle in anderer Reihenfolge ausgeben.
  sort "$WORK/schema_nach1.sql" > "$WORK/schema_nach1.sorted"; sort "$WORK/schema_nach2.sql" > "$WORK/schema_nach2.sorted"
  check W "zweites Einspielen ohne Fehler, Schema unveraendert" "ok|gleich" \
    "$w|$(diff -q "$WORK/schema_nach1.sorted" "$WORK/schema_nach2.sorted" >/dev/null && echo gleich || { diff "$WORK/schema_nach1.sorted" "$WORK/schema_nach2.sorted" | head -20; echo verschieden; })"
fi

# --- X: Rueckweg und Fail-fast -----------------------------------------------------------------------------------------
if [[ "${SKIP_X:-0}" -ne 1 && "${WITH_MIGRATION:-1}" -eq 1 ]]; then
  stop_rest
  # Fail-fast (Review #449 🟡3): eine spaetere Fassung des Waechters, die den Stempel 20261119_001 traegt, aber einen anderen
  # Text hat -> erneutes Einspielen bricht ab, statt sie still zurueckzudrehen.
  q "SELECT pg_get_functiondef('public.tournaments_guard_lifecycle()'::regprocedure);" > "$WORK/guard_eigen.sql"
  psql_stdin <<<"$(sed 's/^BEGIN$/BEGIN -- 20261119_001 spaetere Fassung/' "$WORK/guard_eigen.sql");" >/dev/null
  check X "Fail-fast: Waechter mit Stempel 20261119_001, aber fremdem Text -> erneutes Einspielen bricht ab" "abgebrochen|unbekannte Fassung" \
    "$(psql_stdin < "$TARGET_FILE" >/dev/null 2>"$WORK/f0.err" && echo gelaufen || echo abgebrochen)|$(grep -o 'unbekannte Fassung' "$WORK/f0.err" | head -1)"
  psql_stdin <<<"$(cat "$WORK/guard_eigen.sql");" >/dev/null
  # Spaetere Migrationen (AFTER, z. B. 20261121_001_hallenton) zuerst ueber ihren eigenen Rueckweg zurueck, in umgekehrter
  # Reihenfolge -- sonst enthaelt "zurueck" deren Objekte und der Vergleich mit "vorher" ist per Konstruktion rot.
  x="ok"
  for (( i=${#AFTER[@]}-1; i>=0; i-- )); do
    rb="$REPO_ROOT/supabase/rollbacks/$(basename "${AFTER[$i]}" .sql)_rollback.sql"
    if [[ ! -f "$rb" ]]; then x="fehler: Rueckweg fehlt fuer $(basename "${AFTER[$i]}")"; break; fi
    psql_stdin < "$rb" >/dev/null 2>"$WORK/xa.err" || { x="fehler: $(basename "$rb"): $(tail -2 "$WORK/xa.err")"; break; }
  done
  if [[ "$x" == "ok" ]]; then
    if psql_stdin < "$ROLLBACK_FILE" >/dev/null 2>"$WORK/x.err"; then x="ok"; else x="fehler: $(tail -2 "$WORK/x.err")"; fi
  fi
  schema_dump > "$WORK/schema_zurueck.sql"
  check X "Rueckweg laeuft in einem Block, Schema (public, public_view) = vor der Migration" "ok|gleich" \
    "$x|$(diff -q "$WORK/schema_vorher.sql" "$WORK/schema_zurueck.sql" >/dev/null && echo gleich || { diff "$WORK/schema_vorher.sql" "$WORK/schema_zurueck.sql" | head -20; echo verschieden; })"
  check X "Rueckweg ein zweites Mal: bricht ohne Aenderung ab" "abgebrochen" \
    "$(psql_stdin < "$ROLLBACK_FILE" >/dev/null 2>&1 && echo gelaufen || echo abgebrochen)"
  # Fail-fast: eine fremde Fassung des Waechters (hier: ein Kommentar mehr) -> Migration bricht ohne Aenderung ab.
  q "SELECT pg_get_functiondef('public.tournaments_guard_lifecycle()'::regprocedure);" > "$WORK/guard_def.sql"
  psql_stdin <<<"$(sed 's/^BEGIN$/BEGIN -- fremde Fassung/' "$WORK/guard_def.sql");" >/dev/null
  check X "Fail-fast: tournaments_guard_lifecycle in fremder Fassung -> Abbruch 'unbekannte Fassung', nichts angelegt" "abgebrochen|unbekannte Fassung|f" \
    "$(psql_stdin < "$TARGET_FILE" >/dev/null 2>"$WORK/f.err" && echo gelaufen || echo abgebrochen)|$(grep -o 'unbekannte Fassung' "$WORK/f.err" | head -1)|$(q "SELECT to_regclass('public.gatherings') IS NOT NULL;")"
fi
