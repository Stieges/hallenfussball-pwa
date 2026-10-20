/**
 * LiveCockpit: Abschnittsende von selbst, Wiederanpfiff, Abpfiff mit Ton und Vibration (B-08b, B-08c; T2-UI).
 * Echte Engine (fake-indexeddb), echte Verdrahtung; gemockt nur Ton (Zähler), Sync-Anzeige, Rolle, Toast-Kontext.
 * Zeit über `Date` (Fake-Timer nur für `Date`): ein Sprung der Uhr, der nächste Takt der Ansicht löst das Ende aus.
 * Testwerte wörtlich aus @SL-005 (Spiel 11, 2 x 6 Minuten, 1 Minute Pause), @SL-006 (Stand 1:0), @SL-009, @SL-062,
 * @SL-063, @FU-070; Befund C-COCKPIT-HALBZEIT-START („Start“ in der Halbzeitpause meldet „Spiel fortgesetzt“).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import { anpfiff, halte, warteSperre } from './engineHarnessSupport';
import { T0 } from './enginePhaseFixture';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const ton = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: ton.play, stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false,
  }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showWarning: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }),
}));

// Spiel 11: 2 x 6 Minuten, 1 Minute Halbzeitpause.
const ZWEI_ABSCHNITTE = { groupPhaseGameDuration: 12, gamePeriods: 2, halftimeBreak: 1 };
const TON_AUS = { soundEnabled: false };
const vibrate = vi.fn();

const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };

beforeEach(() => {
  ton.play.mockClear();
  vibrate.mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'vibrate');
});

const stand = (): HTMLElement => screen.getByTestId('scoreboard-score');
const zustand = (): HTMLElement => screen.getByTestId('scoreboard-state');

async function toreHeim(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(await screen.findByTestId('goal-button-home'));
  await warteSperre(); // Sperre des Nummern-Bausteins (@SL-021), dann schließen: das Tor zählt ohne Nummer (@SL-083)
  await user.keyboard('{Escape}');
}

async function bisHalbzeit(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await anpfiff(user);
  await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
  await toreHeim(user);
  await waitFor(() => expect(stand()).toHaveTextContent('1:0'));
  zu(360_000);
  await waitFor(() => expect(zustand()).toHaveTextContent('Halbzeit'));
}

describe('LiveCockpit: Halbzeit von selbst und Wiederanpfiff (B-08b)', () => {
  it('@SL-005 Ablauf des ersten Abschnitts: Halbzeit mit Pausen-Restzeit, der Ton einmal, das Cockpit bietet den Wiederanpfiff an', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />);
    await bisHalbzeit(user);
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('1:00');
    zu(361_000);
    await waitFor(() => expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('0:59'));
    expect(ton.play).toHaveBeenCalledTimes(1);
    expect(vibrate).not.toHaveBeenCalled(); // Vibration nur beim Abpfiff
    expect(screen.getByTestId('match-wiederanpfiff-button')).toHaveTextContent('Wiederanpfiff');
    expect(screen.queryByTestId('match-start-button')).toBeNull();
  });

  it('@SL-006 C-COCKPIT-HALBZEIT-START: der Wiederanpfiff startet den zweiten Abschnitt bei 0:00, Stand 1:0, meldet den Wiederanpfiff und nicht „Spiel fortgesetzt“', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />);
    await bisHalbzeit(user);
    zu(420_000);
    await user.click(screen.getByTestId('match-wiederanpfiff-button'));
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent('Spielzeit 0:00');
    expect(stand()).toHaveTextContent('1:0');
    expect(screen.getByText('Wiederanpfiff – der nächste Abschnitt läuft')).toBeInTheDocument();
    expect(screen.queryByText('Spiel fortgesetzt')).toBeNull();
    expect(screen.getByTestId('match-pause-button')).toBeInTheDocument();
  });

  it('@SL-070 bei 0:00 der Pause bleibt die Halbzeit stehen, es wird nicht von selbst angepfiffen', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />);
    await bisHalbzeit(user);
    zu(360_000 + 600_000);
    await new Promise((fertig) => { setTimeout(fertig, 600); });
    expect(zustand()).toHaveTextContent('Halbzeit');
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('0:00');
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent('Wiederanpfiff');
    expect(ton.play).toHaveBeenCalledTimes(1);
  });

  it('@SL-005 auch mit gespeicherter Einstellung autoFinishEnabled=false endet der erste Abschnitt von selbst: Halbzeit, 1:00, Ton einmal', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} einstellungen={{ autoFinishEnabled: false }} />);
    await bisHalbzeit(user);
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('1:00');
    expect(ton.play).toHaveBeenCalledTimes(1);
  });

  it('@SL-009 auch mit autoFinishEnabled=false ist das Spiel mit Ablauf einmal abgepfiffen (1:0, Ton einmal)', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={{ groupPhaseGameDuration: 10, gamePeriods: 1 }} einstellungen={{ autoFinishEnabled: false }} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    await toreHeim(user);
    await waitFor(() => expect(stand()).toHaveTextContent('1:0'));
    zu(600_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    expect(stand()).toHaveTextContent('1:0');
    await new Promise((fertig) => { setTimeout(fertig, 700); });
    expect(ton.play).toHaveBeenCalledTimes(1);
  });

  it('@SL-008 Gegenbeispiel: ein Spiel am Stück hat keine Halbzeit, es endet bei Ablauf mit dem Abpfiff', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={{ groupPhaseGameDuration: 10, gamePeriods: 1 }} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(600_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    expect(screen.queryByText('Halbzeit')).toBeNull();
    expect(screen.queryByTestId('match-wiederanpfiff-button')).toBeNull();
  });
});

describe('LiveCockpit: Fouls über die Halbzeit (G11, B-08b Punkt 3)', () => {
  it('Halbzeit lässt die Fouls in der Gesamtzahl stehen; die Zählung des zweiten Abschnitts geht darauf weiter (kein Reset)', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    await user.click(screen.getByTestId('foul-button-home'));
    await waitFor(() => expect(screen.getByTestId('team-fouls-home')).toHaveTextContent('Foul 1/5'));
    zu(360_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Halbzeit'));
    expect(screen.getByTestId('team-fouls-home')).toHaveTextContent('Foul 1/5');
    zu(420_000);
    await user.click(screen.getByTestId('match-wiederanpfiff-button'));
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    expect(screen.getByTestId('team-fouls-home')).toHaveTextContent('Foul 1/5');
    await user.click(screen.getByTestId('foul-button-home'));
    await waitFor(() => expect(screen.getByTestId('team-fouls-home')).toHaveTextContent('Foul 2/5'));
  });
});

describe('LiveCockpit: Abpfiff mit Ton und Vibration, genau einmal (B-08c)', () => {
  it('@SL-009 @SL-062 zweiter Abschnitt läuft ab: abgepfiffen mit 1:0, der Abpfiff-Ton einmal (nach dem Ton der Halbzeit), die Vibration einmal', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />);
    await bisHalbzeit(user);
    zu(420_000);
    await user.click(screen.getByTestId('match-wiederanpfiff-button'));
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    ton.play.mockClear();
    zu(420_000 + 360_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    expect(stand()).toHaveTextContent('1:0');
    expect(ton.play).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
    // weiter vergeht Zeit und die Ansicht zeichnet neu: kein zweiter Pfiff (@FU-070)
    await new Promise((fertig) => { setTimeout(fertig, 700); });
    expect(ton.play).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('@SL-063 Gegenbeispiel: mit ausgeschaltetem Abpfiff-Ton bleibt es beim Abpfiff still, die Vibration kommt trotzdem', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={{ groupPhaseGameDuration: 10, gamePeriods: 1 }} einstellungen={TON_AUS} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(600_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    expect(ton.play).not.toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('@FU-070 Abpfiff von Hand, zweimal schnell ausgelöst: genau ein Ton und eine Vibration', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={{ groupPhaseGameDuration: 10, gamePeriods: 1 }} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(240_000);
    // Abpfiff von Hand ist ein Halteknopf mit Rückfrage (@SL-157, @SL-010): „Beenden“ zweimal schnell getippt pfeift nur einmal ab
    await halte(screen.getByTestId('match-finish-button'));
    const beenden = await screen.findByRole('button', { name: 'Beenden' });
    await user.dblClick(beenden);
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    await new Promise((fertig) => { setTimeout(fertig, 300); });
    expect(ton.play).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });
});
