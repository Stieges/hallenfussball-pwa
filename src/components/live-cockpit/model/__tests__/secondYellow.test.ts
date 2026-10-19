import { describe, it, expect } from 'vitest';
import { hatSchonGelb } from '../secondYellow';
import type { RuntimeMatchEvent } from '../../../../types/tournament';

const gelb = (teamId: string, playerNumber: number): RuntimeMatchEvent => ({ id: `y-${teamId}-${playerNumber}`, timestampSeconds: 100, type: 'YELLOW_CARD', payload: { teamId, playerNumber }, scoreAfter: { home: 0, away: 0 } });
const gelbRot: RuntimeMatchEvent = { id: 'yr', timestampSeconds: 100, type: 'RED_CARD', payload: { teamId: 'sv-sued', playerNumber: 7, cardType: 'YELLOW_RED' }, scoreAfter: { home: 0, away: 0 } };
const tor: RuntimeMatchEvent = { id: 'g', timestampSeconds: 100, type: 'GOAL', payload: { teamId: 'sv-sued', playerNumber: 7 }, scoreAfter: { home: 1, away: 0 } };

describe('hatSchonGelb (L5, @SL-088)', () => {
  it('@SL-088 Nr. 7 von SV Süd hat in diesem Spiel schon Gelb', () => { expect(hatSchonGelb([gelb('sv-sued', 7)], 'sv-sued', 7)).toBe(true); });
  it('Gegenbeispiel: Nr. 7 von FC Nord ist eine andere Person', () => { expect(hatSchonGelb([gelb('sv-sued', 7)], 'fc-nord', 7)).toBe(false); });
  it('Gegenbeispiel: eine andere Nummer desselben Teams hat noch kein Gelb', () => { expect(hatSchonGelb([gelb('sv-sued', 7)], 'sv-sued', 8)).toBe(false); });
  it('Gegenbeispiel: ein Tor oder eine Gelb-Rote Karte der Nummer 7 ist keine Gelbe Karte', () => { expect(hatSchonGelb([tor, gelbRot], 'sv-sued', 7)).toBe(false); });
  it('ohne Ereignisse hat niemand Gelb', () => { expect(hatSchonGelb([], 'sv-sued', 7)).toBe(false); });
});
