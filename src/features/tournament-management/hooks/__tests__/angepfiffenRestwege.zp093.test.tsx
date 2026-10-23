/**
 * @ZP-093 Restwege (Befund C-ANGEPFIFFEN-TAUSCHZIEL, Review #350 A3): Rückgängig/Wiederholen und ein vorgemerkter
 * Feldwechsel setzen Zeit und Feld eines Spiels nicht zurück, das inzwischen angepfiffen wurde (läuft, Halbzeit, beendet).
 * Gegenbeispiel: ein noch geplantes Spiel wird weiter zurückgesetzt bzw. umgesetzt.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Match, Tournament } from '../../../../types/tournament';
import { createMockMatch, createMockTournament } from '../../../../test/factories';
import { keepStartedPlaces } from '../../../schedule-editor';
import { useScheduleHistory } from '../useScheduleHistory';
import { usePendingChanges } from '../usePendingChanges';

vi.mock('../../../../components/ui/Toast', () => ({ useToast: () => ({ showSuccess: vi.fn(), showWarning: vi.fn() }) }));

const T10 = new Date('2026-10-23T10:00:00');
const T11 = new Date('2026-10-23T11:00:00');
const spiel = (status: string, extra: Partial<Match> = {}) =>
  createMockMatch({ id: 's5', field: 1, scheduledTime: T10, matchStatus: status as Match['matchStatus'], ...extra });

describe('@ZP-093 Rückgängig/Wiederholen (C-ANGEPFIFFEN-TAUSCHZIEL)', () => {
  it.each(['running', 'paused', 'finished'])('@ZP-093 Rückgängig setzt ein inzwischen angepfiffenes Spiel (%s) nicht auf Zeit und Feld zurück', (status) => {
    const onMatchesUpdate = vi.fn();
    const { result: r, rerender } = renderHook((p: { matches: Match[] }) => useScheduleHistory({ matches: p.matches, onMatchesUpdate, isEditing: true }),
      { initialProps: { matches: [spiel('scheduled')] } });
    act(() => { r.current.saveToHistory(); });
    rerender({ matches: [spiel(status, { scheduledTime: T11, field: 2 })] });
    act(() => { r.current.handleUndo(); });
    const applied = onMatchesUpdate.mock.calls[0][0] as Match[];
    expect(applied[0].field).toBe(2);
    expect(applied[0].scheduledTime).toEqual(T11);
  });

  it('@ZP-093 Gegenbeispiel: ein geplantes Spiel wird durch Rückgängig weiter zurückgesetzt', () => {
    const onMatchesUpdate = vi.fn();
    const { result, rerender } = renderHook((p: { matches: Match[] }) => useScheduleHistory({ matches: p.matches, onMatchesUpdate, isEditing: true }),
      { initialProps: { matches: [spiel('scheduled')] } });
    act(() => { result.current.saveToHistory(); });
    rerender({ matches: [spiel('scheduled', { scheduledTime: T11, field: 2 })] });
    act(() => { result.current.handleUndo(); });
    const applied = onMatchesUpdate.mock.calls[0][0] as Match[];
    expect(applied[0].field).toBe(1);
    expect(applied[0].scheduledTime).toEqual(T10);
  });

  it('@ZP-093 Wiederholen behält Zeit und Feld eines angepfiffenen Spiels ebenfalls', () => {
    const snapshot = [spiel('scheduled', { scheduledTime: T11, field: 2 })];
    const aktuell = [spiel('paused', { scheduledTime: T10, field: 1 })];
    const [m] = keepStartedPlaces(snapshot, aktuell);
    expect(m.field).toBe(1);
    expect(m.scheduledTime).toEqual(T10);
  });
});

describe('@ZP-093 vorgemerkter Feldwechsel (C-ANGEPFIFFEN-TAUSCHZIEL)', () => {
  const speichere = (spaeterStatus: string) => {
    const onTournamentUpdate = vi.fn();
    const vorher = createMockTournament({ matches: [spiel('scheduled')], numberOfFields: 2 });
    const nachher: Tournament = { ...vorher, matches: [spiel(spaeterStatus)] };
    const { result, rerender } = renderHook((p: { tournament: Tournament }) =>
      usePendingChanges({ tournament: p.tournament, onTournamentUpdate, clearHistory: vi.fn() }), { initialProps: { tournament: vorher } });
    act(() => { result.current.setPendingField('s5', 2); });
    rerender({ tournament: nachher });
    act(() => { result.current.handleSaveWithConflicts(); });
    return onTournamentUpdate.mock.calls[0][0] as Tournament;
  };

  it.each(['running', 'paused', 'finished'])('@ZP-093 ein vor dem Anpfiff vorgemerkter Feldwechsel wird beim Speichern für ein %s-Spiel übersprungen', (status) => {
    const saved = speichere(status);
    expect(saved.matches[0].field).toBe(1);
    expect(saved.fieldAssignments?.s5).toBeUndefined();
  });

  it('@ZP-093 gegenbeispiel: bei einem weiter geplanten Spiel wird der vorgemerkte Feldwechsel gespeichert', () => {
    const saved = speichere('scheduled');
    expect(saved.matches[0].field).toBe(2);
    expect(saved.fieldAssignments?.s5).toBe(2);
  });
});
