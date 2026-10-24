/**
 * B3 / @OB-017: „Turniertyp wechseln“ im Assistenten fragt im Dialog der App nach (Rückfrage-Funktion des Bildschirms),
 * nie über window.confirm. „Turnier zurücksetzen“ prüfen wizard.resultsReset.a10.test.tsx und wizard.entryGuard.test.tsx.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../useRepository', () => ({ useRepository: () => ({ save: vi.fn(), get: () => Promise.resolve(null) }) }));

import { useTournamentWizard } from '../useTournamentWizard';

function startWithClassic(ask?: Parameters<typeof useTournamentWizard>[1]) {
  const hook = renderHook(() => useTournamentWizard(undefined, ask));
  act(() => hook.result.current.updateForm('tournamentType', 'classic'));
  return hook;
}

afterEach(() => vi.restoreAllMocks());

describe('@OB-017 Assistent: Turniertyp wechseln fragt im Dialog der App', () => {
  it('bestätigt: Typ wechselt, die Rückfrage kam über den Dialog und nicht über window.confirm', async () => {
    const browserConfirm = vi.spyOn(window, 'confirm');
    const ask = vi.fn().mockResolvedValue(true);
    const { result } = startWithClassic(ask);

    act(() => result.current.handleTournamentTypeChange('bambini'));

    await waitFor(() => expect(result.current.formData.tournamentType).toBe('bambini'));
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask.mock.calls[0][0].variant).toBe('warning');
    expect(result.current.formData.resultMode).toBe('winLossOnly');
    expect(browserConfirm).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: abgelehnt → Typ bleibt', async () => {
    const browserConfirm = vi.spyOn(window, 'confirm');
    const ask = vi.fn().mockResolvedValue(false);
    const { result } = startWithClassic(ask);

    act(() => result.current.handleTournamentTypeChange('bambini'));

    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    expect(result.current.formData.tournamentType).toBe('classic');
    expect(browserConfirm).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ohne Dialog des Bildschirms gilt die Rückfrage als abgelehnt – nie ein Fenster des Browsers', async () => {
    const browserConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = startWithClassic();

    act(() => result.current.handleTournamentTypeChange('bambini'));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.formData.tournamentType).toBe('classic');
    expect(browserConfirm).not.toHaveBeenCalled();
  });
});
