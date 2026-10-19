/**
 * LiveCockpit -- Tor-Ablauf über die echte Engine (Aufgabe 3.4): Tor zählt mit dem ersten Tipp, die Rückennummer kommt als
 * Nachtrag (AMEND) an dasselbe Tor, Eigentor. Echte Engine (fake-indexeddb), echte Verdrahtung; gemockt nur Ton, Sync-Anzeige,
 * Rolle, Toast-Kontext. Datum über `vi.setSystemTime` (Spielzeit 3:12 = Anpfiff + 192 s); Zeitgeber bleiben echt, `warteSperre`
 * wartet die 300 ms des Nummern-Bausteins ab. Spiel: FC Alpha (Heim, "FC Nord" im Gherkin) gegen SV Beta ("SV Süd").
 * Szenarien: @SL-019, @SL-084, @SL-021 (RF1), @SL-083, @SL-022, RF3 (Gerätewechsel), RF4 (Ausgang ohne Netz).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import {
  anpfiff, ausgang, detailsVon, eintraegeImLog, fremdesGeraetSendetTor, toreImLog, torImLog, warteSperre,
} from './engineHarnessSupport';
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

const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };
const stand = (): HTMLElement => screen.getByTestId('scoreboard-score');
const nummer = (n: string) => within(screen.getByTestId('number-picker')).getByRole('button', { name: n });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function starte(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await anpfiff(user);
  await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
}

describe('LiveCockpit – Tor-Ablauf (Engine)', () => {
  it('@SL-019 @SL-084 Tor FC Nord bei 3:12, Nummer 7 erst bei 3:25 → 1:0, das Tor trägt 3:12 und Nr. 7', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user); zu(192_000);
    await user.click(screen.getByTestId('goal-button-home'));
    await waitFor(() => expect(stand()).toHaveTextContent('1:0'));
    await warteSperre(); zu(205_000);
    await user.click(nummer('7'));
    const tor = await torImLog();
    expect(tor).toMatchObject({ type: 'GOAL', teamId: 'teama', clockMs: 192_000 });
    await waitFor(() => expect(detailsVon(tor.id).playerNumber).toBe(7));
    expect(screen.queryByTestId('number-picker')).toBeNull();
  });

  it('@SL-021 RF1 zweimal schnell auf „Tor“, dann Nr. 7 → genau ein Tor', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    const knopf = screen.getByTestId('goal-button-home');
    fireEvent.click(knopf); fireEvent.click(knopf);
    await warteSperre();
    await user.click(nummer('7'));
    await waitFor(() => expect(stand()).toHaveTextContent('1:0'));
    expect(toreImLog()).toHaveLength(1);
  });

  it('@SL-083 @SL-020 Esc schließt die Auswahl, das Tor zählt ohne Nummer', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    await user.click(screen.getByTestId('goal-button-home'));
    await warteSperre(); await user.keyboard('{Escape}');
    await waitFor(() => expect(stand()).toHaveTextContent('1:0'));
    expect(screen.queryByTestId('number-picker')).toBeNull();
    expect(detailsVon((await torImLog()).id).playerNumber).toBeUndefined();
  });

  it('@SL-020 „ohne Nummer“ lässt das Tor stehen, die Nummer lässt sich später nachtragen (AMEND am selben Tor)', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    await user.click(screen.getByTestId('goal-button-home'));
    await warteSperre();
    await user.click(within(screen.getByTestId('number-picker')).getByRole('button', { name: 'ohne Nummer' }));
    await waitFor(() => expect(stand()).toHaveTextContent('1:0'));
    expect(toreImLog()).toHaveLength(1);
    expect(detailsVon(toreImLog()[0].id).playerNumber).toBeUndefined();
  });

  it('@SL-022 Eigentor der Nr. 4 von SV Beta bei 5:40, Stand vorher 1:0 → 2:0, OWN_GOAL für SV Beta bei 5:40', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user); zu(60_000);
    await user.click(screen.getByTestId('goal-button-home'));
    await warteSperre(); await user.keyboard('{Escape}');
    await waitFor(() => expect(stand()).toHaveTextContent('1:0'));
    zu(340_000);
    await user.click(screen.getByTestId('goal-button-home'));
    await warteSperre(); zu(352_000); // die Wahl kommt später, die Spielzeit bleibt die des ersten Tipps
    await user.click(screen.getByRole('button', { name: 'Eigentor (SV Beta)' }));
    await warteSperre();
    await user.click(nummer('4'));
    await waitFor(() => expect(stand()).toHaveTextContent('2:0'));
    const eigentore = eintraegeImLog().filter((e) => e.type === 'OWN_GOAL');
    expect(eigentore).toEqual([expect.objectContaining({ teamId: 'teamb', clockMs: 340_000 })]);
    await waitFor(() => expect(detailsVon(eigentore[0].id).playerNumber).toBe(4));
    expect(toreImLog()).toHaveLength(1);
  });

  it('RF3 Gerätewechsel: kommt bei offener Auswahl ein Tor eines anderen Geräts dazu, bekommt das eigene Tor die Nummer', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    await user.click(screen.getByTestId('goal-button-home'));
    const eigenesTor = await torImLog();
    await fremdesGeraetSendetTor('teamb');
    await warteSperre();
    await user.click(nummer('7'));
    await waitFor(() => expect(detailsVon(eigenesTor.id).playerNumber).toBe(7));
    expect(toreImLog().filter((e) => e.id !== eigenesTor.id).every((e) => detailsVon(e.id).playerNumber === undefined)).toBe(true);
  });

  it('RF4 ohne Netz: Tor und Nachtrag liegen in dieser Reihenfolge im Ausgang, die Tafel zeigt 1:0 sofort', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    await user.click(screen.getByTestId('goal-button-home'));
    await warteSperre();
    await user.click(nummer('7'));
    await waitFor(async () => expect((await ausgang()).map((e) => e.type)).toEqual(['MATCH_START', 'GOAL', 'AMEND']));
    expect(stand()).toHaveTextContent('1:0');
  });

  it('Gegenbeispiel: ein Tor für FC Alpha ändert den Stand von SV Beta nicht', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    await user.click(screen.getByTestId('goal-button-home'));
    await waitFor(() => expect(stand()).toHaveTextContent('1:0'));
    expect(toreImLog().every((e) => e.teamId === 'teama')).toBe(true);
  });

  it('@SL-021 Gegenbeispiel: nach geschlossener Auswahl zählt der nächste Tipp auf „Tor“ ein zweites Tor', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    await user.click(screen.getByTestId('goal-button-home'));
    await warteSperre(); await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('number-picker')).toBeNull());
    await user.click(screen.getByTestId('goal-button-home'));
    await waitFor(() => expect(stand()).toHaveTextContent('2:0'));
  });
});
