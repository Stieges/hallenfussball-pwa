/**
 * tests/e2e/cloud/testData.ts
 *
 * EINZIGE Quelle für E-Mails, Passwort, Rollen, Turnier-IDs, Share-Code und Team-Namen der
 * lokalen Cloud-Testumgebung (Task T2, `.superpowers/sdd/2026-09-24-testumgebung/task-T2-brief.md`).
 * `scripts/e2e-seed.ts` und alle "cloud"-E2E-Tests (Task T3+) importieren ausschließlich von hier
 * — keine der Werte darf verstreut nochmal literal auftauchen.
 *
 * Diese Datei beschreibt NUR Testdaten der lokalen Umgebung. Sie enthält keine Zugangsdaten zur
 * Produktion und keine echten Geheimnisse.
 */

// =============================================================================
// DETERMINISTISCHE IDs
// =============================================================================

import { e2eUuid } from './e2eUuid';

export { e2eUuid };

// =============================================================================
// PASSWORT + REGISTRIERUNGSCODE
// =============================================================================

/** Gemeinsames Test-Passwort für alle Testnutzer mit Konto. */
export const E2E_TEST_PASSWORD = 'E2E-Test-Passwort-1!';

/**
 * Muss exakt mit `scripts/lib/e2e-registration-code.sh` übereinstimmen (geprüft von
 * `tests/e2e/cloud/__tests__/registrationCodeParity.test.ts`). Fester Testwert, kein
 * Geheimnis, nie in der Produktion setzen.
 */
export const E2E_REGISTRATION_CODE = 'E2E-LOCAL-CODE-NICHT-PRODUKTIV';

// =============================================================================
// TESTNUTZER
// =============================================================================

export type E2EUserKey =
  | 'owner'
  | 'coadmin'
  | 'helper'
  | 'trainer'
  | 'viewer'
  | 'revoked'
  | 'stranger'
  | 'google'
  | 'logouttest'
  | 'logouttestMobile'
  | 'abmelden'
  | 'abmeldenAn024'
  | 'abmeldenFu006';

export interface E2EUserSpec {
  key: E2EUserKey;
  email: string;
  displayName: string;
}

/**
 * Testnutzer mit echtem Konto (`auth.users` + `public.profiles`). Rollen im Live-Cup werden in
 * `E2E_LIVE_CUP.collaborators` beschrieben, nicht hier — diese Tabelle ist reine Identität.
 */
export const E2E_USERS: Record<E2EUserKey, E2EUserSpec> = {
  owner: { key: 'owner', email: 'owner@test.local', displayName: 'Olli Owner' },
  coadmin: { key: 'coadmin', email: 'coadmin@test.local', displayName: 'Clara Co-Admin' },
  helper: { key: 'helper', email: 'helper@test.local', displayName: 'Heiko Helfer' },
  trainer: { key: 'trainer', email: 'trainer@test.local', displayName: 'Tanja Trainer' },
  viewer: { key: 'viewer', email: 'viewer@test.local', displayName: 'Vera Viewer' },
  revoked: { key: 'revoked', email: 'revoked@test.local', displayName: 'Rudi Revoked' },
  stranger: { key: 'stranger', email: 'stranger@test.local', displayName: 'Steffi Stranger' },
  // auth_provider = 'google' (Admin-API app_metadata.provider) — für den Hinweis bei
  // "Passwort vergessen" bei Konten ohne Passwort-Login.
  google: { key: 'google', email: 'google@test.local', displayName: 'Gustav Google' },
  // Fixrunde 1 (C1, Ruling U): EIGENER Nutzer für den Anmelden/Abmelden-Test
  // (`auth.cloud.spec.ts`) -- `supabase.auth.signOut()` läuft ohne `scope`-Option (Supabase-JS
  // Standard `scope: 'global'`, `src/features/auth/context/authActions.ts:507`) und beendet
  // damit ALLE Sessions des Kontos. Würde dieser Test `owner` abmelden, verlöre jeder andere
  // owner-Test, der über `asRole('owner')` denselben `playwright/.auth/owner.json`-storageState
  // (= dieselbe Session) teilt, mitten im Volllauf seine Anmeldung. Kein Turnier-Bezug nötig --
  // dieser Nutzer ist NIRGENDWO Mitglied, taucht in KEINEM anderen Spec über `asRole()` auf.
  logouttest: { key: 'logouttest', email: 'logouttest@test.local', displayName: 'Lena Logouttest' },
  // Fixrunde 2 (N9): ZWEITER, eigener Nutzer NUR für cloud-mobile -- derselbe Logout-Test
  // (`auth.cloud.spec.ts`) läuft `fullyParallel` auf `cloud-desktop` UND `cloud-mobile`
  // gleichzeitig. Hätten beide Projekt-Instanzen denselben `logouttest`-Nutzer angemeldet, würde
  // die `signOut()`-Instanz der EINEN Projekt-Instanz (scope: 'global', s.o.) die Session der
  // ANDEREN, noch laufenden Instanz global widerrufen -- genau die C1-Fehlerklasse, nur zwischen
  // Projekten statt zwischen Spec-Dateien. War vorher nur als "unwahrscheinlich" eingestuft
  // (keine Turnier-Mitgliedschaft, also kein Datenzugriff, der dadurch bräche) -- aber der
  // Logout-Test selbst prüft genau das UI-Verhalten von signOut(), also die einzige Prüfung, bei
  // der das tatsächlich etwas kaputt machen könnte.
  logouttestMobile: { key: 'logouttestMobile', email: 'logouttest-mobile@test.local', displayName: 'Mona Logouttest' },
  // A-07d3: EIGENE Konten für `abmelden-geraete.cloud.spec.ts`, je Test eines. „Auf allen anderen
  // Geräten abmelden" (`admin.signOut(jwt, 'others')`) beendet jede andere Sitzung desselben Kontos.
  // Isolation der Fälle: Jeder Fall hat sein Konto, damit „andere Geräte abmelden“ nie die Sitzung
  // eines anderen Falls trifft. Der Banner-Fehler „von einem anderen Gerät aus abgemeldet“ mitten im
  // Test hatte eine andere Ursache (C-ABMELDE-HINWEIS-WETTLAUF, App-Fix 0e60860a), nicht die
  // Kontentrennung. Jedes Konto besitzt genau seinen Cup
  // (`E2E_ABMELDEN_OWNER` in `engineCups.ts`, die RPC prüft den Eigentümer). Kein storageState, der
  // Spec meldet sich selbst über die Oberfläche an.
  abmelden: { key: 'abmelden', email: 'abmelden@test.local', displayName: 'Anja Abmelden' },
  abmeldenAn024: { key: 'abmeldenAn024', email: 'abmelden-an024@test.local', displayName: 'Anton Abmelden' },
  abmeldenFu006: { key: 'abmeldenFu006', email: 'abmelden-fu006@test.local', displayName: 'Frieda Abmelden' },
};

/** Adressen für offene/abgelaufene/widerrufene Einladungen OHNE eigenes Konto. */
export const E2E_INVITEE_EMAIL = 'invitee@test.local';
export const E2E_EXPIRED_INVITE_EMAIL = 'expired@test.local';
export const E2E_REVOKED_INVITE_EMAIL = 'revokedinvite@test.local';

// =============================================================================
// TURNIERE
// =============================================================================

export const E2E_LIVE_CUP_ID = e2eUuid('tournament:live-cup');
export const E2E_PUBLIC_CUP_ID = e2eUuid('tournament:public-cup');
export const E2E_DRAFT_CUP_ID = e2eUuid('tournament:draft-cup');
export const E2E_STRANGER_CUP_ID = e2eUuid('tournament:stranger-cup');
/**
 * Fixrunde 2 (N3, Ruling AA): FÜNFTES Testturnier, NUR für `publish-coadmin.cloud.spec.ts` --
 * der T2-Brief verlangt den Entwurf-Cup wörtlich als "Entwurf, privat, ohne `publishedAt`"
 * (`task-T2-brief.md`, Abschnitt "Testturniere (verbindlich)"); Fixrunde 1 hatte ihm
 * `publishedAt` gegeben, um die Veröffentlichen-RPC (N1) testen zu können -- das widersprach dem
 * Brief (kein Ruling dafür). Der Entwurf-Cup ist seit Fixrunde 2 wieder ein reiner Entwurf (kein
 * `publishedAt`, kein Sponsor/Monitor, kein Co-Admin). Der "Freigabe-Cup" trägt stattdessen
 * genau den Zustand, den `publish-coadmin.cloud.spec.ts` braucht: veröffentlicht
 * (`publishedAt` gesetzt), privat (`is_public=false`), coadmin als Co-Admin, ein Sponsor + ein
 * Monitor.
 */
export const E2E_RELEASE_CUP_ID = e2eUuid('tournament:release-cup');

/** Titel der Testturniere (`scripts/e2e-seed.ts` UND `tests/e2e/cloud/smoke.spec.ts`
 *  importieren von hier — keine literale Zweitstelle). */
export const E2E_LIVE_CUP_TITLE = 'Live-Cup';
export const E2E_PUBLIC_CUP_TITLE = 'Public-Cup';
export const E2E_DRAFT_CUP_TITLE = 'Entwurf-Cup';
export const E2E_STRANGER_CUP_TITLE = 'Fremd-Cup';
/** Fixrunde 2 (N3, Ruling AA). */
export const E2E_RELEASE_CUP_TITLE = 'Freigabe-Cup';

/** Fester Share-Code des Public-Cup (Nachweis 3: anonymer Zugriff per Share-Code). */
export const E2E_PUBLIC_CUP_SHARE_CODE = 'E2EPUB';

/**
 * Fester Monitor des Public-Cup (`scripts/e2e-seed.ts`, Abschnitt "Public-Cup"). Task T4
 * (`two-devices.cloud.spec.ts`) braucht die Monitor-Route `/display/:tournamentId/:monitorId`
 * mit einem `live`-Slide, um "kein Neuladen" für einen anonymen Zuschauer belegen zu können —
 * der bereits vorhandene Seed-Monitor hatte `slides: []` (T2), das zeigt nur den
 * "keine Slides konfiguriert"-Screen, nie ein laufendes Spiel. Einzige Änderung: ein Slide.
 */
export const E2E_PUBLIC_CUP_MONITOR_ID = e2eUuid('monitor:public-cup:1');

/**
 * B-06: Monitor des Engine-Cups SPIELPLANOWNER mit einem `live`-Slide auf Feld 1. Ersetzt den entfallenen
 * Verwaltungs-Reiter „Monitor“ (alte Groß-Anzeige, Daniel 10.10.) als Weg, auf dem `spielplan-lesen.cloud.spec.ts`
 * (@FU-087) den Monitor des Eigentümers prüft: die Monitor-Seite `/display/:tournamentId/:monitorId`.
 */
export const E2E_SPIELPLANOWNER_MONITOR_ID = e2eUuid('monitor:engine-cup:SPIELPLANOWNER:1');

/**
 * Fixrunde 2 (N3, Ruling AA; vorher Fixrunde 1/I2/Ruling V, damals noch am Entwurf-Cup):
 * Sponsor + Monitor des Freigabe-Cup, für den Nachweis "Sponsor und Monitor folgen" in
 * `publish-coadmin.cloud.spec.ts` -- der Monitor zeigt EINEN `sponsor`-Slide auf genau diesen
 * Sponsor, damit ein anonymer Monitor-Aufruf nach dem (gewollten) Veröffentlichen den
 * Sponsor-Namen zeigt. Analog zum bereits vorhandenen `E2E_PUBLIC_CUP_MONITOR_ID`-Muster.
 */
export const E2E_RELEASE_CUP_MONITOR_ID = e2eUuid('monitor:release-cup:1');
export const E2E_RELEASE_CUP_SPONSOR_ID = e2eUuid('sponsor:release-cup:1');
export const E2E_RELEASE_CUP_SPONSOR_NAME = 'Freigabe-Sponsor GmbH';

/** Team-Namen des Live-Cup: 8 Teams (A–H), erste Hälfte Gruppe A, zweite Hälfte Gruppe B. */
export const E2E_LIVE_CUP_TEAM_NAMES = [
  'Team A',
  'Team B',
  'Team C',
  'Team D',
  'Team E',
  'Team F',
  'Team G',
  'Team H',
] as const;

export const E2E_LIVE_CUP_GROUP_A = E2E_LIVE_CUP_TEAM_NAMES.slice(0, 4);
export const E2E_LIVE_CUP_GROUP_B = E2E_LIVE_CUP_TEAM_NAMES.slice(4, 8);

/**
 * A-23 (Durchstich, `turniertag.spec.ts`): Turnier mit 8 Teams in 2 Gruppen und Top 4
 * (Halbfinale über Kreuz, Spiel um Platz 3, Finale). Der Seed legt es privat und unberührt an;
 * die Schritte D1-D15 spielen den Turniertag darauf durch.
 */
export const E2E_TURNIERTAG_CUP_ID = e2eUuid('tournament:turniertag-cup');
export const E2E_TURNIERTAG_CUP_TITLE = 'Turniertag-Cup';
export const E2E_TURNIERTAG_TEAM_NAMES = ['Adler', 'Bären', 'Falken', 'Löwen', 'Panther', 'Tiger', 'Wölfe', 'Füchse'] as const;
/** 2 Gruppen à 4 Teams: 2 x 6 Gruppenspiele + 2 Halbfinals + Platz 3 + Finale. */
export const E2E_TURNIERTAG_MATCH_COUNT = 16;
/** Der Turniertag-Cup ist veröffentlicht (Zuschauer-Seite, Bildschirm) mit festem Code und einem Monitor. */
export const E2E_TURNIERTAG_SHARE_CODE = 'TURNTG';
export const E2E_TURNIERTAG_MONITOR_ID = e2eUuid('monitor:turniertag-cup:1');

/** Zweites Turnier am selben Tag (D15): leerer Seed-Cup ohne Monitore, übernimmt diese aus dem Turniertag-Cup. */
export const E2E_ZWEITES_TURNIER_ID = e2eUuid('tournament:zweites-turnier');
export const E2E_ZWEITES_TURNIER_TITLE = 'Zweites Turnier';

/** Team-Namen des Public-Cup (kleiner, für "einige Ergebnisse"). */
export const E2E_PUBLIC_CUP_TEAM_NAMES = ['Public Löwen', 'Public Adler', 'Public Falken', 'Public Bären'] as const;

// =============================================================================
// MITARBEITER-ROLLEN IM LIVE-CUP (verbindliche Tabelle aus dem Brief)
// =============================================================================

export type E2ECollaboratorRole = 'owner' | 'co-admin' | 'trainer' | 'collaborator' | 'viewer';

export interface E2ELiveCupCollaboratorSpec {
  userKey: E2EUserKey;
  role: E2ECollaboratorRole;
  /** true = danach widerrufen (declined_at gesetzt) */
  revoked?: boolean;
  /** nur für trainer: eingeschränkt auf Team A */
  teamNames?: readonly string[];
}

// Abschluss-Review (final-review.md, M3): Das Feld `accepted` stand hier vorher auf JEDER Zeile
// literal `true`, wurde von scripts/e2e-seed.ts aber nie gelesen -- mapMembershipInsertToSupabase()
// setzt accepted_at IMMER (scripts/e2e-seed.ts:459-465, supabaseMappers.ts:735: `input.acceptedAtIso
// ?? now`), unabhängig vom hier gesetzten Wert. Ein künftiges `accepted: false` hätte deshalb
// stillschweigend trotzdem ein angenommenes Mitglied erzeugt -- ein totes Feld, das eine Zusage
// vortäuscht, die der Code nicht einlöst. Entfernt statt verdrahtet: eine "offene" (noch nicht
// angenommene) Mitgliedschaft mit user_id GESETZT (anders als eine reine invite_email-Einladung)
// kommt in diesem Turnier nirgends vor -- alle sechs Zeilen unten waren/sind angenommen. Offene
// Einladungen OHNE Konto deckt bereits `targetedInvites` weiter unten ab (invite_email, user_id
// NULL) -- ein strukturell anderer, bereits vorhandener Zustand.
export const E2E_LIVE_CUP_COLLABORATORS: E2ELiveCupCollaboratorSpec[] = [
  { userKey: 'owner', role: 'owner' },
  { userKey: 'coadmin', role: 'co-admin' },
  { userKey: 'helper', role: 'collaborator' },
  { userKey: 'trainer', role: 'trainer', teamNames: [E2E_LIVE_CUP_TEAM_NAMES[0]] },
  { userKey: 'viewer', role: 'viewer' },
  { userKey: 'revoked', role: 'co-admin', revoked: true },
];

// Engine-Cups (A-23/C3b-3a, S5): einzige Quelle in `engineCups.ts` (Dateigrenze 300 Zeilen).
export * from './engineCups';
