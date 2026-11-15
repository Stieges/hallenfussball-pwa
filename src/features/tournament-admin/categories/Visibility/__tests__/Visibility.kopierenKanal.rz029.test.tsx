/**
 * @RZ-029 „Link kopieren“ in der Verwaltung (Sichtbarkeit) kopiert die Zuschauer-Adresse mit dem Kanal Link (?k=l);
 * der angezeigte Link bleibt ohne Zusatz.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { ToastProvider } from '../../../../../components/ui/Toast';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../../../hooks/useRepository', () => ({
  useRepository: () => ({ makeTournamentPublic: vi.fn(), makeTournamentPrivate: vi.fn(), regenerateShareCode: vi.fn() }),
}));
vi.mock('../../../../../lib/supabase', () => ({ isSupabaseConfigured: true }));
vi.mock('../../../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));

import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { VisibilityCategory } from '../index';

await initRealDeI18n();

const tournament = {
  id: 'cup', title: 'Nikolaus-Turnier', status: 'published', publishedAt: '2026-02-01T10:00:00.000Z',
  isPublic: true, shareCode: 'NIKO26', teams: [], matches: [],
} as unknown as Tournament;

describe('@RZ-029 Link kopieren in der Verwaltung', () => {
  const schreiben = vi.fn(() => Promise.resolve());
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: schreiben }, configurable: true });
  });

  it('kopiert …/#/live/NIKO26?k=l; der angezeigte Link steht ohne Zusatz da', async () => {
    render(<ToastProvider><VisibilityCategory tournamentId="cup" tournament={tournament} onTournamentUpdate={vi.fn()} /></ToastProvider>);
    fireEvent.click(screen.getByText('Turnier-Sichtbarkeit'));
    const angezeigt = `${window.location.origin}/#/live/NIKO26`;
    expect(screen.getByDisplayValue(angezeigt)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '📋 Kopieren' }));
    await waitFor(() => expect(schreiben).toHaveBeenCalledWith(`${angezeigt}?k=l`));
  });
});
