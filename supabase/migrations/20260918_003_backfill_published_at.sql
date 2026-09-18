-- ============================================
-- 20260918_003: publishedAt für Bestandsturniere materialisieren
-- ============================================
--
-- 20260918_002 macht `config ? 'publishedAt'` zur Bedingung für make_tournament_public.
-- Die Anwendung füllt das Feld beim LESEN zurück (supabaseMappers/LocalStorageRepository:
-- status 'published' ohne publishedAt erbt created_at) — die Datenbankfunktion sieht diese
-- Rückfüllung aber nicht, sie liest die Config direkt.
--
-- Ohne diese Migration widersprechen sich beide Schichten: Ein vor der Einführung
-- veröffentlichtes Turnier gilt in der App als freigegeben, würde vom RPC aber mit
-- "has not been released" abgewiesen — es ließe sich nicht mehr teilen.
--
-- Rein additiv: setzt einen Schlüssel, der bisher fehlte, auf denselben Wert, den die
-- Anwendung ohnehin berechnet. Kein bestehender Wert wird überschrieben (Bedingung: NOT ?).
UPDATE public.tournaments
SET config = COALESCE(config, '{}'::jsonb)
           || jsonb_build_object(
                'publishedAt',
                to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
              )
WHERE status = 'published'
  AND NOT (COALESCE(config, '{}'::jsonb) ? 'publishedAt');
