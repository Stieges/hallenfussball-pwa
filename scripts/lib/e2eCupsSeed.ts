/**
 * scripts/lib/e2eCupsSeed.ts — Cup-Erzeugung des E2E-Seeds (A-23 Fixrunde 1, Befund 3.1).
 *
 * Aus `scripts/e2e-seed.ts` ausgelagert: der Bau geplanter Turniere (`buildScheduledTournament`),
 * die Engine-Cups, die Altspiel-Cups und der Turniertag-Cup samt ihren Helfern. `e2e-seed.ts`
 * ruft `seedEngineCups`, `seedLegacyCups` und `seedTurniertagCup` weiterhin in derselben
 * Reihenfolge auf, mit denselben Logs — Verhalten und Ausgabe des Seed-Laufs sind unverändert.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  E2E_ENGINE_CUPS,
  E2E_LEGACY_CUPS,
  E2E_TURNIERTAG_CUP_ID,
  E2E_TURNIERTAG_CUP_TITLE,
  E2E_TURNIERTAG_TEAM_NAMES,
  E2E_TURNIERTAG_MATCH_COUNT,
  E2E_TURNIERTAG_SHARE_CODE,
  E2E_TURNIERTAG_MONITOR_ID,
  ENGINE_CUP_SEED_NOW_START_OFFSET_MS,
  engineCupIds,
  engineEventId,
  legacyCupIds,
  e2eUuid,
} from '../../tests/e2e/cloud/testData';
import type { TournamentCreationService } from '../../src/core/services/TournamentCreationService';
import type { ITournamentRepository } from '../../src/core/repositories/ITournamentRepository';
import type { Tournament, Team } from '../../src/core/models/types';
import { mapMembershipInsertToSupabase } from '../../src/core/repositories/supabaseMappers';
import { generateFullSchedule } from '../../src/core/generators/scheduleGenerator';
import { matchSideTeamId, transitionalSides } from '../../src/core/models/matchSlot';
import {
  assertEngineAutoSelect,
  assertLegacyMatch,
  insertLegacyGhostEvents,
  seedEngineMatch,
  type EngineSeedDeps,
} from './engineSeedDb';

/**
 * Baut ein vollständig geplantes Tournament-Objekt (Teams + generierter Spielplan), OHNE die
 * `isPublic`/`shareCode`-Zwangslogik von `TournamentCreationService.publish()` — die setzt bei
 * jeder Erstveröffentlichung `isPublic = true` (Zeilen ~187-191 der Datei), was für private,
 * aber bereits verplante Turniere (Live-Cup, Fremd-Cup) falsch wäre. Der Rest ist identisch zu
 * `publish()`: `generateFullSchedule` (nutzt intern `fairScheduler.generateGroupPhaseSchedule`)
 * + dieselbe Match-Umwandlung.
 */
export function buildScheduledTournament(
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

// =============================================================================
// ENGINE-SPIELE (A-23, übernimmt C3b-3a: S1-S8)
// =============================================================================

type SeedMatch = Tournament['matches'][number];

/** S6/S7: das Laufspiel eines Mehrspiel-Cups (MATCH_START -60 s, Tor Heim -30 s -> 1:0). */
export async function seedRunningEngineMatch(
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

async function addHelper(admin: SupabaseClient, tournamentId: string, helperId: string): Promise<void> {
  const { error } = await admin
    .from('tournament_collaborators')
    .insert(mapMembershipInsertToSupabase({ tournamentId, userId: helperId, role: 'collaborator', teamIds: [] }));
  if (error) {
    throw new Error(`Mitgliedschaft helper (${tournamentId}): ${error.message}`);
  }
}

export async function seedEngineCups(
  deps: EngineSeedDeps,
  ownerRepo: ITournamentRepository,
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
      await addHelper(deps.admin, ids.tournamentId, helperId);
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
export async function seedLegacyCups(
  deps: EngineSeedDeps,
  ownerRepo: ITournamentRepository,
  service: TournamentCreationService,
  helperId: string
): Promise<void> {
  for (const cup of E2E_LEGACY_CUPS) {
    const ids = legacyCupIds(cup.slug);
    const tournament = buildSingleMatchCup(service, ids, cup.title);
    tournament.matches[0].id = ids.matchId;
    await ownerRepo.save(tournament);
    await addHelper(deps.admin, ids.tournamentId, helperId);
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
export async function seedTurniertagCup(
  deps: EngineSeedDeps,
  ownerRepo: ITournamentRepository,
  service: TournamentCreationService
): Promise<void> {
  deps.log('Lege Turniertag-Cup an…');
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
      gamePeriods: 2,
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
  const { error: publicError } = await deps.ownerClient.rpc('make_tournament_public', { tournament_id: tournament.id });
  if (publicError) {
    throw new Error(`make_tournament_public(Turniertag-Cup): ${publicError.message}`);
  }
  const { error: shareCodeError } = await deps.admin.from('tournaments').update({ share_code: E2E_TURNIERTAG_SHARE_CODE }).eq('id', tournament.id);
  if (shareCodeError) {
    throw new Error(`Fester Share-Code Turniertag-Cup: ${shareCodeError.message}`);
  }
  deps.log(`Turniertag-Cup: ${tournament.matches.length} Spiele (12 Gruppen, 2 Halbfinals, Platz 3, Finale).`);
}
