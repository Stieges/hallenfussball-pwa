/**
 * LiveCockpit -- eine Meldung endet mit dem Wechsel zum nächsten Spiel (@SL-192; Befund C-MELDUNG-UEBER-SPIELWECHSEL).
 * Gherkin: nach dem Abpfiff von Spiel 3 steht „Spiel abgepfiffen“; Olli wechselt zu Spiel 4 -> Meldung sofort weg.
 * Der Wechsel kommt als neue `currentMatch.id` an, egal ob über „Weiter“, den Spielplan oder die Adresse.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';
import { HOLD_MS } from '../../ui/atoms/HoldButton';
import { NOTICE_DAUER_MS } from '../hooks/useCockpitNotices';

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

const MELDUNG = 'notice-line';

function spiel(nummer: number, status = 'RUNNING') {
  return {
    id: `match-${nummer}`, number: nummer, phaseLabel: 'Gruppenphase', fieldId: 'field-1',
    scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 0, awayScore: 0, status, elapsedSeconds: 30, playPhase: 'regular', events: [],
  };
}

function props(match: unknown, extra: Partial<LiveCockpitProps> = {}): LiveCockpitProps {
  return {
    fieldName: 'Feld 1', tournamentName: 'Test-Turnier', tournamentId: 'tour-1',
    currentMatch: match as never, upcomingMatches: [], kannSteuern: true,
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onUndoLastEvent: vi.fn(), onManualEditResult: vi.fn(), onAdjustTime: vi.fn(),
    onLoadNextMatch: vi.fn(), onReopenLastMatch: vi.fn(), ...extra,
  };
}

/** Abpfiff von Hand: Abpfiff-Knopf halten, Rückfrage mit „Beenden“ bestätigen. */
async function pfeifeAb(): Promise<void> {
  fireEvent.pointerDown(screen.getByTestId('match-finish-button'), { pointerId: 1, button: 0 });
  await act(async () => { await vi.advanceTimersByTimeAsync(HOLD_MS + 60); });
  fireEvent.pointerUp(screen.getByTestId('match-finish-button'), { pointerId: 1 });
  fireEvent.click(await screen.findByRole('button', { name: 'Beenden' }));
}

/** Spiel 3 abgepfiffen; der Aufrufer wechselt auf Spiel 4, sobald der Knopf `onLoadNextMatch` ruft. */
function MitWeiter(): ReactElement {
  const [nummer, setNummer] = useState(3);
  const [beendet, setBeendet] = useState(false);
  const match = spiel(nummer, nummer === 3 && beendet ? 'FINISHED' : 'RUNNING');
  return <LiveCockpit {...props(match, { onFinish: () => { setBeendet(true); return Promise.resolve(null); }, onLoadNextMatch: () => { setNummer(4); } })} />;
}

describe('@SL-192 Meldung endet mit dem Spielwechsel', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('@SL-192 Spielplan/Adresse: nach „Spiel abgepfiffen“ in Spiel 3 ist die Zeile bei Spiel 4 sofort leer', async () => {
    const { rerender } = render(<LiveCockpit {...props(spiel(3))} />);
    await pfeifeAb();
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('Spiel abgepfiffen');

    rerender(<LiveCockpit {...props(spiel(4, 'NOT_STARTED'))} />);

    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();
    await act(async () => { await vi.advanceTimersByTimeAsync(NOTICE_DAUER_MS[3] + 100); });
    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();
  });

  it('@SL-192 Cockpit-Weg „Weiter“: das Spiel wechselt über den Aufrufer, die Meldung aus Spiel 3 ist weg', async () => {
    render(<MitWeiter />);
    await pfeifeAb();
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('Spiel abgepfiffen');

    fireEvent.click(await screen.findByTestId('match-next-button'));

    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();
  });

  it('@SL-192 Gegenbeispiel: ohne Wechsel (neues Objekt desselben Spiels) bleibt die Meldung ihre 3 s stehen', async () => {
    const { rerender } = render(<LiveCockpit {...props(spiel(3))} />);
    await pfeifeAb();
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('Spiel abgepfiffen');

    rerender(<LiveCockpit {...props({ ...spiel(3, 'FINISHED'), elapsedSeconds: 31 })} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(NOTICE_DAUER_MS[3] - 500); });
    expect(screen.getByTestId(MELDUNG)).toHaveTextContent('Spiel abgepfiffen');

    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(screen.getByTestId(MELDUNG)).toBeEmptyDOMElement();
  });
});
