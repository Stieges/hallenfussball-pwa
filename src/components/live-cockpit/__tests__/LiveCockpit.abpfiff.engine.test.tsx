/**
 * LiveCockpit – Abpfiff von Hand über die echte Engine (Plan LT-1): Gedrückthalten fragt mit der Restzeit des ganzen Spiels nach,
 * kurze Bedienung pfeift nie ab, „Beenden“ sendet genau ein Spielende, das Spielende von selbst schließt die Rückfrage (RL2).
 * Echte Engine (fake-indexeddb), gemockt nur Ton, Sync-Anzeige, Rolle. Spiel 11, 2 × 6 Minuten, 1 Minute Pause (Gherkin @SL-010);
 * Datum über `vi.setSystemTime`, die Haltezeit (1 s) läuft in echter Zeit.
 * Szenarien: @SL-157, @SL-158, @SL-167 (Tastatur-Halten), @SL-010, @SL-133, RL2.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { looseVs } from '../../../test/matchSlotFixtures';
import { Harness } from './engineHarness';
import { HARNESS_MATCH_ID, anpfiff, eintraegeImLog, halte } from './engineHarnessSupport';
import { T0 } from './enginePhaseFixture';
import { HOLD_MS } from '../../ui/atoms/HoldButton';

/** Die gespielte Zeit: am Laptop in der Kopfzeile der Tafel (@SL-180), am Handy unter der Uhr. */
const spielzeit = (): HTMLElement => screen.queryByTestId('scoreboard-kopf-text') ?? screen.getByTestId('scoreboard-clock-sub');

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

/** Spiel 11, zwei Abschnitte zu je 6 Minuten, 1 Minute Pause (stabile Referenz für das Gerüst). */
const SPIEL_11 = {
  groupPhaseGameDuration: 12, gamePeriods: 2, halftimeBreak: 1,
  matches: [{ id: HARNESS_MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 1, matchNumber: 11 }],
};
const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };
const zustand = (): HTMLElement => screen.getByTestId('scoreboard-state');
const matchEnds = (): number => eintraegeImLog().filter((e) => e.type === 'MATCH_END').length;
const rueckfrage = (): HTMLElement | null => screen.queryByRole('alertdialog');
const breite = (px: number): void => { Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px }); };
const warte = async (ms: number): Promise<void> => { await act(async () => { await new Promise((fertig) => { setTimeout(fertig, ms); }); }); };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function imZweitenAbschnittBei(user: ReturnType<typeof userEvent.setup>, spielzeitMs: number): Promise<void> {
  await anpfiff(user);
  await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
  zu(360_000);
  await waitFor(() => expect(zustand()).toHaveTextContent('Halbzeit'));
  zu(420_000); // Pause vorbei
  await user.click(screen.getByTestId('match-wiederanpfiff-button'));
  await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
  zu(420_000 + spielzeitMs);
  await waitFor(() => expect(spielzeit()).toHaveTextContent(/(Gespielt|Spielzeit) 2:48/));
}

describe('Abpfiff halten fragt nach', () => {
  it('@SL-157 Gedrückthalten fragt nach „Spiel 11 bei noch 3:12 Minuten Spielzeit beenden?“', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />); await imZweitenAbschnittBei(user, 168_000);
    expect(rueckfrage()).toBeNull();
    await halte(screen.getByTestId('match-finish-button'));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Spiel 11 bei noch 3:12 Minuten Spielzeit beenden?');
    expect(matchEnds()).toBe(0);
  });

  it('@SL-157 die Taste füllt sich sichtbar, solange sie gehalten wird', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />); await imZweitenAbschnittBei(user, 168_000);
    const knopf = screen.getByTestId('match-finish-button');
    fireEvent.pointerDown(knopf, { pointerId: 1, button: 0 });
    expect(knopf).toHaveAttribute('data-fuellt', 'true');
    fireEvent.pointerUp(knopf, { pointerId: 1 });
    expect(knopf).not.toHaveAttribute('data-fuellt');
  });

  it('@SL-133 im ersten Abschnitt bei 4:00 nennt die Rückfrage die Restzeit des ganzen Spiels: 8:00', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />); await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(240_000);
    await waitFor(() => expect(spielzeit()).toHaveTextContent(/(Gespielt|Spielzeit) 4:00/));
    await halte(screen.getByTestId('match-finish-button'));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Spiel 11 bei noch 8:00 Minuten Spielzeit beenden?');
  });

  it('@SL-010 ohne Bestätigung läuft das Spiel weiter („Weiterspielen“, kein Spielende im Log)', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />); await imZweitenAbschnittBei(user, 168_000);
    await halte(screen.getByTestId('match-finish-button'));
    await user.click(await screen.findByRole('button', { name: 'Weiterspielen' }));
    expect(rueckfrage()).toBeNull();
    expect(zustand()).toHaveTextContent('Live');
    expect(screen.getByTestId('match-pause-button')).toBeInTheDocument();
    expect(matchEnds()).toBe(0);
  });

  it('@SL-010 „Beenden“ → genau ein Spielende, das Abzeichen der Tafel zeigt „Ende“ (@OB-065)', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />); await imZweitenAbschnittBei(user, 168_000);
    await halte(screen.getByTestId('match-finish-button'));
    await user.click(await screen.findByRole('button', { name: 'Beenden' }));
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    expect(matchEnds()).toBe(1);
    expect(rueckfrage()).toBeNull();
  });
});

/** Mit der Tab-Taste auf den Knopf: Tastatur-Fokus (Fokus per Programm allein ändert die Fokusart nicht). */
const tabZu = (k: HTMLElement): void => { fireEvent.keyDown(document.body, { key: 'Tab' }); k.focus(); };

describe('@SL-158 kurze Bedienung pfeift nicht ab', () => {
  it.each<[string, (knopf: HTMLElement) => Promise<void>]>([
    ['„Abpfiff“ kurz antippt', async (k) => { fireEvent.pointerDown(k, { pointerId: 1, button: 0 }); fireEvent.pointerUp(k, { pointerId: 1 }); fireEvent.click(k); }],
    ['„Abpfiff“ nach einer halben Sekunde wieder loslässt', async (k) => {
      fireEvent.pointerDown(k, { pointerId: 1, button: 0 }); await warte(500); fireEvent.pointerUp(k, { pointerId: 1 }); await warte(HOLD_MS);
    }],
    ['am Laptop die Eingabetaste drückt, während „Abpfiff“ den Fokus hat', async (k) => {
      tabZu(k); fireEvent.keyDown(k, { key: 'Enter' }); fireEvent.keyUp(k, { key: 'Enter' }); await warte(HOLD_MS + 60);
    }],
    ['am Laptop die Leertaste kurz drückt, während „Abpfiff“ den Fokus hat (@SL-167)', async (k) => {
      tabZu(k); fireEvent.keyDown(k, { key: ' ' }); fireEvent.keyUp(k, { key: ' ' }); await warte(HOLD_MS + 60);
    }],
  ])('@SL-158 %s → keine Rückfrage, Spiel 11 läuft weiter', async (_bedienung, aktion) => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />); await imZweitenAbschnittBei(user, 168_000);
    await aktion(screen.getByTestId('match-finish-button'));
    expect(rueckfrage()).toBeNull();
    expect(zustand()).toHaveTextContent('Live');
    expect(matchEnds()).toBe(0);
  });

  describe.each([[360, 'einem Handy mit 360 Bildpunkten Breite'], [1280, 'einem Laptop mit 1280×720 Bildpunkten']])('@SL-167 Spiel 11 läuft auf %i px (%s)', (px) => {
    beforeEach(() => { breite(px); });
    afterEach(() => { breite(1280); });

    it('@SL-167 „Abpfiff halten“ liegt als eigene Taste in der Leiste, nicht im Blatt „Mehr“', async () => {
      const user = userEvent.setup();
      render(<Harness turnier={SPIEL_11} />); await imZweitenAbschnittBei(user, 168_000);
      expect(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Abpfiff halten' })).toBeInTheDocument();
      await user.click(screen.getByTestId('cockpit-more-button'));
      expect(within(screen.getByTestId('more-sheet')).queryByText(/Abpfiff/)).toBeNull();
    });

    it.each([['Enter'], [' ']])('@SL-167 Entscheidung A3: Taste „%s“ auf dem fokussierten „Abpfiff“ etwa eine Sekunde gehalten → Rückfrage', async (taste) => {
      const user = userEvent.setup();
      render(<Harness turnier={SPIEL_11} />); await imZweitenAbschnittBei(user, 168_000);
      const knopf = screen.getByTestId('match-finish-button');
      tabZu(knopf);
      fireEvent.keyDown(knopf, { key: taste });
      await warte(HOLD_MS + 60);
      expect(await screen.findByRole('alertdialog')).toHaveTextContent('Spiel 11 bei noch 3:12 Minuten Spielzeit beenden?');
      expect(matchEnds()).toBe(0);
    });
  });

  it('@SL-167 Tastenwiederholung: hält Tom die Leertaste weiter, wenn die Rückfrage schon da ist, bleibt sie offen und nichts wird beendet', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />); await imZweitenAbschnittBei(user, 168_000);
    const knopf = screen.getByTestId('match-finish-button');
    tabZu(knopf);
    fireEvent.keyDown(knopf, { key: ' ' });
    await warte(HOLD_MS + 60);
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    // der Fokus liegt jetzt auf „Weiterspielen“; das Betriebssystem wiederholt die Taste, danach lässt Tom sie los
    const weiter = screen.getByRole('button', { name: 'Weiterspielen' });
    expect(weiter).toHaveFocus();
    for (let i = 0; i < 3; i += 1) { fireEvent.keyDown(weiter, { key: ' ', repeat: true }); }
    await user.keyboard('{/ }');
    expect(rueckfrage()).not.toBeNull();
    expect(matchEnds()).toBe(0);
  });
});

describe('RL2 Spielende von selbst bei offener Rückfrage', () => {
  it('RL2 die Rückfrage schließt ohne Befehl, es bleibt bei genau einem Spielende', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />); await imZweitenAbschnittBei(user, 168_000);
    await halte(screen.getByTestId('match-finish-button'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    zu(420_000 + 360_000); // der Abschnitt läuft ab: Spielende von selbst
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    await waitFor(() => expect(rueckfrage()).toBeNull());
    expect(matchEnds()).toBe(1);
  });

  it('RL2 gesperrtes Gerät: nach 5 Minuten Sprung der Uhr kein zweites Spielende durch die späte Bestätigung', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />); await imZweitenAbschnittBei(user, 168_000);
    await halte(screen.getByTestId('match-finish-button'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    zu(420_000 + 360_000 + 300_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    // Die Rückfrage schließt über einen Effekt (useCockpitCommands), also einen Renderschritt NACH dem Abzeichen „Ende“:
    // auf den Zielzustand warten, nicht auf den Augenblick, in dem das Abzeichen erscheint (Coverage-Lauf: langsamer).
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Beenden' })).toBeNull());
    expect(rueckfrage()).toBeNull();
    expect(matchEnds()).toBe(1);
  });
});

describe('S3 Steuer-Verlust bei offener Rückfrage (@SL-018, Spec § 4.4)', () => {
  it('@SL-018 verliert das Gerät die Steuer, während „Abpfiff halten“ fragt, schließt die Rückfrage ohne Befehl: kein Spielende', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness turnier={SPIEL_11} />); await imZweitenAbschnittBei(user, 168_000);
    await halte(screen.getByTestId('match-finish-button'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    rerender(<Harness turnier={SPIEL_11} kannSteuern={false} />);
    await waitFor(() => expect(rueckfrage()).toBeNull());
    expect(screen.queryByRole('button', { name: 'Beenden' })).toBeNull();
    expect(matchEnds()).toBe(0);
    expect(zustand()).toHaveTextContent('Live');
  });

  it('@SL-018 Gegenbeispiel: behält das Gerät die Steuer (Rerender), bleibt die Rückfrage offen', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness turnier={SPIEL_11} />); await imZweitenAbschnittBei(user, 168_000);
    await halte(screen.getByTestId('match-finish-button'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    rerender(<Harness turnier={SPIEL_11} kannSteuern />);
    expect(rueckfrage()).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Beenden' }));
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    expect(matchEnds()).toBe(1);
  });
});
