-- Migration: on_auth_user_created (Rekonstruierbarkeit der Baseline)
--
-- Task T1 (.superpowers/sdd/2026-09-24-testumgebung/task-T1-brief.md): Der Trigger
-- "on_auth_user_created" AUF auth.users fehlt in der Baseline (00000000000000_baseline_live_schema.sql).
-- Grund: Die Baseline wurde mit `supabase db dump --schema public --linked` erzeugt (siehe
-- supabase/migrations/README.md) — ein Dump mit `--schema public` exportiert keine Objekte im
-- Schema "auth", selbst wenn die aufgerufene Funktion (hier public.handle_new_user(), im Schema
-- "public") sehr wohl im Dump enthalten ist.
--
-- Live existiert dieser Trigger (ursprünglich angelegt von 20260111_auth_hardening.sql:39-42,
-- einer der 23 älteren Bestandsmigrationen, die laut README.md nicht mehr von Null replayfähig
-- sind). Ohne ihn bekäme ein neu registrierter auth.users-Eintrag nie eine passende
-- public.profiles-Zeile — in einem aus der Baseline rekonstruierten Container (z. B. der lokalen
-- Testumgebung aus Task T1) bliebe profiles für jeden neuen Testnutzer leer.
--
-- CREATE OR REPLACE TRIGGER (statt DROP + CREATE) macht diese Migration auf der Live-Datenbank zu
-- einem No-op: Der Trigger existiert dort bereits, mit exakt derselben Definition (Timing AFTER
-- INSERT, Ereignis auf auth.users, ruft public.handle_new_user() — geprüft gegen
-- 20260111_auth_hardening.sql:39-42, unverändert seit damals). Diese Migration wird NICHT
-- automatisch gegen die Live-Datenbank angewendet — das macht der Controller separat, nach
-- Freigabe durch Daniel (siehe Task-Brief, Abschnitt "Vorgaben und Fakten").
--
-- Schließt zugleich die Rekonstruierbarkeits-Lücke: scripts/rls-role-matrix.sh musste diesen
-- Trigger bisher selbst als Testaufbau nachbauen (Behelf, kein Teil einer Migration) — mit dieser
-- Datei kommt er jetzt aus der Migrationsliste wie jeder andere Trigger auch, der Behelf entfällt.

CREATE OR REPLACE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();
