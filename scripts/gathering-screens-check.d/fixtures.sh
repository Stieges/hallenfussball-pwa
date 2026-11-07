# shellcheck shell=bash
#
# gathering-screens-check.d/fixtures.sh — Zusatzdaten und Hilfen fuer scripts/gathering-screens-check.sh (per source NACH
# scripts/gatherings-check.d/fixtures.sh, dessen Identitaeten, Turniere und Hilfen tx/try/who/rpc hier gelten).
# Testwerte aus dem Gherkin der Funktionalitaet G: Veranstaltung „Nikolausturnier“ in der Bergader SportARENA, Bildschirm
# „Halle“ mit Folien und Sponsoren; F2-, F1-, D- und E-Junioren (E abgeschlossen, D nicht geteilt).

GS="$(uuid_for gathering:nikolaus)"; GS2="$(uuid_for gathering:zweite)"
SC_HALLE="$(uuid_for screen:halle)"; SC_EINGANG="$(uuid_for screen:eingang)"
key_for() { printf '%s' "gathering-screens-check:key:$1" | shasum -a 256 | cut -c1-32; }
KEY_HALLE="$(key_for halle)"; KEY_EINGANG="$(key_for eingang)"
T_DRAFT="$(uuid_for tournament:entwurf)"; T_LOC="$(uuid_for tournament:andere-halle)"
ORT="Bergader SportARENA"
SCREEN_CONFIG='{"defaultSlideDuration":15,"transition":"fade","transitionDuration":500,"theme":"dark","performanceMode":"auto","overscanPercent":5,"secretNote":"Schluessel beim Hausmeister","slides":[{"id":"s1","type":"live","config":{"fieldId":"field-1"},"duration":null,"order":0},{"id":"s2","type":"sponsor","config":{"sponsorId":"sp-bergader"},"duration":null,"order":1}]}'
SCREEN_SPONSORS='[{"id":"sp-bergader","name":"Bergader","logoUrl":"https://example.test/bergader.png","websiteUrl":"https://example.test","tier":"gold","contact":"vertrieb@bergader.test"},{"id":"sp-unbenutzt","name":"Unbenutzt GmbH"}]'

# Grundaufbau (nur in nie festgeschriebenen Transaktionen bzw. mit Aufraeumen): Veranstaltung mit Ort, F2/F1/D/E/Entwurf/
# andere Halle zugeordnet, Bildschirm „Halle“.
SETUP_S="$(who super)
INSERT INTO public.gatherings (id, owner_id, name, share_code, screen_location_name)
VALUES ('$GS', '$U_OLLI', 'Nikolausturnier', 'HALLE1', '$ORT');
UPDATE public.tournaments SET gathering_id = '$GS' WHERE id IN ('$T_F2', '$T_F1', '$T_D', '$T_E', '$T_DRAFT', '$T_LOC');
INSERT INTO public.gathering_screens (id, gathering_id, name, screen_key, config, sponsors)
VALUES ('$SC_HALLE', '$GS', 'Halle', '$KEY_HALLE', '$SCREEN_CONFIG'::jsonb, '$SCREEN_SPONSORS'::jsonb);"
# on <turnier> -- als Superuser direkt auf die Bildschirme (Vorbereitung, nicht die geprueften Funktionen)
on_sql() { echo "$(who super) UPDATE public.gatherings SET on_screen_tournament_id = '$1', on_screen_since = now() WHERE id = '$GS';"; }
coadmin_sql() { echo "$(who super) INSERT INTO public.tournament_collaborators (tournament_id, user_id, role, accepted_at)
VALUES ('$2', '$1', 'co-admin', now());"; }

setup_screens_data() {
  psql_stdin <<SQL
INSERT INTO public.tournaments (id, owner_id, title, date, start_time, number_of_teams, number_of_fields, group_phase_duration,
                                location_name, status, is_public, share_code, config)
VALUES ('$T_DRAFT', '$U_OLLI', 'B-Junioren Entwurf', current_date + 3, '15:00', 2, 1, 10, '$ORT', 'draft', false, NULL, '{}'),
       ('$T_LOC', '$U_OLLI', 'A-Junioren andere Halle', current_date + 3, '10:00', 2, 1, 10, 'Halle Nord', 'published', true,
        'AJUNIO', '{"publishedAt":"2026-11-01T00:00:00.000Z"}');
SQL
}

# Antworten vor dieser Migration (Kategorie T): Zuschauer- und Monitor-Antwort, Endstand, public_gathering ohne Bildschirme.
GV_SETUP="$(who super)
INSERT INTO public.gatherings (id, owner_id, name, share_code) VALUES ('$GS2', '$U_OLLI', 'Vergleich', 'VERGL1');
UPDATE public.tournaments SET gathering_id = '$GS2' WHERE id IN ('$T_F2', '$T_F1', '$T_E');
INSERT INTO public.tournament_final_standings (tournament_id, snapshot, finished_at, finished_by, request_id)
VALUES ('$T_E', '{\"groups\":[]}'::jsonb, '2026-11-01T12:00:00Z', '$U_OLLI', '$(uuid_for request:e-final)')
ON CONFLICT (tournament_id) DO NOTHING;"
capture_before_screens() {
  capture_core
  tx "$GV_SETUP $(who anon) SELECT 'k:' || public.public_gathering('VERGL1')::text;" | norm_payload > "$WORK/vorher_pg.json"
  tx "$GV_SETUP $(who anon) SELECT 'k:' || public.public_tournament('F2JUNI')::text;" | norm_payload > "$WORK/vorher_f2_viewer_g.json"
  tx "$GV_SETUP $(who anon) SELECT 'k:' || public.public_final_standings('EJUNIO')::text;" > "$WORK/vorher_e_final.json"
}

# Sicherheitskern und Monitor-Funktionen (Kategorie S: unveraendert durch diese Migration).
CORE_SQL="SELECT count(*) || '|' || md5(string_agg(pg_get_functiondef(p.oid), E'\n' ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public_view' OR p.oid IN (to_regprocedure('public.public_tournament(text,bigint)'),
       to_regprocedure('public.display_tournament(uuid,text,bigint)'), to_regprocedure('public.is_reading_member(uuid)'),
       to_regprocedure('public.display_final_standings(uuid,text)'), to_regprocedure('public.display_final_standings(uuid)'),
       to_regprocedure('public.public_final_standings(text)'), to_regprocedure('match_engine.final_standings_payload(public.tournaments)'));"
capture_core() { q "$CORE_SQL" > "$WORK/vorher_core.txt"; }
