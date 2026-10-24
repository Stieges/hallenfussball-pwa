/**
 * @OB-055 (B-43b3-F) — Rückfrage „Ungespeicherte Änderungen“ im Turnier-Verwaltungsschirm:
 * Esc und Klick auf die Abdunkelung lösen „Abbrechen“ aus (nicht „Verwerfen“); man bleibt in den
 * Einstellungen, die Änderungen bleiben erhalten (der nächste Tab-Wechsel fragt erneut).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TournamentManagementScreen } from '../TournamentManagementScreen';
import { ToastProvider } from '../../components/ui/Toast';

vi.mock('../../hooks/useTournamentManager', () => ({
  useTournamentManager: () => ({
    tournament: { id: 't1', name: 'Wintercup', teams: [], matches: [], groups: [], numberOfGroups: 1 },
    schedule: { allMatches: [], rounds: [] }, currentStandings: [], isLoading: false, loadingError: null,
    handleTournamentUpdate: vi.fn(), applyRemote: vi.fn(), scheduleService: {},
  }),
}));
// Fixrunde TB-6: der Reiter „Einstellungen“ holt das Repository aus dem Kontext (schmaler Speicherweg der Plätze-Einstellung)
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => ({ tournamentRepository: {} }) }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('../../components/layout/AuthSection', () => ({ AuthSection: () => null }));
vi.mock('../../features/klaerungsliste/KlaerungslisteEinstieg', () => ({ KlaerungslisteEinstieg: () => null })); // B-50: braucht AuthProvider, hier nicht Gegenstand
// A-08f3e3: Übertragungsstatus im Kopf braucht Repository-Kontext; hier nicht Gegenstand.
vi.mock('../../features/tournament-management/components/EngineOutboxHeaderStatus', () => ({ EngineOutboxHeaderStatus: () => null }));
vi.mock('../../features/tournament-management/TeamsTab', () => ({ TeamsTab: () => <p>Teams-Tab</p> }));
vi.mock('../../features/tournament-management/SettingsTab', () => ({
  SettingsTab: ({ onDirtyChange }: { onDirtyChange: (d: boolean) => void }) => (
    <button onClick={() => onDirtyChange(true)}>Änderung tippen</button>
  ),
}));

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

function mount() {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/tournament/t1/settings']}>
        <TournamentManagementScreen
          tournamentId="t1" onNavigateToLogin={vi.fn()} onNavigateToRegister={vi.fn()} onNavigateToProfile={vi.fn()}
        />
        <Where />
      </MemoryRouter>
    </ToastProvider>,
  );
  fireEvent.click(screen.getByText('Änderung tippen'));
  fireEvent.click(screen.getByText('Teams'));
}

describe('@OB-055 B-43b3-F Verwaltungsschirm – Rückfrage ungespeicherte Änderungen', () => {
  it('Tab-Wechsel mit Änderungen öffnet die Rückfrage und bleibt zunächst auf der Seite', () => {
    mount();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('where').textContent).toContain('settings');
  });

  it('Esc löst „Abbrechen“ aus: Rückfrage zu, Einstellungen bleiben, Änderungen bleiben (erneute Rückfrage)', () => {
    mount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('where').textContent).toContain('settings');
    fireEvent.click(screen.getByText('Teams'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Klick auf die Abdunkelung löst „Abbrechen“ aus, nicht „Verwerfen“', () => {
    mount();
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('where').textContent).toContain('settings');
  });

  it('Gegenbeispiel: „Verwerfen“ wechselt den Tab', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('where').textContent).toContain('teams');
  });
});
