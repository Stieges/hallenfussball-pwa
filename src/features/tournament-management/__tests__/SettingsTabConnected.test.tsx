/**
 * Review TB-6 A4: `SettingsTabConnected` lädt nach dem Speichern der Einstellung „Plätze ausspielen“ immer frisch – auch wenn
 * der Dienst einen Fehler wirft (Netzfehler trotz „online“). Der Fehler selbst erreicht den Abschnitt (sichtbare Meldung).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsTabConnected } from '../SettingsTabConnected';
import { nikolaus } from '../../../core/standings/__tests__/decisionTestKit';

const repo = vi.hoisted(() => ({ get: vi.fn(), updatePlacementsToPlayOut: vi.fn() }));
vi.mock('../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => ({ tournamentRepository: repo }) }));
vi.mock('../SettingsTab', () => ({
  SettingsTab: ({ onSavePlayOutPlaces }: { onSavePlayOutPlaces: (p: number[]) => Promise<unknown> }) => (
    <button type="button" onClick={() => { onSavePlayOutPlaces([1, 3]).then(() => 'ok', () => 'fehler'); }}>speichern</button>
  ),
}));

describe('SettingsTabConnected (Review TB-6 A4)', () => {
  it('lädt nach einem Fehler des Speicherwegs trotzdem frisch; Gegenbeispiel: nach Erfolg ebenfalls', async () => {
    const t = nikolaus();
    repo.get.mockResolvedValue(t);
    repo.updatePlacementsToPlayOut.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce(undefined);
    const onSaved = vi.fn();
    render(<SettingsTabConnected tournament={t} onTournamentUpdate={vi.fn()} onPlacesSaved={onSaved} />);
    await userEvent.click(screen.getByText('speichern'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByText('speichern'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
    expect(repo.updatePlacementsToPlayOut).toHaveBeenCalledTimes(2);
  });
});
