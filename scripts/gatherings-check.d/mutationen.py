#!/usr/bin/env python3
"""Mutationen der Migration 20261119_001_gatherings.sql fuer `gatherings-check.sh --gegenprobe`.

Je Kernregel eine Mutation; jede muss mindestens eine Pruefung des Checks rot faerben. Jede Ersetzung muss genau einmal
passen, sonst bricht das Skript ab (eine veraltete Mutation darf nicht still gruen werden).

Aufruf: mutationen.py --list | mutationen.py <ID> <migration.sql>  (mutierter Text auf stdout)
"""
import sys

MUTATIONS = {
    # @VA-019, @VA-015 Z. 3: Abschluss-Sperre ohne gathering_id
    "G1-c-free": [("'config', 'gathering_id'];", "'config'];")],
    # @VA-021: Client-Rollen duerfen das Feld schreiben, INSERT behaelt es
    "G2-schutz-trigger": [("  IF current_user NOT IN ('authenticated', 'anon') THEN\n    RETURN NEW;   -- Server-Funktionen",
                           "  IF true THEN\n    RETURN NEW;   -- Server-Funktionen")],
    # @VA-021 Z. 4: Turnier eines anderen Kontos zuordnen
    "G3-eigentuemer-turnier": [("IF r.owner_id IS DISTINCT FROM v_owner THEN", "IF false THEN")],
    # @VA-016: hoechstens eine Veranstaltung je Turnier (HF007)
    "G4-konflikt": [("IF r.gathering_id IS NOT NULL AND r.gathering_id <> p_gathering_id THEN", "IF false THEN")],
    # @VA-013: gathering_code auch fuer den Bildschirm
    "G5-code-bildschirm": [("CASE WHEN NOT v_screen AND coalesce(v_t.is_public, false) AND v_t.gathering_id IS NOT NULL",
                            "CASE WHEN coalesce(v_t.is_public, false) AND v_t.gathering_id IS NOT NULL")],
    # @VA-004: nicht freigegebene Turniere erscheinen
    "G6-nur-oeffentliche": [("FROM st s WHERE coalesce(s.is_public, false)),", "FROM st s),")],
    # @ZM-180: Loesen setzt die Version der Veranstaltung nicht
    "G7-version-loesen": [("  UPDATE public.gatherings SET updated_at = now() WHERE id = p_gathering_id;\n  RETURN jsonb_build_object('added'",
                           "  RETURN jsonb_build_object('added'")],
    # @VA-011: anonyme Sitzung zaehlt als Eigentuemer
    "G8-echtes-konto": [("     AND public.is_real_account()\n     AND EXISTS (SELECT 1 FROM public.gatherings g",
                         "     AND EXISTS (SELECT 1 FROM public.gatherings g")],
    # @VA-004, @VA-006: pending verraet die Anzahl
    "G9-pending-anzahl": [("'state', 'pending', 'version', v_version, 'server_now', v_server_now, 'name', v_g.name);",
                           "'state', 'pending', 'version', v_version, 'server_now', v_server_now, 'name', v_g.name, 'count', v_assigned);")],
    # GATE 2 Nr. 15: Code nur gegen gatherings geprueft
    "G10-code-beide-tabellen": [("IF NOT EXISTS (SELECT 1 FROM public.gatherings g WHERE g.share_code = v_code)\n"
                                 "       AND NOT EXISTS (SELECT 1 FROM public.tournaments t WHERE t.share_code = v_code) THEN",
                                 "IF NOT EXISTS (SELECT 1 FROM public.gatherings g WHERE g.share_code = v_code) THEN")],
    # @VA-020: Kopie traegt die Veranstaltung mit
    "G11-kopie": [("    NEW.gathering_id := NULL;   -- @VA-020", "    NULL;   -- @VA-020")],
    # @VA-021 Z. 3: Zuordnen zaehlt die Version des Turniers hoch (Optimistic Lock am Geraet)
    "G12-turnier-version": [("UPDATE public.tournaments t SET gathering_id = p_gathering_id\n",
                             "UPDATE public.tournaments t SET gathering_id = p_gathering_id, version = coalesce(t.version, 0) + 1\n")],
    # @ZM-180: Papierkorb setzt die Version der Veranstaltung nicht
    "G13-papierkorb": [("FOR EACH ROW WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at\n",
                        "FOR EACH ROW WHEN (false AND OLD.deleted_at IS DISTINCT FROM NEW.deleted_at\n")],
    # @ZM-180: Version ohne matches.updated_at (genau die Vorgabe: zurueckgenommener Anpfiff laesst sie sinken)
    "G14-version-spiele": [("(VALUES (s.updated_at), (s.max_actual), (s.max_updated), (s.changed_at))",
                            "(VALUES (s.updated_at), (s.max_actual), (s.changed_at))")],
    # Obergrenze 50 je Konto
    "G15-grenze": [(">= c_max_per_account THEN", ">= c_max_per_account + 1000 THEN")],
    # HF010: Namenspruefung meldet nur noch
    "G16-name": [("RAISE EXCEPTION 'GATHERING_NAME_INVALID", "RAISE NOTICE 'GATHERING_NAME_INVALID")],
    # @VA-011: jedes Konto liest jede Veranstaltung
    "G17-lesen": [("USING (public.has_gathering_permission(id, 'readGathering'));", "USING (true);")],
    # Kappung „laeuft“ ab dem uebernaechsten Tag
    "G18-kappung": [("                WHEN ts.started AND v_today >= ts.date + 2 THEN 'finished'   -- gekappt (wie @HE-111)\n", "")],
    # @VA-003: Positivliste um eine Kennung erweitert
    "G19-positivliste": [("'share_code', s.share_code))", "'share_code', s.share_code, 'id', s.id))")],
    # @VA-016: Papierkorb wird zugeordnet
    "G20-papierkorb-zuordnen": [("IF r.found_id IS NULL OR r.deleted_at IS NOT NULL THEN", "IF r.found_id IS NULL THEN")],
    # @VA-011: Maria (nicht Eigentuemerin) ordnet zu
    "G21-recht-zuordnen": [("IF NOT public.has_gathering_permission(p_gathering_id, 'assignTournaments') THEN", "IF false THEN")],
    # R0: Mitglieder direkt ueber die Schnittstelle
    "G22-mitglieder": [("  IF current_user IN ('authenticated', 'anon') THEN\n    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: Mitglieder",
                        "  IF false THEN\n    RAISE EXCEPTION 'GATHERING_NOT_ALLOWED: Mitglieder")],
}


def main() -> None:
    if sys.argv[1:] == ["--list"]:
        print("\n".join(MUTATIONS))
        return
    mid, path = sys.argv[1], sys.argv[2]
    text = open(path, encoding="utf-8").read()
    for old, new in MUTATIONS[mid]:
        n = text.count(old)
        if n != 1:
            sys.exit(f"Mutation {mid}: Stelle {n}-mal statt genau einmal gefunden: {old[:60]!r}")
        text = text.replace(old, new)
    sys.stdout.write(text)


if __name__ == "__main__":
    main()
