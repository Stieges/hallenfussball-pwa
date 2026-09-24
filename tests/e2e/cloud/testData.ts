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

import { createHash } from 'node:crypto';

// =============================================================================
// DETERMINISTISCHE IDs
// =============================================================================

/**
 * Deterministische UUID aus einem stabilen Seed-String (keine Zufallswerte, kein `uuid`-Paket
 * nötig). Kein RFC-4122-v5 (kein externes Namespace-Hashing-Schema vorgeschrieben) — nur
 * stabil, kollisionsarm (SHA-256) und ein gültiges `uuid`-Spaltenformat für Postgres.
 */
export function e2eUuid(seed: string): string {
  const hash = createHash('sha256').update(`hallenfussball-e2e:${seed}`).digest('hex');
  const bytes = hash.slice(0, 32).split('');
  // Version-Nibble auf "4" (kosmetisch, Postgres erzwingt das nicht, hält die IDs aber
  // von echten, per gen_random_uuid() erzeugten Zeilen visuell unterscheidbar).
  bytes[12] = '4';
  const hex = bytes.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

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
  | 'logouttest';

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

/** Titel der vier Testturniere (`scripts/e2e-seed.ts` UND `tests/e2e/cloud/smoke.spec.ts`
 *  importieren von hier — keine literale Zweitstelle). */
export const E2E_LIVE_CUP_TITLE = 'Live-Cup';
export const E2E_PUBLIC_CUP_TITLE = 'Public-Cup';
export const E2E_DRAFT_CUP_TITLE = 'Entwurf-Cup';
export const E2E_STRANGER_CUP_TITLE = 'Fremd-Cup';

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
 * Fixrunde 1 (I2, Ruling V): Sponsor + Monitor des Entwurf-Cup, für den Nachweis "Sponsor und
 * Monitor folgen" in `publish-coadmin.cloud.spec.ts` -- der Monitor zeigt EINEN `sponsor`-Slide
 * auf genau diesen Sponsor, damit ein anonymer Monitor-Aufruf nach dem (gewollten)
 * Veröffentlichen den Sponsor-Namen zeigt. Analog zum bereits vorhandenen
 * `E2E_PUBLIC_CUP_MONITOR_ID`-Muster.
 */
export const E2E_DRAFT_CUP_MONITOR_ID = e2eUuid('monitor:draft-cup:1');
export const E2E_DRAFT_CUP_SPONSOR_ID = e2eUuid('sponsor:draft-cup:1');
export const E2E_DRAFT_CUP_SPONSOR_NAME = 'Entwurf-Sponsor GmbH';

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

/** Team-Namen des Public-Cup (kleiner, für "einige Ergebnisse"). */
export const E2E_PUBLIC_CUP_TEAM_NAMES = ['Public Löwen', 'Public Adler', 'Public Falken', 'Public Bären'] as const;

// =============================================================================
// MITARBEITER-ROLLEN IM LIVE-CUP (verbindliche Tabelle aus dem Brief)
// =============================================================================

export type E2ECollaboratorRole = 'owner' | 'co-admin' | 'trainer' | 'collaborator' | 'viewer';

export interface E2ELiveCupCollaboratorSpec {
  userKey: E2EUserKey;
  role: E2ECollaboratorRole;
  /** true = angenommen (accepted_at gesetzt), false = noch offen */
  accepted: boolean;
  /** true = danach widerrufen (declined_at gesetzt) */
  revoked?: boolean;
  /** nur für trainer: eingeschränkt auf Team A */
  teamNames?: readonly string[];
}

export const E2E_LIVE_CUP_COLLABORATORS: E2ELiveCupCollaboratorSpec[] = [
  { userKey: 'owner', role: 'owner', accepted: true },
  { userKey: 'coadmin', role: 'co-admin', accepted: true },
  { userKey: 'helper', role: 'collaborator', accepted: true },
  { userKey: 'trainer', role: 'trainer', accepted: true, teamNames: [E2E_LIVE_CUP_TEAM_NAMES[0]] },
  { userKey: 'viewer', role: 'viewer', accepted: true },
  { userKey: 'revoked', role: 'co-admin', accepted: true, revoked: true },
];
