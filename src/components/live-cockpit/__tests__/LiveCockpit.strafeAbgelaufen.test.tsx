/**
 * LiveCockpit -- eine abgelaufene Zeitstrafe steht in der Meldezeile, die Marke in der Spalte verschwindet (Aufgabe 3.3).
 * Szenarien: @SL-096 (Hinweis, verdeckt weder Uhr noch Stand), @SL-031 (Marke mit Restzeit), @SL-030 (Gegenbeispiel: Ende mit Restzeit).
 * Die Engine-Ansicht kommt aus einer veränderbaren Vorgabe (`useEnginePhase` gemockt); Spiel 11, FC Nord – SV Süd.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import type { PhaseView } from '../engine/phaseView';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makePhaseView, makeProps } from './cockpitFixtures';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const ansicht = vi.hoisted(() => ({ aktuell: null as unknown as PhaseView }));
vi.mock('../hooks/useEnginePhase', () => ({ useEnginePhase: () => ansicht.aktuell }));
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

const mitStrafe = (remainingMs: number): PhaseView =>
  makePhaseView({ penalties: [{ id: 'p1', teamId: 'sv-sued', playerNumber: 5, remainingMs }] });

describe('LiveCockpit – abgelaufene Zeitstrafe (@SL-096)', () => {
  beforeEach(() => { ansicht.aktuell = mitStrafe(800); });

  it('@SL-096 @SL-031 die Marke „Nr. 5 · 0:00“ steht in der Spalte; läuft die Strafe ab, meldet die Meldezeile „Zeitstrafe SV Süd Nr. 5 abgelaufen“, Uhr und Stand bleiben sichtbar', () => {
    const match = makeLiveMatch();
    const { rerender } = render(<LiveCockpit {...makeProps(match)} />);
    expect(screen.getByTestId('team-penalty-p1')).toHaveTextContent('Nr. 5 · 0:00');

    ansicht.aktuell = makePhaseView();
    rerender(<LiveCockpit {...makeProps(match)} />);

    expect(screen.getByTestId('notice-line')).toHaveTextContent('Zeitstrafe SV Süd Nr. 5 abgelaufen');
    expect(screen.queryByTestId('team-penalty-p1')).toBeNull();
    expect(screen.getByTestId('scoreboard-clock')).toBeVisible();
    expect(screen.getByTestId('scoreboard-score')).toBeVisible();
  });

  it('@SL-030 Gegenbeispiel: endet die Strafe mit Restzeit (Gegentor), bleibt die Meldezeile ohne „abgelaufen“', () => {
    ansicht.aktuell = mitStrafe(45_000);
    const match = makeLiveMatch();
    const { rerender } = render(<LiveCockpit {...makeProps(match)} />);

    ansicht.aktuell = makePhaseView();
    rerender(<LiveCockpit {...makeProps(match)} />);

    expect(screen.getByTestId('notice-line')).not.toHaveTextContent('abgelaufen');
  });
});
