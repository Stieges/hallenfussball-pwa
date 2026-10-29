/**
 * R2 PR 4 – @W2A-012 „… einstellbar sind 1 bis 5 Schützen, vorbelegt 3, im Assistenten und in den Turnier-Einstellungen“.
 * Beide Orte (CLAUDE.md „Häufig vergessen“: der Wizard hat eine eigene Instanz): Wizard Schritt „Modus“ (Match Cockpit Pro) und
 * Admin-Kategorie „Match-Cockpit“ zeigen für ein Turnier ohne gespeicherte Schützenzahl 3. Die Grenzen 1 bis 5 am Feld prüft
 * `B-04d-w2a-034-ungueltiger-regelwert.test.tsx`, am Server die Regel-Fixtures 37 bis 39.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ToastProvider } from '../../ui/Toast/ToastContext';
import { renderInRouter, oeffneAlleAbschnitte, makeTournament } from '../../../__tests__/helpers/b03PlatzhalterHarness';

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));
vi.mock('../../../features/auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    myMembership: {
      id: 'm1', userId: 'user-1', tournamentId: 't1', role: 'owner', teamIds: [],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    },
    members: [], coAdmins: [], isLoading: false, error: null,
  }),
}));

describe('@W2A-012 Schützen vorbelegt 3', () => {
  it('@W2A-012 im Assistenten (Schritt Modus, Match Cockpit Pro): 3', async () => {
    const { Step2_ModeAndSystem } = await import('../../../features/tournament-creation/Step2_ModeAndSystem');
    const { container } = renderInRouter(
      <ToastProvider>
        <Step2_ModeAndSystem formData={{ mode: 'classic' }} onUpdate={vi.fn()} onMovePlacementLogic={vi.fn()} onTogglePlacementLogic={vi.fn()} />
      </ToastProvider>
    );
    oeffneAlleAbschnitte(container);
    expect(await screen.findByTestId('settings-penalty-shooters')).toHaveValue(3);
  }, 30_000);

  it('@W2A-012 in den Turnier-Einstellungen (Admin, Match-Cockpit) ohne gespeicherte Einstellungen: 3', async () => {
    const { MatchCockpitCategory } = await import('../../../features/tournament-admin/categories/MatchCockpit');
    const ohneEinstellungen = { ...makeTournament(), matchCockpitSettings: undefined };
    renderInRouter(<MatchCockpitCategory tournamentId="t1" tournament={ohneEinstellungen} onTournamentUpdate={vi.fn()} />);
    expect(await screen.findByTestId('settings-penalty-shooters')).toHaveValue(3);
  }, 30_000);
});
