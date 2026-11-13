/**
 * „Turnier kopieren“ und die Leibchen (@W3-029, @SL-232): die Hallenfarben und die Regel (Einstellung des Turniers) gehen in die Kopie, die Wahl der Leibchen
 * eines Spiels (`kit`, `kitDecision`) nicht – sie gehört dem Spiel.
 */
import { describe, expect, it } from 'vitest';
import { buildCopiedTournament } from '../tournamentCopy';
import { teamSlot } from '../matchSlot';
import type { Tournament } from '../../../types/tournament';

const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000a2';
let n = 0;
const makeId = (): string => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

const original = (): Tournament => ({
  id: 'orig', title: 'Hallencup', status: 'published', teams: [{ id: A, name: 'A' }, { id: B, name: 'B' }],
  matches: [{ id: 'm1', round: 1, field: 1, slotA: teamSlot(A), slotB: teamSlot(B), matchStatus: 'finished', kitDecision: 'bib', kit: { a: '#FFCC00', bibSide: 'a' } }],
  bibColor: '#FFCC00', bibColors: ['#FFCC00', '#FF6600'], bibRule: 'away',
} as unknown as Tournament);

describe('@W3-029 @SL-232 Turnier kopieren', () => {
  const kopie = buildCopiedTournament(original(), { newId: 'neu', title: 'Kopie', now: '2026-11-12T10:00:00.000Z', makeId });

  it('@W3-029 @W3-041 die Leibchenfarben und die Regel werden übernommen', () => {
    expect(kopie.bibColors).toEqual(['#FFCC00', '#FF6600']);
    expect(kopie.bibRule).toBe('away');
    expect(kopie.bibColor).toBe('#FFCC00');
  });

  it('@SL-232 Gegenbeispiel: die Wahl der Leibchen am Spiel (Zustand und Farben) bleibt nicht stehen', () => {
    expect(kopie.matches[0].kit).toBeUndefined();
    expect(kopie.matches[0].kitDecision).toBeUndefined();
  });
});
