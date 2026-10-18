/**
 * B-06 Gegenbeispiel (CLAUDE.md „Häufig vergessen“): Nach dem Umzug nach `match-settings/` rendern
 * Wizard Schritt 2 und die Admin-Kategorie „Match-Cockpit“ das Einstellungs-Panel unverändert.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../types/tournament';
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

describe('B-06 MatchCockpitSettingsPanel nach dem Umzug', () => {
  it('Wizard Schritt 2 rendert das Panel (Zeitstrafe-Feld da)', async () => {
    const { Step2_ModeAndSystem } = await import('../../../features/tournament-creation/Step2_ModeAndSystem');
    const { container } = renderInRouter(
      <ToastProvider>
        <Step2_ModeAndSystem
          formData={{ mode: 'classic' }}
          onUpdate={vi.fn()}
          onMovePlacementLogic={vi.fn()}
          onTogglePlacementLogic={vi.fn()}
        />
      </ToastProvider>
    );
    oeffneAlleAbschnitte(container);
    expect(await screen.findByTestId('settings-time-penalty-duration')).toBeInTheDocument();
  }, 30_000);

  it('Admin-Kategorie „Match-Cockpit“ rendert das Panel (Zeitstrafe-Feld da)', async () => {
    const { MatchCockpitCategory } = await import('../../../features/tournament-admin/categories/MatchCockpit');
    renderInRouter(
      <MatchCockpitCategory tournamentId="t1" tournament={makeTournament()} onTournamentUpdate={vi.fn()} />
    );
    expect(await screen.findByTestId('settings-time-penalty-duration')).toBeInTheDocument();
  }, 30_000);

  it('@SL-005 @SL-009 Wizard Schritt 2 bietet „Spiel automatisch beenden“ nicht an, Ton und Vibration stehen weiter da', async () => {
    const { Step2_ModeAndSystem } = await import('../../../features/tournament-creation/Step2_ModeAndSystem');
    const { container } = renderInRouter(
      <ToastProvider>
        <Step2_ModeAndSystem
          formData={{ mode: 'classic' }}
          onUpdate={vi.fn()}
          onMovePlacementLogic={vi.fn()}
          onTogglePlacementLogic={vi.fn()}
        />
      </ToastProvider>
    );
    oeffneAlleAbschnitte(container);
    expect(await screen.findByTestId('settings-time-penalty-duration')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /enableAutoEnd|automatisch beenden|Auto-Beenden/i })).toBeNull();
    expect(container.textContent ?? '').not.toMatch(/autoEnd|Auto-Beenden|automatisch beenden/i);
    expect(screen.getAllByRole('switch', { name: /enableVibration|Vibration/i }).length).toBeGreaterThan(0);
  }, 30_000);

  it('@SL-005 @SL-009 Wizard-Zusammenfassung nennt „Auto“ nicht, auch bei gespeichertem autoFinishEnabled=true', async () => {
    const { Step2_ModeAndSystem } = await import('../../../features/tournament-creation/Step2_ModeAndSystem');
    const { container } = renderInRouter(
      <ToastProvider>
        <Step2_ModeAndSystem
          formData={{ mode: 'classic', matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, autoFinishEnabled: true, soundEnabled: true } }}
          onUpdate={vi.fn()}
          onMovePlacementLogic={vi.fn()}
          onTogglePlacementLogic={vi.fn()}
        />
      </ToastProvider>
    );
    expect((await screen.findAllByText(/Sound/)).length).toBeGreaterThan(0);
    expect(container.textContent ?? '').not.toMatch(/Sound \+ (Haptik \+ )?Auto|\bAuto\b/);
  }, 30_000);

  it('@SL-005 @SL-009 Admin-Center bietet „Spiel automatisch beenden“ nicht an', async () => {
    const { MatchCockpitCategory } = await import('../../../features/tournament-admin/categories/MatchCockpit');
    const { container } = renderInRouter(
      <MatchCockpitCategory tournamentId="t1" tournament={makeTournament()} onTournamentUpdate={vi.fn()} />
    );
    expect(await screen.findByTestId('settings-time-penalty-duration')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /enableAutoEnd|automatisch beenden|Auto-Beenden/i })).toBeNull();
    expect(container.textContent ?? '').not.toMatch(/autoEnd|Auto-Beenden|automatisch beenden/i);
  }, 30_000);
});
