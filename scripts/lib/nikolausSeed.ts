/**
 * scripts/lib/nikolausSeed.ts — Testdaten-Vorlage „Nikolaus-Turnier TEST“ (Hauptlinie des Durchstichs).
 *
 * Im Stil von `e2eCupsSeed.ts` (Turniertag-Cup): derselbe `TournamentCreationService` und derselbe Generator wie der
 * Assistent, also der echte Runden-Spielplan mit Eröffnung durch den Veranstalter (@W4-029 ff., @W4-033). Das Turnier
 * ist veröffentlicht (fester Share-Code, ein Monitor), ohne Mitglieder außer dem Owner, und noch ganz unberührt.
 * Nur gegen den lokalen Stack (`assertLocalSupabaseTarget` im Aufrufer `e2e-seed.ts`), nie gegen Produktion.
 *
 * Reihenfolge der Tabellenkriterien: die Voreinstellung für private Hallenturniere nach BFV Teil 3 § 20 (13)
 * (@W2A-046): Punkte, direkter Vergleich, Tordifferenz, erzielte Tore. Der Assistent setzt sie heute noch nicht von
 * selbst (Paket TB); der Seed gibt sie vor, damit die Tabelle des Turniers eindeutig festliegt.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  E2E_NIKOLAUS_AGE_CLASS,
  E2E_NIKOLAUS_CHANGE_MINUTES,
  E2E_NIKOLAUS_CUPS,
  E2E_NIKOLAUS_DATE,
  E2E_NIKOLAUS_END_TIME,
  E2E_NIKOLAUS_GAME_MINUTES,
  E2E_NIKOLAUS_HOST_TEAM_NAMES,
  E2E_NIKOLAUS_LOCATION,
  E2E_NIKOLAUS_MATCH_COUNT,
  E2E_NIKOLAUS_ORGANIZER,
  E2E_NIKOLAUS_START_TIME,
  E2E_NIKOLAUS_TEAM_NAMES,
  e2eUuid,
  type NikolausVariante,
} from '../../tests/e2e/cloud/testData';
import type { TournamentCreationService } from '../../src/core/services/TournamentCreationService';
import type { ITournamentRepository } from '../../src/core/repositories/ITournamentRepository';
import type { Team, Tournament } from '../../src/core/models/types';
import { DEFAULT_OPENING_MODE } from '../../src/types/tournament';
import { mapMembershipInsertToSupabase } from '../../src/core/repositories/supabaseMappers';
import { buildScheduledTournament } from './e2eCupsSeed';

/** Das Nikolaus-Turnier als Turnierobjekt mit dem echten Spielplan (ohne Datenbank, deshalb ohne Aufwand prüfbar). */
export function buildNikolausTournament(service: TournamentCreationService, variante: NikolausVariante = 'haupt'): Tournament {
  const cup = E2E_NIKOLAUS_CUPS[variante];
  const teams: Team[] = E2E_NIKOLAUS_TEAM_NAMES.map((name) => ({ id: cup.teamId(name), name }));
  const nowIso = new Date().toISOString();
  const tournament = buildScheduledTournament(
    service,
    {
      id: cup.tournamentId,
      title: cup.title,
      ageClass: E2E_NIKOLAUS_AGE_CLASS,
      date: E2E_NIKOLAUS_DATE,
      startDate: E2E_NIKOLAUS_DATE,
      timeSlot: `${E2E_NIKOLAUS_START_TIME} - ${E2E_NIKOLAUS_END_TIME}`,
      startTime: E2E_NIKOLAUS_START_TIME,
      location: { name: E2E_NIKOLAUS_LOCATION },
      organizer: E2E_NIKOLAUS_ORGANIZER,
      numberOfFields: 1,
      numberOfTeams: teams.length,
      groupSystem: 'roundRobin',
      numberOfGroups: 1,
      groupPhaseGameDuration: E2E_NIKOLAUS_GAME_MINUTES,
      groupPhaseBreakDuration: E2E_NIKOLAUS_CHANGE_MINUTES,
      gamePeriods: 1,
      placementLogic: [
        { id: 'points', enabled: true },
        { id: 'directComparison', enabled: true },
        { id: 'goalDifference', enabled: true },
        { id: 'goalsFor', enabled: true },
      ],
      teams,
      hostTeamIds: E2E_NIKOLAUS_HOST_TEAM_NAMES.map(cup.teamId),
      openingMode: DEFAULT_OPENING_MODE,
      monitors: [
        {
          id: cup.monitorId,
          name: 'Hallenbildschirm',
          defaultSlideDuration: 15,
          transition: 'fade',
          transitionDuration: 500,
          theme: 'dark',
          performanceMode: 'auto',
          slides: [
            { id: e2eUuid(`monitor:nikolaus-cup:${variante}:1:slide:live-field-1`), type: 'live', config: { fieldId: 'field-1' }, duration: null, order: 0 },
          ],
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
    },
    /* isPublic */ false
  );
  tournament.publishedAt = nowIso; // Backstop von make_tournament_public()
  if (tournament.matches.length !== E2E_NIKOLAUS_MATCH_COUNT) {
    throw new Error(`Nikolaus-Turnier: erwartet ${E2E_NIKOLAUS_MATCH_COUNT} Spiele, Spielplan hat ${tournament.matches.length}.`);
  }
  return tournament;
}

interface NikolausSeedDeps {
  admin: SupabaseClient;
  ownerClient: SupabaseClient;
  log: (message: string) => void;
}

/** Legt EIN Nikolaus-Turnier an: privat gespeichert, dann veröffentlicht mit festem Share-Code (Muster Turniertag-Cup). */
async function seedOne(
  deps: NikolausSeedDeps,
  ownerRepo: ITournamentRepository,
  service: TournamentCreationService,
  variante: NikolausVariante,
  helperId: string,
  coadminId: string
): Promise<void> {
  const cup = E2E_NIKOLAUS_CUPS[variante];
  deps.log(`Lege ${cup.title} an…`);
  const tournament = buildNikolausTournament(service, variante);
  await ownerRepo.save(tournament);
  if (cup.mitHelfer) {
    const { error } = await deps.admin
      .from('tournament_collaborators')
      .insert(mapMembershipInsertToSupabase({ tournamentId: tournament.id, userId: helperId, role: 'collaborator', teamIds: [] }));
    if (error) {
      throw new Error(`Mitgliedschaft helper (${cup.title}): ${error.message}`);
    }
  }
  if (cup.mitCoAdmin) {
    const { error } = await deps.admin
      .from('tournament_collaborators')
      .insert(mapMembershipInsertToSupabase({ tournamentId: tournament.id, userId: coadminId, role: 'co-admin', teamIds: [] }));
    if (error) {
      throw new Error(`Mitgliedschaft co-admin (${cup.title}): ${error.message}`);
    }
  }
  const { error: publicError } = await deps.ownerClient.rpc('make_tournament_public', { tournament_id: tournament.id });
  if (publicError) {
    throw new Error(`make_tournament_public(${cup.title}): ${publicError.message}`);
  }
  const { error: shareCodeError } = await deps.admin.from('tournaments').update({ share_code: cup.shareCode }).eq('id', tournament.id);
  if (shareCodeError) {
    throw new Error(`Fester Share-Code ${cup.title}: ${shareCodeError.message}`);
  }
  deps.log(`${cup.title}: ${tournament.matches.length} Spiele, eine Gruppe, 1 Feld, Waging eröffnet als Heimmannschaft.`);
}

/** Hauptturnier und Zwilling für den Zeitplan-Schritt (N5). */
export async function seedNikolausCups(
  deps: NikolausSeedDeps,
  ownerRepo: ITournamentRepository,
  service: TournamentCreationService,
  helperId: string,
  coadminId: string
): Promise<void> {
  await seedOne(deps, ownerRepo, service, 'haupt', helperId, coadminId);
  await seedOne(deps, ownerRepo, service, 'zeitplan', helperId, coadminId);
}
