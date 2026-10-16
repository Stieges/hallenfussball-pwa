/**
 * A-03 (MVP-Bauplan, Spur A) – die Fairness-Auswertung liest die Seiten aus den Slots.
 * Eine offene Seite hat kein Team und zählt nirgends; ein Name im Übergangsfeld zählt nie.
 */
import { describe, it, expect, vi } from 'vitest';
import { analyzeScheduleFairness, generateGroupPhaseSchedule } from '../fairScheduler';
import type { Match, Team } from '../../../types/tournament';
import { vs, slots, groupRank, testUuid, withStaleSides } from '../../../test/matchSlotFixtures';
import { teamSlot } from '../../models/matchSlot';

const [A, B, C] = [1, 2, 3].map(testUuid);
const m = (id: string, slot: number, sides: Pick<Match, 'slotA' | 'slotB'>): Match => ({
  id, round: slot + 1, field: 1, slot, ...sides,
});

describe('analyzeScheduleFairness über Slots', () => {
  it('A-03 zählt Heim- und Auswärtsspiele je Team-ID', () => {
    const analysis = analyzeScheduleFairness([m('1', 0, vs(A, B)), m('2', 1, vs(A, C)), m('3', 2, vs(B, A))]);

    const stats = (id: string) => analysis.teamStats.find((s) => s.teamId === id);
    expect(stats(A)).toMatchObject({ homeCount: 2, awayCount: 1, matchSlots: [0, 1, 2] });
    expect(stats(B)).toMatchObject({ homeCount: 1, awayCount: 1 });
    expect(stats(C)).toMatchObject({ homeCount: 0, awayCount: 1 });
  });

  it('A-03 Gegenbeispiel: eine offene Seite zählt für kein Team, die besetzte Seite schon', () => {
    const analysis = analyzeScheduleFairness([m('1', 0, slots(groupRank('A', 1), teamSlot(B)))]);

    expect(analysis.teamStats.map((s) => s.teamId)).toEqual([B]);
    expect(analysis.teamStats[0]).toMatchObject({ homeCount: 0, awayCount: 1 });
  });

  it('A-03 Gegenbeispiel: ein Name im Übergangsfeld teamA zählt nicht', () => {
    const decoy: Match = withStaleSides({
      id: '1', round: 1, field: 1, slot: 0,
      ...slots(groupRank('A', 1), groupRank('A', 2)),
    }, 'Team A', 'Team B');

    expect(analyzeScheduleFairness([decoy]).teamStats).toEqual([]);
  });
});

describe('generateGroupPhaseSchedule – Gruppenspiele tragen Team-Slots (auch nach dem Heim/Gast-Ausgleich)', () => {
  const four: Team[] = [1, 2, 3, 4].map((n) => ({ id: testUuid(n), name: `Team ${n}`, group: 'A' }));
  const options = {
    groups: new Map([['A', four]]),
    numberOfFields: 1,
    slotDurationMinutes: 10,
    breakBetweenSlotsMinutes: 2,
    minRestSlotsPerTeam: 0,
  };

  it.each([
    ['A-03 Kreisverfahren', undefined],
    ['A-03 DFB-Schlüssel 1T04M', '1T04M'],
  ])('%s: jede Paarung genau einmal, beide Seiten besetzt, ohne Übergangsfeld', (_name, dfbPatternCode) => {
    const matches = generateGroupPhaseSchedule({ ...options, dfbPatternCode });

    expect(matches).toHaveLength(6);
    const pairs = new Set<string>();
    for (const match of matches) {
      expect(match.slotA?.kind).toBe('team');
      expect(match.slotB?.kind).toBe('team');
      const a = match.slotA?.kind === 'team' ? match.slotA.teamId : '';
      const b = match.slotB?.kind === 'team' ? match.slotB.teamId : '';
      expect('teamA' in match || 'teamB' in match).toBe(false); // A-36a: kein Übergangsfeld mehr
      pairs.add([a, b].sort().join('|'));
    }
    expect(pairs.size).toBe(6);
  });

  it('A-03 unbekannter DFB-Schlüssel fällt laut (Warnung) auf das Kreisverfahren zurück', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const matches = generateGroupPhaseSchedule({ ...options, dfbPatternCode: '9T99M' });

    expect(matches).toHaveLength(6);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('9T99M'));
    warn.mockRestore();
  });
});
