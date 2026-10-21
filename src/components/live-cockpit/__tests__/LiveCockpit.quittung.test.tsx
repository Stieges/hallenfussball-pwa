/**
 * LiveCockpit: Quittungszeile nach dem Abpfiff (@SL-152, Variante C, bestätigt 2026-10-20).
 * Unter dem Abzeichen „Ende“ mit Endstand steht 30 Sekunden lang „Abgepfiffen · 2:1 gespeichert“ (Endstand eingesetzt);
 * davor und danach steht sie nicht. Echte Engine (fake-indexeddb) und echte Verdrahtung wie `LiveCockpit.abschnittsende`;
 * gemockt nur Ton, Sync-Anzeige, Rolle, Toast. Zeit über `Date`. Der Code wurde erst nach dem Gherkin gelesen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import { anpfiff, warteSperre } from './engineHarnessSupport';
import { T0 } from './enginePhaseFixture';

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
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showWarning: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }),
}));

// Spiel am Stück, 10 Minuten
const EIN_ABSCHNITT = { groupPhaseGameDuration: 10, gamePeriods: 1 };
const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };
const zustand = (): HTMLElement => screen.getByTestId('scoreboard-state');
const quittung = (): HTMLElement | null => screen.queryByTestId('scoreboard-quittung');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true, writable: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'vibrate');
});

async function tore(user: ReturnType<typeof userEvent.setup>, anzahl: number): Promise<void> {
  for (let i = 0; i < anzahl; i += 1) {
    await user.click(await screen.findByTestId('goal-button-home'));
    await warteSperre(); // Sperre des Nummern-Bausteins (@SL-021), dann schließen: das Tor zählt ohne Nummer (@SL-083)
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByTestId('scoreboard-score')).toHaveTextContent(`${i + 1}:0`));
  }
}

describe('LiveCockpit: Quittungszeile nach dem Abpfiff (@SL-152)', () => {
  it('@SL-152 vor dem Abpfiff steht keine Quittungszeile (Gegenbeispiel)', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={EIN_ABSCHNITT} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    await tore(user, 1);
    expect(quittung()).toBeNull();
  });

  it('@SL-152 von selbst abgepfiffen mit 3:0: „Ende“ und darunter „Abgepfiffen · 3:0 gespeichert“ (der tatsächliche Endstand, nicht fest 2:1)', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={EIN_ABSCHNITT} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    await tore(user, 3);
    zu(600_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('3:0');
    expect(screen.getByTestId('scoreboard-quittung')).toHaveTextContent('Abgepfiffen · 3:0 gespeichert');
    expect(screen.getByTestId('scoreboard-quittung')).not.toHaveTextContent('2:1');
    // das Abzeichen bleibt „Ende“, die Zeile ersetzt es nicht
    expect(zustand()).toHaveTextContent('Ende');
  });

  it('@SL-152 Abpfiff von Hand bei 1:0: die Zeile nennt 1:0', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={EIN_ABSCHNITT} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    await tore(user, 1);
    zu(240_000);
    await user.click(screen.getByTestId('match-finish-button'));
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    expect(screen.getByTestId('scoreboard-quittung')).toHaveTextContent('Abgepfiffen · 1:0 gespeichert');
  });

  it('@SL-152 von selbst abgepfiffen: die Quittung steht, die Meldung „Spiel abgepfiffen“ steht nicht zusätzlich in der Meldezeile', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={EIN_ABSCHNITT} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(600_000);
    await waitFor(() => expect(quittung()).not.toBeNull());
    await new Promise((fertig) => { setTimeout(fertig, 300); });
    expect(screen.getByTestId('notice-line')).not.toHaveTextContent('Spiel abgepfiffen');
  });

  it('@SL-152 Abpfiff von Hand: die Quittung steht, die Meldung „Spiel abgepfiffen“ steht nicht zusätzlich in der Meldezeile', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={EIN_ABSCHNITT} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(240_000);
    await user.click(screen.getByTestId('match-finish-button'));
    await waitFor(() => expect(quittung()).not.toBeNull());
    await new Promise((fertig) => { setTimeout(fertig, 300); });
    expect(screen.getByTestId('notice-line')).not.toHaveTextContent('Spiel abgepfiffen');
  });

  it('@SL-152 ohne Netz (Einträge warten im Ausgang): Quittung „gespeichert“ und „Einträge warten“ stehen zugleich, „gespeichert“ heißt lokal', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={EIN_ABSCHNITT} />); // das Gerüst sendet nichts: alles bleibt im Ausgang
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(240_000);
    await user.click(screen.getByTestId('match-finish-button'));
    await waitFor(() => expect(quittung()).not.toBeNull());
    expect(quittung()).toHaveTextContent('Abgepfiffen · 0:0 gespeichert');
    await waitFor(() => expect(screen.getByTestId('scoreboard-eintraege-warten')).toHaveTextContent(/Einträge? warte/));
  });

  it('@SL-152 nach den 30 Sekunden steht keine Zeile mehr, das Abzeichen bleibt „Ende“ (Gegenbeispiel)', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={EIN_ABSCHNITT} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    await tore(user, 1);
    zu(600_000);
    await waitFor(() => expect(quittung()).not.toBeNull());
    zu(600_000 + 29_000);
    await new Promise((fertig) => { setTimeout(fertig, 600); });
    expect(quittung()).not.toBeNull();
    zu(600_000 + 30_000);
    await waitFor(() => expect(quittung()).toBeNull());
    expect(zustand()).toHaveTextContent('Ende');
  });
});
