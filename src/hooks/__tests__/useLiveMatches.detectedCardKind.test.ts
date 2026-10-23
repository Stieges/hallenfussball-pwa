/**
 * detectedCardKind (C3b-2 F3b2, Monitor-Kartenanimation, Ruling PC30): Kartentyp NUR ueber
 * `cardKindOf` ableiten -- ersetzt `event.type === 'RED_CARD' ? 'RED' : 'YELLOW'`, das Gelb-Rot
 * faelschlich auf 'RED' abbildete (der Monitor zeigte "ROTE KARTE" statt "GELB-ROT").
 */
import { describe, it, expect } from 'vitest';
import { detectedCardKind } from '../useLiveMatches';
import type { RuntimeMatchEvent } from '../../types/tournament';

function redCardEvent(cardType?: string): RuntimeMatchEvent {
  return {
    id: 'e1',
    timestampSeconds: 10,
    type: 'RED_CARD',
    payload: { teamId: 'teamA', ...(cardType !== undefined ? { cardType } : {}) },
    scoreAfter: { home: 0, away: 0 },
  } as RuntimeMatchEvent;
}

describe('detectedCardKind (F3b2)', () => {
  it('Gelb-Rot (RED_CARD + cardType "YELLOW_RED") -> "YELLOW_RED"', () => {
    expect(detectedCardKind(redCardEvent('YELLOW_RED'))).toBe('YELLOW_RED');
  });

  it('Gegenbeispiel: RED_CARD ohne cardType -> "RED"', () => {
    expect(detectedCardKind(redCardEvent(undefined))).toBe('RED');
  });

  it('YELLOW_CARD -> "YELLOW"', () => {
    const event: RuntimeMatchEvent = {
      id: 'e2', timestampSeconds: 5, type: 'YELLOW_CARD',
      payload: { teamId: 'teamA' }, scoreAfter: { home: 0, away: 0 },
    };
    expect(detectedCardKind(event)).toBe('YELLOW');
  });
});
