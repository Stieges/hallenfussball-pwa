/**
 * Das „nächste Spiel“ eines Felds im Client, wie am Server (`match_kit_set`, 20261124_002_leibchen_schritt2.sql): das erste noch nicht beendete Spiel
 * mit zwei Teams nach `scheduled_start`, `round`, `slot`, `match_number` – solange ein Spiel des Felds läuft, ist es das laufende (Leibchen 2b, Punkt 7).
 * Szenarien: @SL-206, @SL-215 (Karte im Endstand für das nächste Spiel), @SL-216, @SL-236 (Vorab-Festlegung nur für spätere Spiele). Testwerte aus dem Gherkin.
 */
import { describe, expect, it } from 'vitest';
import { nextMatchOnField } from '../nextMatch';
import { pendingSlot, teamSlot } from '../matchSlot';
import type { Match } from '../../../types/tournament';

const T = (n: number): string => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const um = (stunde: number, minute: number): Date => new Date(2026, 10, 28, stunde, minute);
const spiel = (id: string, nr: number, extra: Partial<Match> = {}): Match => ({
  id, matchNumber: nr, round: 1, field: 1, slotA: teamSlot(T(nr * 2)), slotB: teamSlot(T(nr * 2 + 1)), matchStatus: 'scheduled', scheduledTime: um(10, nr * 10), ...extra,
});

describe('@SL-215 @SL-216 das nächste Spiel des Felds', () => {
  it('@SL-215 Spiel 1 ist beendet, Spiel 2 folgt auf Feld 1: Spiel 2 ist das nächste', () => {
    const matches = [spiel('s1', 1, { matchStatus: 'finished' }), spiel('s2', 2), spiel('s3', 3)];
    expect(nextMatchOnField(matches, 1)?.id).toBe('s2');
  });

  it('@SL-215 solange Spiel 1 noch läuft, ist es das laufende Spiel – das nächste folgt erst nach dem Abpfiff', () => {
    const matches = [spiel('s1', 1, { matchStatus: 'running' }), spiel('s2', 2)];
    expect(nextMatchOnField(matches, 1)?.id).toBe('s1');
  });

  it('@SL-215 Spiel 2 steht noch nicht fest (ein Team offen): übersprungen, bis beide Teams feststehen', () => {
    const matches = [spiel('s2', 2, { slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 1 }) }), spiel('s3', 3)];
    expect(nextMatchOnField(matches, 1)?.id).toBe('s3');
  });

  it('@SL-232 ein ausgefallenes Spiel ist nie das nächste', () => {
    expect(nextMatchOnField([spiel('s2', 2, { matchStatus: 'skipped' }), spiel('s3', 3)], 1)?.id).toBe('s3');
  });

  it('@SL-216 Sortierung: Uhrzeit, dann Runde, dann Slot, dann Spielnummer – unabhängig von der Reihenfolge im Array', () => {
    const gleichZeit = um(11, 0);
    const matches = [
      spiel('spaeter-runde', 9, { scheduledTime: gleichZeit, round: 2 }),
      spiel('slot-2', 8, { scheduledTime: gleichZeit, round: 1, slot: 2 }),
      spiel('slot-1-nr-7', 7, { scheduledTime: gleichZeit, round: 1, slot: 1 }),
      spiel('slot-1-nr-6', 6, { scheduledTime: gleichZeit, round: 1, slot: 1 }),
    ];
    expect(nextMatchOnField(matches, 1)?.id).toBe('slot-1-nr-6');
    expect(nextMatchOnField([...matches].reverse(), 1)?.id).toBe('slot-1-nr-6');
  });

  it('@SL-216 der Slot geht der Spielnummer vor: Slot 1 mit Nummer 9 kommt vor Slot 2 mit Nummer 5', () => {
    const gleichZeit = um(11, 0);
    const matches = [
      spiel('slot-2-nr-5', 5, { scheduledTime: gleichZeit, slot: 2 }),
      spiel('slot-1-nr-9', 9, { scheduledTime: gleichZeit, slot: 1 }),
    ];
    expect(nextMatchOnField(matches, 1)?.id).toBe('slot-1-nr-9');
  });

  it('@SL-216 ohne Runde (undefined) kommt ein Spiel nach denen mit Runde (NULLS LAST statt NaN)', () => {
    const gleichZeit = um(11, 0);
    const matches = [spiel('ohne-runde', 1, { scheduledTime: gleichZeit, round: undefined as unknown as number }), spiel('mit-runde', 2, { scheduledTime: gleichZeit, round: 3 })];
    expect(nextMatchOnField(matches, 1)?.id).toBe('mit-runde');
    expect(nextMatchOnField([...matches].reverse(), 1)?.id).toBe('mit-runde');
  });

  it('@SL-216 ein Spiel ohne Uhrzeit kommt nach denen mit Uhrzeit (NULLS LAST)', () => {
    const matches = [spiel('ohne', 2, { scheduledTime: undefined }), spiel('mit', 3)];
    expect(nextMatchOnField(matches, 1)?.id).toBe('mit');
  });

  it('@SL-236 Gegenbeispiel: Spiele anderer Felder zählen nicht', () => {
    const matches = [spiel('feld-2', 1, { field: 2 }), spiel('feld-1', 2)];
    expect(nextMatchOnField(matches, 1)?.id).toBe('feld-1');
    expect(nextMatchOnField(matches, 3)).toBeUndefined();
  });

  it('@SL-236 ein späteres Spiel ist nicht das nächste (nur dafür gilt die Vorab-Festlegung)', () => {
    const matches = [spiel('s6', 6, { matchStatus: 'running' }), spiel('s14', 14)];
    expect(nextMatchOnField(matches, 1)?.id).not.toBe('s14');
  });

  it('@SL-216 Gegenbeispiel: ist alles gespielt, gibt es kein nächstes Spiel', () => {
    expect(nextMatchOnField([spiel('s1', 1, { matchStatus: 'finished' })], 1)).toBeUndefined();
  });
});
