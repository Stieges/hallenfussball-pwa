/**
 * A-03 (MVP-Bauplan, Spur A) – die Fairness-Auswertung liest die Seiten aus den Slots.
 * Eine offene Seite hat kein Team und zählt nirgends; ein Name im Übergangsfeld zählt nie.
 */
import { describe, it, expect } from 'vitest';
import { analyzeScheduleFairness } from '../fairScheduler';
import type { Match } from '../../../types/tournament';
import { vs, slots, groupRank, testUuid } from '../../../test/matchSlotFixtures';
import { teamSlot } from '../../models/matchSlot';

const [A, B, C] = [1, 2, 3].map(testUuid);
const m = (id: string, slot: number, sides: Pick<Match, 'teamA' | 'teamB' | 'slotA' | 'slotB'>): Match => ({
  id, round: slot + 1, field: 1, slot, ...sides,
});

describe('analyzeScheduleFairness über Slots', () => {
  it('@TM-034 zählt Heim- und Auswärtsspiele je Team-ID', () => {
    const analysis = analyzeScheduleFairness([m('1', 0, vs(A, B)), m('2', 1, vs(A, C)), m('3', 2, vs(B, A))]);

    const stats = (id: string) => analysis.teamStats.find((s) => s.teamId === id);
    expect(stats(A)).toMatchObject({ homeCount: 2, awayCount: 1, matchSlots: [0, 1, 2] });
    expect(stats(B)).toMatchObject({ homeCount: 1, awayCount: 1 });
    expect(stats(C)).toMatchObject({ homeCount: 0, awayCount: 1 });
  });

  it('@TM-033 Gegenbeispiel: eine offene Seite zählt für kein Team, die besetzte Seite schon', () => {
    const analysis = analyzeScheduleFairness([m('1', 0, slots(groupRank('A', 1), teamSlot(B)))]);

    expect(analysis.teamStats.map((s) => s.teamId)).toEqual([B]);
    expect(analysis.teamStats[0]).toMatchObject({ homeCount: 0, awayCount: 1 });
  });

  it('@TM-033 Gegenbeispiel: ein Name im Übergangsfeld teamA zählt nicht', () => {
    const decoy: Match = { id: '1', round: 1, field: 1, slot: 0, teamA: 'Team A', teamB: 'Team B' };

    expect(analyzeScheduleFairness([decoy]).teamStats).toEqual([]);
  });
});
