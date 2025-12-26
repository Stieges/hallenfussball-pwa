/**
 * Tests for useScheduleEditor Hook
 *
 * Covers:
 * - Mode management (view/edit)
 * - Match selection
 * - Match updates (time, field, referee)
 * - Skip/unskip functionality
 * - Undo/Redo
 * - State persistence
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScheduleEditor } from '../useScheduleEditor';
import { Match, Tournament } from '../../../../types/tournament';

// ============================================================================
// Test Helpers
// ============================================================================

function createMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: `match-${Math.random().toString(36).slice(2, 7)}`,
    round: 1,
    field: 1,
    teamA: 'team-a',
    teamB: 'team-b',
    scheduledTime: new Date('2024-01-15T10:00:00'),
    matchStatus: 'scheduled',
    ...overrides,
  };
}

function createTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 'test-tournament',
    name: 'Test Tournament',
    sportType: 'hallenfussball',
    tournamentType: 'group_only',
    systemType: 'round_robin',
    teams: [],
    matches: [
      createMatch({ id: 'm1' }),
      createMatch({ id: 'm2', scheduledTime: new Date('2024-01-15T10:15:00') }),
      createMatch({ id: 'm3', scheduledTime: new Date('2024-01-15T10:30:00') }),
    ],
    numberOfFields: 2,
    gameDuration: 10,
    breakDuration: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Tournament;
}

// ============================================================================
// Mode Management Tests
// ============================================================================

describe('Mode Management', () => {
  it('should start in view mode by default', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    expect(result.current.state.mode).toBe('view');
    expect(result.current.isEditing).toBe(false);
  });

  it('should start in specified initial mode', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
        initialMode: 'edit',
      })
    );

    expect(result.current.state.mode).toBe('edit');
    expect(result.current.isEditing).toBe(true);
  });

  it('should enter edit mode', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.enterEditMode();
    });

    expect(result.current.state.mode).toBe('edit');
    expect(result.current.isEditing).toBe(true);
  });

  it('should exit edit mode', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
        initialMode: 'edit',
      })
    );

    act(() => {
      result.current.exitEditMode();
    });

    expect(result.current.state.mode).toBe('view');
    expect(result.current.isEditing).toBe(false);
  });

  it('should toggle edit mode', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    // Toggle to edit
    act(() => {
      result.current.toggleEditMode();
    });
    expect(result.current.isEditing).toBe(true);

    // Toggle back to view
    act(() => {
      result.current.toggleEditMode();
    });
    expect(result.current.isEditing).toBe(false);
  });

  it('should clear selection when exiting edit mode', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
        initialMode: 'edit',
      })
    );

    // Select a match
    act(() => {
      result.current.selectMatch('m1');
    });
    expect(result.current.selectedMatch).not.toBeNull();

    // Exit edit mode
    act(() => {
      result.current.exitEditMode();
    });
    expect(result.current.selectedMatch).toBeNull();
  });
});

// ============================================================================
// Selection Tests
// ============================================================================

describe('Match Selection', () => {
  it('should select a match', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.selectMatch('m1');
    });

    expect(result.current.state.selectedMatchId).toBe('m1');
    expect(result.current.selectedMatch).toBeDefined();
    expect(result.current.selectedMatch?.id).toBe('m1');
  });

  it('should deselect when selecting null', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.selectMatch('m1');
    });
    expect(result.current.selectedMatch).not.toBeNull();

    act(() => {
      result.current.selectMatch(null);
    });
    expect(result.current.selectedMatch).toBeNull();
  });

  it('should return null for non-existent match', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.selectMatch('non-existent');
    });

    expect(result.current.selectedMatch).toBeNull();
  });
});

// ============================================================================
// Update Tests
// ============================================================================

describe('Match Updates', () => {
  it('should update match time', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    const newTime = new Date('2024-01-15T11:00:00');

    act(() => {
      result.current.updateMatchTime('m1', newTime);
    });

    expect(onUpdate).toHaveBeenCalled();
    const updatedTournament = onUpdate.mock.calls[0][0];
    const updatedMatch = updatedTournament.matches.find((m: Match) => m.id === 'm1');
    expect(updatedMatch?.scheduledTime).toEqual(newTime);
  });

  it('should update match field', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchField('m1', 2);
    });

    expect(onUpdate).toHaveBeenCalled();
    const updatedTournament = onUpdate.mock.calls[0][0];
    const updatedMatch = updatedTournament.matches.find((m: Match) => m.id === 'm1');
    expect(updatedMatch?.field).toBe(2);
  });

  it('should update match referee', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchReferee('m1', 3);
    });

    expect(onUpdate).toHaveBeenCalled();
    const updatedTournament = onUpdate.mock.calls[0][0];
    const updatedMatch = updatedTournament.matches.find((m: Match) => m.id === 'm1');
    expect(updatedMatch?.referee).toBe(3);
  });

  it('should remove referee when passing undefined', () => {
    const tournamentWithRef = createTournament({
      matches: [
        createMatch({ id: 'm1', referee: 1 }),
      ],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament: tournamentWithRef,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchReferee('m1', undefined);
    });

    expect(onUpdate).toHaveBeenCalled();
    const updatedTournament = onUpdate.mock.calls[0][0];
    const updatedMatch = updatedTournament.matches.find((m: Match) => m.id === 'm1');
    expect(updatedMatch?.referee).toBeUndefined();
  });

  it('should not update non-existent match', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchField('non-existent', 2);
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('should set dirty flag after update', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.updateMatchField('m1', 2);
    });

    expect(result.current.isDirty).toBe(true);
  });
});

// ============================================================================
// Skip/Unskip Tests
// ============================================================================

describe('Skip/Unskip', () => {
  it('should skip a match', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.skipMatch('m1', 'Team not present');
    });

    expect(onUpdate).toHaveBeenCalled();
    const updatedTournament = onUpdate.mock.calls[0][0];
    const updatedMatch = updatedTournament.matches.find((m: Match) => m.id === 'm1');
    expect(updatedMatch?.matchStatus).toBe('skipped');
    expect(updatedMatch?.skippedReason).toBe('Team not present');
    expect(updatedMatch?.skippedAt).toBeDefined();
  });

  it('should unskip a match', () => {
    const tournamentWithSkipped = createTournament({
      matches: [
        createMatch({
          id: 'm1',
          matchStatus: 'skipped',
          skippedReason: 'Test reason',
          skippedAt: new Date().toISOString(),
        } as Partial<Match>),
      ],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament: tournamentWithSkipped,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.unskipMatch('m1');
    });

    expect(onUpdate).toHaveBeenCalled();
    const updatedTournament = onUpdate.mock.calls[0][0];
    const updatedMatch = updatedTournament.matches.find((m: Match) => m.id === 'm1');
    expect(updatedMatch?.matchStatus).toBe('scheduled');
    expect(updatedMatch?.skippedReason).toBeUndefined();
    expect(updatedMatch?.skippedAt).toBeUndefined();
  });
});

// ============================================================================
// Undo/Redo Tests
// ============================================================================

describe('Undo/Redo', () => {
  it('should not be able to undo initially', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should track changes for undo', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchField('m1', 2);
    });

    expect(result.current.state.pendingChanges.length).toBeGreaterThan(0);
  });

  it('should call undo without error', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchField('m1', 2);
    });

    // Should not throw
    act(() => {
      result.current.undo();
    });
  });

  it('should call redo without error', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchField('m1', 2);
    });

    act(() => {
      result.current.undo();
    });

    // Should not throw
    act(() => {
      result.current.redo();
    });
  });
});

// ============================================================================
// Persistence Tests
// ============================================================================

describe('Persistence', () => {
  it('should save changes and clear dirty flag', async () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchField('m1', 2);
    });

    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.saveChanges();
    });

    expect(result.current.isDirty).toBe(false);
    expect(result.current.state.pendingChanges).toHaveLength(0);
  });

  it('should discard changes and clear dirty flag', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchField('m1', 2);
    });

    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.discardChanges();
    });

    expect(result.current.isDirty).toBe(false);
    expect(result.current.state.pendingChanges).toHaveLength(0);
  });

  it('should clear undo/redo stacks on save', async () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchField('m1', 2);
    });

    await act(async () => {
      await result.current.saveChanges();
    });

    expect(result.current.state.undoStack).toHaveLength(0);
    expect(result.current.state.redoStack).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty tournament matches', () => {
    const tournament = createTournament({ matches: [] });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    expect(result.current.selectedMatch).toBeNull();

    act(() => {
      result.current.selectMatch('any');
    });

    expect(result.current.selectedMatch).toBeNull();
  });

  it('should handle time as ISO string', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchTime('m1', '2024-01-15T12:00:00.000Z');
    });

    expect(onUpdate).toHaveBeenCalled();
    const updatedTournament = onUpdate.mock.calls[0][0];
    const updatedMatch = updatedTournament.matches.find((m: Match) => m.id === 'm1');
    expect(updatedMatch?.scheduledTime).toBeInstanceOf(Date);
  });

  it('should update timestamp on tournament update', () => {
    // Use an explicitly old timestamp to ensure the new one is different
    const tournament = createTournament({
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchField('m1', 2);
    });

    expect(onUpdate).toHaveBeenCalled();
    const updatedTournament = onUpdate.mock.calls[0][0];
    // The new timestamp should be more recent than 2020
    expect(new Date(updatedTournament.updatedAt).getFullYear()).toBeGreaterThan(2020);
  });

  it('should preserve other match properties on update', () => {
    const matchWithExtras = createMatch({
      id: 'm1',
      scoreA: 3,
      scoreB: 2,
      referee: 1,
    });
    const tournament = createTournament({
      matches: [matchWithExtras],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchField('m1', 2);
    });

    const updatedTournament = onUpdate.mock.calls[0][0];
    const updatedMatch = updatedTournament.matches.find((m: Match) => m.id === 'm1');
    expect(updatedMatch?.field).toBe(2);
    expect(updatedMatch?.scoreA).toBe(3);
    expect(updatedMatch?.scoreB).toBe(2);
    expect(updatedMatch?.referee).toBe(1);
  });
});

// ============================================================================
// Concurrent Update Tests
// ============================================================================

describe('Concurrent Updates', () => {
  it('should handle multiple rapid updates', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchField('m1', 2);
      result.current.updateMatchField('m2', 2);
      result.current.updateMatchField('m3', 2);
    });

    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(result.current.isDirty).toBe(true);
  });

  it('should handle update to same match multiple times', () => {
    const tournament = createTournament();
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useScheduleEditor({
        tournament,
        onTournamentUpdate: onUpdate,
      })
    );

    act(() => {
      result.current.updateMatchField('m1', 2);
    });

    act(() => {
      result.current.updateMatchField('m1', 1);
    });

    act(() => {
      result.current.updateMatchField('m1', 2);
    });

    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(result.current.state.pendingChanges.length).toBe(3);
  });
});
