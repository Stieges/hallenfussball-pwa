/**
 * Echt erzeugte Cloud-Zeilen für die Gleichlauf-Fixture `src/core/standings/__fixtures__/group-state.json`
 * (GA4 A-13b-S Punkt 3, task-GA4-plan-v2.md R-GA4v2-7, Review-Auflage 1). Nur Testumgebung.
 *
 * Weg wie in der App: `TournamentCreationService.publish` (Generator) → `mapTournamentToSupabase` (Cloud-Zeilen, genau
 * das, was `SupabaseRepository.save()` schickt). Zwei Turniere aus dem Gherkin:
 *  - „Nikolaus“ (@W2A-067, @TM-147): eine Gruppe „Jeder gegen jeden“ mit 6 Teams → Spiele `group_letter 'all'`, Teams
 *    `group_letter NULL` (C-GRUPPE-ALL-UNEINHEITLICH),
 *  - „Hallencup Nord“ (@W2A-048, @TM-053 2×4): Gruppen A/B zu je 4 Teams, Finalrunde „top-4“.
 * `scripts/group-completion-fixture.ts` schreibt daraus die Fixture; `groupCompletionTwins.test.ts` erzeugt dieselben
 * Zeilen erneut und vergleicht sie (IDs der Spiele erzeugt der Generator zufällig, sie werden dort normalisiert).
 */
import { webcrypto } from 'node:crypto';
import { TournamentCreationService } from '../core/services/TournamentCreationService';
import { mapTournamentToSupabase } from '../core/repositories/supabaseMappers';
import type { ITournamentRepository } from '../core/repositories/ITournamentRepository';
import type { Tournament } from '../core/models/types';
import { testUuid } from './testIds';

export type GeneratedTournamentKey = 'nikolaus' | 'hallencup';

export interface GeneratedRows {
  tournament: Record<string, unknown>;
  teams: Array<Record<string, unknown>>;
  matches: Array<Record<string, unknown>>;
}

/** Eigentümer der erzeugten Zeilen (Olli); im Container wird er auf die Test-Identität abgebildet. */
export const FIXTURE_OWNER_ID = testUuid(900);

/** Spalten, die bei jedem Erzeugen neu entstehen (Tag der Erzeugung, Freigabe, Teilen-Code) – nicht Teil des Vergleichs. */
export const VOLATILE_TOURNAMENT_COLUMNS = ['date', 'published_at', 'share_code', 'share_code_created_at', 'created_at', 'updated_at'] as const;
/** Dieselben Angaben im `config` der Turnierzeile. */
export const VOLATILE_CONFIG_KEYS = ['publishedAt', 'shareCode', 'shareCodeCreatedAt'] as const;

const NIKOLAUS_TEAMS = ['DJK Kammer', 'TSV Waging rot', 'TSV Petting', 'DJK Otting', 'TSV 1921 Fridolfing', 'TSV Waging blau'];
const HALLENCUP_TEAMS: ReadonlyArray<readonly [string, 'A' | 'B']> = [
  ['FC Nord', 'A'], ['SV Süd', 'A'], ['TSV West', 'A'], ['SC Ost', 'A'],
  ['SG Mitte', 'B'], ['DJK Berg', 'B'], ['VfB Ufer', 'B'], ['TuS Tal', 'B'],
];

function ensureWindowCrypto(): void {
  // publish() erzeugt den Teilen-Code über window.crypto (src/utils/shareCode.ts); unter Node fehlt window.
  const g = globalThis as unknown as { window?: { crypto?: unknown } };
  if (g.window?.crypto === undefined) {
    g.window = { ...(g.window ?? {}), crypto: webcrypto };
  }
}

function input(key: GeneratedTournamentKey): Partial<Tournament> {
  if (key === 'nikolaus') {
    return {
      id: testUuid(901),
      title: 'Nikolaus-Turnier',
      startTime: '09:00',
      numberOfFields: 1,
      numberOfTeams: 6,
      groupSystem: 'roundRobin',
      finalsConfig: { preset: 'none' },
      placementsToPlayOut: [1, 2],
      teams: NIKOLAUS_TEAMS.map((name, i) => ({ id: testUuid(910 + i), name })),
    };
  }
  return {
    id: testUuid(902),
    title: 'Hallencup Nord',
    startTime: '09:00',
    numberOfFields: 2,
    numberOfTeams: 8,
    numberOfGroups: 2,
    groupSystem: 'groupsAndFinals',
    finalsConfig: { preset: 'top-4' },
    teams: HALLENCUP_TEAMS.map(([name, group], i) => ({ id: testUuid(920 + i), name, group })),
  };
}

/** Cloud-Zeilen eines frisch angelegten Turniers über den Produktionsweg. */
export async function generateRows(key: GeneratedTournamentKey): Promise<GeneratedRows> {
  ensureWindowCrypto();
  let saved: Tournament | undefined;
  const repository = {
    get: () => Promise.resolve(null),
    save: (t: Tournament) => {
      saved = t;
      return Promise.resolve();
    },
  } as unknown as ITournamentRepository;
  const tournament = await new TournamentCreationService(repository).publish(input(key));
  if (saved?.id !== tournament.id) {
    throw new Error('publish() hat nicht gespeichert');
  }
  const { tournamentRow, teamRows, matchRows } = mapTournamentToSupabase(tournament, FIXTURE_OWNER_ID);
  return {
    tournament: { ...tournamentRow },
    teams: teamRows.map((row) => ({ ...row })),
    matches: matchRows.map((row) => ({ ...row })),
  };
}

/**
 * Vergleichsform: flüchtige Spalten weg, jede vom Generator vergebene ID (Spiele) durch ihre Reihenfolge ersetzt –
 * auch in Herkünften (`matchResult.matchId`).
 */
export function normalizeRows(rows: GeneratedRows): unknown {
  const omit = (obj: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> =>
    Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
  const config = rows.tournament.config;
  const tournament = {
    ...omit(rows.tournament, VOLATILE_TOURNAMENT_COLUMNS),
    ...(config !== null && typeof config === 'object' ? { config: omit(config as Record<string, unknown>, VOLATILE_CONFIG_KEYS) } : {}),
  };
  let text = JSON.stringify({ tournament, teams: rows.teams, matches: rows.matches });
  rows.matches.forEach((match, index) => {
    text = text.split(String(match.id)).join(`<spiel-${index + 1}>`);
  });
  return JSON.parse(text) as unknown;
}
