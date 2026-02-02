import { describe, it, expect } from 'vitest';
import {
  TeamTrainerSchema,
  TournamentGroupSchema,
  TournamentFieldSchema,
  RuntimeMatchEventSchema,
} from '../CommonSchemas';

// =============================================================================
// TeamTrainerSchema
// =============================================================================

describe('TeamTrainerSchema', () => {
  it('validates a complete trainer', () => {
    const trainer = {
      id: 't1',
      name: 'Max Mustermann',
      email: 'max@example.com',
      phone: '+49123456',
      inviteStatus: 'accepted',
      inviteToken: 'abc123',
      inviteSentAt: '2026-01-01T00:00:00Z',
      acceptedAt: '2026-01-02T00:00:00Z',
      createdAt: '2025-12-01T00:00:00Z',
    };
    expect(TeamTrainerSchema.parse(trainer)).toMatchObject(trainer);
  });

  it('validates minimal trainer (only required fields)', () => {
    const trainer = { id: 't1', name: 'Anna', inviteStatus: 'pending', createdAt: '2026-01-01T00:00:00Z' };
    const result = TeamTrainerSchema.parse(trainer);
    expect(result.id).toBe('t1');
    expect(result.email).toBeUndefined();
  });

  it('rejects invalid inviteStatus', () => {
    const trainer = { id: 't1', name: 'X', inviteStatus: 'invalid', createdAt: '2026-01-01' };
    expect(() => TeamTrainerSchema.parse(trainer)).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => TeamTrainerSchema.parse({ id: 't1' })).toThrow();
  });

  it('preserves unknown fields (passthrough)', () => {
    const trainer = { id: 't1', name: 'X', inviteStatus: 'pending', createdAt: '2026-01-01', futureField: 42 };
    const result = TeamTrainerSchema.parse(trainer);
    expect((result as Record<string, unknown>).futureField).toBe(42);
  });
});

// =============================================================================
// TournamentGroupSchema
// =============================================================================

describe('TournamentGroupSchema', () => {
  it('validates a complete group', () => {
    const group = { id: 'A', customName: 'Lions', shortCode: 'LI', allowedFieldIds: ['field-1', 'field-2'] };
    expect(TournamentGroupSchema.parse(group)).toMatchObject(group);
  });

  it('validates minimal group (only id)', () => {
    const result = TournamentGroupSchema.parse({ id: 'B' });
    expect(result.id).toBe('B');
    expect(result.customName).toBeUndefined();
  });

  it('rejects missing id', () => {
    expect(() => TournamentGroupSchema.parse({ customName: 'X' })).toThrow();
  });

  it('preserves unknown fields (passthrough)', () => {
    const result = TournamentGroupSchema.parse({ id: 'A', extra: true });
    expect((result as Record<string, unknown>).extra).toBe(true);
  });
});

// =============================================================================
// TournamentFieldSchema
// =============================================================================

describe('TournamentFieldSchema', () => {
  it('validates a complete field', () => {
    const field = { id: 'field-1', defaultName: 'Feld 1', customName: 'Halle Nord', shortCode: 'HN' };
    expect(TournamentFieldSchema.parse(field)).toMatchObject(field);
  });

  it('validates minimal field', () => {
    const result = TournamentFieldSchema.parse({ id: 'field-1', defaultName: 'Feld 1' });
    expect(result.id).toBe('field-1');
    expect(result.customName).toBeUndefined();
  });

  it('rejects missing defaultName', () => {
    expect(() => TournamentFieldSchema.parse({ id: 'field-1' })).toThrow();
  });
});

// =============================================================================
// RuntimeMatchEventSchema
// =============================================================================

describe('RuntimeMatchEventSchema', () => {
  it('validates a GOAL event', () => {
    const event = {
      id: 'e1',
      matchId: 'm1',
      timestampSeconds: 120,
      type: 'GOAL',
      payload: {
        teamId: 't1',
        teamName: 'Team A',
        direction: 'INC',
        newHomeScore: 1,
        newAwayScore: 0,
        playerNumber: 7,
      },
      scoreAfter: { home: 1, away: 0 },
    };
    expect(RuntimeMatchEventSchema.parse(event)).toMatchObject(event);
  });

  it('validates a STATUS_CHANGE event', () => {
    const event = {
      id: 'e2',
      timestampSeconds: 0,
      type: 'STATUS_CHANGE',
      payload: { toStatus: 'RUNNING' },
      scoreAfter: { home: 0, away: 0 },
    };
    const result = RuntimeMatchEventSchema.parse(event);
    expect(result.type).toBe('STATUS_CHANGE');
    expect(result.payload.toStatus).toBe('RUNNING');
  });

  it('validates a YELLOW_CARD event with incomplete flag', () => {
    const event = {
      id: 'e3',
      timestampSeconds: 300,
      type: 'YELLOW_CARD',
      payload: { teamId: 't2', playerNumber: 10, cardType: 'YELLOW' },
      scoreAfter: { home: 0, away: 0 },
      incomplete: true,
    };
    const result = RuntimeMatchEventSchema.parse(event);
    expect(result.incomplete).toBe(true);
  });

  it('rejects invalid event type', () => {
    const event = {
      id: 'e1',
      timestampSeconds: 0,
      type: 'INVALID_TYPE',
      payload: {},
      scoreAfter: { home: 0, away: 0 },
    };
    expect(() => RuntimeMatchEventSchema.parse(event)).toThrow();
  });

  it('rejects missing scoreAfter', () => {
    const event = {
      id: 'e1',
      timestampSeconds: 0,
      type: 'GOAL',
      payload: {},
    };
    expect(() => RuntimeMatchEventSchema.parse(event)).toThrow();
  });

  it('preserves unknown payload fields (passthrough)', () => {
    const event = {
      id: 'e1',
      timestampSeconds: 0,
      type: 'GOAL',
      payload: { futurePayloadField: 'test' },
      scoreAfter: { home: 0, away: 0 },
    };
    const result = RuntimeMatchEventSchema.parse(event);
    expect((result.payload as Record<string, unknown>).futurePayloadField).toBe('test');
  });
});
