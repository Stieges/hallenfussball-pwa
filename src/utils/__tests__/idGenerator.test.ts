import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateUniqueId,
  generateTournamentId,
  generateTeamId,
  generateGroupStageMatchId,
  generateFinalsMatchId,
} from '../idGenerator';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('idGenerator', () => {
  describe('generateUniqueId — Format', () => {
    it('matches RFC 4122 v4 pattern', () => {
      for (let i = 0; i < 100; i++) {
        expect(generateUniqueId()).toMatch(UUID_V4_PATTERN);
      }
    });
  });

  describe('generateUniqueId — Kollisions-Resistenz', () => {
    it('produces 100k unique IDs without collision', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100_000; i++) {
        ids.add(generateUniqueId());
      }
      expect(ids.size).toBe(100_000);
    });
  });

  describe('generateUniqueId — Fallback paths', () => {
    let originalCrypto: typeof globalThis.crypto;

    beforeEach(() => {
      originalCrypto = globalThis.crypto;
    });

    afterEach(() => {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      });
    });

    it('falls back to crypto.getRandomValues when randomUUID is missing', () => {
      Object.defineProperty(globalThis, 'crypto', {
        value: {
          getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
        },
        configurable: true,
      });
      const id = generateUniqueId();
      expect(id).toMatch(UUID_V4_PATTERN);
    });

    it('throws when neither randomUUID nor getRandomValues exist', () => {
      Object.defineProperty(globalThis, 'crypto', {
        value: {},
        configurable: true,
      });
      expect(() => generateUniqueId()).toThrow(
        /Cryptographically secure UUID generation unavailable/
      );
    });
  });

  describe('Wrappers delegate to generateUniqueId', () => {
    it.each([
      ['generateTournamentId', generateTournamentId],
      ['generateTeamId', generateTeamId],
      ['generateGroupStageMatchId', generateGroupStageMatchId],
      ['generateFinalsMatchId', generateFinalsMatchId],
    ])('%s returns valid UUID v4', (_name, fn) => {
      expect(fn()).toMatch(UUID_V4_PATTERN);
    });
  });
});
