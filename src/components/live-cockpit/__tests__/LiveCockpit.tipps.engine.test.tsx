/**
 * LiveCockpit – Zahl der Tipps je Eintrag und Rückgängig über die echte Engine (Aufgabe 3.6; Szenarien @SL-124, @SL-066, @SL-038, @SL-109).
 * Jeder Tipp läuft über `tippe`; gezählt wird, was wirklich geklickt wurde. Erwartet wird außerdem genau das Ereignis im Log.
 * Beispiel „Hallencup Süd“: FC Nord = Heim (`FC Alpha` im Gerüst), SV Süd = Gast (`SV Beta`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import { anpfiff, eintraegeImLog, warteSperre } from './engineHarnessSupport';
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

/** Zwei Abschnitte zu je 6 Minuten, 1 Minute Pause (stabile Referenz für das Gerüst). */
const ZWEI_ABSCHNITTE = { groupPhaseGameDuration: 12, gamePeriods: 2, halftimeBreak: 1 };
const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

type Tippen = (el: HTMLElement) => Promise<void>;
const picker = (n: string) => within(screen.getByTestId('number-picker')).getByRole('button', { name: n });
type Log = ReturnType<typeof eintraegeImLog>;
const wirksam = (log: Log, art: string) => log.filter((e) => e.type === art);

describe('@SL-124 Ein Eintrag braucht nur wenige Tipps', () => {
  it.each<[string, (tippe: Tippen) => Promise<void>, number, (log: Log) => boolean]>([
    ['ein Tor für FC Nord mit der Rückennummer 7', async (tippe) => { await tippe(screen.getByTestId('goal-button-home')); await warteSperre(); await tippe(picker('7')); }, 2,
      (log) => wirksam(log, 'GOAL').length === 1 && log.some((e) => e.type === 'AMEND')],
    ['ein Foul für SV Süd', async (tippe) => { await tippe(screen.getByTestId('foul-button-away')); }, 2,
      (log) => wirksam(log, 'FOUL').length === 1],
    ['eine Gelbe Karte für die Nummer 5 von SV Süd', async (tippe) => { await tippe(screen.getByTestId('card-button-away')); await tippe(screen.getByRole('button', { name: /Gelb$/ })); await warteSperre(); await tippe(picker('5')); }, 3,
      (log) => wirksam(log, 'YELLOW_CARD').length === 1],
    ['eine Zeitstrafe für die Nummer 5 von SV Süd', async (tippe) => { await tippe(screen.getByTestId('penalty-button-away')); await warteSperre(); await tippe(picker('5')); }, 3,
      (log) => wirksam(log, 'TIME_PENALTY').length === 1],
    ['das Zurücknehmen des jüngsten Eintrags', async (tippe) => { await tippe(screen.getByTestId('match-undo-button')); }, 1,
      (log) => log.some((e) => e.type === 'RETRACT')],
  ])('@SL-124 %s braucht höchstens die Tipps der Tabelle', async (name, ablauf, hoechstens, imLog) => {
    const u = userEvent.setup();
    render(<Harness />); await anpfiff(u);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    if (name.startsWith('das Zurücknehmen')) {
      await u.click(screen.getByTestId('foul-button-away')); zu(2_000); // Vorbereitung, zählt nicht
    }
    let tipps = 0;
    await ablauf(async (el) => { tipps += 1; await u.click(el); });
    expect(tipps).toBeLessThanOrEqual(hoechstens);
    await waitFor(() => expect(imLog(eintraegeImLog())).toBe(true));
  });
});

describe('Rückgängig über die Leiste (@SL-066, @SL-038, @SL-109)', () => {
  // Befund C-COCKPIT-UNDO-ANPFIFF-FEHLT: die Engine nimmt MATCH_START zurück (core/match/handlers/retract.ts, Fixtures 60a–60e),
  // aber `undoTarget` (core/match/client/retractTargets.ts, KIND_BY_TYPE) bietet den Anpfiff dem Cockpit nicht als Ziel an.
  // `src/core/**` gehört Spur A (Ruling R-LT2); der Test steht deshalb als it.fails, bis dort MATCH_START aufgenommen ist.
  it.fails('@SL-066 Rückgängig direkt nach dem Anpfiff nimmt den Anpfiff zurück (Befund C-COCKPIT-UNDO-ANPFIFF-FEHLT, Ziel Spur A)', async () => {
    const u = userEvent.setup();
    render(<Harness />); await anpfiff(u);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    await u.click(screen.getByTestId('match-undo-button'));
    // vor dem Anpfiff bleibt der Abzeichen-Platz leer, die Anstoßzeit steht bei der Uhr (@OB-068)
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toBeEmptyDOMElement(), { timeout: 500 });
  });

  it('@SL-038 @SL-109 Rückgängig nach Tor und Pause nimmt das Tor zurück, nicht die Pause', async () => {
    const u = userEvent.setup();
    render(<Harness />); await anpfiff(u);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    await u.click(screen.getByTestId('goal-button-home')); await warteSperre(); await u.keyboard('{Escape}');
    await u.click(screen.getByTestId('match-pause-button'));
    zu(2_000);
    await u.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('0:0'));
    expect(screen.getByTestId('match-resume-button')).toBeInTheDocument();
  });

  it('@SL-038 Gegenbeispiel: ist das Tor zurückgenommen und sonst nichts eingetragen, nimmt ein zweites Rückgängig 4 Sekunden später nichts zurück', async () => {
    const u = userEvent.setup();
    render(<Harness />); await anpfiff(u);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    await u.click(screen.getByTestId('goal-button-home')); await warteSperre(); await u.keyboard('{Escape}');
    zu(2_000);
    await u.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('0:0'));
    zu(6_000);
    await waitFor(() => expect(screen.getByTestId('match-undo-button')).toBeDisabled());
    await u.click(screen.getByTestId('match-undo-button'));
    expect(wirksam(eintraegeImLog(), 'RETRACT')).toHaveLength(1);
    expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live');
  });

  describe('@SL-067 Nach 30 Sekunden oder einem Eintrag nimmt Rückgängig den Anpfiff nicht mehr zurück', () => {
    it('@SL-067 vor 40 Sekunden, ohne Eintrag → Rückgängig nimmt nichts zurück, Spiel 1 läuft weiter', async () => {
      const u = userEvent.setup();
      render(<Harness />); await anpfiff(u);
      await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
      zu(40_000);
      await u.click(screen.getByTestId('match-undo-button'));
      expect(wirksam(eintraegeImLog(), 'RETRACT')).toHaveLength(0);
      expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live');
      expect(screen.getByTestId('match-pause-button')).toBeInTheDocument();
    });

    it('@SL-067 vor 20 Sekunden, und Tom hat ein Foul für SV Süd erfasst → Rückgängig nimmt das Foul zurück, nicht den Anpfiff', async () => {
      const u = userEvent.setup();
      render(<Harness />); await anpfiff(u);
      await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
      zu(5_000);
      await u.click(screen.getByTestId('foul-button-away'));
      zu(20_000);
      await u.click(screen.getByTestId('match-undo-button'));
      await waitFor(() => expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 0'));
      const retracts = wirksam(eintraegeImLog(), 'RETRACT');
      expect(retracts).toHaveLength(1);
      expect(eintraegeImLog().find((e) => e.id === (retracts[0] as { targetId?: string }).targetId)?.type).toBe('FOUL');
      expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live');
    });
  });

  describe('@SL-109 Rückgängig nimmt die Korrektur der Uhr zurück, aber nie Pause, Halbzeit oder Abpfiff (Foul für SV Süd bei 2:00)', () => {
    const FOUL_BEI_2_00 = async (u: ReturnType<typeof userEvent.setup>): Promise<void> => {
      await anpfiff(u);
      await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
      zu(120_000);
      await u.click(screen.getByTestId('foul-button-away'));
      await waitFor(() => expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 1'));
    };

    // Befund C-COCKPIT-UNDO-ANPFIFF-FEHLT (um CLOCK_ADJUST erweitert): `KIND_BY_TYPE` kennt kein CLOCK_ADJUST, die Engine nimmt es zurück
    // (Fixture 61a-uhrkorrektur-zuruecknehmen.json). Rückgängig trifft deshalb das Foul statt der Korrektur.
    it.fails('@SL-109 hat Tom die Spielzeit von 3:30 auf 3:10 korrigiert → steht die Spielzeit wieder auf dem Stand ohne die Korrektur, das Foul zählt weiter (Befund C-COCKPIT-UNDO-ANPFIFF-FEHLT, Ziel Spur A)', async () => {
      const u = userEvent.setup();
      render(<Harness turnier={ZWEI_ABSCHNITTE} />); await FOUL_BEI_2_00(u);
      zu(210_000);
      await waitFor(() => expect(screen.getByTestId('scoreboard-kopf-text')).toHaveTextContent('Gespielt 3:30'));
      await u.click(screen.getByTestId('cockpit-more-button'));
      await u.click(screen.getByTestId('mehr-uhr-korrigieren'));
      const dialog = await screen.findByRole('dialog', { name: /Spielzeit|Zeit/i });
      for (let i = 0; i < 2; i += 1) { await u.click(within(dialog).getByRole('button', { name: '10 Sekunden weniger' })); }
      await u.click(within(dialog).getByRole('button', { name: 'Übernehmen' }));
      await waitFor(() => expect(screen.getByTestId('scoreboard-kopf-text')).toHaveTextContent('Gespielt 3:10'));
      zu(212_000);
      await u.click(screen.getByTestId('match-undo-button'));
      // Zwischen der Korrektur (bei 3:10) und dem Rückgängig laufen 2 s (`zu(212_000)`): „der Stand ohne die Korrektur“ ist daher 3:32
      await waitFor(() => expect(screen.getByTestId('scoreboard-kopf-text')).toHaveTextContent('Gespielt 3:32'), { timeout: 500 });
      expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 1');
    });

    it('@SL-109 hat Tom die Uhr angehalten → ist das Foul zurückgenommen, und die Uhr bleibt angehalten', async () => {
      const u = userEvent.setup();
      render(<Harness turnier={ZWEI_ABSCHNITTE} />); await FOUL_BEI_2_00(u);
      zu(130_000);
      await u.click(screen.getByTestId('match-pause-button'));
      await waitFor(() => expect(screen.getByTestId('match-resume-button')).toBeInTheDocument());
      zu(132_000);
      await u.click(screen.getByTestId('match-undo-button'));
      await waitFor(() => expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 0'));
      expect(screen.getByTestId('match-resume-button')).toBeInTheDocument();
      expect(screen.getByTestId('scoreboard-clock')).toHaveAttribute('data-steht', 'true');
    });

    it('@SL-109 hat die Halbzeitpause begonnen → ist das Foul zurückgenommen, und die Halbzeitpause läuft weiter', async () => {
      const u = userEvent.setup();
      render(<Harness turnier={ZWEI_ABSCHNITTE} />); await FOUL_BEI_2_00(u);
      zu(360_000);
      await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Halbzeit'));
      zu(362_000);
      await u.click(screen.getByTestId('match-undo-button'));
      await waitFor(() => expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 0'));
      expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Halbzeit');
      expect(screen.getByTestId('match-wiederanpfiff-button')).toBeInTheDocument();
    });
  });
});
