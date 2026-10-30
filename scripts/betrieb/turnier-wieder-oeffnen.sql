-- ====================================================================================================
-- turnier-wieder-oeffnen.sql -- Betreiber-Vorlage: ein versehentlich abgeschlossenes Turnier auf Zuruf wieder öffnen
-- (@LZ-091 Notweg, @ET-046; Plan Endstand und Abschluss F1, R-EA-12; Paket A-21a-S)
--
-- WER/WO: der Betreiber (Daniel), im Supabase-Dashboard unter "SQL Editor" (läuft dort als Rolle postgres).
-- Geprüft wird diese Datei von scripts/tournament-lifecycle-check.sh: Block 1 läuft dort WÖRTLICH (Platzhalter ersetzt)
-- gegen ein abgeschlossenes Turnier und ein zweites Mal gegen das wieder geöffnete (Abbruch ohne Änderung, Probe bei P-11);
-- reopen_tournament selbst belegen P-11 und P-12. Änderungen hier immer mit dem Skript prüfen. Den Knopf
-- "Turnier wieder öffnen" in der App gibt es erst nach dem MVP (@LZ-058).
--
-- PLATZHALTER (nur im Editor ersetzen, nie in dieser Datei im Repo):
--   <turnier-id>  die Kennung des Turniers (Block 0 zeigt sie, oder aus der Adresse in der App)
--   <grund>       der Grund in Ollis Worten, z. B. versehentlich abgeschlossen (1 bis 500 Zeichen)
--
-- WAS DANACH GILT (vorher mit Olli besprechen):
--   - Das Turnier ist wieder "Läuft" (bzw. "Festgelegt", falls nie ein Spiel angepfiffen war).
--   - Helfer dürfen SOFORT wieder eintragen, und der Helfer-QR-Code gilt wieder (am Turniertag). Eine eigene
--     Freischaltung je Helfer gibt es im MVP nicht (@LZ-062 ist MVP+).
--   - Hallen-Monitor und öffentliche Seite zeigen weiter den Endstand von vor dem Wiederöffnen, unverändert, bis Olli neu
--     abschließt (@ZM-121 Z. 2, @LZ-077 Z. 2; Server ab 20261118_008); ein Hinweis "vorläufig" ist MVP+ (@LZ-065). Der
--     Bildschirm wird nicht mehr 60 Minuten nach dem Abschluss frei.
--   - Der alte Endstand bleibt gespeichert, bis Olli erneut abschließt; dann wird er ersetzt.
--   - Der Verlauf hält das Wiederöffnen mit Grund und dem Zeitpunkt des aufgehobenen Abschlusses fest. Als Person steht
--     dort Olli (die Vorlage handelt in seinem Namen, wie bei seiner Bitte).
--   - Was nach dem Abschluss eingetroffen war ("nach dem Ende eingetroffen"), wird NICHT übernommen (@LZ-042 MVP+).
--
-- ARBEITSWEISE IM EDITOR: immer nur EINEN Block markieren und ausführen (0, dann 1, dann 2).
-- ====================================================================================================


-- ##### BLOCK 0 - Vorher prüfen (nur lesen; genau eine Zeile)
-- Erwartet: titel stimmt (vorlesen!), zustand = finished, abgeschlossen_um gefüllt, geloescht leer.
SELECT t.id AS turnier_id, t.title AS titel, t.lifecycle_status AS zustand, t.finished_at AS abgeschlossen_um,
       t.deleted_at AS geloescht, t.owner_id AS eigentuemer,
       (SELECT count(*) FROM public.late_entries l WHERE l.tournament_id = t.id) AS nach_dem_ende_eingetroffen
  FROM (SELECT 1) AS x
  LEFT JOIN public.tournaments t ON t.id = '<turnier-id>';


-- ##### BLOCK 1 - Wieder öffnen (als Ganzes markieren; bricht bei jedem Zweifel ab, ändert dann nichts)
-- Ergebnis: die Antwort des Servers, erwartet {"status": "ok", "lifecycle": "running"}.
DO $$
DECLARE
  v_turnier uuid := '<turnier-id>';
  v_grund   text := '<grund>';
  v_owner   uuid;
  v_antwort jsonb;
BEGIN
  SELECT t.owner_id INTO v_owner FROM public.tournaments t
   WHERE t.id = v_turnier AND t.deleted_at IS NULL AND t.lifecycle_status = 'finished';
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Abbruch: Turnier % gibt es nicht, es ist gelöscht oder nicht abgeschlossen.', v_turnier;
  END IF;
  IF v_grund IS NULL OR btrim(v_grund) = '' OR v_grund LIKE '<%' THEN
    RAISE EXCEPTION 'Abbruch: Grund fehlt (Platzhalter <grund> ersetzen).';
  END IF;
  -- Im Namen des Eigentümers handeln (wie eine Anfrage aus Ollis App): Sitzung mit seinem Konto, Rolle authenticated.
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_owner, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  PERFORM set_config('role', 'authenticated', true);
  v_antwort := public.reopen_tournament(v_turnier, v_grund, gen_random_uuid());
  PERFORM set_config('role', 'postgres', true);
  IF v_antwort ->> 'status' IS DISTINCT FROM 'ok' THEN
    RAISE EXCEPTION 'Abbruch: Server lehnt ab: %', v_antwort;
  END IF;
  RAISE NOTICE 'Wieder geöffnet: %', v_antwort;
END;
$$;


-- ##### BLOCK 2 - Nachher prüfen (nur lesen; genau eine Zeile)
-- Erwartet: zustand = running (oder fixed), abgeschlossen_um leer, letzter_eintrag = reopen mit dem Grund.
SELECT public.tournament_lifecycle(t.id) AS zustand, t.finished_at AS abgeschlossen_um,
       l.kind AS letzter_eintrag, l.reason AS grund, l.finished_at_before AS aufgehobener_abschluss, l.created_at AS um
  FROM public.tournaments t
  LEFT JOIN LATERAL (SELECT * FROM public.tournament_lifecycle_log x WHERE x.tournament_id = t.id ORDER BY x.id DESC LIMIT 1) l ON true
 WHERE t.id = '<turnier-id>';
