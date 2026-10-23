/**
 * C3b-2 F3b1 Fixrunde (Ruling PC30): `cardKindOf` ist die EINE Hilfsfunktion, die den
 * Kartentyp eines Ereignisses bestimmt (RED_CARD + payload.cardType 'YELLOW_RED' → 'YELLOW_RED').
 * Alle Leser, die zwischen Gelb/Gelb-Rot/Rot unterscheiden muessen, nutzen sie -- keine eigenen
 * verstreuten `payload.cardType === 'YELLOW_RED'`-Abfragen.
 */
import { describe, it, expect } from 'vitest';
import { cardKindOf } from '../cardKind';

describe('cardKindOf (PC30)', () => {
  it("RED_CARD mit payload.cardType 'YELLOW_RED' -> 'YELLOW_RED'", () => {
    expect(cardKindOf({ type: 'RED_CARD', payload: { cardType: 'YELLOW_RED' } })).toBe('YELLOW_RED');
  });

  it('RED_CARD ohne cardType -> RED', () => {
    expect(cardKindOf({ type: 'RED_CARD', payload: {} })).toBe('RED');
  });

  it("RED_CARD mit payload.cardType 'RED' -> RED", () => {
    expect(cardKindOf({ type: 'RED_CARD', payload: { cardType: 'RED' } })).toBe('RED');
  });

  it('YELLOW_CARD -> YELLOW', () => {
    expect(cardKindOf({ type: 'YELLOW_CARD', payload: {} })).toBe('YELLOW');
  });

  it('Tor (andere Ereignistypen) -> null', () => {
    expect(cardKindOf({ type: 'GOAL', payload: {} })).toBeNull();
  });

  it('kein payload -> fuer RED_CARD trotzdem RED (kein Crash)', () => {
    expect(cardKindOf({ type: 'RED_CARD' })).toBe('RED');
  });
});
