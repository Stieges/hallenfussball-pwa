/**
 * @ZP-093 „Ein angepfiffenes Spiel lässt sich nicht verschieben, auch nicht in der Halbzeit“ (Befund C-ANGEPFIFFEN-TAUSCHZIEL):
 * Kartenansicht – kein Ablegen auf eine gesperrte Karte, kein Feldwechsel, „Felder neu verteilen“ lässt sie stehen.
 * Gilt für laufende, unterbrochene (paused) und beendete Spiele; ein geplantes Spiel lässt sich weiter verschieben.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

import type { Match } from '../../../../types/tournament';
import { createMockMatch, createMockTournament } from '../../../../test/factories';
import { useScheduleTabActions } from '../useScheduleTabActions';

const T10 = new Date('2026-10-23T10:00:00');
const T11 = new Date('2026-10-23T11:00:00');
const spiel = (id: string, status: string, extra: Partial<Match> = {}) =>
  createMockMatch({ id, field: 1, scheduledTime: T10, matchStatus: status as Match['matchStatus'], ...extra });

function setup(matches: Match[], isEditing = true) {
  const tournament = createMockTournament({ matches, numberOfFields: 2 });
  const onTournamentUpdate = vi.fn();
  const showWarning = vi.fn();
  const setPendingField = vi.fn();
  const { result } = renderHook(() => useScheduleTabActions({
    tournament, onTournamentUpdate, isEditing, saveToHistory: vi.fn(), showSuccess: vi.fn(), showWarning,
    setPendingReferee: vi.fn(), setPendingField, lockFinishedResults: false,
  }));
  return { result, onTournamentUpdate, showWarning, setPendingField };
}

describe('@ZP-093 Kartenansicht: angepfiffene Spiele bleiben stehen (C-ANGEPFIFFEN-TAUSCHZIEL)', () => {
  it.each(['running', 'paused', 'finished'])('@ZP-093 Ablegen auf die Karte eines Spiels mit Status %s wird abgelehnt, mit Rückmeldung', (status) => {
    const { result, onTournamentUpdate, showWarning } = setup([spiel('s5', status), spiel('s6', 'scheduled', { scheduledTime: T11, field: 2 })]);
    let accepted: boolean | undefined;
    act(() => { accepted = result.current.handleMatchSwap('s6', 's5'); });
    expect(accepted).toBe(false);
    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledWith('tournament:schedule.startedLocked');
  });

  it('@ZP-093 ein angepfiffenes Spiel als Quelle des Tauschs wird ebenfalls abgelehnt', () => {
    const { result, onTournamentUpdate } = setup([spiel('s5', 'paused'), spiel('s6', 'scheduled', { scheduledTime: T11 })]);
    act(() => { result.current.handleMatchSwap('s5', 's6'); });
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@ZP-093 Gegenbeispiel: zwei geplante Spiele lassen sich weiter tauschen', () => {
    const { result, onTournamentUpdate, showWarning } = setup([spiel('s5', 'scheduled'), spiel('s6', 'scheduled', { scheduledTime: T11, field: 2 })]);
    let accepted: boolean | undefined;
    act(() => { accepted = result.current.handleMatchSwap('s5', 's6'); });
    expect(accepted).toBe(true);
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
    expect(showWarning).not.toHaveBeenCalled();
  });

  it.each(['running', 'paused', 'finished'])('@ZP-093 Feldwechsel im Bearbeitungsmodus bei Status %s wird abgelehnt, mit Rückmeldung', (status) => {
    const { result, setPendingField, showWarning } = setup([spiel('s5', status)]);
    act(() => { result.current.handleFieldChange('s5', 2); });
    expect(setPendingField).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledWith('tournament:schedule.startedLocked');
  });

  it('@ZP-093 Gegenbeispiel: bei einem geplanten Spiel geht der Feldwechsel durch', () => {
    const { result, setPendingField } = setup([spiel('s5', 'scheduled')]);
    act(() => { result.current.handleFieldChange('s5', 2); });
    expect(setPendingField).toHaveBeenCalledWith('s5', 2);
  });

  it('@ZP-093 „Felder neu verteilen“ lässt ein Spiel in der Halbzeit unverändert, das geplante Spiel weicht aus', () => {
    // beide Spiele um 10:00 auf Feld 1: das angepfiffene behält Feld 1, das geplante wandert auf das freie Feld 2
    const { result, onTournamentUpdate } = setup([spiel('s5', 'paused'), spiel('s6', 'scheduled')]);
    act(() => { result.current.handleRedistributeFields(); });
    const updated = onTournamentUpdate.mock.calls[0][0].matches as Match[];
    expect(updated.find((m) => m.id === 's5')?.field).toBe(1);
    expect(updated.find((m) => m.id === 's6')?.field).toBe(2);
  });
});
