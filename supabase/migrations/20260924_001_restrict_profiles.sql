-- Profile-Tabelle vor öffentlichem E-Mail-Zugriff (F3) und Selbst-Beförderung (F7) schützen.
--
-- Anlass: Live bestätigt am 24.09.2026 (task-R6-brief.md). "public"."profiles" trägt einen
-- Tabellen-GRANT ALL für "anon" und "authenticated", zusammen mit der Policy
-- "profiles_select_all" (USING (true)) liest deshalb jeder — auch ohne Anmeldung — die
-- E-Mail-Adresse, den Auth-Provider und die Preferences aller Nutzer (F3). Zusätzlich hat
-- "profiles_update_own" (USING auth.uid() = id) keinen Spaltenschutz: ein Nutzer kann per
-- direktem UPDATE die eigene "role" auf 'admin' setzen und kommt damit in den UI-Admin-Bereich
-- (AuthGuard.tsx, F7).
--
-- Zugriffstabelle (vom Controller erhoben, gegen den App-Code nachgeprüft):
--   AuthContext.tsx#fetchProfile           SELECT display_name, avatar_url, role  (authenticated, eigenes Profil)
--   invitationService.ts#validateInvitation SELECT id, display_name               (authenticated, evtl. anon — Name des Einladenden)
--   authHelpers.ts#checkOAuthOnlyUser      SELECT auth_provider WHERE email=...   (anon — Login/„Passwort vergessen")
--   mergeService.ts#checkEmailExists       SELECT id WHERE email=...             (authenticated, MERGE_ACCOUNTS-Flag aus)
--   authActions.ts#updateProfile           UPDATE display_name, avatar_url        (authenticated, eigenes Profil)
-- Kein App-Pfad macht INSERT oder DELETE auf "profiles" (Zeilen entstehen ausschließlich über
-- den Trigger handle_new_user() auf auth.users, SECURITY DEFINER). Kein App-Pfad liest "email"
-- oder "auth_provider" als Teil eines regulären SELECT-Result-Sets — beide Abfragen filtern nur
-- danach (`.eq('email', …)`), brauchen also SELECT-Recht auf die Spalte, obwohl sie nicht im
-- Select-Result auftaucht. Genau deshalb wandern beide auf eine SECURITY-DEFINER-RPC (unten),
-- statt ihnen einen Spalten-GRANT auf "email" zu geben — ein GRANT SELECT (email) würde sonst
-- wieder das volle Massenauslesen aller E-Mail-Adressen erlauben, das diese Migration schließt.
--
-- Warum Spalten-GRANTs statt eines pauschalen REVOKE: Ein pauschales REVOKE ALL ohne
-- differenzierte GRANTs hätte fetchProfile, die Einladungsanzeige und updateProfile mitgebrochen.
-- Die Spaltenliste ist bewusst minimal (genau das, was die obige Tabelle belegt) — kein "auf
-- Vorrat" gewährtes Recht.
--
-- Neue Funktion "auth_provider_for_email"(text): ersetzt die beiden `.eq('email', …)`-Abfragen.
-- SECURITY DEFINER, damit sie trotz des Spaltenschutzes intern per E-Mail suchen kann; der
-- Aufrufer bekommt nur den auth_provider zurück (oder NULL), nie die E-Mail-Adresse selbst.
--
-- Case-Normalisierung: Die App vergleicht immer mit `email.toLowerCase().trim()`
-- (authHelpers.ts, mergeService.ts). Ob "profiles.email" selbst konsistent kleingeschrieben
-- gespeichert ist, lässt sich ohne Zugriff auf die Live-Datenbank nicht beweisen — der
-- schreibende Trigger handle_new_user() übernimmt "NEW.email" aus auth.users unverändert, ohne
-- eigene Normalisierung (Baseline, Zeile ~223). Deshalb vergleicht die Funktion unten
-- vorsichtshalber beidseitig mit lower(): "lower(email) = lower(trim(p_email))". Das kostet
-- nichts (die Tabelle hat ohnehin keinen Index auf email, ein Sequential Scan bleibt ein
-- Sequential Scan) und ist im schlimmsten Fall überflüssig, nie falsch.
--
-- Restrisiko der RPC (bewusst akzeptiert, siehe task-R6-brief.md): Sie verrät für eine
-- EINZELNE, bekannte Adresse per Zeitverhalten bzw. NULL/nicht-NULL, ob ein Konto existiert und
-- mit welchem Provider. Das ist eine bewusste Entscheidung des Produktverantwortlichen, damit
-- der Hinweis „nutze Google/Apple" bei „Passwort vergessen" (Ghost-Password-Schutz) erhalten
-- bleibt — die Alternative (Hinweis ersatzlos streichen) würde denselben Nutzern eine
-- schlechtere Fehlermeldung liefern. Kein Massenauslesen: es gibt weiterhin keine Möglichkeit,
-- alle E-Mail-Adressen aufzuzählen (kein SELECT * o.ä. mehr auf email).
--
-- Bewusst NICHT angefasst: "profiles_select_all" und "profiles_update_own" selbst — beide
-- Policies bleiben unverändert, der Schutz kommt ausschließlich über die Spalten-GRANTs.

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON "public"."profiles" FROM "anon", "authenticated";

GRANT SELECT ("id", "display_name", "avatar_url") ON "public"."profiles" TO "anon";
GRANT SELECT ("id", "display_name", "avatar_url", "role") ON "public"."profiles" TO "authenticated";

-- "updated_at" wird ausschließlich vom Trigger "profiles_updated_at" (BEFORE UPDATE,
-- SECURITY INVOKER, aber ohne eigenen Spaltenschutz-Bedarf) gesetzt. PostgreSQL prüft
-- Spalten-Rechte nur gegen die vom Client gesendete SET-Klausel, nicht gegen das, was ein
-- BEFORE-UPDATE-Trigger anschließend an NEW ändert — ein UPDATE, das nur display_name/
-- avatar_url im SET nennt, braucht deshalb kein GRANT UPDATE (updated_at). Empirisch im
-- Wegwerf-Container bestätigt (siehe Report).
GRANT UPDATE ("display_name", "avatar_url") ON "public"."profiles" TO "authenticated";

CREATE OR REPLACE FUNCTION "public"."auth_provider_for_email"("p_email" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT "auth_provider"
  FROM "public"."profiles"
  WHERE lower("email") = lower(trim("p_email"))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION "public"."auth_provider_for_email"("text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."auth_provider_for_email"("text") TO "anon", "authenticated";
