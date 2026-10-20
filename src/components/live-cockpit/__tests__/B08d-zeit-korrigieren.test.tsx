/**
 * LiveCockpit: Spielzeit korrigieren mit Grenzen (B-08d, Cockpit-Teil) – echte Engine (fake-indexeddb), echte
 * Verdrahtung über den Harness, gemockt nur Ton, Sync, Rolle und Toast. Zeit über `Date`.
 * Testwerte wörtlich aus @SL-011 (5:20 → 4:50, alle Anzeigen folgen), @SL-012 (Obergrenze 6:00),
 * @SL-077 (Tor bei 5:10 begrenzt), @SL-079 (keine Korrektur in der Halbzeitpause). Pflichttest „echter Weg“:
 * 2. Abschnitt 5:20 → 4:50, danach läuft die Uhr von 4:50 weiter (Anker neu, +10 s → 5:00).
 * Die Liste der Einträge (@SL-076) folgt mit Aufgabe 4.1 und ist hier nicht Teil des Tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import { anpfiff, storeSender, warteSperre, HARNESS_MATCH_ID, type SenderFabrik } from './engineHarnessSupport';
import type { LocalMatchStore } from '../../../core/match/client';
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
const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };

beforeEach(() => {
  ton.play.mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const zustand = (): HTMLElement => screen.getByTestId('scoreboard-state');
const uhrSub = (): HTMLElement => screen.getByTestId('scoreboard-clock-sub');
/** Bietet „Mehr“ den Punkt „Uhr korrigieren“ an? Öffnet das Blatt, schaut nach und schließt es wieder. */
async function zeitPunktDa(user: ReturnType<typeof userEvent.setup>): Promise<boolean> {
  await user.click(screen.getByTestId('cockpit-more-button'));
  const da = screen.queryByTestId('mehr-uhr-korrigieren') !== null;
  await user.click(screen.getByTestId('mehr-schliessen'));
  return da;
}

async function zurZweitenHalbzeit(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await anpfiff(user);
  await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
  zu(360_000);
  await waitFor(() => expect(zustand()).toHaveTextContent('Halbzeit'));
  zu(420_000); // Pause vorbei: Wiederanpfiff (eine Minute Pause)
  await user.click(screen.getByTestId('match-wiederanpfiff-button'));
  await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
}

/** Dialog öffnen, einen Schritt je Klick auf den Zähler, dann Übernehmen oder Abbrechen. */
async function zeitDialog(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByTestId('cockpit-more-button'));
  await user.click(screen.getByTestId('mehr-uhr-korrigieren'));
  return screen.findByRole('dialog', { name: /Spielzeit|Zeit/i });
}

describe('LiveCockpit: Spielzeit korrigieren (B-08d)', () => {
  it('@SL-011 Pflichttest echter Weg: 2. Abschnitt 5:20 → 4:50, Anzeige folgt, die Uhr läuft von 4:50 weiter', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} zeitKorrektur />);
    await zurZweitenHalbzeit(user);
    zu(740_000); // zweiter Abschnitt bei 5:20
    await waitFor(() => expect(uhrSub()).toHaveTextContent('Spielzeit 5:20'));

    const dialog = await zeitDialog(user);
    const weniger = within(dialog).getByRole('button', { name: '10 Sekunden weniger' });
    for (let i = 0; i < 3; i += 1) { await user.click(weniger); }
    await user.click(within(dialog).getByRole('button', { name: 'Übernehmen' }));

    await waitFor(() => expect(uhrSub()).toHaveTextContent('Spielzeit 4:50'));
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('1:10');
    zu(750_000); // +10 s bei laufender Uhr (Anker neu)
    await waitFor(() => expect(uhrSub()).toHaveTextContent('Spielzeit 5:00'));
  });

  it('@SL-011 laufende Uhr bei 5:23: Ziel 4:50 ist erreichbar und kommt als CLOCK_ADJUST mit 650000 an', async () => {
    const user = userEvent.setup();
    let store: LocalMatchStore | null = null;
    let konto = '';
    const fabrik: SenderFabrik = (s, accountId, tournamentId) => { store = s; konto = accountId; return storeSender(s, accountId, tournamentId); };
    render(<Harness turnier={ZWEI_ABSCHNITTE} zeitKorrektur senderFabrik={fabrik} />);
    await zurZweitenHalbzeit(user);
    zu(743_000); // Tom hat vergessen anzuhalten: die Uhr läuft, 5:23
    await waitFor(() => expect(uhrSub()).toHaveTextContent('Spielzeit 5:23'));

    const dialog = await zeitDialog(user);
    const weniger = within(dialog).getByRole('button', { name: '10 Sekunden weniger' });
    await user.click(weniger);
    expect(within(dialog).getByText('5:20')).toBeInTheDocument(); // erster Schritt aufs Raster
    for (let i = 0; i < 3; i += 1) { await user.click(weniger); }
    expect(within(dialog).getByText('4:50')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Übernehmen' }));

    await waitFor(() => expect(uhrSub()).toHaveTextContent('Spielzeit 4:50'));
    const kopie = await (store as LocalMatchStore | null)?.load(konto, HARNESS_MATCH_ID);
    const korrekturen = (kopie?.pending ?? []).filter((e) => e.type === 'CLOCK_ADJUST');
    expect(korrekturen).toHaveLength(1);
    expect(korrekturen[0]?.clockMs).toBe(650_000);
  });

  it('@SL-011 Gegenbeispiel: steht die Uhr genau auf 5:20, ist der erste Schritt 5:10', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} zeitKorrektur />);
    await zurZweitenHalbzeit(user);
    zu(740_000);
    await waitFor(() => expect(uhrSub()).toHaveTextContent('Spielzeit 5:20'));

    const dialog = await zeitDialog(user);
    await user.click(within(dialog).getByRole('button', { name: '10 Sekunden weniger' }));
    expect(within(dialog).getByText('5:10')).toBeInTheDocument();
  });

  it('@SL-012 Gegenbeispiel: über 6:00 hinaus geht es nicht, Abbrechen lässt die Uhr stehen', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} zeitKorrektur />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(180_000); // erster Abschnitt bei 3:00
    await waitFor(() => expect(uhrSub()).toHaveTextContent('Spielzeit 3:00'));

    const dialog = await zeitDialog(user);
    const mehr = within(dialog).getByRole('button', { name: '10 Sekunden mehr' });
    for (let i = 0; i < 40; i += 1) { await user.click(mehr); }
    expect(within(dialog).getByText('höchstens 6:00')).toBeInTheDocument();
    expect(within(dialog).queryByText('7:00')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    expect(uhrSub()).toHaveTextContent('Spielzeit 3:00');
  });

  it('@SL-077 nach dem Tor bei 5:10 stellt die Uhr nicht davor zurück; Hinweis mit dem Tor', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} zeitKorrektur />);
    await zurZweitenHalbzeit(user);
    zu(730_000); // 5:10 im zweiten Abschnitt: Tor für Heim
    await user.click(await screen.findByTestId('goal-button-home'));
    await warteSperre(); // Sperre des Nummern-Bausteins (@SL-021); Schließen lässt das Tor ohne Nummer zählen (@SL-083)
    await user.keyboard('{Escape}');
    zu(740_000); // 5:20
    await waitFor(() => expect(uhrSub()).toHaveTextContent('Spielzeit 5:20')); // erst wenn die Anzeige nachgezogen hat, sonst öffnet der Dialog mit 5:10

    const dialog = await zeitDialog(user);
    expect(within(dialog).getByText('wegen des Tors bei 5:10 frühestens 5:10')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '10 Sekunden weniger' }));
    expect(within(dialog).getByRole('button', { name: '10 Sekunden weniger' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() => expect(uhrSub()).toHaveTextContent('Spielzeit 5:10'));
  });

  it('@SL-077 „Dann behält die Uhr 5:20“: ein Versuch unter 5:10 (4:50) sendet nichts, die Uhr bleibt bei 5:20', async () => {
    const user = userEvent.setup();
    let store: LocalMatchStore | null = null;
    let konto = '';
    const fabrik: SenderFabrik = (s, accountId, tournamentId) => { store = s; konto = accountId; return storeSender(s, accountId, tournamentId); };
    render(<Harness turnier={ZWEI_ABSCHNITTE} zeitKorrektur senderFabrik={fabrik} />);
    await zurZweitenHalbzeit(user);
    zu(730_000); // Tor für Heim bei 5:10
    await user.click(await screen.findByTestId('goal-button-home'));
    await warteSperre(); // Sperre des Nummern-Bausteins (@SL-021); Schließen lässt das Tor ohne Nummer zählen (@SL-083)
    await user.keyboard('{Escape}');
    zu(740_000); // Uhr steht bei 5:20
    await waitFor(() => expect(uhrSub()).toHaveTextContent('Spielzeit 5:20')); // Anzeige muss nachgezogen haben, bevor der Dialog öffnet

    const dialog = await zeitDialog(user);
    const weniger = within(dialog).getByRole('button', { name: '10 Sekunden weniger' });
    for (let i = 0; i < 3; i += 1) { await user.click(weniger); } // 4:50 gewollt
    expect(within(dialog).getByText('5:10')).toBeInTheDocument(); // 4:50 ist nicht erreichbar
    expect(within(dialog).queryByText('4:50')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => expect(uhrSub()).toHaveTextContent('Spielzeit 5:20'));
    const kopie = await (store as LocalMatchStore | null)?.load(konto, HARNESS_MATCH_ID);
    expect((kopie?.pending ?? []).filter((e) => e.type === 'CLOCK_ADJUST')).toHaveLength(0);
  });

  it('@SL-079 in der Halbzeitpause bietet das Cockpit keine Zeitkorrektur an', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} zeitKorrektur />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    expect(await zeitPunktDa(user)).toBe(true);
    zu(360_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Halbzeit'));
    expect(await zeitPunktDa(user)).toBe(false);
  });

  it('@SL-079 Zeile 2: nach dem Abpfiff (2:1) bietet das Cockpit keine Zeitkorrektur an', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} zeitKorrektur />);
    await zurZweitenHalbzeit(user);
    zu(500_000);
    for (const seite of ['home', 'home', 'away']) {
      await user.click(await screen.findByTestId(`goal-button-${seite}`));
      await warteSperre(); // Sperre des Nummern-Bausteins (@SL-021); Schließen lässt das Tor ohne Nummer zählen (@SL-083)
      await user.keyboard('{Escape}');
    }
    expect(await zeitPunktDa(user)).toBe(true); // Gegenprobe: im laufenden Abschnitt ist die Korrektur da
    zu(420_000 + 360_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Abgepfiffen'));
    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('2:1');
    expect(await zeitPunktDa(user)).toBe(false);
  });
});
