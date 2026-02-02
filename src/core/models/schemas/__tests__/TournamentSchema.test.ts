import { describe, it, expect } from 'vitest';
import { TeamSchema, MatchSchema, TournamentSchema } from '../TournamentSchema';

// =============================================================================
// Helpers
// =============================================================================

function createMinimalTournament(overrides?: Record<string, unknown>) {
  return {
    id: 'tour-1',
    title: 'Test Tournament',
    sport: 'hallenfussball',
    sportId: 'hallenfussball',
    tournamentType: 'group',
    mode: 'standard',
    teams: [],
    matches: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// =============================================================================
// TeamSchema
// =============================================================================

describe('TeamSchema', () => {
  it('validates a team with trainers', () => {
    const team = {
      id: 't1',
      name: 'FC Bayern',
      group: 'A',
      trainers: [
        { id: 'tr1', name: 'Max', inviteStatus: 'pending', createdAt: '2026-01-01' },
      ],
    };
    const result = TeamSchema.parse(team);
    expect(result.trainers).toHaveLength(1);
    expect(result.trainers![0].name).toBe('Max');
  });

  it('rejects team with invalid trainer inviteStatus', () => {
    const team = {
      id: 't1',
      name: 'FC Bayern',
      trainers: [
        { id: 'tr1', name: 'Max', inviteStatus: 'bad-status', createdAt: '2026-01-01' },
      ],
    };
    expect(() => TeamSchema.parse(team)).toThrow();
  });

  it('accepts team without trainers', () => {
    const result = TeamSchema.parse({ id: 't1', name: 'BVB' });
    expect(result.trainers).toBeUndefined();
  });
});

// =============================================================================
// MatchSchema
// =============================================================================

describe('MatchSchema', () => {
  it('validates a match with events', () => {
    const match = {
      id: 'm1',
      round: 1,
      field: 1,
      teamA: 't1',
      teamB: 't2',
      events: [
        {
          id: 'e1',
          timestampSeconds: 120,
          type: 'GOAL',
          payload: { teamId: 't1', direction: 'INC' },
          scoreAfter: { home: 1, away: 0 },
        },
      ],
    };
    const result = MatchSchema.parse(match);
    expect(result.events).toHaveLength(1);
    expect(result.events![0].type).toBe('GOAL');
  });

  it('rejects match with invalid event type', () => {
    const match = {
      id: 'm1',
      round: 1,
      field: 1,
      teamA: 't1',
      teamB: 't2',
      events: [
        { id: 'e1', timestampSeconds: 0, type: 'INVALID', payload: {}, scoreAfter: { home: 0, away: 0 } },
      ],
    };
    expect(() => MatchSchema.parse(match)).toThrow();
  });

  it('accepts match without events', () => {
    const result = MatchSchema.parse({ id: 'm1', round: 1, field: 1, teamA: 't1', teamB: 't2' });
    expect(result.events).toBeUndefined();
  });
});

// =============================================================================
// TournamentSchema — groups & fields
// =============================================================================

describe('TournamentSchema groups/fields', () => {
  it('validates tournament with typed groups', () => {
    const tournament = createMinimalTournament({
      groups: [
        { id: 'A', customName: 'Lions', shortCode: 'LI' },
        { id: 'B' },
      ],
    });
    const result = TournamentSchema.parse(tournament);
    expect(result.groups).toHaveLength(2);
    expect(result.groups![0].id).toBe('A');
    expect(result.groups![0].customName).toBe('Lions');
  });

  it('rejects groups with missing id', () => {
    const tournament = createMinimalTournament({
      groups: [{ customName: 'NoId' }],
    });
    expect(() => TournamentSchema.parse(tournament)).toThrow();
  });

  it('validates tournament with typed fields', () => {
    const tournament = createMinimalTournament({
      fields: [
        { id: 'field-1', defaultName: 'Feld 1', customName: 'Halle Nord' },
      ],
    });
    const result = TournamentSchema.parse(tournament);
    expect(result.fields).toHaveLength(1);
    expect(result.fields![0].defaultName).toBe('Feld 1');
  });

  it('rejects fields with missing defaultName', () => {
    const tournament = createMinimalTournament({
      fields: [{ id: 'field-1' }],
    });
    expect(() => TournamentSchema.parse(tournament)).toThrow();
  });

  it('preserves unknown top-level fields (passthrough)', () => {
    const tournament = createMinimalTournament({ customTopLevel: 'preserved' });
    const result = TournamentSchema.parse(tournament);
    expect((result as Record<string, unknown>).customTopLevel).toBe('preserved');
  });
});

// =============================================================================
// TournamentSchema — full round-trip
// =============================================================================

describe('TournamentSchema round-trip', () => {
  it('validates a complete tournament with all sub-schemas', () => {
    const tournament = createMinimalTournament({
      teams: [
        {
          id: 't1',
          name: 'FC Bayern',
          group: 'A',
          trainers: [{ id: 'tr1', name: 'Coach', inviteStatus: 'accepted', createdAt: '2026-01-01' }],
        },
      ],
      matches: [
        {
          id: 'm1',
          round: 1,
          field: 1,
          teamA: 't1',
          teamB: 't2',
          events: [
            { id: 'e1', timestampSeconds: 60, type: 'GOAL', payload: { teamId: 't1' }, scoreAfter: { home: 1, away: 0 } },
          ],
        },
      ],
      groups: [{ id: 'A', customName: 'Gruppe A' }],
      fields: [{ id: 'field-1', defaultName: 'Feld 1' }],
    });

    const result = TournamentSchema.parse(tournament);
    expect(result.teams).toHaveLength(1);
    expect(result.matches).toHaveLength(1);
    expect(result.groups).toHaveLength(1);
    expect(result.fields).toHaveLength(1);
    expect(result.teams[0].trainers![0].inviteStatus).toBe('accepted');
    expect(result.matches[0].events![0].type).toBe('GOAL');
  });

  it('defaults status to draft', () => {
    const result = TournamentSchema.parse(createMinimalTournament());
    expect(result.status).toBe('draft');
  });
});
