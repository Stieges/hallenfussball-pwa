/**
 * Test-Hilfen GA4 A-13a: Turniere aus den ECHT ERZEUGTEN Cloud-Zeilen der Gleichlauf-Fixture `group-state.json`
 * (publish → mapTournamentToSupabase, Ergebnisse wie nach `append_match_events`) über den Mapper zurück – derselbe Weg wie
 * beim Laden aus der Cloud. Dazu Lagen mit Abschluss (`groupCompletions`). Nur Testumgebung.
 */
import groupStateFixture from '../__fixtures__/group-state.json';
import type { GroupCompletion, Match, Tournament } from '../../../types/tournament';
import { mapTournamentFromSupabase } from '../../repositories/supabaseMappers';
import type { GeneratedRows, GeneratedTournamentKey } from '../../../test/groupCompletionRows';
import { testUuid } from '../../../test/testIds';

type MapperArgs = Parameters<typeof mapTournamentFromSupabase>;

/** Spalten, die die erzeugte Zeile nicht trägt (sie kommen erst aus `select('*')`); Werte wie eine frische Zeile. */
const MATCH_DEFAULTS = {
  live_state: null, actual_end: null, timer_start_time: null, timer_paused_at: null, overtime_score_a: null,
  overtime_score_b: null, penalty_score_a: null, penalty_score_b: null, decided_by: null, skipped_reason: null,
  skipped_at: null, origin_a: null, origin_b: null, forfeit_absent: null,
};

const rowsOf = (key: GeneratedTournamentKey): GeneratedRows =>
  (groupStateFixture.tournaments as unknown as Record<GeneratedTournamentKey, GeneratedRows>)[key];

/**
 * Fixture-Zeilen plus Ergebnisse (`updates`) → Turnier über `mapTournamentFromSupabase`. Ohne Ergebnisse
 * (`results: false`): das frisch angelegte Turnier, kein Spiel angepfiffen. `extraUpdates`: weitere Spalten je Spiel.
 */
export function tournamentFromFixture(
  key: GeneratedTournamentKey,
  { results = true, extraUpdates = [] }: { results?: boolean; extraUpdates?: ReadonlyArray<{ id: string; set: Record<string, unknown> }> } = {},
): Tournament {
  const rows = rowsOf(key);
  const updates = new Map(groupStateFixture.updates.filter((u) => results && u.tournament === key).map((u) => [u.id, u]));
  const extra = new Map(extraUpdates.map((u) => [u.id, u.set]));
  const matchRows = rows.matches.map((row) => {
    const update = updates.get(String(row.id));
    const { tournament: _t, id: _id, ...columns } = update ?? { tournament: key, id: '' };
    // R3-2b: Zusatz-Spalten je Spiel (tournament-state.json `extraUpdates`, Spalten wie in matches)
    return { ...MATCH_DEFAULTS, ...row, ...columns, ...(extra.get(String(row.id)) ?? {}) };
  });
  return mapTournamentFromSupabase(
    rows.tournament as unknown as MapperArgs[0],
    rows.teams as unknown as MapperArgs[1],
    matchRows as unknown as MapperArgs[2],
  );
}

/** Team-IDs der echt erzeugten Turniere (`groupCompletionRows.ts`: Nikolaus 910–915, Hallencup 920–927). */
export const HC = {
  nord: testUuid(920), sued: testUuid(921), west: testUuid(922), ost: testUuid(923),
  mitte: testUuid(924), berg: testUuid(925), ufer: testUuid(926), tal: testUuid(927),
} as const;

export const NK = {
  kammer: testUuid(910), wagingRot: testUuid(911), petting: testUuid(912), otting: testUuid(913),
  fridolfing: testUuid(914), wagingBlau: testUuid(915),
} as const;

/** Spiel zweier Teams (Heim, Gast in beliebiger Reihenfolge) – die Spiel-IDs vergibt der Generator. */
export function matchOf(tournament: Tournament, x: string, y: string): Match {
  const found = tournament.matches.find((m) => {
    const ids = [m.slotA.kind === 'team' ? m.slotA.teamId : '', m.slotB.kind === 'team' ? m.slotB.teamId : ''];
    return ids.includes(x) && ids.includes(y);
  });
  if (found === undefined) {
    throw new Error(`Testlage: kein Spiel ${x} gegen ${y}`);
  }
  return found;
}

/** Spiel mit Beschriftung (z. B. „2. Halbfinale“, „Finale“). */
export function matchLabelled(tournament: Tournament, label: string): Match {
  const found = tournament.matches.find((m) => m.label === label);
  if (found === undefined) {
    throw new Error(`Testlage: kein Spiel „${label}“`);
  }
  return found;
}

/** Ändert ein Spiel des Turniers (wie ein angenommener Eintrag bzw. eine Korrektur). */
export function withMatch(tournament: Tournament, matchId: string, change: Partial<Match>): Tournament {
  if (!tournament.matches.some((m) => m.id === matchId)) {
    throw new Error(`Testlage: Spiel ${matchId} fehlt`);
  }
  return { ...tournament, matches: tournament.matches.map((m) => (m.id === matchId ? { ...m, ...change } : m)) };
}

/** Abschluss einer Gruppe (Zeile `group_completions` nach dem Mapper, A-13b-C). */
export function completion(groupId: string, ranking: string[], extra: Partial<GroupCompletion> = {}): GroupCompletion {
  return { groupId, ranking, openRanks: [], stale: false, completedAt: '2026-11-28T11:00:00Z', ...extra };
}
