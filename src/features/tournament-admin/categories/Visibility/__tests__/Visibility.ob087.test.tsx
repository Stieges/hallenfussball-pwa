/**
 * @OB-087 Zeile 7: Olli ändert die Sichtbarkeit, und das Speichern scheitert. Am Fehlerhinweis steht „Erneut versuchen“ (≥ 44 px); ein Tipp wiederholt genau
 * diese Änderung (Veröffentlichen bzw. Privatisieren). Solange der Versuch läuft, ist die Taste gesperrt und arbeitet; ein zweiter Tipp löst nichts doppelt aus.
 * Gelingt es, verschwindet der Hinweis. Gegenbeispiel: bei einem anderen Fehler (neuer Code) steht keine Taste.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { ToastProvider } from '../../../../../components/ui/Toast';
import { touchTargets } from '../../../../../design-tokens';

const repo = vi.hoisted(() => ({ makeTournamentPublic: vi.fn(), makeTournamentPrivate: vi.fn(), regenerateShareCode: vi.fn() }));
vi.mock('../../../../../hooks/useRepository', () => ({ useRepository: () => repo }));
vi.mock('../../../../../lib/supabase', () => ({ isSupabaseConfigured: true }));
vi.mock('../../../../auth/hooks/useMyTournamentRole', () => ({ useMyTournamentRole: () => ({ role: 'owner', isLoading: false }) }));

import { VisibilityCategory } from '../index';

const GEPRIEN = { shareCode: 'ABC123', createdAt: '2026-02-01T10:00:00.000Z' };
const turnier = (o: Partial<Tournament>): Tournament =>
  ({ id: 't1', title: 'Test-Turnier', status: 'published', publishedAt: '2026-02-01T10:00:00.000Z', teams: [], matches: [], ...o }) as unknown as Tournament;

function zeige(t: Tournament, onUpdate = vi.fn()) {
  render(<ToastProvider><VisibilityCategory tournamentId={t.id} tournament={t} onTournamentUpdate={onUpdate} /></ToastProvider>);
  fireEvent.click(screen.getByText('admin:visibility.tournamentVisibility')); // die Sektion ist eingeklappt
  return onUpdate;
}

/**
 * Tippt die Option an der Auswahl. Der Tipp geht auf die Auswahlkugel: ein Tipp auf den Text der Beschriftung löst im Test (React-Stapel in `act`)
 * die Beschriftung zweimal aus (Tipp + weitergereichter Tipp auf die Kugel); im Browser sieht die zweite Auslösung schon „wird gespeichert“.
 */
function waehle(option: 'privat' | 'teilbar'): void {
  fireEvent.click(screen.getAllByRole('radio')[option === 'privat' ? 0 : 1]);
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.makeTournamentPublic.mockResolvedValue(GEPRIEN);
  repo.makeTournamentPrivate.mockResolvedValue(undefined);
  repo.regenerateShareCode.mockResolvedValue(GEPRIEN);
});

describe('@OB-087 Zeile 7 – „Erneut versuchen“ beim gescheiterten Ändern der Sichtbarkeit', () => {
  it('@OB-087 Zeile 7: scheitert „Mit Link teilbar“, steht „Erneut versuchen“ (≥ 44 px) am Hinweis; der Tipp wiederholt genau das Veröffentlichen, bei Erfolg verschwindet der Hinweis', async () => {
    repo.makeTournamentPublic.mockRejectedValueOnce(new Error('Failed to fetch'));
    const onUpdate = zeige(turnier({ isPublic: false }));
    waehle('teilbar');
    const hinweis = await screen.findByTestId('visibility-error');
    expect(hinweis).toHaveTextContent('Failed to fetch');
    const taste = screen.getByTestId('visibility-error-retry');
    expect(taste).toHaveStyle({ minHeight: touchTargets.minimum });

    await act(async () => { fireEvent.click(taste); });
    await waitFor(() => { expect(screen.queryByTestId('visibility-error')).toBeNull(); });
    expect(repo.makeTournamentPublic).toHaveBeenCalledTimes(2);
    expect(repo.makeTournamentPrivate).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ isPublic: true, shareCode: 'ABC123' }));
  });

  it('@OB-087 Zeile 7: scheitert „Privat“, wiederholt „Erneut versuchen“ genau das Privatisieren – nicht das Veröffentlichen', async () => {
    repo.makeTournamentPrivate.mockRejectedValueOnce(new Error('Failed to fetch'));
    const onUpdate = zeige(turnier({ isPublic: true, shareCode: 'ABC123' }));
    waehle('privat');
    await screen.findByTestId('visibility-error');
    await act(async () => { fireEvent.click(screen.getByTestId('visibility-error-retry')); });
    await waitFor(() => { expect(screen.queryByTestId('visibility-error')).toBeNull(); });
    expect(repo.makeTournamentPrivate).toHaveBeenCalledTimes(2);
    expect(repo.makeTournamentPublic).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ isPublic: false }));
  });

  it('@OB-087 Zeile 7: solange der Versuch läuft, ist die Taste gesperrt und arbeitet; ein zweiter Tipp löst nichts doppelt aus; scheitert er wieder, ist sie frei', async () => {
    repo.makeTournamentPublic.mockRejectedValueOnce(new Error('Failed to fetch'));
    zeige(turnier({ isPublic: false }));
    waehle('teilbar');
    await screen.findByTestId('visibility-error');
    let scheitern: (e: Error) => void = () => undefined;
    repo.makeTournamentPublic.mockReturnValueOnce(new Promise((_ok, nein) => { scheitern = nein; }));
    const taste = screen.getByTestId('visibility-error-retry');
    await act(async () => { fireEvent.click(taste); fireEvent.click(taste); });
    expect(repo.makeTournamentPublic).toHaveBeenCalledTimes(2); // ein Versuch, nicht zwei
    expect(screen.getByTestId('visibility-error-retry')).toHaveAttribute('aria-busy', 'true');
    await act(async () => { scheitern(new Error('Failed to fetch')); });
    expect(screen.getByTestId('visibility-error')).toBeInTheDocument();
    expect(screen.getByTestId('visibility-error-retry')).not.toHaveAttribute('aria-busy', 'true');
  });

  it('@OB-087 Zeile 7 Gegenbeispiel: ohne Fehler gibt es keinen Hinweis und keine Taste', () => {
    zeige(turnier({ isPublic: false }));
    expect(screen.queryByTestId('visibility-error')).toBeNull();
    expect(screen.queryByTestId('visibility-error-retry')).toBeNull();
  });

  it('@OB-087 Zeile 7 Gegenbeispiel: scheitert „Neuen Code erzeugen“, steht der Hinweis ohne „Erneut versuchen“', async () => {
    repo.regenerateShareCode.mockRejectedValueOnce(new Error('Failed to fetch'));
    zeige(turnier({ isPublic: true, shareCode: 'ABC123' }));
    fireEvent.click(screen.getByText('admin:visibility.generateNewCode'));
    expect(await screen.findByTestId('visibility-error')).toHaveTextContent('admin:visibility.errorRegeneratingCode');
    expect(screen.queryByTestId('visibility-error-retry')).toBeNull();
  });
});
