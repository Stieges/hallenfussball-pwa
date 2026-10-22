/**
 * Torschützenliste des Turniers (A-20b, Plan `plan-endstand-abschluss.md`; Record Endstand und Torschützen
 * @ET-032–@ET-040, Record Korrigieren @EK-009). Das Format `ScorerRow` ist der Vertrag mit dem Endstand-Snapshot (A-20a).
 * `calculateScorers` (utils/calculations) bleibt bis B-29 für das PDF.
 *
 * Regeln: Es zählen nur Tore (`GOAL`: reguläre Spielzeit und Verlängerung) – nie ein Strafstoß aus dem Schießen, nie
 * Spiele, die nicht ausgetragen/annulliert sind (`skipped`), nie Wertungen (sie haben keine Tor-Ereignisse, @ET-035).
 * Ein Eigentor steht bei keinem Schützen, sondern in der Zeile „Eigentore“ des begünstigten Teams. Tore ohne gültige
 * Rückennummer (1–99, @SL-172; Altdaten außerhalb inklusive) stehen gesammelt je Team in „ohne Nummer“. Beide Sammelzeilen
 * haben keinen Rang und stehen am Ende. Rang: absteigend nach Toren, Gleichstand = gleicher Rang; darin deutsche
 * Sortierung nach Teamname, dann Nummer. Rein, ohne React.
 */
import type { Tournament } from '../../types/tournament';
import { eventsForMatch, type EngineEventsById } from '../../utils/calculations';
import { isJerseyNumber } from '../match/jerseyNumber';
import type { TeamId } from '../models/schemas/MatchSlotSchema';
import type { ScorerRow } from './finalStandings/types';

type PlayerRow = Extract<ScorerRow, { kind: 'player' }>;
type CollectiveRow = Extract<ScorerRow, { kind: 'noNumber' | 'ownGoals' }>;

const collator = new Intl.Collator('de', { sensitivity: 'base' });
const byTeamThenNumber = (a: PlayerRow, b: PlayerRow): number =>
  b.goals - a.goals || collator.compare(a.teamName, b.teamName) || a.number - b.number;
const byTeam = (a: CollectiveRow, b: CollectiveRow): number => collator.compare(a.teamName, b.teamName);

function getOrAdd<R>(map: Map<string, R>, key: string, make: () => R): R {
  const existing = map.get(key);
  if (existing) { return existing; }
  const created = make();
  map.set(key, created);
  return created;
}

export function computeScorers(
  t: Pick<Tournament, 'teams' | 'matches'>,
  engineEventsById?: EngineEventsById,
): ScorerRow[] {
  const nameOf = new Map(t.teams.map((team) => [team.id, team.name]));
  const players = new Map<string, PlayerRow>();
  const noNumber = new Map<string, CollectiveRow>();
  const ownGoals = new Map<string, CollectiveRow>();

  for (const match of t.matches) {
    if (match.matchStatus === 'skipped') { continue; }
    for (const event of eventsForMatch(match, engineEventsById)) {
      const teamId = event.payload.teamId;
      const teamName = teamId === undefined ? undefined : nameOf.get(teamId);
      if (event.type !== 'GOAL' || teamId === undefined || teamName === undefined || teamName === '') { continue; }
      const id = teamId as TeamId;
      const number = event.payload.playerNumber;
      if (event.payload.ownGoal === true) {
        getOrAdd(ownGoals, teamId, (): CollectiveRow => ({ kind: 'ownGoals', rank: null, teamId: id, teamName, goals: 0 })).goals += 1;
      } else if (isJerseyNumber(number)) {
        getOrAdd(players, `${teamId}|${number}`, (): PlayerRow => ({ kind: 'player', rank: 0, teamId: id, teamName, number, goals: 0 })).goals += 1;
      } else {
        getOrAdd(noNumber, teamId, (): CollectiveRow => ({ kind: 'noNumber', rank: null, teamId: id, teamName, goals: 0 })).goals += 1;
      }
    }
  }

  const ranked = [...players.values()].sort(byTeamThenNumber);
  let rank = 0;
  ranked.forEach((row, index) => {
    if (index === 0 || row.goals !== ranked[index - 1].goals) { rank = index + 1; }
    row.rank = rank;
  });
  return [...ranked, ...[...noNumber.values()].sort(byTeam), ...[...ownGoals.values()].sort(byTeam)];
}
