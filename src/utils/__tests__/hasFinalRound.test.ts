/** A-36b Nachzug F1 (@ET-042): Finalrunde aus dem Turniermodell statt `finals.enabled`. */
import { describe, expect, it } from 'vitest';
import { hasFinalRound } from '../calculations';
import type { Match } from '../../types/tournament';
import { vs, testUuid } from '../../test/matchSlotFixtures';

const group: Match = { id: 'g', round: 1, field: 1, ...vs(testUuid(1), testUuid(2)), group: 'A' };
const final: Match = { ...group, id: 'f', isFinal: true, finalType: 'final' };

describe('@ET-042 hasFinalRound', () => {
  it('@ET-042 Finalrunden-Spiel vorhanden → ja', () => {
    expect(hasFinalRound({ matches: [group, final], finalsConfig: { preset: 'none' } })).toBe(true);
  });
  it('@ET-042 Konfiguration sieht eine Finalrunde vor (Spielplan noch ohne Finalspiele) → ja', () => {
    expect(hasFinalRound({ matches: [group], groupSystem: 'groupsAndFinals', finalsConfig: { preset: 'top-4' } })).toBe(true);
  });
  it('@ET-042 Gegenbeispiel (F1-W2): Jeder gegen jeden mit stehengebliebenem Preset top-4 → nein', () => {
    expect(hasFinalRound({ matches: [group], groupSystem: 'roundRobin', finalsConfig: { preset: 'top-4' } })).toBe(false);
    expect(hasFinalRound({ matches: [group], finalsConfig: { preset: 'top-4' } })).toBe(false);
  });
  it('@ET-042 Gegenbeispiel: nur Gruppe, Preset none bzw. ohne Konfiguration → nein', () => {
    expect(hasFinalRound({ matches: [group], finalsConfig: { preset: 'none' } })).toBe(false);
    expect(hasFinalRound({ matches: [group] })).toBe(false);
  });
});
