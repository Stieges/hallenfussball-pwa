import { describe, it, expect } from 'vitest';
import { MutationItemSchema, FailedMutationItemSchema } from '../MutationItemSchema';

// =============================================================================
// MutationItemSchema
// =============================================================================

describe('MutationItemSchema', () => {
  it('validates a valid SAVE_TOURNAMENT item', () => {
    const item = {
      id: 'abc-123',
      type: 'SAVE_TOURNAMENT',
      payload: { id: 't1', title: 'Test' },
      timestamp: Date.now(),
      retryCount: 0,
    };
    expect(MutationItemSchema.parse(item)).toMatchObject(item);
  });

  it('validates all mutation types', () => {
    const types = ['SAVE_TOURNAMENT', 'DELETE_TOURNAMENT', 'UPDATE_MATCH', 'UPDATE_MATCHES', 'UPDATE_TOURNAMENT_METADATA'] as const;
    for (const type of types) {
      const item = { id: '1', type, payload: null, timestamp: 0, retryCount: 0 };
      expect(() => MutationItemSchema.parse(item)).not.toThrow();
    }
  });

  it('rejects invalid mutation type', () => {
    const item = { id: '1', type: 'INVALID_TYPE', payload: null, timestamp: 0, retryCount: 0 };
    expect(() => MutationItemSchema.parse(item)).toThrow();
  });

  it('rejects missing id', () => {
    const item = { type: 'SAVE_TOURNAMENT', payload: null, timestamp: 0, retryCount: 0 };
    expect(() => MutationItemSchema.parse(item)).toThrow();
  });

  it('rejects non-numeric timestamp', () => {
    const item = { id: '1', type: 'SAVE_TOURNAMENT', payload: null, timestamp: 'not-a-number', retryCount: 0 };
    expect(() => MutationItemSchema.parse(item)).toThrow();
  });

  it('accepts any payload (z.unknown)', () => {
    const items = [
      { id: '1', type: 'SAVE_TOURNAMENT', payload: null, timestamp: 0, retryCount: 0 },
      { id: '2', type: 'DELETE_TOURNAMENT', payload: 'tour-id', timestamp: 0, retryCount: 0 },
      { id: '3', type: 'UPDATE_MATCH', payload: { tournamentId: 't1', update: {} }, timestamp: 0, retryCount: 0 },
    ];
    for (const item of items) {
      expect(() => MutationItemSchema.parse(item)).not.toThrow();
    }
  });
});

// =============================================================================
// FailedMutationItemSchema
// =============================================================================

describe('FailedMutationItemSchema', () => {
  it('validates a failed item with lastError', () => {
    const item = {
      id: 'f1',
      type: 'SAVE_TOURNAMENT',
      payload: { id: 't1' },
      timestamp: 1000,
      retryCount: 5,
      failedAt: 2000,
      lastError: 'Network error',
    };
    expect(FailedMutationItemSchema.parse(item)).toMatchObject(item);
  });

  it('validates a failed item without lastError', () => {
    const item = {
      id: 'f1',
      type: 'DELETE_TOURNAMENT',
      payload: 'tour-1',
      timestamp: 1000,
      retryCount: 5,
      failedAt: 2000,
    };
    const result = FailedMutationItemSchema.parse(item);
    expect(result.lastError).toBeUndefined();
  });

  it('rejects missing failedAt', () => {
    const item = {
      id: 'f1',
      type: 'SAVE_TOURNAMENT',
      payload: null,
      timestamp: 1000,
      retryCount: 5,
    };
    expect(() => FailedMutationItemSchema.parse(item)).toThrow();
  });
});
