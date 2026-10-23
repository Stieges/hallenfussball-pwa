/**
 * tokenGenerator — UUID-Erzeugung (A-07h, Abdeckung features/auth). Einladungs-Tokens und -Link sind mit A-18a entfallen.
 */
import { describe, it, expect } from 'vitest';
import { generateUUID } from '../tokenGenerator';

describe('generateUUID', () => {
  it('liefert eine UUID im Format der Version 4', () => {
    expect(generateUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('Fallback ohne crypto.randomUUID liefert ebenfalls eine gültige Version-4-UUID', () => {
    const original = crypto.randomUUID;
    // @ts-expect-error – Test simuliert einen älteren Browser ohne randomUUID
    crypto.randomUUID = undefined;
    try {
      expect(generateUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      crypto.randomUUID = original;
    }
  });
});
