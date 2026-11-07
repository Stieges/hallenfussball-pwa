#!/usr/bin/env python3
"""Mutationen der Migration 20261122_001_gathering_screens.sql fuer `gathering-screens-check.sh --gegenprobe`.

Je Kernregel eine Mutation; jede muss mindestens eine Pruefung aus B, U, D, O, T oder S rot faerben. Jede Ersetzung muss
genau einmal passen, sonst bricht das Skript ab (eine veraltete Mutation darf nicht still gruen werden).

Aufruf: mutationen.py --list | mutationen.py <ID> <migration.sql> (mutierter Text auf stdout)
        mutationen.py --public-gathering <migration.sql>  (nur CREATE OR REPLACE public_gathering dieser Fassung, fuer den
        Rueckweg nach einer Mutation, die public_gathering veraendert hat)
"""
import sys

MUTATIONS = {
    # @VA-037: Umschalten und Status ohne Rechtepruefung
    "S1-recht-umschalten": [("  IF NOT (public.is_real_account() AND public.has_tournament_permission(p_tournament_id, 'manageScreens')) THEN",
                             "  IF false THEN")],
    # @VA-041: Ort wird nicht verglichen
    "S2-ort": [("\n             THEN 'other_location'", " AND false\n             THEN 'other_location'")],
    # @VA-036 Z. 3: Entwurf darf auf die Bildschirme
    "S3-entwurf": [("THEN 'draft'", "AND false THEN 'draft'")],
    # @VA-043: Schluessel ohne strenges Format (Raender/Gross-Kleinschreibung oeffnen den Bildschirm)
    "S4-schluessel-format": [("  IF p_key IS NULL OR p_key !~ '^[0-9a-f]{32}$' THEN\n    RETURN jsonb_build_object('state', 'invalid');",
                              "  IF p_key IS NULL OR lower(btrim(p_key)) !~ '^[0-9a-f]{32}$' THEN\n    RETURN jsonb_build_object('state', 'invalid');"),
                             ("SELECT * INTO v_s FROM public.gathering_screens s WHERE s.screen_key = p_key;",
                              "SELECT * INTO v_s FROM public.gathering_screens s WHERE s.screen_key = lower(btrim(p_key));")],
    # @ZM-180: Version ohne gatherings.updated_at (Wechsel auf ein aelteres Turnier liesse sie sinken)
    "S5-version-wechsel": [("v_base_us := greatest(public_view.epoch_us(v_g.updated_at), public_view.epoch_us(v_s.updated_at));",
                            "v_base_us := public_view.epoch_us(v_s.updated_at);")],
    # unchanged zu frueh (Aenderungen am Turnier in der Halle gingen verloren)
    "S6-unchanged": [("CASE WHEN v_t IS NULL THEN v_all_us ELSE v_inner_us END) <= p_since_version",
                      "0) <= p_since_version")],
    # @VA-036 Z. 5 / @VA-004: nicht geteiltes Turnier erscheint fuer Zuschauer
    "S7-on-screen-oeffentlich": [("     AND coalesce(t.is_public, false) AND t.share_code IS NOT NULL\n",
                                  "     AND t.share_code IS NOT NULL\n")],
    # @VA-045: Stand im Kindermodus
    "S8-kindermodus": [("      SELECT NOT (public_view.switches(t.config) ->> 'kidsMode')::boolean\n",
                        "      SELECT true OR (public_view.switches(t.config) ->> 'kidsMode')::boolean\n")],
    # wechselt nie still: Waechter-Trigger fehlt
    "S9-waechter": [("  FOR EACH ROW WHEN (OLD.gathering_id IS NOT NULL\n", "  FOR EACH ROW WHEN (false AND OLD.gathering_id IS NOT NULL\n")],
    # @VA-036 Z. 6: Erneuern ohne neuen Schluessel
    "S10-erneuern": [("UPDATE public.gathering_screens SET screen_key = v_key, key_created_at = now() WHERE id = p_screen_id;",
                      "UPDATE public.gathering_screens SET key_created_at = now() WHERE id = p_screen_id;")],
    # @VA-038: „Von den Bildschirmen nehmen“ nimmt auch ein anderes Turnier herunter
    "S11-herunter-fremd": [("  ELSIF v_g.on_screen_tournament_id = p_tournament_id THEN", "  ELSIF true THEN")],
    # Abwehr in der Tiefe: Bildschirm prueft die Zulaessigkeit beim Lesen nicht
    "S12-lesen-zulaessig": [("                   AND public.gathering_screen_reason(v_g.id, v_g.on_screen_tournament_id) IS NULL\n              THEN v_g.on_screen_tournament_id END;",
                             "              THEN v_g.on_screen_tournament_id END;")],
    # @VA-034 E8: Bildschirme einrichten ohne Rechtepruefung
    "S13-recht-einrichten": [("  IF NOT public.has_gathering_permission(p_gathering_id, 'editGathering') THEN", "  IF false THEN")],
    # Grenze 10 je Veranstaltung
    "S14-grenze": [("  c_max_per_gathering constant integer := 10;\n  v_name text;\n  v_key text;\n  v_id uuid;",
                    "  c_max_per_gathering constant integer := 1000;\n  v_name text;\n  v_key text;\n  v_id uuid;")],
    # @VA-043: Schluessel in der Antwort des Bildschirms
    "S15-schluessel-antwort": [("      'id', v_s.id, 'name', v_s.name,\n", "      'id', v_s.id, 'name', v_s.name, 'key', v_s.screen_key,\n")],
    # @VA-034: alle Sponsoren statt nur der Folien
    "S16-sponsoren": [("     AND sp ->> 'id' IN (SELECT y.s", "     AND true OR sp ->> 'id' IN (SELECT y.s")],
    # @VA-044: Delta trotz Wechsel (der Bildschirm bekaeme die Folien und das neue Turnier nicht voll)
    "S17-delta-nach-wechsel": [("  IF v_t IS NOT NULL AND v_since_ok AND v_base_us <= p_since_version THEN",
                                "  IF v_t IS NOT NULL AND v_since_ok THEN")],
    # Titel eines fremden Turniers fuer Co-Admins
    "S18-titel-fremd": [("           WHEN public.is_real_account() AND public.has_tournament_permission(g.on_screen_tournament_id, 'manageScreens')\n",
                         "           WHEN true\n")],
    # @VA-042 Herkunft: derselbe Monitor zweimal uebernommen
    "S19-doppelt-uebernehmen": [("CREATE UNIQUE INDEX IF NOT EXISTS gathering_screens_one_adoption", "CREATE INDEX IF NOT EXISTS gathering_screens_one_adoption"),
                                ("  IF EXISTS (SELECT 1 FROM public.gathering_screens s\n              WHERE s.adopted_tournament_id = p_tournament_id AND s.adopted_monitor_id = p_monitor_id) THEN",
                                 "  IF false THEN")],
    # @VA-041: Ort nicht normalisiert
    "S20-ort-normalisiert": [("  SELECT nullif(lower(regexp_replace(btrim(coalesce(p_location, '')), '[[:space:]]+', ' ', 'g')), '');",
                              "  SELECT nullif(coalesce(p_location, ''), '');")],
    # letzter Bildschirm geloescht: Turnier bleibt in der Halle stehen (kaeme mit einem neuen Bildschirm still zurueck)
    "S21-loeschen-abraeumen": [("  DELETE FROM public.gathering_screens WHERE id = p_screen_id;\n  -- Ohne Bildschirme steht nichts mehr in der Halle (no_screens).\n  PERFORM public.gathering_clear_ineligible_on_screen(v_gid);\n",
                                "  DELETE FROM public.gathering_screens WHERE id = p_screen_id;\n")],
    # @VA-045: public_gathering ohne on_screen
    "S22-zuschauer-on-screen": [("      || coalesce((SELECT jsonb_build_object('on_screen', o) FROM public.gathering_public_on_screen(v_g.id) AS o WHERE o IS NOT NULL), '{}'::jsonb);",
                                 "      || '{}'::jsonb;")],
    # @VA-042 Herkunft: Monitor eines fremden Kontos uebernehmen
    "S23-uebernehmen-fremd": [("  IF v_t.owner_id IS DISTINCT FROM v_g.owner_id THEN", "  IF false THEN")],
    # @VA-040: Uebersicht ohne Rechtepruefung
    "S24-uebersicht-recht": [("  IF NOT public.has_gathering_permission(p_gathering_id, 'readGathering') THEN", "  IF false THEN")],
    # Tabelle fuer Clients lesbar
    "S25-tabellenrechte": [("REVOKE ALL ON public.gathering_screens FROM PUBLIC, anon, authenticated;",
                            "REVOKE ALL ON public.gathering_screens FROM PUBLIC, anon, authenticated;\nGRANT SELECT ON public.gathering_screens TO authenticated;")],
    # Endstand ohne Zulaessigkeit
    "S26-endstand-zulaessig": [("  IF v_tid IS NULL OR public.gathering_screen_reason(v_gid, v_tid) IS NOT NULL THEN", "  IF v_tid IS NULL THEN")],
    # Bildschirme ohne Bildschirme der Veranstaltung: on_screen fuer Zuschauer auch ohne Bildschirme
    "S27-ohne-bildschirme": [("           WHEN NOT EXISTS (SELECT 1 FROM public.gathering_screens s WHERE s.gathering_id = g.id) THEN 'no_screens'\n", "")],
    # Folien-Positivliste: ganze Konfiguration samt interner Notiz
    "S28-folien-positivliste": [("    || jsonb_build_object('slides', v_slides);", "    || v_s.config || jsonb_build_object('slides', v_slides);")],
}


def public_gathering_block(text: str) -> str:
    i = text.index("CREATE OR REPLACE FUNCTION public.public_gathering(")
    j = text.index("COMMENT ON FUNCTION public.public_gathering(text) IS", i)
    k = text.index("';\n", j) + 3
    return "BEGIN;\n" + text[i:k] + "COMMIT;\n"


def main() -> None:
    if sys.argv[1:] == ["--list"]:
        print("\n".join(MUTATIONS))
        return
    if sys.argv[1] == "--public-gathering":
        sys.stdout.write(public_gathering_block(open(sys.argv[2], encoding="utf-8").read()))
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
