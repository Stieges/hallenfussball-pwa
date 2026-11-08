/**
 * @W2A-080 „Die Turnierleitung schaltet ‚Zeitstrafe endet bei Gegentor‘ bei den Spielregeln ein oder aus“ – Gegeben Olli legt den
 * „Hallencup Nord“ an und öffnet die Spielregeln / Dann steht dort „Zeitstrafe endet bei Gegentor“, eingeschaltet vorbelegt /
 * Und schaltet er es aus, gilt @W2A-015 für alle danach eingetragenen Zeitstrafen.
 * Beide Orte (CLAUDE.md „Häufig vergessen“: der Wizard hat eine eigene Instanz): Wizard Schritt „Modus“ (Step2) und Admin-Kategorie
 * „Match-Cockpit“ (Turniereinstellungen); dazu der Baustein selbst mit Sperre für Nicht-Turnierleitung (@W2A-030). Die Wirkung auf
 * eine neue Strafe (Eintrag trägt `endsOnGoal`) prüft `LiveCockpit.zeitstrafeGegentor.engine.test.tsx`.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/Toast/ToastContext';
import { renderInRouter, oeffneAlleAbschnitte, makeTournament } from '../../../__tests__/helpers/b03PlatzhalterHarness';
import { MatchCockpitSettingsPanel } from '../MatchCockpitSettingsPanel';
import { RulesLockProvider } from '../RulesLockContext';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../types/tournament';

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

describe('@W2A-080 Schalter „Zeitstrafe endet bei Gegentor“ bei den Spielregeln', () => {
  it('@W2A-080 Vorgabe: eingeschaltet', () => {
    expect(DEFAULT_MATCH_COCKPIT_SETTINGS.penaltyEndsOnGoal).toBe(true);
  });

  it('@W2A-080 im Assistenten (Schritt Modus): eingeschaltet vorbelegt; ausschalten gibt die Regel „aus“ weiter', async () => {
    const { Step2_ModeAndSystem } = await import('../../../features/tournament-creation/Step2_ModeAndSystem');
    const onUpdate = vi.fn();
    const { container } = renderInRouter(
      <ToastProvider>
        <Step2_ModeAndSystem formData={{ mode: 'classic' }} onUpdate={onUpdate} onMovePlacementLogic={vi.fn()} onTogglePlacementLogic={vi.fn()} />
      </ToastProvider>
    );
    oeffneAlleAbschnitte(container);
    const schalter = await screen.findByTestId('settings-penalty-ends-on-goal');
    expect(schalter).toBeChecked();
    fireEvent.click(schalter);
    expect(onUpdate).toHaveBeenCalledWith('matchCockpitSettings', expect.objectContaining({ penaltyEndsOnGoal: false }));
  }, 30_000);

  it('@W2A-080 in den Turnier-Einstellungen (Admin, Match-Cockpit) ohne gespeicherte Einstellungen: eingeschaltet; ausschalten speichert „aus“', async () => {
    const { MatchCockpitCategory } = await import('../../../features/tournament-admin/categories/MatchCockpit');
    const onTournamentUpdate = vi.fn();
    const ohne = { ...makeTournament(), matchCockpitSettings: undefined };
    renderInRouter(<MatchCockpitCategory tournamentId="t1" tournament={ohne} onTournamentUpdate={onTournamentUpdate} />);
    const schalter = await screen.findByTestId('settings-penalty-ends-on-goal');
    expect(schalter).toBeChecked();
    fireEvent.click(schalter);
    expect(onTournamentUpdate).toHaveBeenCalledWith(expect.objectContaining({
      matchCockpitSettings: expect.objectContaining({ penaltyEndsOnGoal: false }),
    }));
  }, 30_000);

  it('@W2A-080 ein gespeichertes „aus“ steht ausgeschaltet da', () => {
    render(<MatchCockpitSettingsPanel settings={{ ...DEFAULT_MATCH_COCKPIT_SETTINGS, penaltyEndsOnGoal: false }} onChange={vi.fn()} tournamentId="t1" onTestSound={vi.fn()} />);
    expect(screen.getByTestId('settings-penalty-ends-on-goal')).not.toBeChecked();
  });

  it('@W2A-030 @W2A-080 ohne Turnierleitung ist der Schalter gesperrt und ändert nichts', async () => {
    const onChange = vi.fn();
    render(
      <RulesLockProvider value={true}>
        <MatchCockpitSettingsPanel settings={DEFAULT_MATCH_COCKPIT_SETTINGS} onChange={onChange} tournamentId="t1" onTestSound={vi.fn()} />
      </RulesLockProvider>
    );
    const schalter = screen.getByTestId('settings-penalty-ends-on-goal');
    expect(schalter).toBeDisabled();
    const vorher = onChange.mock.calls.length;
    await userEvent.click(schalter);
    expect(onChange.mock.calls).toHaveLength(vorher);
    expect(schalter).toBeChecked();
  });
});
