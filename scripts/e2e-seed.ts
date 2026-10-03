/**
 * scripts/e2e-seed.ts — Testnutzer und Testturniere für die lokale Supabase-Testumgebung.
 *
 * Task T2 (.superpowers/sdd/2026-09-24-testumgebung/task-T2-brief.md). Ausführbar mit
 * `npx tsx scripts/e2e-seed.ts` bzw. `npm run test:env:seed` / `npm run test:env:reset`
 * (reset ruft dieses Skript automatisch danach auf).
 *
 * Idempotent: löscht die fünf festen Test-Turniere (kaskadiert auf Teams/Spiele/Ereignisse/
 * Mitarbeiter, Fixrunde 2/N3: Freigabe-Cup als fünftes hinzugekommen) und die zehn
 * Testnutzer-Konten (kaskadiert auf Profile, Fixrunde 2/N9: `logouttestMobile` als zehntes
 * hinzugekommen) VOR dem Neuanlegen. Ein zweiter Lauf ergibt denselben Stand (Task-T2-Nachweis 2).
 *
 * Architektur-Entscheidung (Brief, Abschnitt "Testturniere"): "Turniere, Teams, Spiele und
 * Ereignisse über die Mapper-/Repository-Schicht der App erzeugen (…), nicht per handgeschriebenem
 * SQL." und "Schreiben mit dem Service-Role-Key des lokalen Stacks." Dieses Skript setzt beides
 * um: Alle Zeilen entstehen über echte App-Bausteine —
 *   - `TournamentCreationService` (Wizard-Service) für Entwurf-Erzeugung/Defaults,
 *   - `generateFullSchedule`/`fairScheduler` (dieselben Generatoren wie der Wizard) für den
 *     Spielplan,
 *   - `mapTournamentToSupabase`/`mapMembershipInsertToSupabase`/
 *     `mapMatchEventToSupabase` (echte Mapper aus `src/core/repositories/`) für die Zeilenform —
 * aber die eigentlichen Schreibzugriffe laufen über einen Service-Role-Client (kein
 * `auth.getUser()`-Session nötig, RLS ist für den Seed irrelevant, `SupabaseRepository` selbst
 * ist an eine Vite-Singleton-Session gebunden und dafür nicht einsetzbar). `SeedRepository` unten
 * implementiert dafür `ITournamentRepository` schlank nach, mit denselben Mapper-Aufrufen wie
 * `SupabaseRepository`, nur mit einer explizit übergebenen Owner-ID statt `auth.getUser()`
 * (Ausnahme `updateMatches`: Roh-Schreibweise, s. u.).
 *
 * "Wo das nicht geht" (Brief) — bewusste Direktzugriffe ohne Mapper, mit Begründung inline:
 *   - Fester Share-Code (`E2EPUB`): `TournamentCreationService.publish()` generiert nur einen
 *     Code, wenn noch keiner gesetzt ist — wir setzen ihn vorher, kein Sonderfall nötig.
 *   - `declined_at` (widerrufene Einladung/Mitgliedschaft): Die App selbst setzt das per
 *     direktem `.update({declined_at: …})` (`invitationService.ts`), es gibt keinen Mapper dafür.
 *   - `invite_email`-Ziel-Einladungen (invitee/expired/revokedinvite): `mapInvitationInsertToSupabase`
 *     ist für Einladungs-LINKS gebaut (keine Ziel-E-Mail im Feld), nicht für an eine konkrete
 *     Adresse adressierte Einladungen mit `invite_email`. Wir bauen die Zeile direkt im
 *     `CollaboratorInsert`-Format (demselben Typ, den der Mapper auch zurückgibt).
 *   - `match_events` für das laufende Spiel: `mapMatchEventToSupabase` ist der echte Mapper
 *     (aus `liveMatchMappers.ts`, derselbe, den `SupabaseLiveMatchRepository` beim Live-Spiel
 *     nutzt) — hier direkt verwendet, weil `ITournamentRepository.save()` keine Events schreibt.
 *   - Google-Provider (`app_metadata.provider`): Auth-Admin-API, kein DB-Mapper-Thema.
 *   - Ergebnis-/Status-Spalten in `SeedRepository.updateMatches`: seit V4 sendet der Client-Mapper
 *     sie nicht mehr — der Seed schreibt sie roh (Kommentar dort, Scope-Review F3).
 */

import { createHmac } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { assertLocalSupabaseTarget } from './lib/assertLocalSupabaseTarget';
import { getLocalSupabaseStatus } from './lib/localSupabaseStatus';
import {
  E2E_USERS,
  type E2EUserKey,
  E2E_TEST_PASSWORD,
  E2E_INVITEE_EMAIL,
  E2E_EXPIRED_INVITE_EMAIL,
  E2E_REVOKED_INVITE_EMAIL,
  E2E_LIVE_CUP_ID,
  E2E_PUBLIC_CUP_ID,
  E2E_DRAFT_CUP_ID,
  E2E_STRANGER_CUP_ID,
  E2E_RELEASE_CUP_ID,
  E2E_LIVE_CUP_TITLE,
  E2E_PUBLIC_CUP_TITLE,
  E2E_DRAFT_CUP_TITLE,
  E2E_STRANGER_CUP_TITLE,
  E2E_RELEASE_CUP_TITLE,
  E2E_PUBLIC_CUP_SHARE_CODE,
  E2E_PUBLIC_CUP_MONITOR_ID,
  E2E_RELEASE_CUP_MONITOR_ID,
  E2E_RELEASE_CUP_SPONSOR_ID,
  E2E_RELEASE_CUP_SPONSOR_NAME,
  E2E_LIVE_CUP_TEAM_NAMES,
  E2E_PUBLIC_CUP_TEAM_NAMES,
  E2E_LIVE_CUP_COLLABORATORS,
  E2E_ENGINE_CUPS,
  E2E_TURNIERTAG_CUP_ID,
  E2E_TURNIERTAG_CUP_TITLE,
  E2E_TURNIERTAG_TEAM_NAMES,
  E2E_TURNIERTAG_MATCH_COUNT,
  E2E_TURNIERTAG_SHARE_CODE,
  E2E_TURNIERTAG_MONITOR_ID,
  E2E_LEGACY_CUPS,
  ENGINE_CUP_SEED_NOW_START_OFFSET_MS,
  engineCupIds,
  engineEventId,
  legacyCupIds,
  e2eUuid,
} from '../tests/e2e/cloud/testData';

import { TournamentCreationService } from '../src/core/services/TournamentCreationService';
import type { ITournamentRepository } from '../src/core/repositories/ITournamentRepository';
import type { Tournament, MatchUpdate, Team } from '../src/core/models/types';
import {
  mapTournamentToSupabase,
  mapMembershipInsertToSupabase,
  type CollaboratorInsert,
} from '../src/core/repositories/supabaseMappers';
import { callServerTime } from '../src/core/repositories/appendMatchEventsRpc';
import type { Database } from '../src/types/supabase';
import { generateFullSchedule } from '../src/core/generators/scheduleGenerator';
import { matchSideTeamId, transitionalSides } from '../src/core/models/matchSlot';
import { assertEngineAutoSelect, assertLegacyMatch, insertLegacyGhostEvents, seedEngineMatch, type EngineSeedDeps } from './lib/engineSeedDb';

// =============================================================================
// 0. PRODUKTIONS-SPERRE + CLIENT
// =============================================================================

const { url, serviceRoleKey, anonKey, jwtSecret } = getLocalSupabaseStatus();
assertLocalSupabaseTarget(url, serviceRoleKey);

const admin: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Signiert ein kurzlebiges lokales JWT für `userId` mit dem JWT-Secret des lokalen Stacks
 * (`supabase status`, Standardwert der CLI, kein Produktionsgeheimnis — siehe
 * `assertLocalSupabaseTarget.ts`). Nötig, weil manche DB-Trigger (`protect_collaborator_row`,
 * Migration `20260922_003_protect_owner_and_roles.sql`) `auth.uid()` prüfen — das ist beim
 * Service-Role-Key IMMER NULL (kein `sub`-Claim), Service-Role umgeht RLS, aber keine Trigger.
 * Für die eine Stelle, die eine echte Eigentümer-Identität braucht (Widerruf einer
 * Mitgliedschaft, `declined_at`), authentifiziert dieses Skript sich deshalb "als" der
 * jeweilige Testnutzer, statt die Prüfung zu umgehen.
 */
function signLocalUserJwt(userId: string): string {
  const base64url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: userId,
    role: 'authenticated',
    iss: 'supabase-demo',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  };
  const data = `${base64url(header)}.${base64url(payload)}`;
  const signature = createHmac('sha256', jwtSecret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function asUserClient(userId: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${signLocalUserJwt(userId)}` } },
  });
}

/** Typisierter Owner-Client (S1): `append_match_events` bricht unter Service-Role mit 42501 ab. */
function asTypedUserClient(userId: string): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${signLocalUserJwt(userId)}` } },
  });
}

// =============================================================================
// 1. SEED-REPOSITORY (siehe Kopfkommentar: gleicher Mapper wie SupabaseRepository,
//    explizite Owner-ID statt auth.getUser())
// =============================================================================

class SeedRepository implements ITournamentRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly ownerId: string
  ) {}

  async get(): Promise<Tournament | null> {
    throw new Error('SeedRepository.get() ist für den Seed nicht implementiert.');
  }

  async getByShareCode(): Promise<Tournament | null> {
    throw new Error('SeedRepository.getByShareCode() ist für den Seed nicht implementiert.');
  }

  async save(tournament: Tournament): Promise<void> {
    const { tournamentRow, teamRows, matchRows } = mapTournamentToSupabase(tournament, this.ownerId);

    const { error: tError } = await this.client.from('tournaments').upsert(tournamentRow, { onConflict: 'id' });
    if (tError) {
      throw new Error(`SeedRepository.save (tournaments): ${tError.message}`);
    }

    if (teamRows.length > 0) {
      const { error } = await this.client.from('teams').upsert(teamRows, { onConflict: 'id' });
      if (error) {
        throw new Error(`SeedRepository.save (teams): ${error.message}`);
      }
    }

    if (matchRows.length > 0) {
      const { error } = await this.client.from('matches').upsert(matchRows, { onConflict: 'id' });
      if (error) {
        throw new Error(`SeedRepository.save (matches): ${error.message}`);
      }
    }
  }

  async updateMatch(tournamentId: string, update: MatchUpdate): Promise<void> {
    return this.updateMatches(tournamentId, [update]);
  }

  /**
   * Umgeht den V4-Mapper absichtlich: der Seed bildet den Server-Zustand ab, den sonst nur der
   * RPC herstellt (Scope-Review F3). Kein Produktionspfad.
   */
  async updateMatches(tournamentId: string, updates: MatchUpdate[]): Promise<void> {
    const columnByField: ReadonlyArray<readonly [keyof MatchUpdate, string]> = [
      ['scoreA', 'score_a'],
      ['scoreB', 'score_b'],
      ['matchStatus', 'match_status'],
      ['finishedAt', 'actual_end'],
      ['timerStartTime', 'timer_start_time'],
      ['timerPausedAt', 'timer_paused_at'],
      ['timerElapsedSeconds', 'timer_elapsed_seconds'],
      ['overtimeScoreA', 'overtime_score_a'],
      ['overtimeScoreB', 'overtime_score_b'],
      ['penaltyScoreA', 'penalty_score_a'],
      ['penaltyScoreB', 'penalty_score_b'],
      ['decidedBy', 'decided_by'],
      ['skippedReason', 'skipped_reason'],
      ['skippedAt', 'skipped_at'],
    ];
    for (const update of updates) {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [field, column] of columnByField) {
        const value = update[field];
        if (value !== undefined) {
          payload[column] = value;
        }
      }
      const { error } = await this.client
        .from('matches')
        .update(payload)
        .eq('id', update.id)
        .eq('tournament_id', tournamentId);
      if (error) {
        throw new Error(`SeedRepository.updateMatches (match ${update.id}): ${error.message}`);
      }
    }
  }

  async delete(id: string): Promise<void> {
    await this.client.from('tournaments').delete().eq('id', id);
  }

  async listForCurrentUser(): Promise<Tournament[]> {
    return [];
  }

  async makeTournamentPublic(): Promise<{ shareCode: string; createdAt: string } | null> {
    throw new Error('SeedRepository.makeTournamentPublic() ist für den Seed nicht implementiert.');
  }

  async makeTournamentPrivate(): Promise<void> {
    // No-op: Der Seed setzt tournament.isPublic direkt vor dem save() (siehe buildScheduledTournament),
    // die RPC-gestützte Sichtbarkeitsumschaltung ist für die Datenanlage nicht nötig.
  }

  async regenerateShareCode(): Promise<{ shareCode: string; createdAt: string } | null> {
    throw new Error('SeedRepository.regenerateShareCode() ist für den Seed nicht implementiert.');
  }
}

// =============================================================================
// 2. HILFSFUNKTIONEN
// =============================================================================

function log(message: string): void {
  // eslint-disable-next-line no-console -- Seed-Skript (kein Produktionscode), Fortschrittsausgabe ist der Zweck.
  console.log(`[e2e-seed] ${message}`);
}

/**
 * Baut ein vollständig geplantes Tournament-Objekt (Teams + generierter Spielplan), OHNE die
 * `isPublic`/`shareCode`-Zwangslogik von `TournamentCreationService.publish()` — die setzt bei
 * jeder Erstveröffentlichung `isPublic = true` (Zeilen ~187-191 der Datei), was für private,
 * aber bereits verplante Turniere (Live-Cup, Fremd-Cup) falsch wäre. Der Rest ist identisch zu
 * `publish()`: `generateFullSchedule` (nutzt intern `fairScheduler.generateGroupPhaseSchedule`)
 * + dieselbe Match-Umwandlung.
 */
function buildScheduledTournament(
  service: TournamentCreationService,
  data: Partial<Tournament>,
  isPublic: boolean
): Tournament {
  const tournament = service.createDraft(data, data.id);
  const schedule = generateFullSchedule(tournament);

  tournament.matches = schedule.allMatches.map((scheduledMatch, index) => ({
    id: scheduledMatch.id,
    round: Math.floor(index / tournament.numberOfFields) + 1,
    field: scheduledMatch.field,
    slot: scheduledMatch.slot,
    // A-05: Spielseiten als Slot (Team-ID oder Herkunft); teamA/teamB nur ueber die eine Schreibstelle.
    ...transitionalSides(scheduledMatch.slotA, scheduledMatch.slotB),
    slotA: scheduledMatch.slotA,
    slotB: scheduledMatch.slotB,
    scoreA: scheduledMatch.scoreA,
    scoreB: scheduledMatch.scoreB,
    group: scheduledMatch.group,
    isFinal: scheduledMatch.phase !== 'groupStage',
    phase: scheduledMatch.phase,
    finalType: scheduledMatch.finalType,
    label: scheduledMatch.label,
    scheduledTime: scheduledMatch.startTime,
    referee: scheduledMatch.referee,
  }));

  tournament.status = 'published';
  tournament.isPublic = isPublic;
  tournament.updatedAt = new Date().toISOString();
  return tournament;
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const perPage = 200;
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`listUsers(page=${page}): ${error.message}`);
    }
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      return found.id;
    }
    if (data.users.length < perPage) {
      return null;
    }
  }
  return null;
}

async function deleteUserIfExists(email: string): Promise<void> {
  const id = await findUserIdByEmail(email);
  if (id) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      throw new Error(`deleteUser(${email}): ${error.message}`);
    }
  }
}

async function createTestUser(
  email: string,
  displayName: string,
  provider: 'email' | 'google' = 'email'
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    // Kein Passwort für 'google': GoTrue legt bei einem gesetzten Passwort automatisch eine
    // "email"-Identity an und überschreibt damit raw_app_meta_data.provider wieder auf 'email',
    // egal was wir hier mitgeben (empirisch geprüft). Ein Google-Testkonto hat ohnehin keinen
    // Passwort-Login — genau das simuliert dieser Zweig.
    password: provider === 'google' ? undefined : E2E_TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: displayName },
    app_metadata: provider === 'google' ? { provider: 'google', providers: ['google'] } : { provider: 'email' },
  });
  if (error || !data.user) {
    throw new Error(`createUser(${email}): ${error?.message ?? 'kein user in der Antwort'}`);
  }
  return data.user.id;
}

function deterministicToken(seed: string): string {
  return e2eUuid(`invite-token:${seed}`).replace(/-/g, '');
}


// =============================================================================
// 2b. ENGINE-SPIELE (A-23, übernimmt C3b-3a: S1-S8)
// =============================================================================

type SeedMatch = Tournament['matches'][number];

/** S6/S7: das Laufspiel eines Mehrspiel-Cups (MATCH_START -60 s, Tor Heim -30 s -> 1:0). */
async function seedRunningEngineMatch(
  deps: EngineSeedDeps,
  cupName: string,
  tournamentId: string,
  match: SeedMatch,
  idPrefix: string
): Promise<void> {
  const homeTeamId = matchSideTeamId(match, 'A');
  const awayTeamId = matchSideTeamId(match, 'B');
  if (!homeTeamId || !awayTeamId) {
    throw new Error(`${cupName}: Laufspiel ${match.id} hat keine Team-IDs.`);
  }
  await seedEngineMatch(deps, {
    slug: cupName,
    matchId: match.id,
    homeTeamId,
    awayTeamId,
    form: 'running',
    specs: [
      { key: 'start', type: 'MATCH_START', atOffsetMs: ENGINE_START_OFFSET_MS },
      { key: 'goal-home', type: 'GOAL', side: 'home', atOffsetMs: ENGINE_GOAL_OFFSET_MS },
    ],
    idFor: (key) => e2eUuid(`event:${idPrefix}:${match.id}:${key}`),
    startOffsetMs: ENGINE_START_OFFSET_MS,
    expected: { status: 'running', scoreA: 1, scoreB: 0 },
  });
  await assertEngineAutoSelect(deps.admin, cupName, tournamentId, match.id);
  deps.log(`${cupName}: Auto-Auswahl trifft das Engine-Laufspiel.`);
}

const ENGINE_START_OFFSET_MS = ENGINE_CUP_SEED_NOW_START_OFFSET_MS;
const ENGINE_GOAL_OFFSET_MS = -30_000;

/** Zwei Teams, ein Spiel (S5/S8): feste IDs, Spiel-ID nach dem Spielplan überschrieben. */
function buildSingleMatchCup(
  service: TournamentCreationService,
  ids: ReturnType<typeof engineCupIds>,
  title: string
): Tournament {
  const tournament = buildScheduledTournament(
    service,
    {
      id: ids.tournamentId,
      title,
      ageClass: 'U13',
      date: new Date().toISOString().split('T')[0],
      timeSlot: '09:00 - 16:00',
      startTime: '09:00',
      location: { name: 'Sporthalle Testumgebung' },
      numberOfFields: 1,
      numberOfTeams: 2,
      groupSystem: 'roundRobin',
      numberOfGroups: 1,
      groupPhaseGameDuration: 60,
      gamePeriods: 1,
      teams: [
        { id: ids.homeTeamId, name: ids.homeTeamName },
        { id: ids.awayTeamId, name: ids.awayTeamName },
      ],
    },
    /* isPublic */ false
  );
  if (tournament.matches.length !== 1) {
    throw new Error(`${title}: erwartet genau 1 Spiel, Spielplan hat ${tournament.matches.length}.`);
  }
  return tournament;
}

async function addHelper(tournamentId: string, helperId: string): Promise<void> {
  const { error } = await admin
    .from('tournament_collaborators')
    .insert(mapMembershipInsertToSupabase({ tournamentId, userId: helperId, role: 'collaborator', teamIds: [] }));
  if (error) {
    throw new Error(`Mitgliedschaft helper (${tournamentId}): ${error.message}`);
  }
}

async function seedEngineCups(
  deps: EngineSeedDeps,
  ownerRepo: SeedRepository,
  service: TournamentCreationService,
  helperId: string
): Promise<void> {
  deps.log(`Lege ${E2E_ENGINE_CUPS.length} Engine-Cups an…`);
  for (const cup of E2E_ENGINE_CUPS) {
    const ids = engineCupIds(cup.slug);
    const tournament = buildSingleMatchCup(service, ids, cup.title);
    tournament.matches[0].id = ids.matchId;
    await ownerRepo.save(tournament);
    if (cup.helper) {
      await addHelper(ids.tournamentId, helperId);
    }
    await seedEngineMatch(deps, {
      slug: cup.slug,
      matchId: ids.matchId,
      homeTeamId: ids.homeTeamId,
      awayTeamId: ids.awayTeamId,
      form: cup.form,
      specs: cup.events,
      idFor: (key) => engineEventId(cup.slug, key),
      startOffsetMs: ENGINE_START_OFFSET_MS,
      expected: cup.expected,
    });
  }
}

/** S8: Altspiel-Fixtures nur für C3b-3b (kein Test darauf in diesem Paket). */
async function seedLegacyCups(
  deps: EngineSeedDeps,
  ownerRepo: SeedRepository,
  service: TournamentCreationService,
  helperId: string
): Promise<void> {
  for (const cup of E2E_LEGACY_CUPS) {
    const ids = legacyCupIds(cup.slug);
    const tournament = buildSingleMatchCup(service, ids, cup.title);
    tournament.matches[0].id = ids.matchId;
    await ownerRepo.save(tournament);
    await addHelper(ids.tournamentId, helperId);
    const nowIso = new Date().toISOString();
    await ownerRepo.updateMatches(ids.tournamentId, [
      cup.rawStatus === 'finished'
        ? { id: ids.matchId, scoreA: cup.scoreA, scoreB: cup.scoreB, matchStatus: 'finished', finishedAt: nowIso }
        : { id: ids.matchId, scoreA: cup.scoreA, scoreB: cup.scoreB, matchStatus: 'running', timerStartTime: nowIso, timerElapsedSeconds: 300 },
    ]);
    if (cup.rawStatus === 'running') {
      await insertLegacyGhostEvents(deps.admin, ids.matchId, ids.homeTeamId, (key) => e2eUuid(`event:legacy-cup:${cup.slug}:${key}`));
    }
    await assertLegacyMatch(deps.admin, cup.slug, ids.matchId, cup.rawStatus);
    deps.log(`Altspiel-Cup ${cup.slug}: ${cup.rawStatus}, keine Engine-Zeile.`);
  }
}


/** A-23 (Durchstich): 8 Teams, 2 Gruppen, Top 4 -- privat, unberührt, ohne Mitglieder außer dem Owner. */
async function seedTurniertagCup(
  ownerRepo: SeedRepository,
  service: TournamentCreationService,
  ownerClient: SupabaseClient<Database>
): Promise<void> {
  log('Lege Turniertag-Cup an…');
  const teams: Team[] = E2E_TURNIERTAG_TEAM_NAMES.map((name, index) => ({
    id: e2eUuid(`team:turniertag-cup:${name}`),
    name,
    group: index < 4 ? 'A' : 'B',
  }));
  const tournament = buildScheduledTournament(
    service,
    {
      id: E2E_TURNIERTAG_CUP_ID,
      title: E2E_TURNIERTAG_CUP_TITLE,
      ageClass: 'U13',
      date: new Date().toISOString().split('T')[0],
      timeSlot: '09:00 - 16:00',
      startTime: '09:00',
      location: { name: 'Sporthalle Testumgebung' },
      numberOfFields: 2,
      numberOfTeams: teams.length,
      groupSystem: 'groupsAndFinals',
      numberOfGroups: 2,
      groupPhaseGameDuration: 60,
      gamePeriods: 1,
      finals: { final: true, thirdPlace: true, fifthSixth: false, seventhEighth: false },
      finalsConfig: { preset: 'top-4' },
      teams,
      monitors: [
        {
          id: E2E_TURNIERTAG_MONITOR_ID,
          name: 'Hallenbildschirm',
          defaultSlideDuration: 15,
          transition: 'fade',
          transitionDuration: 500,
          theme: 'dark',
          performanceMode: 'auto',
          slides: [
            { id: e2eUuid('monitor:turniertag-cup:1:slide:live-field-1'), type: 'live', config: { fieldId: 'field-1' }, duration: null, order: 0 },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
    /* isPublic */ false
  );
  tournament.publishedAt = new Date().toISOString(); // Backstop von make_tournament_public()
  if (tournament.matches.length !== E2E_TURNIERTAG_MATCH_COUNT) {
    throw new Error(`Turniertag-Cup: erwartet ${E2E_TURNIERTAG_MATCH_COUNT} Spiele, Spielplan hat ${tournament.matches.length}.`);
  }
  await ownerRepo.save(tournament);
  const { error: publicError } = await ownerClient.rpc('make_tournament_public', { tournament_id: tournament.id });
  if (publicError) {
    throw new Error(`make_tournament_public(Turniertag-Cup): ${publicError.message}`);
  }
  const { error: shareCodeError } = await admin.from('tournaments').update({ share_code: E2E_TURNIERTAG_SHARE_CODE }).eq('id', tournament.id);
  if (shareCodeError) {
    throw new Error(`Fester Share-Code Turniertag-Cup: ${shareCodeError.message}`);
  }
  log(`Turniertag-Cup: ${tournament.matches.length} Spiele (12 Gruppen, 2 Halbfinals, Platz 3, Finale).`);
}

// =============================================================================
// 3. HAUPTABLAUF
// =============================================================================

async function main(): Promise<void> {
  log(`Ziel: ${url} (Produktions-Sperre bestanden).`);

  // ---------------------------------------------------------------------------
  // 3.1 Alte Testdaten entfernen (Reihenfolge wichtig: Turniere VOR Nutzern —
  // tournament_collaborators.invited_by hat KEIN ON DELETE CASCADE, würde beim
  // Löschen eines Nutzers mit offenen invited_by-Verweisen sonst einen FK-Fehler
  // werfen. tournaments.owner_id UND tournament_collaborators.tournament_id
  // haben ON DELETE CASCADE, also räumt das Löschen der Turniere zuerst alle
  // Collaborator-Zeilen weg, bevor die Nutzer verschwinden.)
  // ---------------------------------------------------------------------------
  log('Lösche bestehende Test-Turniere (falls vorhanden)…');
  const allTournamentIds = [
    E2E_LIVE_CUP_ID,
    E2E_PUBLIC_CUP_ID,
    E2E_DRAFT_CUP_ID,
    E2E_STRANGER_CUP_ID,
    E2E_RELEASE_CUP_ID,
    E2E_TURNIERTAG_CUP_ID,
    ...E2E_ENGINE_CUPS.map((cup) => engineCupIds(cup.slug).tournamentId),
    ...E2E_LEGACY_CUPS.map((cup) => legacyCupIds(cup.slug).tournamentId),
  ];
  const { error: deleteTournamentsError } = await admin.from('tournaments').delete().in('id', allTournamentIds);
  if (deleteTournamentsError) {
    throw new Error(`Löschen bestehender Turniere: ${deleteTournamentsError.message}`);
  }

  log('Lösche bestehende Testnutzer-Konten (falls vorhanden)…');
  const userKeys = Object.keys(E2E_USERS) as E2EUserKey[];
  for (const key of userKeys) {
    await deleteUserIfExists(E2E_USERS[key].email);
  }

  // ---------------------------------------------------------------------------
  // 3.2 Testnutzer neu anlegen
  // ---------------------------------------------------------------------------
  log('Lege Testnutzer an…');
  const userIds: Record<E2EUserKey, string> = {} as Record<E2EUserKey, string>;
  for (const key of userKeys) {
    const spec = E2E_USERS[key];
    userIds[key] = await createTestUser(spec.email, spec.displayName, key === 'google' ? 'google' : 'email');
  }
  log(`${userKeys.length} Testnutzer angelegt.`);

  // handle_new_user() (Trigger, AFTER INSERT ON auth.users) liest raw_app_meta_data.provider
  // im selben Statement, in dem GoTrue den Nutzer anlegt — GoTrue setzt app_metadata bei
  // admin.createUser() aber in einem SEPARATEN Folge-Update, NACH diesem INSERT (empirisch
  // geprüft: raw_app_meta_data.provider ist danach korrekt "google", profiles.auth_provider
  // trotzdem noch "email"). Der ON-CONFLICT-Zweig des Triggers hilft nicht (er behält den
  // bestehenden Wert, wenn er nicht NULL ist — COALESCE(profiles.auth_provider, …)). Direktes
  // Update ist hier der einzige Weg (kein Mapper dafür, reiner Auth-Metadaten-Fixup).
  const { error: googleProviderError } = await admin
    .from('profiles')
    .update({ auth_provider: 'google' })
    .eq('id', userIds.google);
  if (googleProviderError) {
    throw new Error(`Google-Provider-Fixup: ${googleProviderError.message}`);
  }

  const ownerRepo = new SeedRepository(admin, userIds.owner);
  const strangerRepo = new SeedRepository(admin, userIds.stranger);
  const service = new TournamentCreationService(ownerRepo);
  const strangerService = new TournamentCreationService(strangerRepo);

  // S3: Serverzeit EINMAL je Seed-Lauf (nicht Date.now(): Host- und Docker-Uhr können abweichen).
  const ownerClient = asTypedUserClient(userIds.owner);
  const seedNow = await callServerTime(ownerClient);
  log(`seedNow aus server_time: ${new Date(seedNow).toISOString()}.`);
  const engineDeps: EngineSeedDeps = { admin, ownerClient, seedNow, log };
  // S4: Spieldauer 60 min, ein Abschnitt -- über das Turnier, nicht über matches.duration_minutes.
  const engineDuration = { groupPhaseGameDuration: 60, gamePeriods: 1 } as const;

  // ---------------------------------------------------------------------------
  // 3.3 Live-Cup: privat, Gruppenphase, 8 Teams (A–H) in 2 Gruppen
  // ---------------------------------------------------------------------------
  log('Lege Live-Cup an…');
  const liveCupTeams: Team[] = E2E_LIVE_CUP_TEAM_NAMES.map((name, index) => ({
    id: e2eUuid(`team:live-cup:${name}`),
    name,
    group: index < 4 ? 'A' : 'B',
  }));

  const liveCup = buildScheduledTournament(
    service,
    {
      id: E2E_LIVE_CUP_ID,
      title: E2E_LIVE_CUP_TITLE,
      ageClass: 'U13',
      date: new Date().toISOString().split('T')[0],
      timeSlot: '09:00 - 16:00',
      startTime: '09:00',
      location: { name: 'Sporthalle Testumgebung' },
      numberOfFields: 2,
      numberOfTeams: liveCupTeams.length,
      groupSystem: 'groupsAndFinals', // 2 getrennte Gruppen, aber KEINE Finalrunde (s.u.)
      numberOfGroups: 2,
      ...engineDuration,
      // Keine Playoffs: finals bleiben false, finalsConfig.preset 'none' (Default aus createDraft) —
      // groupsAndFinals wird NUR gebraucht, damit generateGroupStageMatches() die Teams nach
      // team.group in 2 echte Gruppen statt einer einzigen "all"-Gruppe aufteilt
      // (scheduleGenerator.ts: generateGroupStageMatches, roundRobin-Zweig ignoriert team.group).
      teams: liveCupTeams,
    },
    /* isPublic */ false
  );
  await ownerRepo.save(liveCup);

  const [matchDone1, matchDone2, matchRunning] = liveCup.matches;
  const now = new Date().toISOString();
  // S6: matchDone1/2 bleiben beendete ALTspiele (3:1, 2:2, ohne Ereignisse), das laufende Spiel
  // ist ein Engine-Spiel -- seine Spalten setzt nur die RPC (kein updateMatches darauf).
  await ownerRepo.updateMatches(liveCup.id, [
    { id: matchDone1.id, scoreA: 3, scoreB: 1, matchStatus: 'finished', finishedAt: now },
    { id: matchDone2.id, scoreA: 2, scoreB: 2, matchStatus: 'finished', finishedAt: now },
  ]);
  await seedRunningEngineMatch(engineDeps, 'Live-Cup', liveCup.id, matchRunning, 'live-cup');

  // ---------------------------------------------------------------------------
  // 3.4 Live-Cup Mitarbeiter (Owner, Co-Admin, Helper/Collaborator, Trainer, Viewer,
  //     widerrufener Co-Admin) + offene/abgelaufene/widerrufene Einladungen
  // ---------------------------------------------------------------------------
  log('Lege Live-Cup Mitarbeiter + Einladungen an…');
  const teamIdByName = new Map(liveCupTeams.map((t) => [t.name, t.id]));

  for (const collab of E2E_LIVE_CUP_COLLABORATORS) {
    const membershipRow = mapMembershipInsertToSupabase({
      tournamentId: E2E_LIVE_CUP_ID,
      userId: userIds[collab.userKey],
      role: collab.role,
      teamIds: (collab.teamNames ?? []).map((name) => teamIdByName.get(name)).filter((id): id is string => Boolean(id)),
    });
    const { error } = await admin.from('tournament_collaborators').insert(membershipRow);
    if (error) {
      throw new Error(`Mitgliedschaft ${collab.userKey}: ${error.message}`);
    }
    if (collab.revoked) {
      // Kein Mapper dafür — die App selbst setzt declined_at per direktem Update
      // (src/features/auth/services/invitationService.ts), kein Sonderfall.
      // `protect_collaborator_row` (20260922_003) prüft `user_owns_tournament()`, also
      // `auth.uid()` — beim Service-Role-Key immer NULL. Deshalb hier als Owner authentifiziert
      // (siehe signLocalUserJwt/asUserClient oben), nicht mit dem Service-Role-Client.
      const { error: revokeError } = await asUserClient(userIds.owner)
        .from('tournament_collaborators')
        .update({ declined_at: new Date().toISOString() })
        .eq('tournament_id', E2E_LIVE_CUP_ID)
        .eq('user_id', userIds[collab.userKey]);
      if (revokeError) {
        throw new Error(`Widerruf ${collab.userKey}: ${revokeError.message}`);
      }
    }
  }

  // invite_email-Ziel-Einladungen: mapInvitationInsertToSupabase deckt das nicht ab
  // (kein invite_email-Feld, siehe Kopfkommentar) — direkte CollaboratorInsert-Zeilen.
  const nowIso = new Date().toISOString();
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const targetedInvites: CollaboratorInsert[] = [
    {
      tournament_id: E2E_LIVE_CUP_ID,
      invite_email: E2E_INVITEE_EMAIL,
      invite_code: deterministicToken('invitee'),
      role: 'co-admin',
      invited_by: userIds.owner,
      invited_at: nowIso,
      expires_at: in7Days,
      max_uses: 1,
      use_count: 0,
      team_ids: [],
    },
    {
      tournament_id: E2E_LIVE_CUP_ID,
      invite_email: E2E_EXPIRED_INVITE_EMAIL,
      invite_code: deterministicToken('expired'),
      role: 'viewer',
      invited_by: userIds.owner,
      invited_at: yesterday,
      expires_at: yesterday, // bereits abgelaufen
      max_uses: 1,
      use_count: 0,
      team_ids: [],
    },
    {
      tournament_id: E2E_LIVE_CUP_ID,
      invite_email: E2E_REVOKED_INVITE_EMAIL,
      invite_code: deterministicToken('revokedinvite'),
      role: 'collaborator',
      invited_by: userIds.owner,
      invited_at: nowIso,
      expires_at: in7Days,
      declined_at: nowIso, // widerrufen, bevor sie je angenommen wurde
      max_uses: 1,
      use_count: 0,
      team_ids: [],
    },
  ];
  const { error: invitesError } = await admin.from('tournament_collaborators').insert(targetedInvites);
  if (invitesError) {
    throw new Error(`Ziel-Einladungen: ${invitesError.message}`);
  }

  // ---------------------------------------------------------------------------
  // 3.5 Public-Cup: veröffentlicht, fester Share-Code, 1 Monitor, 1 Sponsor
  // ---------------------------------------------------------------------------
  log('Lege Public-Cup an…');
  const publicCupTeams: Team[] = E2E_PUBLIC_CUP_TEAM_NAMES.map((name) => ({
    id: e2eUuid(`team:public-cup:${name}`),
    name,
  }));

  const publicCup = service.createDraft({
    id: E2E_PUBLIC_CUP_ID,
    title: E2E_PUBLIC_CUP_TITLE,
    ageClass: 'U15',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '10:00 - 15:00',
    startTime: '10:00',
    location: { name: 'Sporthalle Testumgebung' },
    numberOfFields: 1,
    numberOfTeams: publicCupTeams.length,
    groupSystem: 'roundRobin',
    numberOfGroups: 1,
    ...engineDuration,
    teams: publicCupTeams,
    monitors: [
      {
        id: E2E_PUBLIC_CUP_MONITOR_ID,
        name: 'Haupthalle Eingang',
        defaultSlideDuration: 15,
        transition: 'fade',
        transitionDuration: 500,
        theme: 'dark',
        performanceMode: 'auto',
        // Task T4 (two-devices.cloud.spec.ts): ein `live`-Slide auf Feld 1 -- ohne das zeigt
        // die Monitor-Route (`/display/:tournamentId/:monitorId`) nur den "keine Slides
        // konfiguriert"-Screen und nie das laufende Spiel, das der Test dort ohne Neuladen
        // erwartet zu sehen. `tests/e2e/cloud/testData.ts#E2E_PUBLIC_CUP_MONITOR_ID` ist die
        // einzige Quelle für die ID.
        slides: [
          {
            id: e2eUuid('monitor:public-cup:1:slide:live-field-1'),
            type: 'live',
            config: { fieldId: 'field-1' },
            duration: null,
            order: 0,
          },
        ],
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    sponsors: [
      {
        id: e2eUuid('sponsor:public-cup:1'),
        name: 'Test-Sponsor GmbH',
        tier: 'gold',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
  });

  const schedule = generateFullSchedule(publicCup);
  publicCup.matches = schedule.allMatches.map((scheduledMatch, index) => ({
    id: scheduledMatch.id,
    round: Math.floor(index / publicCup.numberOfFields) + 1,
    field: scheduledMatch.field,
    slot: scheduledMatch.slot,
    // A-05: Spielseiten als Slot (Team-ID oder Herkunft); teamA/teamB nur ueber die eine Schreibstelle.
    ...transitionalSides(scheduledMatch.slotA, scheduledMatch.slotB),
    slotA: scheduledMatch.slotA,
    slotB: scheduledMatch.slotB,
    scoreA: scheduledMatch.scoreA,
    scoreB: scheduledMatch.scoreB,
    group: scheduledMatch.group,
    isFinal: scheduledMatch.phase !== 'groupStage',
    phase: scheduledMatch.phase,
    finalType: scheduledMatch.finalType,
    label: scheduledMatch.label,
    scheduledTime: scheduledMatch.startTime,
    referee: scheduledMatch.referee,
  }));
  publicCup.status = 'published';
  publicCup.publishedAt = nowIso; // Backstop von make_tournament_public() prüft config->>'publishedAt'
  publicCup.updatedAt = nowIso;
  await ownerRepo.save(publicCup);

  // is_public/share_code stehen NICHT in mapTournamentToSupabase()'s tournamentRow (bewusst so
  // gebaut, siehe Kommentar "K1" dort) — die Spalten der tournaments-Tabelle selbst werden nur
  // über die RPC `make_tournament_public` gesetzt (SupabaseRepository.makeTournamentPublic()),
  // die echte Owner-Identität via `auth.uid()` prüft und `config ? 'publishedAt'` voraussetzt.
  // `tournament_visibility_cascade` (AFTER UPDATE ON tournaments) verteilt is_public danach an
  // teams/matches/match_events. Die RPC erzeugt aber IMMER einen zufälligen Code — der Brief
  // verlangt einen festen ("E2EPUB"). Deshalb: RPC (für den echten, geprüften is_public-Zustand)
  // + anschließendes, gezieltes Service-Role-Update NUR für share_code (Brief-Ausnahme).
  const { error: makePublicError } = await asUserClient(userIds.owner).rpc('make_tournament_public', {
    tournament_id: publicCup.id,
  });
  if (makePublicError) {
    throw new Error(`make_tournament_public(Public-Cup): ${makePublicError.message}`);
  }
  const { error: fixedShareCodeError } = await admin
    .from('tournaments')
    .update({ share_code: E2E_PUBLIC_CUP_SHARE_CODE })
    .eq('id', publicCup.id);
  if (fixedShareCodeError) {
    throw new Error(`Fester Share-Code Public-Cup: ${fixedShareCodeError.message}`);
  }

  // "einige Ergebnisse"
  await ownerRepo.updateMatches(
    publicCup.id,
    publicCup.matches.slice(0, 2).map((m) => ({
      id: m.id,
      scoreA: 2,
      scoreB: 0,
      matchStatus: 'finished' as const,
      finishedAt: nowIso,
    }))
  );

  // S7: das dritte Public-Cup-Spiel ist ein Engine-Laufspiel auf Feld 1 (dort schaut der
  // `live`-Slide des Seed-Monitors hin); alle Spiele AB Index 3 bleiben unangetastet.
  const publicCupRunningMatch = publicCup.matches[2];
  if (!publicCupRunningMatch) {
    throw new Error('Public-Cup: erwartetes drittes Spiel (Index 2) für das Engine-Laufspiel fehlt.');
  }
  await seedRunningEngineMatch(engineDeps, 'Public-Cup', publicCup.id, publicCupRunningMatch, 'public-cup');

  // ---------------------------------------------------------------------------
  // 3.6 Entwurf-Cup: Entwurf, privat, OHNE publishedAt (Fixrunde 2, N3/Ruling AA -- wieder
  // wörtlich wie im T2-Brief: "Entwurf-Cup | Entwurf, privat, ohne publishedAt". Fixrunde 1
  // hatte hier probeweise publishedAt gesetzt, um die Veröffentlichen-RPC prüfbar zu machen --
  // das ging über Ruling V hinaus und widersprach dem Brief. Der dafür nötige Zustand
  // (veröffentlicht + privat + coadmin) steht jetzt im eigenen Freigabe-Cup, siehe 3.7.)
  // ---------------------------------------------------------------------------
  log('Lege Entwurf-Cup an…');
  const draftCup = service.createDraft({
    id: E2E_DRAFT_CUP_ID,
    title: E2E_DRAFT_CUP_TITLE,
    ageClass: 'U11',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '09:00 - 16:00',
    startTime: '09:00',
    location: { name: 'Sporthalle Testumgebung' },
    numberOfTeams: 2,
    teams: [
      { id: e2eUuid('team:draft-cup:1'), name: 'Entwurf Team 1' },
      { id: e2eUuid('team:draft-cup:2'), name: 'Entwurf Team 2' },
    ],
  });
  // status bleibt 'draft' (createDraft-Default), matches bleiben [] — kein publish(), also
  // auch kein publishedAt in config (Brief: "ohne publishedAt").
  await ownerRepo.save(draftCup);

  // ---------------------------------------------------------------------------
  // 3.7 Freigabe-Cup: veröffentlicht (publishedAt gesetzt), privat (is_public=false), coadmin
  // als Co-Admin, 1 Sponsor + 1 Monitor (Fixrunde 2, N3/Ruling AA -- neues, fünftes
  // Testturnier NUR für `publish-coadmin.cloud.spec.ts`, das Brief-Szenario "coadmin
  // veröffentlicht [ein Turnier]" braucht ein Turnier, das schon veröffentlicht (publishedAt
  // gesetzt) aber noch NICHT öffentlich (is_public=false) ist -- genau der Zustand, den der
  // Entwurf-Cup laut Brief NICHT haben darf. `buildScheduledTournament()` (s. o.) setzt
  // `status='published'` aber NIE `publishedAt` -- deshalb hier wie beim Public-Cup ein
  // expliziter Nachtrag.
  //
  // Fixrunde 3 (N15, Begründung geschärft): `publishedAt` in `config` ist NICHT primär wegen des
  // `isDraft`-UI-Gates nötig -- ein bloßes `status='published'` würde dafür schon reichen, weil
  // die App `publishedAt` beim LESEN aus `status` rückwirkend ableitet, falls `config.publishedAt`
  // fehlt (`supabaseMappers.ts:545-547`, reines Anzeige-Backfill). Zwingend ist der Wert in
  // `config` für den DB-TRIGGER `enforce_release_before_public` (HF001,
  // `20260921_001_enforce_release_before_public.sql`), der beim Übergang zu `is_public=true`
  // direkt `config ? 'publishedAt'` in SQL prüft -- der kennt das clientseitige Backfill nicht.
  // Ohne diesen Nachtrag würde also nicht die UI-Sektion blockieren (die zeigt sich trotzdem
  // offen), sondern der spätere `UPDATE ... SET is_public=true` mit HF001 abgelehnt.
  // ---------------------------------------------------------------------------
  log('Lege Freigabe-Cup an…');
  const releaseCup = buildScheduledTournament(
    service,
    {
      id: E2E_RELEASE_CUP_ID,
      title: E2E_RELEASE_CUP_TITLE,
      ageClass: 'U15',
      date: new Date().toISOString().split('T')[0],
      timeSlot: '09:00 - 16:00',
      startTime: '09:00',
      location: { name: 'Sporthalle Testumgebung' },
      numberOfTeams: 2,
      teams: [
        { id: e2eUuid('team:release-cup:1'), name: 'Freigabe Team 1' },
        { id: e2eUuid('team:release-cup:2'), name: 'Freigabe Team 2' },
      ],
      sponsors: [
        {
          id: E2E_RELEASE_CUP_SPONSOR_ID,
          name: E2E_RELEASE_CUP_SPONSOR_NAME,
          tier: 'gold',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      monitors: [
        {
          id: E2E_RELEASE_CUP_MONITOR_ID,
          name: 'Freigabe-Monitor',
          defaultSlideDuration: 15,
          transition: 'fade',
          transitionDuration: 500,
          theme: 'dark',
          performanceMode: 'auto',
          slides: [
            {
              id: e2eUuid('monitor:release-cup:1:slide:sponsor'),
              type: 'sponsor',
              config: { sponsorId: E2E_RELEASE_CUP_SPONSOR_ID, showQrCode: false },
              duration: null,
              order: 0,
            },
          ],
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
    },
    /* isPublic */ false
  );
  releaseCup.publishedAt = nowIso; // s. Kommentar oben -- Backstop, wie beim Public-Cup.
  await ownerRepo.save(releaseCup);

  const { error: releaseCoadminError } = await admin.from('tournament_collaborators').insert(
    mapMembershipInsertToSupabase({
      tournamentId: E2E_RELEASE_CUP_ID,
      userId: userIds.coadmin,
      role: 'co-admin',
      teamIds: [],
    })
  );
  if (releaseCoadminError) {
    throw new Error(`Mitgliedschaft coadmin (Freigabe-Cup): ${releaseCoadminError.message}`);
  }

  // ---------------------------------------------------------------------------
  // 3.8 Fremd-Cup: Eigentümer stranger, privat
  // ---------------------------------------------------------------------------
  log('Lege Fremd-Cup an…');
  const strangerCup = strangerService.createDraft({
    id: E2E_STRANGER_CUP_ID,
    title: E2E_STRANGER_CUP_TITLE,
    ageClass: 'U11',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '09:00 - 16:00',
    startTime: '09:00',
    location: { name: 'Sporthalle Testumgebung' },
    numberOfTeams: 2,
    teams: [
      { id: e2eUuid('team:stranger-cup:1'), name: 'Fremd Team 1' },
      { id: e2eUuid('team:stranger-cup:2'), name: 'Fremd Team 2' },
    ],
  });
  await strangerRepo.save(strangerCup);

  await seedEngineCups(engineDeps, ownerRepo, service, userIds.helper);
  await seedLegacyCups(engineDeps, ownerRepo, service, userIds.helper);
  await seedTurniertagCup(ownerRepo, service, ownerClient);

  log('Fertig.');
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- Seed-Skript (kein Produktionscode), Fehlerausgabe ist der Zweck.
  console.error('[e2e-seed] Fehlgeschlagen:', error);
  process.exit(1);
});
