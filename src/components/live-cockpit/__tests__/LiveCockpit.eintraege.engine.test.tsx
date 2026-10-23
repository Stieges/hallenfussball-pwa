/**
 * LiveCockpit -- Karte, Zeitstrafe, Foul, zweite Gelbe über die echte Engine (Aufgabe 3.5; Engine-Fälle nach ZA-3).
 * Der Server (die Engine) nimmt die Einträge wirklich an, nicht nur das Cockpit bietet sie an. Gemockt nur Ton, Sync-Anzeige,
 * Rolle, Toast-Kontext; Datum über `vi.setSystemTime`, Zeitgeber echt. Spiel: FC Alpha (Heim, „FC Nord“) gegen SV Beta („SV Süd“).
 * Szenarien: @SL-085, @SL-087, @SL-084, @SL-088, @SL-023, @SL-029, RF5.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { MatchCommands } from '../../../core/match/client';
import { Harness } from './engineHarness';
import {
  HARNESS_CTX, HARNESS_MATCH_ID, anpfiff, detailsVon, eintraegeImLog, harnessContext, warteSperre, wirksameImLog,
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

type Nutzer = ReturnType<typeof userEvent.setup>;
const ZWEI_ABSCHNITTE = { groupPhaseGameDuration: 12, gamePeriods: 2, halftimeBreak: 1 };
const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };
const nummer = (n: string) => within(screen.getByTestId('number-picker')).getByRole('button', { name: n });
const zustand = (): HTMLElement => screen.getByTestId('scoreboard-state');
const uhrSteht = (): HTMLElement => screen.getByTestId('scoreboard-clock');

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

async function starte(user: Nutzer): Promise<void> {
  await anpfiff(user);
  await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
}
async function karte(user: Nutzer, seite: 'home' | 'away', art: 'Gelb' | 'Gelb-Rot' | 'Rot', n: string): Promise<void> {
  await user.click(screen.getByTestId(`card-button-${seite}`));
  await user.click(within(screen.getByTestId('card-kind-step')).getByRole('button', { name: art }));
  await warteSperre();
  await user.click(nummer(n));
}
const typen = (...t: string[]) => wirksameImLog().filter((e) => t.includes(e.type));

describe('LiveCockpit – Einträge bei angehaltener Uhr (@SL-085)', () => {
  const faelle: [string, (u: Nutzer) => Promise<void>, string, string][] = [
    ['ein Tor für FC Nord, Nr. 7', async (u) => { await u.click(screen.getByTestId('goal-button-home')); await warteSperre(); await u.click(nummer('7')); }, 'GOAL', 'teama'],
    ['ein Eigentor der Nummer 4 von SV Süd', async (u) => {
      await u.click(screen.getByTestId('goal-button-home')); await warteSperre();
      await u.click(screen.getByRole('button', { name: 'Eigentor (SV Beta)' })); await u.click(nummer('4'));
    }, 'OWN_GOAL', 'teamb'],
    ['ein Foul für SV Süd', async (u) => { await u.click(screen.getByTestId('foul-button-away')); }, 'FOUL', 'teamb'],
    ['eine Gelbe Karte für SV Süd, Nr. 5', async (u) => { await karte(u, 'away', 'Gelb', '5'); }, 'YELLOW_CARD', 'teamb'],
    ['eine Zeitstrafe für SV Süd, Nr. 5', async (u) => {
      await u.click(screen.getByTestId('penalty-button-away')); await warteSperre(); await u.click(nummer('5'));
    }, 'TIME_PENALTY', 'teamb'],
  ];

  it.each(faelle)('@SL-085 bei angehaltener Uhr (4:12) nimmt die Engine %s an, der Eintrag trägt 4:12', async (_e, ablauf, typ, team) => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user); zu(252_000);
    await user.click(screen.getByTestId('match-pause-button'));
    await waitFor(() => expect(uhrSteht()).toHaveAttribute('data-steht', 'true'));
    await ablauf(user);
    await waitFor(() => expect(typen(typ)).toHaveLength(1));
    expect(typen(typ)[0]).toMatchObject({ teamId: team, clockMs: 252_000 });
  });

  it('@SL-085 Gegenbeispiel: ein Foul für SV Süd bei angehaltener Uhr ändert weder den Stand noch die Uhr', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user); zu(252_000);
    await user.click(screen.getByTestId('match-pause-button'));
    await waitFor(() => expect(uhrSteht()).toHaveAttribute('data-steht', 'true'));
    await user.click(screen.getByTestId('foul-button-away'));
    await waitFor(() => expect(typen('FOUL')).toHaveLength(1));
    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('0:0');
    expect(uhrSteht()).toHaveAttribute('data-steht', 'true');
  });
});

describe('LiveCockpit – Einträge in der Halbzeitpause (@SL-087)', () => {
  async function inDerPause(user: Nutzer): Promise<void> {
    await starte(user); zu(360_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Halbzeit'));
  }

  it('@SL-087 in der Halbzeitpause nimmt die Engine eine Zeitstrafe an', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />); await inDerPause(user);
    await user.click(screen.getByTestId('penalty-button-away')); await warteSperre();
    await user.click(nummer('5'));
    await waitFor(() => expect(typen('TIME_PENALTY')).toHaveLength(1));
  });

  it('@SL-087 in der Halbzeitpause nimmt die Engine eine Gelbe Karte an', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />); await inDerPause(user);
    await karte(user, 'away', 'Gelb', '5');
    await waitFor(() => expect(typen('YELLOW_CARD')).toHaveLength(1));
  });

  it('@SL-087 Gegenbeispiel: Tor und Foul bietet das Cockpit in der Halbzeitpause nicht an, auch die Engine nimmt sie nicht an', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />); await inDerPause(user);
    expect(screen.queryByTestId('goal-button-home')).toBeNull();
    expect(screen.queryByTestId('foul-button-away')).toBeNull();
    const kontext = harnessContext();
    const fremd = new MatchCommands({ engine: kontext.engine, store: kontext.store, sender: kontext.sender, accountId: kontext.accountId });
    await expect(fremd.goal(HARNESS_MATCH_ID, HARNESS_CTX, 'leitung', 'teama', false)).rejects.toThrow();
    await expect(fremd.foul(HARNESS_MATCH_ID, HARNESS_CTX, 'leitung', 'teamb')).rejects.toThrow();
    expect(typen('GOAL', 'FOUL')).toHaveLength(0);
  });
});

describe('LiveCockpit – Karten: Spielzeit des ersten Tipps, Nummer, zweite Gelbe', () => {
  it('@SL-084 Karte bei 3:12 angetippt, Nr. 5 erst bei 3:25 → die Karte trägt 3:12 und Nr. 5', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user); zu(192_000);
    await user.click(screen.getByTestId('card-button-away'));
    await user.click(within(screen.getByTestId('card-kind-step')).getByRole('button', { name: 'Gelb' }));
    await warteSperre(); zu(205_000);
    await user.click(nummer('5'));
    await waitFor(() => expect(typen('YELLOW_CARD')).toHaveLength(1));
    const gelb = typen('YELLOW_CARD')[0];
    expect(gelb).toMatchObject({ teamId: 'teamb', clockMs: 192_000 });
    expect(gelb.payload).toMatchObject({ playerNumber: 5 });
  });

  it('@SL-023 Gelb-Rot für Nr. 5 von SV Süd erfasst YELLOW_RED_CARD, nicht RED_CARD', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    await karte(user, 'away', 'Gelb-Rot', '5');
    await waitFor(() => expect(typen('YELLOW_RED_CARD')).toHaveLength(1));
    expect(typen('RED_CARD')).toHaveLength(0);
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 1/5');
  });

  it('@SL-088 zweite Gelbe für Nr. 7: Rückfrage, „Gelb-Rot“ erfasst Gelb-Rot mit einem Tipp', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    await karte(user, 'away', 'Gelb', '7');
    await waitFor(() => expect(typen('YELLOW_CARD')).toHaveLength(1));
    await karte(user, 'away', 'Gelb', '7');
    expect(await screen.findByText('Nr. 7 hat schon Gelb')).toBeInTheDocument();
    expect(typen('YELLOW_CARD')).toHaveLength(1); // noch nichts Zweites erfasst
    await user.click(screen.getByRole('button', { name: 'Gelb-Rot' }));
    await waitFor(() => expect(typen('YELLOW_RED_CARD')).toHaveLength(1));
    expect(typen('YELLOW_CARD')).toHaveLength(1);
  });

  it('@SL-088 „Trotzdem Gelb“ erfasst eine zweite Gelbe Karte für Nr. 7', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    await karte(user, 'away', 'Gelb', '7');
    await waitFor(() => expect(typen('YELLOW_CARD')).toHaveLength(1));
    await karte(user, 'away', 'Gelb', '7');
    await user.click(await screen.findByRole('button', { name: 'Trotzdem Gelb' }));
    await waitFor(() => expect(typen('YELLOW_CARD')).toHaveLength(2));
  });

  it('@SL-088 Gegenbeispiel: Nr. 7 von FC Nord hat noch kein Gelb, keine Rückfrage', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user);
    await karte(user, 'away', 'Gelb', '7');
    await waitFor(() => expect(typen('YELLOW_CARD')).toHaveLength(1));
    await karte(user, 'home', 'Gelb', '7');
    await waitFor(() => expect(typen('YELLOW_CARD')).toHaveLength(2));
    expect(screen.queryByText('Nr. 7 hat schon Gelb')).toBeNull();
  });

  it('@SL-029 Zeitstrafe: Tipp, Nummer 5 — keine Dauer-Auswahl; die Engine setzt die Dauer aus der Regel, die Spalte zeigt die Marke', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starte(user); zu(120_000);
    await user.click(screen.getByTestId('penalty-button-away'));
    expect(screen.queryByText(/Dauer/)).toBeNull();
    await warteSperre();
    await user.click(nummer('5'));
    await waitFor(() => expect(typen('TIME_PENALTY')).toHaveLength(1));
    expect(await screen.findByText(/^Nr\. 5 · /)).toBeInTheDocument();
    expect(typen('TIME_PENALTY')[0].payload).not.toHaveProperty('durationSeconds');
  });

  it('RF5 Abpfiff bei offener Karten-Auswahl: die Auswahl schließt, nichts wird erfasst, die Meldezeile sagt es', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={{ groupPhaseGameDuration: 10, gamePeriods: 1 }} />); await starte(user);
    await user.click(screen.getByTestId('card-button-away'));
    await user.click(within(screen.getByTestId('card-kind-step')).getByRole('button', { name: 'Gelb' }));
    expect(screen.getByTestId('number-picker')).toBeInTheDocument();
    zu(600_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    await waitFor(() => expect(screen.queryByTestId('number-picker')).toBeNull());
    expect(screen.getByTestId('notice-line')).toHaveTextContent('Nicht erfasst');
    expect(eintraegeImLog().filter((e) => e.type === 'YELLOW_CARD')).toHaveLength(0);
  });

  it('RF5 Gegenbeispiel: eine offene Tor-Nummernauswahl bleibt beim Abpfiff offen (das Tor zählt schon, Nachtrag ist erlaubt, @SL-113)', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={{ groupPhaseGameDuration: 10, gamePeriods: 1 }} />); await starte(user);
    await user.click(screen.getByTestId('goal-button-home'));
    await waitFor(() => expect(typen('GOAL')).toHaveLength(1));
    zu(600_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    expect(screen.getByTestId('number-picker')).toBeInTheDocument();
    await warteSperre();
    await user.click(nummer('7'));
    await waitFor(() => expect(detailsVon(typen('GOAL')[0].id).playerNumber).toBe(7));
  });
});
