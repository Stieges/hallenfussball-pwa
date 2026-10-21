#!/usr/bin/env python3
"""helper-join-mutations.py -- Mutationen fuer scripts/helper-join-check.sh --gegenprobe (A-16).

Liest die Migration 20261110_008_helper_join.sql von stdin, wendet die Mutation MUT_KEY an und schreibt die mutierte
KOPIE nach stdout. Jedes Muster muss genau einmal vorkommen, sonst Abbruch (eine Mutation darf nie still ins Leere
gehen). Die Datei im Repo wird nie veraendert.
"""
import os
import sys

M = {
    # M1 (Plan, B1/P4): coalesce je Teilbedingung weg -- alte Form, NULL in einer Teilbedingung schliesst das Turnier
    "M1": [("""  SELECT NOT EXISTS (SELECT 1 FROM public.tournaments WHERE id = p_tournament_id)
      OR EXISTS (SELECT 1 FROM public.tournaments t
                  WHERE t.id = p_tournament_id
                    AND (    coalesce(t.deleted_at IS NOT NULL, false)
                          OR coalesce(t.status IN ('completed', 'cancelled', 'archived'), false)
                          OR coalesce((to_jsonb(t) ->> 'finished_at') IS NOT NULL, false)
                          OR coalesce((to_jsonb(t) ->> 'lifecycle_status') IN ('finished', 'cancelled'), false)))
""", """  SELECT coalesce((SELECT t.deleted_at IS NOT NULL OR t.status IN ('completed', 'cancelled', 'archived')
                          OR (to_jsonb(t) ->> 'finished_at') IS NOT NULL
                          OR (to_jsonb(t) ->> 'lifecycle_status') IN ('finished', 'cancelled')
                     FROM public.tournaments t WHERE t.id = p_tournament_id), true)
""")],
    # M2 (Plan): Ablaufpruefung des Codes weg
    "M2": [("                  WHEN now() >= public.helper_code_cutoff(v_t.date) THEN 'expired'\n",
            "                  WHEN false THEN 'expired'\n")],
    # M3 (Plan): is_real_account() in decide_join_request weg
    "M3": [("  IF NOT FOUND OR NOT (public.is_real_account() AND public.has_tournament_permission(v_req.tournament_id, 'manageHelpers')) THEN\n",
            "  IF NOT FOUND OR NOT (public.has_tournament_permission(v_req.tournament_id, 'manageHelpers')) THEN\n")],
    # M4 (Plan): FOR UPDATE in decide_join_request weg (Wettlauf @HE-006)
    "M4": [("  SELECT * INTO v_req FROM public.tournament_join_requests WHERE id = p_request_id FOR UPDATE;\n",
            "  SELECT * INTO v_req FROM public.tournament_join_requests WHERE id = p_request_id;\n")],
    # M5 (Plan): Definer-Durchgang in protect_collaborator_row weg (Maria entzieht/stuft herab)
    "M5": [("  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;  -- A-16 Definer-Durchgang\n", "")],
    # M6 (Plan, M2): is_device_membership aus der Loesch-Policy weg
    "M6": [("  USING (NOT public.is_device_membership(id, role)\n", "  USING (true\n")],
    # M7 (Plan, M3/@HE-101): Pruefzahl-Index weg
    "M7": [("CREATE UNIQUE INDEX IF NOT EXISTS tournament_join_requests_check_unique          -- M3/@HE-101: Pruefzahl je Turnier eindeutig\n"
            "  ON public.tournament_join_requests (tournament_id, check_number) WHERE status = 'pending';\n", "")],
    # M8 (Plan): Turniername auch bei nicht offenem Code ohne Beziehung ausliefern
    "M8": [("  IF v_state <> 'open' AND v_rel = 'none' THEN\n", "  IF false THEN\n")],
    # M9 (Plan): ACCOUNT_SESSION-Pruefung weg
    "M9": [("  IF public.is_real_account() THEN RETURN jsonb_build_object('result', 'ACCOUNT_SESSION'); END IF;   -- @HE-089, @HE-079\n", "")],
    # M10 (S-1/@HE-105): Pruefzahl-Vergleich weg
    "M10": [("  IF p_accept AND p_check_number IS DISTINCT FROM v_req.check_number THEN\n", "  IF false THEN\n")],
    # M11 (S-2/@HE-106): sameName zaehlt wieder nur offene Anfragen
    "M11": [("'sameName', s.pending + s.members + s.declined,", "'sameName', s.pending,")],
    # M12 (S-3): nach 5 gescheiterten Versuchen wieder PENDING ohne Zeile
    "M12": [("  IF NOT v_done THEN RETURN jsonb_build_object('result', 'BUSY'); END IF;", "  NULL;")],
    # M13 (S-4): Namenspruefung auf verborgene Zeichen in der Funktion weg (CHECK bleibt -> falscher Fehler 23514)
    "M13": [(" OR v_name ~ c_hidden THEN\n", " THEN\n")],
    # M14 (K-2): Feldsteuerung beim Entzug/Herabstufen nicht freigeben
    "M14": [("  UPDATE public.field_control\n"
             "     SET holder_user_id = NULL, holder_device_id = NULL, holder_device_label = NULL, epoch = epoch + 1, claimed_at = now()\n"
             "   WHERE tournament_id = v_mem.tournament_id AND holder_user_id = v_mem.user_id;\n", "")],
    # M15 (K-3): Rollen-Schutz fuer Zeilen aus dem QR-Beitritt wirkungslos
    "M15": [("     AND NEW.role IS DISTINCT FROM OLD.role\n", "     AND false\n")],
    # M16 (K-4): FOR SHARE auf den Code vor dem Anlegen weg (Rotations-Restfenster)
    "M16": [("  PERFORM 1 FROM public.tournament_join_codes WHERE code = v_code AND revoked_at IS NULL FOR SHARE;\n"
             "  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'ROTATED'); END IF;\n", "")],
}

key = os.environ.get("MUT_KEY", "")
if key not in M:
    sys.exit("helper-join-mutations: unbekannte Mutation %r" % key)
s = sys.stdin.read()
for frm, to in M[key]:
    if s.count(frm) != 1:
        sys.exit("helper-join-mutations: Muster in %s nicht genau einmal (%d): %r" % (key, s.count(frm), frm[:70]))
    s = s.replace(frm, to)
sys.stdout.write(s)
