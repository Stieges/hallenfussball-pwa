/**
 * R3-3 Zuschauer-Schalter nach dem Abschluss. @LZ-037: „die öffentliche Ansicht beenden“ und „den Code erneuern“ gelingen,
 * „Ergebnisse/Tabelle für Zuschauer ausblenden“ und die Anzeige-Einstellungen bietet die App erst nach dem Wiederöffnen an.
 * (Den Torschützen-Schalter `publicScorers` gibt es in der App noch nicht als Bedienelement -- sobald er kommt, gehört er
 * mit `useCan(..., { openAfterClose: true })` hierher.) Gegenbeispiel: offen -- alle Schalter bedienbar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { ToastProvider } from '../../../../../components/ui/Toast';

const makeTournamentPrivate = vi.fn(() => Promise.resolve());
const regenerateShareCode = vi.fn(() => Promise.resolve({ shareCode: 'DEF456', createdAt: '2026-02-01T10:00:00.000Z' }));
vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../../../../hooks/useRepository', () => ({
  useRepository: () => ({ makeTournamentPublic: vi.fn(), makeTournamentPrivate, regenerateShareCode }),
}));
vi.mock('../../../../../lib/supabase', () => ({ isSupabaseConfigured: true }));
vi.mock('../../../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));

import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { setTournamentClosed, resetClosedTournaments } from '../../../../../core/services/closedTournaments';
import { VisibilityCategory } from '../index';

await initRealDeI18n();

const tournament = {
  id: 'cup', title: 'Live-Cup', status: 'published', publishedAt: '2026-02-01T10:00:00.000Z',
  isPublic: true, shareCode: 'ABC123', teams: [], matches: [],
} as unknown as Tournament;

function renderCategory(onTournamentUpdate = vi.fn()) {
  render(<ToastProvider><VisibilityCategory tournamentId="cup" tournament={tournament} onTournamentUpdate={onTournamentUpdate} /></ToastProvider>);
  return onTournamentUpdate;
}

beforeEach(() => { vi.clearAllMocks(); resetClosedTournaments(); });
afterEach(() => { resetClosedTournaments(); });

describe('@LZ-037 Zuschauer-Schalter nach dem Abschluss', () => {
  it('abgeschlossen: Ergebnisse- und Tabellen-Schalter gesperrt, Hinweis „abgeschlossen“', () => {
    setTournamentClosed('cup', true);
    renderCategory();
    expect(screen.getByTestId('visibility-scores-toggle')).toBeDisabled();
    expect(screen.getByTestId('visibility-rankings-toggle')).toBeDisabled();
    expect(screen.getByTestId('tournament-closed-hint')).toHaveTextContent('Das Turnier ist abgeschlossen');
  });

  it('abgeschlossen: „Öffentliche Ansicht beenden“ gelingt weiter (eigener Server-Weg)', async () => {
    setTournamentClosed('cup', true);
    renderCategory();
    fireEvent.click(screen.getByText('Turnier-Sichtbarkeit'));
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
    for (const radio of radios) {
      expect(radio).toBeEnabled();
    }
    fireEvent.click(screen.getByText('🔒 Privat'));
    await waitFor(() => expect(makeTournamentPrivate).toHaveBeenCalledWith('cup'));
  });

  it('abgeschlossen: „Neuen Code erzeugen“ bleibt angeboten (Code erneuern, @LZ-037 Z. 5)', async () => {
    setTournamentClosed('cup', true);
    renderCategory();
    fireEvent.click(screen.getByText('Neuen Code generieren'));
    await waitFor(() => expect(regenerateShareCode).toHaveBeenCalledWith('cup'));
  });

  it('Gegenbeispiel: offen – beide Schalter bedienbar, kein Hinweis', () => {
    renderCategory();
    expect(screen.getByTestId('visibility-scores-toggle')).toBeEnabled();
    expect(screen.getByTestId('visibility-rankings-toggle')).toBeEnabled();
    expect(screen.queryByTestId('tournament-closed-hint')).not.toBeInTheDocument();
  });
});
