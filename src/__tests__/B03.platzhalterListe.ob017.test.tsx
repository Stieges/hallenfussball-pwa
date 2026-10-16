/**
 * B-03 (V3) — @OB-017-Gruppe aus B03.platzhalterListe.test.tsx.
 * Gemeinsame Mocks und Helfer: ./helpers/b03PlatzhalterHarness.tsx.
 * Jeder Test unverändert; 30 s Timeout je Fall (kein globales testTimeout).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { makeTournament, renderInRouter, expectRendered } from './helpers/b03PlatzhalterHarness';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// @OB-017 — Rückfragen im Dialog der App, nie als Fenster des Browsers (3 Beispielzeilen)
// ---------------------------------------------------------------------------

type RueckfrageFall = {
  kennung: string;
  zeile: string;
  aktion: string;
  pruefen: () => Promise<void>;
};
const OB017: RueckfrageFall[] = [
  {
    kennung: '@OB-017',
    zeile: 'Team-loeschen',
    aktion: '„Team löschen“ für VfB Ufer wählt',
    pruefen: async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { TeamsTab } = await import('../features/tournament-management/TeamsTab');
      const { ToastProvider } = await import('../components/ui/Toast');
      const { container } = render(
        <ToastProvider>
          <TeamsTab tournament={makeTournament()} onTournamentUpdate={vi.fn()} />
        </ToastProvider>
      );
      expectRendered(container);
      fireEvent.click(screen.getByTestId('team-expand-toggle-vfb'));
      const deleteButton = screen.getAllByRole('button').find((button) =>
        (button.textContent ?? '').includes('teams.delete')
      );
      expect(deleteButton).toBeDefined();
      fireEvent.click(deleteButton!);
      expect(confirmSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByTestId('team-delete-dialog')).toBeInTheDocument();
      });
    },
  },
  {
    kennung: '@OB-017',
    zeile: 'Spielplan-zuruecksetzen',
    aktion: '„Spielplan zurücksetzen“ wählt',
    pruefen: async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { DangerZoneCategory } = await import('../features/tournament-admin/categories/DangerZone');
      const { container } = render(
        <DangerZoneCategory
          tournamentId="t1"
          tournament={makeTournament()}
          onTournamentUpdate={vi.fn()}
          onLocalTournamentUpdate={vi.fn()}
          onMatchesUpdate={vi.fn()}
        />
      );
      expectRendered(container);
      const resetButton = screen.getAllByRole('button').find((button) =>
        (button.textContent ?? '').includes('Spielplan zurücksetzen')
      );
      expect(resetButton).toBeDefined();
      fireEvent.click(resetButton!);
      expect(confirmSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    },
  },
  {
    kennung: '@OB-017',
    zeile: 'Anlegen-Verlassen',
    aktion: 'den Anlege-Vorgang mit ungesicherten Angaben über die Navigation der App verlässt',
    pruefen: async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { TournamentCreationScreen } = await import('../screens/TournamentCreationScreen');
      const { ToastProvider } = await import('../components/ui/Toast');
      const onBack = vi.fn();
      const { container } = renderInRouter(
        <ToastProvider>
          <TournamentCreationScreen
            onBack={onBack}
            onNavigateToLogin={vi.fn()}
            onNavigateToRegister={vi.fn()}
            onNavigateToProfile={vi.fn()}
          />
        </ToastProvider>
      );
      expectRendered(container);
      const backButton = screen.getAllByRole('button').find((button) =>
        /zurück/i.test(button.textContent ?? '')
      );
      expect(backButton).toBeDefined();
      fireEvent.click(backButton!);
      expect(confirmSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    },
  },
];
describe('@OB-017 Rückfragen und Hinweise kommen im Dialog der App, nie als Fenster des Browsers', () => {
  it.each(OB017)('$kennung $zeile: $aktion fragt im Dialog der App nach', async ({ pruefen }) => {
    await pruefen();
  }, 30_000);
});
