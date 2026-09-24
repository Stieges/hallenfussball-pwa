/**
 * core/utils/id — Kennungen für MatchEvent (C-EVID Sofort-Fix)
 */
import { describe, it, expect } from 'vitest';
import { generateEventId, isUuidFormat, toDeterministicUuid, toSupabaseEventId } from '../id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('generateEventId', () => {
  it('liefert eine UUID-förmige Kennung', () => {
    expect(generateEventId()).toMatch(UUID_RE);
  });

  it('liefert bei jedem Aufruf eine andere Kennung', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateEventId()));
    expect(ids.size).toBe(50);
  });
});

describe('isUuidFormat', () => {
  it('erkennt eine echte UUID', () => {
    expect(isUuidFormat('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('erkennt eine Alt-Text-Kennung nicht als UUID', () => {
    expect(isUuidFormat('match-1-goal-1790284219635-zyqvd')).toBe(false);
  });

  it('ist case-insensitiv (Großbuchstaben-Hex zulässig)', () => {
    expect(isUuidFormat('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });
});

describe('toDeterministicUuid', () => {
  it('liefert für dieselbe Eingabe immer dieselbe UUID', () => {
    const input = 'match-1-goal-1790284219635-zyqvd';
    expect(toDeterministicUuid(input)).toBe(toDeterministicUuid(input));
  });

  it('liefert eine UUID-förmige Ausgabe', () => {
    expect(toDeterministicUuid('match-1-goal-1790284219635-zyqvd')).toMatch(UUID_RE);
  });

  it('liefert für unterschiedliche Eingaben unterschiedliche UUIDs', () => {
    const a = toDeterministicUuid('match-1-goal-1-aaaaa');
    const b = toDeterministicUuid('match-1-1790284219635');
    const c = toDeterministicUuid('match-2-1790284219635');
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('ist stabil über viele unterschiedliche Alt-Kennungen (keine Kollision in Stichprobe)', () => {
    const inputs = Array.from({ length: 500 }, (_, i) => `match-${i % 20}-goal-${1700000000000 + i}-${i.toString(36)}`);
    const outputs = new Set(inputs.map(toDeterministicUuid));
    expect(outputs.size).toBe(inputs.length);
  });
});

describe('toSupabaseEventId', () => {
  it('lässt eine echte UUID unverändert', () => {
    const realUuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(toSupabaseEventId(realUuid)).toBe(realUuid);
  });

  it('rechnet eine Alt-Text-Kennung deterministisch um', () => {
    const legacyId = 'match-1-goal-1790284219635-zyqvd';
    expect(toSupabaseEventId(legacyId)).toBe(toDeterministicUuid(legacyId));
    expect(isUuidFormat(toSupabaseEventId(legacyId))).toBe(true);
  });
});
