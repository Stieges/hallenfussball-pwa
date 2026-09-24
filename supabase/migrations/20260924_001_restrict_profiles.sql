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
--   invitationService.ts#validateInvitation SELECT id, display_name               (authenticated — Name des Einladenden)
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
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- FIXRUNDE 1 (adversariales Review, task-R6-review.md, Ruling J): M1, L1, L3
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- M1 (mittel, Namensliste + RPC als Orakel für E-Mails): Die erste Fassung dieser Migration gab
-- "id, display_name, avatar_url" an "anon" frei (Zugriffstabelle oben) UND ließ
-- "profiles_select_all" (USING true) für "authenticated" unangetastet — beides zusammen macht
-- die Namen ALLER Nutzer für jeden aufzählbar, auch ohne Anmeldung. Live bestätigt (Controller,
-- 24.09.2026): bei 6 von 7 Profilen ist "display_name" identisch mit dem E-Mail-Präfix (Folge von
-- Magic-Link-Registrierung, "handle_new_user" setzt "split_part(email,'@',1)" als Fallback-Name).
-- Zusammen mit "auth_provider_for_email" als ungedrosseltem Orakel (nicht-NULL bei Treffer) lassen
-- sich damit E-Mail-Adressen aus der Namensliste heraus systematisch erraten und bestätigen.
--
-- Fix: Der "anon"-GRANT auf "profiles" entfällt VOLLSTÄNDIG (kein SELECT auf irgendeine Spalte
-- mehr für "anon"). Beleg, dass kein funktionierender App-Pfad das bricht: "validateInvitation"
-- (invitationService.ts:223) liest die Einladung ZUERST per
-- ".eq('invite_code', token).single()" aus "tournament_collaborators" — dort gilt
-- "collaborators_select_v3" (USING user_id=auth.uid() OR invite_email=auth.email() OR
-- user_owns_tournament(tournament_id)). Für "anon" sind "auth.uid()"/"auth.email()" NULL und
-- "anon" besitzt nie ein Turnier — die Zeile ist unsichtbar, die Funktion kehrt mit
-- "{ valid: false, error: 'not_found' }" zurück, BEVOR sie je "profiles" erreicht (empirisch im
-- Wegwerf-Container bestätigt: "SELECT count(*) ... WHERE invite_code = 'X'" als "anon" liefert 0
-- Zeilen). Der bekannte kaputte Einladungsfluss (I1, Fixrunde-Notiz) macht den anon-Lesepfad auf
-- "profiles" also schon heute tot — der Fix ändert an einem funktionierenden Fall nichts.
--
-- Für "authenticated" ersetzt diese Migration "profiles_select_all" (USING true) durch
-- "profiles_select_related": eine Zeile ist sichtbar, wenn sie (i) die eigene ist, (ii) die
-- Person Einladende(r) einer mich betreffenden Einladung ist, (iii) die Person Mitglied in einem
-- Turnier ist, das mir gehört, oder (iv) die Person Eigentümer eines Turniers ist, in dem ich
-- akzeptiertes Mitglied bin. "profile_visible_to_viewer()" kapselt das als SECURITY-DEFINER-
-- Funktion (Stil von "user_owns_tournament") — sie liest "tournament_collaborators"/"tournaments"
-- mit den Rechten ihres Eigentümers ("postgres"), nicht mit denen des Aufrufers, und triggert
-- damit NIE deren RLS-Policies. Das ist bewusst so gewählt: Ein Policy-Ausdruck direkt in
-- "profiles_select_related", der per Subquery auf "tournament_collaborators"/"tournaments"
-- zugreift, würde deren Policies (u.a. "collaborators_select_v3", die selbst schon
-- "user_owns_tournament" nutzt) mit auswerten — kein Endlos-Rekursionsfehler (die Policies zeigen
-- nicht auf "profiles" zurück, geprüft per Grep über alle Policy-Definitionen), aber unnötige,
-- schwer nachvollziehbare Verschachtelung. Die SECURITY-DEFINER-Funktion vermeidet das von
-- vornherein.
--
-- L1 (niedrig, MAINTAIN blieb stehen): "REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES, TRIGGER" erfasst nicht "MAINTAIN" (seit PG17 Teil von "ALL"). Fix: "REVOKE ALL"
-- statt der Einzelliste.
--
-- L3 (niedrig, RPC nicht deterministisch bei NULL-auth_provider): "auth_provider_for_email" gab
-- für eine Zeile mit "auth_provider IS NULL" dasselbe NULL zurück wie für "keine Zeile" — nicht
-- unterscheidbar. Fix: "coalesce(auth_provider, 'email')" (die Spalte hat "DEFAULT 'email'", NULL
-- kommt praktisch nur bei sehr alten/manuell veränderten Zeilen vor) plus "ORDER BY created_at"
-- vor "LIMIT 1" für einen deterministischen Treffer bei (laut Controller live nicht vorhandenen,
-- aber möglichen) Dubletten.
--
-- Bewusst NICHT angefasst: "profiles_update_own" (unverändert) und "handle_new_user()"
-- (unverändert — ob der E-Mail-Präfix-Fallback als Anzeigename bleibt, entscheidet Daniel
-- separat, ebenso ein mögliches Bereinigen bestehender Profile). L4 (Harness-Sonden unterscheiden
-- "verweigert" nicht von "leer") und der unabhängige Befund zu "teams.contact_email"/
-- "contact_phone" sind laut Controller geparkt, nicht Teil dieser Fixrunde.

REVOKE ALL ON "public"."profiles" FROM "anon", "authenticated";

GRANT SELECT ("id", "display_name", "avatar_url", "role") ON "public"."profiles" TO "authenticated";

-- "updated_at" wird ausschließlich vom Trigger "profiles_updated_at" (BEFORE UPDATE,
-- SECURITY INVOKER, aber ohne eigenen Spaltenschutz-Bedarf) gesetzt. PostgreSQL prüft
-- Spalten-Rechte nur gegen die vom Client gesendete SET-Klausel, nicht gegen das, was ein
-- BEFORE-UPDATE-Trigger anschließend an NEW ändert — ein UPDATE, das nur display_name/
-- avatar_url im SET nennt, braucht deshalb kein GRANT UPDATE (updated_at). Empirisch im
-- Wegwerf-Container bestätigt (siehe Report).
GRANT UPDATE ("display_name", "avatar_url") ON "public"."profiles" TO "authenticated";

-- Ersetzt "profiles_select_all" (USING true) — siehe Fixrunde-1-Kommentar oben (M1).
CREATE OR REPLACE FUNCTION "public"."profile_visible_to_viewer"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  -- Direct table access bypasses RLS (SECURITY DEFINER) — vermeidet, dass die Policies von
  -- tournament_collaborators/tournaments beim Auswerten dieser Funktion erneut angewendet
  -- werden (Stil von "user_owns_tournament").
  SELECT
    -- (i) die eigene Zeile
    p_profile_id = auth.uid()
    -- (ii) die Person hat mich eingeladen (angenommen ODER noch offen per invite_email)
    OR EXISTS (
      SELECT 1 FROM tournament_collaborators tc
      WHERE tc.invited_by = p_profile_id
        AND (tc.user_id = auth.uid() OR tc.invite_email = auth.email())
    )
    -- (iii) die Person ist akzeptiertes Mitglied in einem Turnier, das mir gehört
    OR EXISTS (
      SELECT 1 FROM tournament_collaborators tc
      JOIN tournaments t ON t.id = tc.tournament_id
      WHERE tc.user_id = p_profile_id
        AND tc.accepted_at IS NOT NULL
        AND t.owner_id = auth.uid()
    )
    -- (iv) die Person ist Eigentümer eines Turniers, in dem ich akzeptiertes Mitglied bin
    OR EXISTS (
      SELECT 1 FROM tournament_collaborators tc
      JOIN tournaments t ON t.id = tc.tournament_id
      WHERE t.owner_id = p_profile_id
        AND tc.user_id = auth.uid()
        AND tc.accepted_at IS NOT NULL
    );
$$;

REVOKE ALL ON FUNCTION "public"."profile_visible_to_viewer"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."profile_visible_to_viewer"("uuid") TO "authenticated";

DROP POLICY IF EXISTS "profiles_select_all" ON "public"."profiles";

CREATE POLICY "profiles_select_related" ON "public"."profiles" FOR SELECT TO "authenticated"
  USING ("public"."profile_visible_to_viewer"("id"));

CREATE OR REPLACE FUNCTION "public"."auth_provider_for_email"("p_email" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT coalesce("auth_provider", 'email')
  FROM "public"."profiles"
  WHERE lower("email") = lower(trim("p_email"))
  ORDER BY "created_at"
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION "public"."auth_provider_for_email"("text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."auth_provider_for_email"("text") TO "anon", "authenticated";
