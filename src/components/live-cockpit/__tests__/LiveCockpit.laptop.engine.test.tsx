/**
 * Laptop-Cockpit über die echte Engine (Plan Cockpit v2 B1, B2, B3). Szenarien: @SL-183 (nach einem Tor blendet die Tafel kurz „Tor für …“ in der
 * Kopfzeile ein, die Einblendung verdeckt nichts), @SL-180 (Kopfzeile „Spiel … · Gespielt …“ am echten Spiel), @SL-186 (Zeitstrafen als Karten, ohne die
 * Marke unter den Tasten), @SL-181 (Variante a unter 720 px). Echte Engine (fake-indexeddb); gemockt nur Ton, Sync-Anzeige, Rolle.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import { anpfiff } from './engineHarnessSupport';
import { T0 } from './enginePhaseFixture';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [], syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
vi.mock('../../../components/ui/Toast/ToastContext', () => ({ useToast: () => ({ showWarning: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }) }));

type Nutzer = ReturnType<typeof userEvent.setup>;
const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };
const hoehe = (px: number): void => { Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: px }); };
const warteSperre = (): Promise<void> => new Promise((r) => { setTimeout(r, 350); });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  hoehe(720);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); hoehe(768); });

async function starte(user: Nutzer): Promise<void> {
  render(<Harness />);
  await anpfiff(user);
  await waitFor(() => expect(screen.getByTestId('scoreboard-state').textContent).toContain('Live'));
}

describe('@SL-183 Nach einem Tor blendet die Tafel kurz „Tor für …“ in der Kopfzeile ein', () => {
  it('Tom erfasst ein Tor für das Heimteam: die Einblendung steht über der Kopfzeile der Tafel, Uhr und Stand bleiben unverdeckt', async () => {
    const user = userEvent.setup();
    await starte(user);
    await user.click(screen.getByTestId('goal-button-home'));
    const meldung = await screen.findByTestId('notice-line');
    await waitFor(() => expect(meldung).toHaveTextContent(/^Tor für /));
    expect(meldung.parentElement?.className).toContain('einblendung');
    expect(meldung.style.height).toBe(''); // keine reservierte Zeilenhöhe: die Einblendung verschiebt nichts
    expect(meldung.style.minHeight).not.toBe('');
    expect(screen.getByTestId('scoreboard').contains(meldung)).toBe(true);
    expect(screen.getByTestId('scoreboard-clock-rest')).toBeVisible();
    expect(screen.getByTestId('scoreboard-box-links')).toBeVisible();
    expect(screen.getByTestId('goal-button-home')).toBeVisible();
  });
});

describe('@SL-180 Kopfzeile der Tafel am echten Spiel', () => {
  it('nach dem Anpfiff: „Spiel … · Feld … · Gespielt 0:00“ (ohne Halbzeit bei einem Abschnitt), Etikett „Restzeit“ über der Uhr, Zeitbalken darunter', async () => {
    const user = userEvent.setup();
    await starte(user);
    const kopf = screen.getByTestId('scoreboard-kopf-text');
    expect(kopf.textContent).toMatch(/^Spiel \d+ · .+ · Gespielt \d+:\d{2}$/);
    expect(screen.getByTestId('scoreboard-clock')).toHaveTextContent('Restzeit');
    expect(screen.getByTestId('scoreboard-zeitbalken')).toHaveAttribute('data-ton', 'gruen');
    zu(30_000);
    await waitFor(() => expect(screen.getByTestId('scoreboard-kopf-text')).toHaveTextContent(/Gespielt 0:30/));
  });
});

describe('@SL-181 Variante a: unter 720 Pixel Fensterhöhe nur „Heim“/„Gast“ über dem Kasten', () => {
  it.each([[719, true], [720, false]] as const)('Fensterhöhe %i: Variante a = %s', async (px, variantA) => {
    hoehe(px);
    const user = userEvent.setup();
    await starte(user);
    expect(screen.queryByTestId('scoreboard-label-links') !== null).toBe(variantA);
    expect(screen.queryByTestId('scoreboard-name-links') !== null).toBe(!variantA);
    // der Name steht in jedem Fall groß in der Leiste über den Tasten
    expect(screen.getByTestId('team-name-home')).toBeVisible();
  });
});

describe('@SL-186 Laufende Zeitstrafen stehen als Karten am Laptop', () => {
  it('Tom erfasst eine Zeitstrafe für Nr. 5: die Karte nennt Team und Nummer, die Marke unter den Tasten entfällt am Laptop', async () => {
    const user = userEvent.setup();
    await starte(user);
    zu(120_000);
    await user.click(screen.getByTestId('penalty-button-away'));
    await warteSperre();
    await user.click(within(screen.getByTestId('number-picker')).getByRole('button', { name: /^5$/ }));
    await waitFor(() => expect(screen.getByTestId('strafen-spalte')).toHaveAttribute('data-anzahl', '1'));
    expect(screen.queryByTestId('strafen-keine')).toBeNull();
    expect(screen.queryByTestId(/^team-penalty-/)).toBeNull();
    expect(screen.getByTestId('strafen-spalte')).toHaveTextContent('Restzeit');
  });

  it('Gegenprobe: ohne Strafe steht „Keine aktiven Zeitstrafen“ da', async () => {
    const user = userEvent.setup();
    await starte(user);
    expect(screen.getByTestId('strafen-keine')).toHaveTextContent('Keine aktiven Zeitstrafen');
  });
});
