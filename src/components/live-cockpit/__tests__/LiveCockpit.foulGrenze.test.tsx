/**
 * LiveCockpit -- Foul-Zähler der Team-Spalte und Hinweis an der Foul-Grenze (Aufgabe 3.3).
 * Szenarien: @SL-033, @SL-034, @SL-035, @SL-099, @SL-102 (Zähler „Foul n/Grenze“, Hinweis in der Meldezeile).
 * Testwerte aus dem Gherkin (Spiel 11, FC Nord – SV Süd); echte deutsche Texte.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../types/tournament';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makeProps } from './cockpitFixtures';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false,
  }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

const fouls = (n: number, teamId: string) => Array.from({ length: n }, (_, i) => ({
  id: `f${i}`, matchId: 'match-11', type: 'FOUL', timestampSeconds: 60 + i, payload: { teamId }, scoreAfter: { home: 0, away: 0 },
}));
const mitFouls = (n: number) => makeLiveMatch({ status: 'PAUSED', events: fouls(n, 'sv-sued') as never });

describe('LiveCockpit – Foul-Zähler gegen die Grenze (@SL-099, @SL-033, @SL-035, @SL-102)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('@SL-033 SV Süd hat 3 Fouls, Grenze 5: der Zähler zeigt „Foul 3/5“, ohne Gesamtzahl', () => {
    render(<LiveCockpit {...makeProps(mitFouls(3))} />);
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 3/5');
    expect(screen.queryByText(/gesamt/)).toBeNull();
  });

  it('@SL-035 Gegenbeispiel: bei 3 Fouls und Grenze 5 steht keine Meldung zur Foul-Grenze da; ein 4. Foul bleibt ohne Hinweis', () => {
    const { rerender } = render(<LiveCockpit {...makeProps(mitFouls(3))} />);
    rerender(<LiveCockpit {...makeProps(mitFouls(4))} />);
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 4/5');
    expect(screen.getByTestId('notice-line')).not.toHaveTextContent('Foul in dieser Halbzeit');
  });

  it('@SL-034 das 5. Foul zeigt „SV Süd: 5. Foul in dieser Halbzeit“ in der Meldezeile, Uhr und Stand bleiben sichtbar', () => {
    const { rerender } = render(<LiveCockpit {...makeProps(mitFouls(4))} />);
    rerender(<LiveCockpit {...makeProps(mitFouls(5))} />);
    expect(screen.getByTestId('notice-line')).toHaveTextContent('SV Süd: 5. Foul in dieser Halbzeit');
    expect(screen.getByTestId('scoreboard-clock')).toBeVisible();
    expect(screen.getByTestId('scoreboard-score')).toBeVisible();
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 5/5');
  });

  it('@SL-102 Foul-Grenze ausgeschaltet, 5 Fouls: nur die Zahl, ohne Grenze und ohne Hinweis', () => {
    const settings = { ...DEFAULT_MATCH_COCKPIT_SETTINGS, foulLimit: null };
    render(<LiveCockpit {...makeProps(mitFouls(5), { cockpitSettings: settings })} />);
    const zaehler = screen.getByTestId('team-fouls-away');
    expect(zaehler).toHaveTextContent(/^Foul 5$/);
    expect(zaehler).not.toHaveTextContent('/');
  });

  it('@SL-034 Grenze 3 aus den Turnierregeln: der Zähler zeigt „Foul 2/3“', () => {
    const settings = { ...DEFAULT_MATCH_COCKPIT_SETTINGS, foulLimit: 3 };
    render(<LiveCockpit {...makeProps(mitFouls(2), { cockpitSettings: settings })} />);
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 2/3');
  });

  it('@SL-099 Gegenbeispiel: der Zähler von FC Nord bleibt bei „Foul 0/5“, wenn nur SV Süd Fouls hat', () => {
    render(<LiveCockpit {...makeProps(mitFouls(3))} />);
    expect(screen.getByTestId('team-fouls-home')).toHaveTextContent('Foul 0/5');
  });
});
