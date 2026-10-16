/**
 * mapCardTypeToEngine (C3b-2 F3b2): einzige Stelle, die den UI-Kartentyp auf den Engine-Befehl
 * abbildet -- ersetzt den fruehen ternaeren Ausdruck in useEngineCommandWiring.ts, der
 * 'YELLOW_RED' faelschlich auf 'RED_CARD' abbildete (Gelb-Rot ging als einfaches Rot an die
 * Engine, `MatchCommands.card` haette 'YELLOW_RED_CARD' erwartet).
 */
import { describe, it, expect } from 'vitest';
import { mapCardTypeToEngine } from '../engineCommandWiringTypes';

describe('mapCardTypeToEngine (F3b2)', () => {
  it('YELLOW -> YELLOW_CARD', () => {
    expect(mapCardTypeToEngine('YELLOW')).toBe('YELLOW_CARD');
  });

  it('YELLOW_RED -> YELLOW_RED_CARD (Gegenbeispiel: nicht RED_CARD)', () => {
    expect(mapCardTypeToEngine('YELLOW_RED')).toBe('YELLOW_RED_CARD');
  });

  it('RED -> RED_CARD', () => {
    expect(mapCardTypeToEngine('RED')).toBe('RED_CARD');
  });
});
