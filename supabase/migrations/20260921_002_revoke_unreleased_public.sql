-- Turniere ohne Freigabe-Beleg werden wieder privat gestellt.
--
-- Vorgeschichte: Bis zum 18.09.2026 legte der Wizard jedes Turnier mit
-- `is_public = true` und einem automatisch erzeugten Share-Code an — auch einen
-- reinen Entwurf. "Öffentlich" bedeutete damit nichts; ein Entwurf war über
-- seinen Link erreichbar, sobald jemand ihn kannte. Seit `20260918_002` lehnt
-- `make_tournament_public` Turniere ohne `config->'publishedAt'` ab, seit
-- `20260921_001` erzwingt ein Trigger dasselbe beim Übergang nach öffentlich.
--
-- Beide Sicherungen wirken nur nach vorn. Diese Migration räumt auf, was unter
-- der alten Voreinstellung entstanden ist: Zeilen, die öffentlich sind, ohne je
-- freigegeben worden zu sein.
--
-- Stand an der Live-Datenbank am 21.09.2026: 0 Treffer. Die Migration ist
-- trotzdem richtig — sie schreibt den Zustand fest und greift in jeder anderen
-- Umgebung (lokale Kopien, Wiederherstellungen aus älteren Sicherungen), in der
-- solche Zeilen noch liegen.
--
-- `share_code_created_at` wird mit zurückgesetzt, nicht nur `share_code`: Die
-- bestehende Funktion `make_tournament_private` räumt ebenfalls beide Felder ab.
-- Nur eines davon zu leeren hinterließe einen Zeitstempel ohne zugehörigen Code.

UPDATE public.tournaments
SET is_public = false,
    share_code = NULL,
    share_code_created_at = NULL
WHERE is_public IS TRUE
  AND NOT (COALESCE(config, '{}'::jsonb) ? 'publishedAt');
