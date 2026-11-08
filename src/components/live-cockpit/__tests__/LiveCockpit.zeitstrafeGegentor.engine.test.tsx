/**
 * Zeitstrafe endet beim Gegentor im Cockpit, über die echte Engine (Befund C-ZEITSTRAFE-GEGENTOR-FEHLT).
 * Record Spiel leiten: @SL-030 (Gegentor beendet die Strafe, das Cockpit zeigt „darf sich ergänzen“), @SL-092 (Eigentor),
 * @SL-044 (Rücknahme des Tores: die Strafe läuft weiter), @SL-094 (gleiche Unterzahl: Tor beendet nichts), @SL-200 (Tor in
 * derselben Sekunde), @SL-204 (Hinweis 10 Sekunden); @W2A-079 (Regel gilt ab Eintrag der Strafe); Record Regelinhalte: @W2A-013, @W2A-015 (Regel aus: Strafe läuft weiter).
 * FC Alpha (Heim) – SV Beta (Gast); die Strafe steht bei SV Beta.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Tournament } from '../../../types/tournament';
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

type Nutzer = ReturnType<typeof userEvent.setup>;
const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };
const nummer = (n: string) => within(screen.getByTestId('number-picker')).getByRole('button', { name: n });
/** Laufende Strafen: am Laptop die Karten der Strafen-Spalte (@SL-186), ihre Anzahl steht am Kasten. */
const anzahl = (): number => Number(screen.getByTestId('strafen-spalte').getAttribute('data-anzahl'));

const REGEL_AUS: Partial<Tournament> = { groupPhaseGameDuration: 20, matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, penaltyEndsOnGoal: false } };
const REGEL_AN: Partial<Tournament> = { groupPhaseGameDuration: 20, matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, penaltyEndsOnGoal: true } };

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
  await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
}

async function strafeFuer(user: Nutzer, seite: 'home' | 'away', nr: string, erwartet: number): Promise<void> {
  await user.click(screen.getByTestId(`penalty-button-${seite}`));
  await warteSperre();
  await user.click(nummer(nr));
  await waitFor(() => expect(eintraegeImLog().filter((e) => e.type === 'TIME_PENALTY')).toHaveLength(erwartet));
}

async function torFuer(user: Nutzer, seite: 'home' | 'away', nr: string, erwartet: number): Promise<void> {
  await user.click(screen.getByTestId(`goal-button-${seite}`));
  await warteSperre();
  await user.click(nummer(nr));
  await waitFor(() => expect(eintraegeImLog().filter((e) => e.type === 'GOAL')).toHaveLength(erwartet));
}

describe('@SL-030 Ein Gegentor beendet die Zeitstrafe, und das Cockpit zeigt die Ergänzung', () => {
  it('@SL-030 @W2A-013 SV Beta hat seit 2:00 eine Zeitstrafe; Tor für FC Alpha bei 2:40: die Strafe ist beendet, SV Beta darf sich ergänzen', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={REGEL_AN} />);
    await starte(user);
    zu(120_000);
    await strafeFuer(user, 'away', '5', 1);
    expect(anzahl()).toBe(1);
    expect(screen.queryByTestId('team-ergaenzen-away')).toBeNull();
    // die Regel steht im Eintrag, Monitor und Zuschauer-Seite lesen sie von dort
    expect(eintraegeImLog().find((e) => e.type === 'TIME_PENALTY')?.payload).toMatchObject({ endsOnGoal: true });
    zu(160_000);
    await torFuer(user, 'home', '7', 1);
    await waitFor(() => expect(anzahl()).toBe(0));
    expect(screen.getByTestId('team-ergaenzen-away')).toHaveTextContent('darf sich ergänzen');
    expect(screen.queryByTestId('team-ergaenzen-home')).toBeNull();
  });

  it('@SL-092 Eigentor der Nummer 4 von SV Beta bei 2:40 beendet die Strafe von SV Beta', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={REGEL_AN} />);
    await starte(user);
    zu(120_000);
    await strafeFuer(user, 'away', '5', 1);
    zu(160_000);
    await user.click(screen.getByTestId('goal-button-home'));
    await warteSperre();
    await user.click(screen.getByRole('button', { name: 'Eigentor (SV Beta)' }));
    await warteSperre();
    await user.click(nummer('4'));
    await waitFor(() => expect(eintraegeImLog().filter((e) => e.type === 'OWN_GOAL')).toHaveLength(1));
    await waitFor(() => expect(anzahl()).toBe(0));
    expect(screen.getByTestId('team-ergaenzen-away')).toBeInTheDocument();
  });

  it('@SL-044 Wird das Gegentor zurückgenommen, läuft die Strafe weiter, der Hinweis verschwindet', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={REGEL_AN} />);
    await starte(user);
    zu(120_000);
    await strafeFuer(user, 'away', '5', 1);
    zu(160_000);
    await torFuer(user, 'home', '7', 1);
    await waitFor(() => expect(anzahl()).toBe(0));
    zu(170_000);
    await user.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(anzahl()).toBe(1));
    expect(screen.queryByTestId('team-ergaenzen-away')).toBeNull();
    // Restzeit: 120 s Dauer minus 50 s seit 2:00 = 70 s = 1:10
    expect(screen.getByTestId('strafen-spalte')).toHaveTextContent('1:10');
  });

  it('@SL-094 @W2A-018 FC Alpha und SV Beta haben je eine laufende Strafe: ein Tor für FC Alpha beendet nichts, keine Ergänzung', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={REGEL_AN} />);
    await starte(user);
    zu(120_000);
    await strafeFuer(user, 'away', '5', 1);
    zu(130_000);
    await strafeFuer(user, 'home', '3', 2);
    zu(160_000);
    await torFuer(user, 'home', '7', 1);
    expect(anzahl()).toBe(2);
    expect(screen.queryByTestId('team-ergaenzen-away')).toBeNull();
  });
});

describe('@W2A-015 Zeitstrafe ohne Gegentor-Regel', () => {
  it('@W2A-015 Regel aus: das Gegentor ändert nichts, die Strafe läuft weiter, keine Ergänzung', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={REGEL_AUS} />);
    await starte(user);
    zu(120_000);
    await strafeFuer(user, 'away', '5', 1);
    expect(eintraegeImLog().find((e) => e.type === 'TIME_PENALTY')?.payload).toMatchObject({ endsOnGoal: false });
    zu(160_000);
    await torFuer(user, 'home', '7', 1);
    expect(anzahl()).toBe(1);
    expect(screen.getByTestId('strafen-spalte')).toHaveTextContent('1:20');
    expect(screen.queryByTestId('team-ergaenzen-away')).toBeNull();
  });
});

describe('@SL-200 Ein Tor in derselben Sekunde wie der Strafbeginn beendet die Zeitstrafe nicht', () => {
  it('@SL-200 Strafe und Tor bei 2:00: die Strafe läuft weiter', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={REGEL_AN} />);
    await starte(user);
    zu(120_000);
    await strafeFuer(user, 'away', '5', 1);
    await torFuer(user, 'home', '7', 1);
    expect(anzahl()).toBe(1);
    expect(screen.queryByTestId('team-ergaenzen-away')).toBeNull();
  });
});

describe('@SL-204 Der Hinweis „darf sich ergänzen“ steht nach dem Gegentor 10 Sekunden Spielzeit', () => {
  it('@SL-204 Strafe seit 2:00, Tor bei 2:40: der Hinweis steht, bei 2:50 nicht mehr', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={REGEL_AN} />);
    await starte(user);
    zu(120_000);
    await strafeFuer(user, 'away', '5', 1);
    zu(160_000);
    await torFuer(user, 'home', '7', 1);
    await waitFor(() => expect(screen.getByTestId('team-ergaenzen-away')).toBeInTheDocument());
    zu(169_000);
    await waitFor(() => expect(screen.getByTestId('team-ergaenzen-away')).toBeInTheDocument());
    zu(171_000);
    await waitFor(() => expect(screen.queryByTestId('team-ergaenzen-away')).toBeNull());
  });

  it('@SL-204 bekommt SV Beta vorher eine neue Zeitstrafe, verschwindet der Hinweis sofort', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={REGEL_AN} />);
    await starte(user);
    zu(120_000);
    await strafeFuer(user, 'away', '5', 1);
    zu(160_000);
    await torFuer(user, 'home', '7', 1);
    await waitFor(() => expect(screen.getByTestId('team-ergaenzen-away')).toBeInTheDocument());
    zu(163_000);
    await strafeFuer(user, 'away', '8', 2);
    await waitFor(() => expect(screen.queryByTestId('team-ergaenzen-away')).toBeNull());
    expect(anzahl()).toBe(1);
  });
});

describe('@W2A-079 Die Gegentor-Regel gilt für Zeitstrafen ab ihrem Eintrag', () => {
  it('@W2A-079 Strafe seit 3:00 (Regel an), Regel bei 3:30 aus, Strafe bei 3:35, Tor bei 3:40: nur die ältere endet', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness turnier={REGEL_AN} />);
    await starte(user);
    zu(180_000);
    await strafeFuer(user, 'away', '5', 1);
    zu(210_000);
    rerender(<Harness turnier={REGEL_AUS} />);
    zu(215_000);
    await strafeFuer(user, 'away', '8', 2);
    const strafen = eintraegeImLog().filter((e) => e.type === 'TIME_PENALTY');
    expect(strafen.map((e) => e.payload.endsOnGoal)).toEqual([true, false]);
    zu(220_000);
    await torFuer(user, 'home', '7', 1);
    await waitFor(() => expect(anzahl()).toBe(1));
    expect(screen.getByTestId('strafen-spalte')).toHaveTextContent('#8');
    expect(screen.getByTestId('strafen-spalte')).not.toHaveTextContent('#5');
  });
});
