/**
 * Testturnier „Hallencup Ost“ für den Entwurf: 9 Gruppenspiele, 2 Felder, alle 12 Minuten ab 15:00.
 * Spiel n hat die ID `s<n>`; Spiel 1 und 2 um 15:00 (Feld 1/2), 3 und 4 um 15:12, … Schiedsrichter n = Spiel n mod 3 + 1.
 * Paarungen so, dass kein Team zweimal zur selben Zeit spielt – auch nicht nach den Tauschen der Tests (6↔9, 6↔8).
 */
import type { Match, Tournament } from '../../../../types/tournament';
import { createMockMatch, createMockTeams, createMockTournament } from '../../../../test/factories';
import { teamSlot } from '../../../../core/models/matchSlot';

export const at = (minutes: number): Date => new Date(2026, 10, 14, 15, minutes);

/** Heim/Gast je Spiel (Team 1…6) */
const PAARUNGEN: [number, number][] = [[1, 2], [3, 4], [5, 6], [1, 3], [2, 4], [5, 1], [6, 3], [1, 5], [3, 5]];

export function spiel(n: number, extra: Partial<Match> = {}): Match {
  const teams = createMockTeams(6, 1);
  const [heim, gast] = PAARUNGEN[n - 1];
  return createMockMatch({
    id: `s${n}`,
    matchNumber: n,
    round: Math.ceil(n / 2),
    field: n % 2 === 1 ? 1 : 2,
    scheduledTime: at(Math.floor((n - 1) / 2) * 12),
    referee: (n % 3) + 1,
    matchStatus: 'scheduled',
    slotA: teamSlot(teams[heim - 1].id),
    slotB: teamSlot(teams[gast - 1].id),
    ...extra,
  });
}

export function hallencup(overrides: Partial<Tournament> = {}, matchExtras: Record<number, Partial<Match>> = {}): Tournament {
  return createMockTournament({
    id: 'hallencup-ost',
    teams: createMockTeams(6, 1),
    numberOfFields: 2,
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 0,
    refereeConfig: { mode: 'organizer', numberOfReferees: 3 },
    matches: Array.from({ length: 9 }, (_, i) => spiel(i + 1, matchExtras[i + 1])),
    ...overrides,
  });
}

export const matchOf = (t: Tournament, id: string): Match => {
  const m = t.matches.find((x) => x.id === id);
  if (!m) { throw new Error(`Spiel ${id} fehlt`); }
  return m;
};
