/**
 * A-03 (MVP-Bauplan, Spur A) – Ein Spiel wird nur dann ein Engine-Spiel (anpfeifbar), wenn BEIDE Seiten
 * besetzt sind (V17). @TM-033 / @TM-034 / @TM-035.
 */
import { describe, it, expect } from 'vitest';
import { buildValidMatches } from '../engineMatchModel';
import type { Match, Team, Tournament } from '../../types/tournament';
import { createMockTournament } from '../../test/factories';
import { teamSlot } from '../../core/models/matchSlot';
import { vs, slots, groupRank, resultOf, testUuid } from '../../test/matchSlotFixtures';

const [NORD, UFER, WALD] = [1, 2, 3].map(testUuid);
const teams: Team[] = [
  { id: NORD, name: 'FC Nord', group: 'A' },
  { id: UFER, name: 'VfB Ufer', group: 'B' },
  { id: WALD, name: 'SV Wald', group: 'B' },
];
const HF1 = testUuid(201);
const semi = (sides: Pick<Match, 'teamA' | 'teamB' | 'slotA' | 'slotB'>): Match => ({
  id: HF1, round: 2, field: 1, matchNumber: 7, isFinal: true, label: '1. Halbfinale', ...sides,
});
const tournamentOf = (matches: Match[]): Tournament => createMockTournament({ teams, matches });

describe('buildValidMatches – nur besetzte Spiele sind anpfeifbar', () => {
  it('@TM-033 Pflicht: Halbfinale mit offener Seite („FC Nord gegen Zweiter Gruppe B“) ergibt kein Engine-Spiel', () => {
    const t = tournamentOf([semi(slots(teamSlot(NORD), groupRank('B', 2)))]);
    expect(buildValidMatches(t)).toEqual([]);
  });

  it('@TM-033 Gegenbeispiel: offene Seite mit echter Team-ID im Übergangsfeld teamB (frühere Auflösung) ist kein Engine-Spiel', () => {
    const m = semi({ teamA: NORD, teamB: UFER, slotA: teamSlot(NORD), slotB: groupRank('B', 2) });
    expect(buildValidMatches(tournamentOf([m]))).toEqual([]);
  });

  it('@TM-033 beide Seiten offen oder Verweis auf ein Vorgängerspiel: kein Engine-Spiel', () => {
    expect(buildValidMatches(tournamentOf([semi(slots(groupRank('A', 1), groupRank('B', 2)))]))).toEqual([]);
    expect(buildValidMatches(tournamentOf([semi(slots(resultOf(testUuid(300), 'winner'), resultOf(testUuid(300), 'loser')))]))).toEqual([]);
  });

  it('@TM-034 Halbfinale mit zwei besetzten Seiten („FC Nord gegen VfB Ufer“) ist ein Engine-Spiel mit den Namen aus der Teamliste', () => {
    const entries = buildValidMatches(tournamentOf([semi(vs(NORD, UFER))]));

    expect(entries).toHaveLength(1);
    expect(entries[0].ctx).toEqual({ matchId: HF1, teamAId: NORD, teamBId: UFER });
    expect(entries[0].meta.homeTeam).toEqual({ id: NORD, name: 'FC Nord' });
    expect(entries[0].meta.awayTeam).toEqual({ id: UFER, name: 'VfB Ufer' });
  });

  it('@TM-035 Gerät ohne Netz kennt die neue Besetzung nicht: lokal noch offen → kein Anpfiff, bis der bestätigte Stand eintrifft', () => {
    const local = tournamentOf([semi(slots(teamSlot(NORD), groupRank('B', 2)))]);
    expect(buildValidMatches(local)).toEqual([]);

    // Der Server-Stand (Gruppe B abgeschlossen) bringt die Besetzung – erst jetzt gibt es ein Engine-Spiel.
    const confirmed = tournamentOf([semi(slots(teamSlot(NORD), teamSlot(UFER, { kind: 'groupRank', group: 'B', rank: 2 })))]);
    expect(buildValidMatches(confirmed)).toHaveLength(1);
  });

  it('@TM-033 Gegenbeispiel: unbekannte Team-ID zeigt keinen Namen aus anderer Quelle – kein Engine-Spiel', () => {
    // Slot zeigt auf eine ID außerhalb der Teamliste; das Übergangsfeld trägt den Namen eines vorhandenen Teams
    const unknown: Match = { ...semi(vs(NORD, UFER)), slotB: teamSlot(testUuid(99)), teamB: 'VfB Ufer' };
    expect(buildValidMatches(tournamentOf([unknown]))).toEqual([]);
  });

  it('@TM-033 Gegenbeispiel: ein Teamname im Übergangsfeld ersetzt keinen Slot (Spiel ohne Slots ist kein Engine-Spiel)', () => {
    const legacy: Match = { id: HF1, round: 1, field: 1, teamA: NORD, teamB: UFER };
    expect(buildValidMatches(tournamentOf([legacy]))).toEqual([]);
  });

  it('@TM-033 Gegenbeispiel: dieselbe Team-ID auf beiden Seiten ist kein Engine-Spiel', () => {
    expect(buildValidMatches(tournamentOf([semi(vs(NORD, NORD))]))).toEqual([]);
  });

  it('@TM-034 Groß-/Kleinschreibung der Team-ID: Engine-Schlüssel klein, Name trotzdem aus der Teamliste', () => {
    const upper: Team[] = teams.map((team) => ({ ...team, id: team.id.toUpperCase() }));
    const m = semi({ ...vs(NORD, UFER) });
    const t = createMockTournament({ teams: upper, matches: [m] });
    const entries = buildValidMatches(t);
    expect(entries[0].ctx.teamAId).toBe(NORD);
    expect(entries[0].meta.homeTeam.name).toBe('FC Nord');
  });
});
