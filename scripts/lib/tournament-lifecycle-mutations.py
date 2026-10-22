#!/usr/bin/env python3
"""tournament-lifecycle-mutations.py -- Mutationen ME1 ... ME20 fuer scripts/tournament-lifecycle-check.sh --gegenprobe
(A-21a-S, plan-endstand-abschluss.md § 3 Tabelle „Mutationen“).

Liest die Migration 20261113_003_tournament_lifecycle.sql von stdin, wendet die Mutation MUT_KEY an und schreibt die
mutierte KOPIE nach stdout. Jedes Muster muss genau einmal vorkommen, sonst Abbruch (eine Mutation darf nie still ins
Leere gehen). Die Datei im Repo wird nie veraendert.
"""
import os
import sys

BLOCK = """  IF public.tournament_is_closed(v_match.tournament_id) THEN
    RETURN match_engine.closed_intake(v_match.tournament_id, p_match_id, p_events, v_uid, p_device_id);
  END IF;
"""
FIELD_INSERT = """    VALUES (v_match.tournament_id, v_match.field, 0)
    ON CONFLICT (tournament_id, field) DO NOTHING;
  END IF;
"""
FINISH_LOCKS = """  PERFORM 1 FROM public.matches m WHERE m.tournament_id = p_tournament_id ORDER BY m.id FOR UPDATE;
  SELECT * INTO v_t FROM public.tournaments WHERE id = p_tournament_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'finish_tournament: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
"""
FINISH_LOCKS_SWAPPED = """  SELECT * INTO v_t FROM public.tournaments WHERE id = p_tournament_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'finish_tournament: keine Berechtigung' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM 1 FROM public.matches m WHERE m.tournament_id = p_tournament_id ORDER BY m.id FOR UPDATE;
"""
END = "\nCOMMIT;\n"

M = {
    # ME1: closed_intake-Aufruf entfernt -> P-2 (nach), P-6, Waechter R-EA-8a
    "ME1": [(BLOCK, "")],
    # ME2: matches_guard_closed weg -> P-5 PATCH matches, Waechter R-EA-8b
    "ME2": [("      ('matches', 'tournament_id'), ('teams', 'tournament_id')", "      ('teams', 'tournament_id')")],
    # ME3: Sperre auf tournaments erlaubt alle config-Schluessel -> P-5 Kindermodus/Sponsor
    "ME3": [("""    IF to_jsonb(NEW) - c_free IS DISTINCT FROM to_jsonb(OLD) - c_free
       OR coalesce(NEW.config, '{}'::jsonb) - v_skip IS DISTINCT FROM coalesce(OLD.config, '{}'::jsonb) - v_skip THEN""",
             """    IF to_jsonb(NEW) - c_free IS DISTINCT FROM to_jsonb(OLD) - c_free THEN""")],
    # ME4: Positivliste leer (publicScorers nicht mehr frei) -> P-5 Gegenbeispiel Torschuetzen-Schalter
    "ME4": [("ARRAY['publicScorers', 'standingDecisions']", "ARRAY['standingDecisions']"),
            ("ELSE ARRAY['publicScorers'] END;", "ELSE ARRAY[]::text[] END;")],
    # ME5: Stand-Vergleich weg -> P-2 STALE_STATE
    "ME5": [("  IF v_expected IS DISTINCT FROM match_engine.tournament_state(p_tournament_id) THEN", "  IF false THEN")],
    # ME6: offene Punkte ohne group_stale -> P-1 gruppe-stale
    "ME6": [("WHERE gc.group_id IS NULL OR gc.reopened_at IS NOT NULL OR gc.stale OR cardinality(gc.open_ranks) > 0",
             "WHERE gc.group_id IS NULL OR gc.reopened_at IS NOT NULL OR cardinality(gc.open_ranks) > 0")],
    # ME7: Turnier vor den Spielen gesperrt -> M K4 (Verklemmung statt Warten), Waechter Sperrreihenfolge
    "ME7": [(FINISH_LOCKS, FINISH_LOCKS_SWAPPED)],
    # ME8: request_id-Pruefung weg -> P-4
    "ME8": [("""  IF FOUND THEN
    IF v_log.kind = 'finish' AND v_log.tournament_id = p_tournament_id THEN""",
             """  IF false THEN
    IF v_log.kind = 'finish' AND v_log.tournament_id = p_tournament_id THEN""")],
    # ME9: anon liest die Endstand-Tabelle -> P-9, Assertion lifecycle-tables-rls-no-client-writes
    "ME9": [(END, "\nGRANT SELECT ON TABLE public.tournament_final_standings TO anon;\nCOMMIT;\n")],
    # ME10: oeffentliche/Monitor-Funktion ohne Schalter-Pruefung -> P-9 Schalter aus
    "ME10": [("""      'standings', CASE WHEN coalesce(p_tournament.config -> 'publicScorers' = 'true'::jsonb, false)
                        THEN fs.snapshot ELSE fs.snapshot - 'scorers' END)""",
              """      'standings', fs.snapshot)""")],
    # ME11: Recht in finish_tournament weg -> P-7
    "ME11": [("""  IF v_uid IS NULL OR NOT public.has_tournament_permission(p_tournament_id, 'manageLifecycle') THEN
    RAISE EXCEPTION 'finish_tournament: keine Berechtigung'""",
              """  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'finish_tournament: keine Berechtigung'""")],
    # ME12: current_user-Bedingung am Schalter weg -> P-5 Client setzt den Schalter selbst
    "ME12": [("""  v_switch boolean := coalesce(current_setting('app.lifecycle_write', true), '') = 'on'
                      AND current_user NOT IN ('authenticated', 'anon');""",
              """  v_switch boolean := coalesce(current_setting('app.lifecycle_write', true), '') = 'on';""")],
    # ME13: Konsistenz ohne Jeder-gegen-jeden-Vergleich -> P-8 Reihenfolge/Platzziffer
    "ME13": [("""  IF NOT EXISTS (SELECT 1 FROM public.matches mm
                  WHERE mm.tournament_id = p_tournament_id
                    AND (coalesce(mm.is_final, false) OR match_engine.group_key(mm.group_letter) <> '')) THEN""",
              "  IF false THEN")],
    # ME14: follow_status setzt bei 'draft' immer zurueck -> P-10 @LZ-004
    "ME14": [("""    ELSIF NEW.status = 'draft'
          AND (TG_OP = 'INSERT'""", """    ELSIF NEW.status = 'draft'
          AND (true""")],
    # ME15: Kind-Sperre ohne is_public-Ausnahme -> P-5 make_tournament_private (B1), save() (B2)
    "ME15": [("      IF TG_OP = 'UPDATE' AND to_jsonb(NEW) - c_admin = to_jsonb(OLD) - c_admin THEN", "      IF false THEN")],
    # ME16: Doppel-Erkennung in closed_intake weg -> P-6b
    "ME16": [("""    IF FOUND THEN
      IF v_existing.match_id = p_match_id AND v_existing.content""", """    IF false THEN
      IF v_existing.match_id = p_match_id AND v_existing.content""")],
    # ME17: closed_intake hinter dem field_control-INSERT -> P-6 „keine neue field_control-Zeile“, Waechter (8)
    "ME17": [(BLOCK, ""), (FIELD_INSERT, FIELD_INSERT + BLOCK)],
    # ME18: neue Tabelle mit tournament_id, ohne Sperre und nicht auf der Liste -> Waechter R-EA-8b
    "ME18": [(END, "\nCREATE TABLE public.zz_probe_ohne_sperre (id bigint PRIMARY KEY, tournament_id uuid REFERENCES public.tournaments(id));\nCOMMIT;\n")],
    # ME19: RLS des Endstands ueber is_active_tournament_member (Fassung vor Review B5: ohne Eigentuemer, mit Bildschirm)
    "ME19": [("  USING (public.has_tournament_permission(tournament_id, 'writeMatchData'));",
              "  USING (public.is_active_tournament_member(tournament_id));")],
    # ME20: reopen_tournament laesst finished_at stehen -> P-11
    "ME20": [("     SET lifecycle_status = 'fixed', finished_at = NULL, change_revision = change_revision + 1",
              "     SET lifecycle_status = 'fixed', change_revision = change_revision + 1")],
}


def main() -> int:
    key = os.environ.get("MUT_KEY", "")
    if key not in M:
        print(f"Unbekannte Mutation: {key}", file=sys.stderr)
        return 2
    text = sys.stdin.read()
    for old, new in M[key]:
        if old == END:
            idx = text.rfind(END)
            if idx < 0:
                print(f"{key}: Ende nicht gefunden", file=sys.stderr)
                return 1
            text = text[:idx] + new + text[idx + len(END):]
            continue
        count = text.count(old)
        if count != 1:
            print(f"{key}: Muster {count}x statt 1x gefunden: {old[:80]!r}", file=sys.stderr)
            return 1
        text = text.replace(old, new)
    sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
