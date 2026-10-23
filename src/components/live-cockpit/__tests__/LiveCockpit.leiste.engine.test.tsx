/**
 * LiveCockpit – Daumenleiste mit echter Engine (Aufgabe 3.6): fünf Plätze am Handy (Entscheidung A2), Tasten-Hinweise,
 * Rückgängig mit 1-s-Sperre, Fenster-Größenänderung bei offener Nummernauswahl (RL5). Echte Engine (fake-indexeddb),
 * gemockt nur Ton, Sync-Anzeige, Rolle. Datum über `vi.setSystemTime`; Zeitgeber bleiben echt.
 * Szenarien: @SL-157, @SL-153, @SL-108, @SL-107, @SL-066, @SL-038, @SL-109, @SL-123 (RL5).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import { anpfiff, detailsVon, eintraegeImLog, torImLog, warteSperre } from './engineHarnessSupport';
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
const breite = (px: number): void => { Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px }); };
const nummer = (n: string) => within(screen.getByTestId('number-picker')).getByRole('button', { name: n });
const retractCount = (): number => eintraegeImLog().filter((e) => e.type === 'RETRACT').length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  breite(1280);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  breite(1280);
});

async function starte(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await anpfiff(user);
  await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
}

describe('Daumenleiste am Handy: fünf Plätze (Entscheidung A2)', () => {
  it('@SL-157 360 px: fünf Leisten-Knöpfe in der Reihenfolge Rückgängig, Pause, Ereignisse, Abpfiff halten, Mehr – jeder mindestens touch-target-minimum breit', async () => {
    breite(360);
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    const knoepfe = within(screen.getByRole('toolbar')).getAllByRole('button');
    expect(knoepfe.map((k) => k.getAttribute('aria-label') ?? k.textContent)).toEqual([
      expect.stringMatching(/^Rückgängig/), 'Pause', 'Ereignisse', 'Abpfiff halten', 'Mehr',
    ]);
    for (const k of knoepfe) { expect(k.style.minWidth).toBe('var(--touch-target-minimum)'); }
    expect(screen.getByTestId('match-pause-button').style.minHeight).toBe('var(--touch-target-primary)');
  });

  it('@SL-157 Gegenbeispiel Laptop 1280 px: vier Plätze, Rückgängig zuletzt vor „Mehr“, kein Leisten-Knopf „Ereignisse“', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    const knoepfe = within(screen.getByRole('toolbar')).getAllByRole('button');
    expect(knoepfe.map((k) => k.getAttribute('aria-label') ?? k.textContent)).toEqual([
      expect.stringContaining('Pause'), 'Abpfiff halten', expect.stringMatching(/^Rückgängig/), expect.stringContaining('Mehr'),
    ]);
  });

  it('@SL-153 aria-keyshortcuts: Pause „Space“, Rückgängig „Control+Z Meta+Z“ (am Laptop zusätzlich als Hinweis sichtbar)', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    expect(screen.getByTestId('match-pause-button')).toHaveAttribute('aria-keyshortcuts', 'Space');
    expect(screen.getByTestId('match-undo-button')).toHaveAttribute('aria-keyshortcuts', 'Control+Z Meta+Z');
    expect(within(screen.getByTestId('match-pause-button')).getByText('Leertaste')).toBeInTheDocument();
  });

  it('@SL-153 Gegenbeispiel: am Handy steht der Hinweis „Leertaste“ nicht auf dem Knopf, der Name bleibt', async () => {
    breite(360);
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    expect(within(screen.getByTestId('match-pause-button')).queryByText('Leertaste')).toBeNull();
    expect(screen.getByTestId('match-pause-button')).toHaveAttribute('aria-keyshortcuts', 'Space');
  });
});

describe('Rückgängig mit 1-s-Sperre (@SL-108, @SL-107)', () => {
  async function torUndFoul(user: ReturnType<typeof userEvent.setup>, frueherFoulHeim = false): Promise<void> {
    await starte(user);
    if (frueherFoulHeim) { zu(60_000); await user.click(screen.getByTestId('foul-button-home')); } // bleibt gültig: hält die Liste der Einträge nicht leer
    zu(180_000);
    await user.click(screen.getByTestId('foul-button-away'));
    zu(200_000);
    await user.click(screen.getByTestId('goal-button-home'));
    await warteSperre();
    await user.keyboard('{Escape}');
    zu(205_000);
  }

  it('@SL-108 zweimal innerhalb einer Sekunde auf „Rückgängig“: nur das Tor ist zurückgenommen, das Foul zählt weiter', async () => {
    const user = userEvent.setup();
    render(<Harness />); await torUndFoul(user);
    const undo = screen.getByTestId('match-undo-button');
    fireEvent.click(undo);
    await waitFor(() => expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('0:0')); // der erste Tipp ist angekommen, das Foul wäre jetzt das nächste Ziel
    zu(205_500); // 0,5 s nach dem ersten Tipp
    fireEvent.click(undo);
    await new Promise((fertig) => { setTimeout(fertig, 50); }); // dem zweiten Tipp Zeit geben, falls er doch etwas auslöste
    expect(retractCount()).toBe(1);
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 1');
  });

  it('@SL-107 Gegenbeispiel: ein zweiter Tipp 3 Sekunden später nimmt auch das Foul zurück', async () => {
    const user = userEvent.setup();
    render(<Harness />); await torUndFoul(user);
    fireEvent.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(retractCount()).toBe(1));
    zu(208_000);
    fireEvent.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(retractCount()).toBe(2));
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 0');
  });

  // Befund C-COCKPIT-LISTE-OHNE-GUELTIGE-EINTRAEGE: `takeRecent` (U5, protocolEntries.ts) blendet zurückgenommene Einträge aus, wenn kein
  // gültiger Eintrag übrig ist. Im Gherkin-Fall (nur Foul und Tor, beide zurückgenommen) bleibt die Liste daher leer. Ziel LT-4 / 4.1.
  it.fails('@SL-107 wörtlich: nur Foul und Tor erfasst, zweimal Rückgängig → die Liste zeigt das Tor und das Foul als zurückgenommen (Befund C-COCKPIT-LISTE-OHNE-GUELTIGE-EINTRAEGE, Ziel LT-4)', async () => {
    const user = userEvent.setup();
    render(<Harness />); await torUndFoul(user);
    fireEvent.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(retractCount()).toBe(1));
    zu(208_000);
    fireEvent.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(retractCount()).toBe(2));
    expect(await screen.findAllByTestId('event-row-retracted', {}, { timeout: 500 })).toHaveLength(2);
  });

  it('@SL-107 Zusatzfall (nicht das Gherkin-Beispiel): mit einem früheren, gültigen Eintrag zeigt die Liste Tor und Foul als zurückgenommen', async () => {
    const user = userEvent.setup();
    render(<Harness />); await torUndFoul(user, true);
    fireEvent.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(retractCount()).toBe(1));
    zu(208_000);
    fireEvent.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(retractCount()).toBe(2));
    const zeilen = await screen.findAllByTestId('event-row-retracted');
    expect(zeilen).toHaveLength(2);
    expect(zeilen.map((z) => z.textContent).join(' ')).toMatch(/Tor/i);
    expect(zeilen.map((z) => z.textContent).join(' ')).toMatch(/Foul/i);
    expect(screen.getByTestId('team-fouls-home')).toHaveTextContent('Foul 1');
  });

  it('@SL-107 Gegenbeispiel: ohne Rückgängig steht kein Eintrag als zurückgenommen in der Liste', async () => {
    const user = userEvent.setup();
    render(<Harness />); await torUndFoul(user, true);
    expect(screen.queryAllByTestId('event-row-retracted')).toHaveLength(0);
  });
});

describe('@SL-123 RL5: Fenster während offener Nummernauswahl verkleinert', () => {
  it('@SL-123 RL5 1280 → 900 px: die Auswahl bleibt offen, die Leiste wechselt das Layout, Nummer 7 landet am selben Tor', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user); zu(192_000);
    await user.click(screen.getByTestId('goal-button-home'));
    const tor = await torImLog();
    expect(screen.getByTestId('number-picker')).toBeInTheDocument();
    expect(screen.getByTestId('live-cockpit')).toHaveAttribute('data-layout', 'breit');

    act(() => { breite(900); window.dispatchEvent(new Event('resize')); });
    expect(screen.getByTestId('live-cockpit')).toHaveAttribute('data-layout', 'daumen');
    expect(screen.getByTestId('number-picker')).toBeInTheDocument();
    expect(screen.getByTestId('match-event-log-button')).toBeInTheDocument();

    await warteSperre();
    await user.click(nummer('7'));
    await waitFor(() => expect(detailsVon(tor.id).playerNumber).toBe(7));
    expect(eintraegeImLog().filter((e) => e.type === 'GOAL')).toHaveLength(1);
    expect(eintraegeImLog().some((e) => e.type === 'AMEND' && e.targetId === tor.id)).toBe(true);
  });

  it('@SL-123 RL5 Gegenbeispiel: ohne Größenänderung bleibt das Layout, und die Auswahl schließt mit der gewählten Nummer', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    await user.click(screen.getByTestId('goal-button-home'));
    await warteSperre();
    await user.click(nummer('7'));
    await waitFor(() => expect(screen.queryByTestId('number-picker')).toBeNull());
    expect(screen.getByTestId('live-cockpit')).toHaveAttribute('data-layout', 'breit');
  });
});
