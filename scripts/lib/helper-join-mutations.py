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
    "M5": [("  IF current_user NOT IN ('authenticated', 'anon')                      -- A-16 Definer-Durchgang, nur mit Schalter\n"
            "     AND coalesce(current_setting('hallenfussball.helper_access_write', true), '') = 'on' THEN RETURN NEW; END IF;\n", "")],
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
    # M17 (Review M-1): Schalter ignoriert -- Durchgang wieder fuer jedes Betreiber-UPDATE (SQL-Editor)
    "M17": [("     AND coalesce(current_setting('hallenfussball.helper_access_write', true), '') = 'on' THEN RETURN NEW; END IF;\n",
             "     THEN RETURN NEW; END IF;\n")],
    # M18 (Review M-1): Rollenbedingung weg -- ein Client, der den Schalter selbst setzt, kaeme durch
    "M18": [("  IF current_user NOT IN ('authenticated', 'anon')                      -- A-16 Definer-Durchgang, nur mit Schalter\n",
             "  IF true                                                               -- A-16 Definer-Durchgang, nur mit Schalter\n")],
    # M19 (Review M-1): change_helper_access setzt den Schalter nach den UPDATEs nicht zurueck
    "M19": [("  PERFORM set_config('hallenfussball.helper_access_write', '', true);\n", "")],
    # M20 (Review M-1): change_helper_access setzt den Schalter nicht -- Co-Admin kann nicht mehr entziehen/herabstufen
    "M20": [("  PERFORM set_config('hallenfussball.helper_access_write', 'on', true);\n", "")],
    # M21 (@HE-062, Gegenprobe Rechte-Aufrufe): is_real_account() in change_helper_access, rotate_helper_code und
    # helper_request_count weg -- eine Geraetesitzung mit manageHelpers (Rechtetabelle) kaeme durch
    "M21": [("  IF NOT FOUND OR NOT (public.is_real_account() AND public.has_tournament_permission(v_mem.tournament_id, 'manageHelpers')) THEN\n",
             "  IF NOT FOUND OR NOT (public.has_tournament_permission(v_mem.tournament_id, 'manageHelpers')) THEN\n"),
            ("DECLARE v_declined integer := 0;\nBEGIN\n  IF NOT (public.is_real_account() AND public.has_tournament_permission(p_tournament_id, 'manageHelpers')) THEN\n",
             "DECLARE v_declined integer := 0;\nBEGIN\n  IF NOT (public.has_tournament_permission(p_tournament_id, 'manageHelpers')) THEN\n"),
            ("AS $$\nBEGIN\n  IF NOT (public.is_real_account() AND public.has_tournament_permission(p_tournament_id, 'manageHelpers')) THEN\n",
             "AS $$\nBEGIN\n  IF NOT (public.has_tournament_permission(p_tournament_id, 'manageHelpers')) THEN\n")],
    # M22 (@HE-008/@HE-102): Erneuern mit 'behalten' lehnt die offenen Anfragen trotzdem ab
    "M22": [("  IF p_open_requests = 'decline' THEN", "  IF true THEN")],
    # M23 (@HE-011/@HE-009): decide_join_request prueft den Ablauf nicht -- Zulassen nach Ablauf erzeugt Zugang
    "M23": [("IF now() >= public.helper_code_cutoff(v_t.date) OR public.tournament_closed_for_helpers(v_t.id) THEN\n",
             "IF false THEN\n")],
    # M24 (@HE-040): Feldbereich in decide_join_request nicht geprueft -- Feld 3 bei zwei Feldern wird zugelassen
    "M24": [("IF p_field IS NOT NULL AND (p_field < 1 OR p_field > v_t.number_of_fields) THEN\n",
             "IF false THEN\n")],
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
