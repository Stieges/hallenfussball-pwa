/**
 * Tastenkürzel am Laptop über die echte Engine (Plan Cockpit v2 K1). Szenarien: @SL-153 (Leertaste, 1, 2, F, J, Strg+Z, ?), @SL-154 (Eingabefeld;
 * Leertaste nach einem Klick auf einen Knopf; Ziffer im offenen Dialog ohne Feldfokus, A4-4), @SL-142 (Dialog offen, auch Abpfiff-Rückfrage, A4-1),
 * @SL-108 (eine 1-s-Sperre für Knopf und Strg+Z, A4-3), @SL-188 (Hinweise nur mit Maus), @SL-189 (Schalter), RL4 (Seitentausch: „links“ ist die Anzeige).
 * Echte Engine (fake-indexeddb); gemockt nur Ton, Sync-Anzeige, Rolle. Gherkin: docs/anforderungen/2026-10-02_spiel-leiten.md.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import { anpfiff, detailsVon, eintraegeImLog, toreImLog, wirksameImLog, HARNESS_CTX } from './engineHarnessSupport';
import { T0 } from './enginePhaseFixture';
import { setzeTastenkuerzel } from '../hooks/useTastenkuerzelAn';

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
const breite = (px: number): void => { Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px }); };
const zustand = (): string => screen.getByTestId('scoreboard-state').textContent ?? '';
const retractAnzahl = (): number => eintraegeImLog().filter((e) => e.type === 'RETRACT').length;
const fouls = (): number => wirksameImLog().filter((e) => e.type === 'FOUL').length;
const mitMaus = (): void => {
  window.matchMedia = ((q: string) => ({ matches: q.includes('hover: hover'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
};
const matchMediaAlt = window.matchMedia;

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
  window.matchMedia = matchMediaAlt;
  setzeTastenkuerzel(true); // Vorbelegung an: der Schalter-Test darf die anderen nicht beeinflussen
  breite(1280);
});

async function starte(user: Nutzer, hilfe?: () => void): Promise<void> {
  render(<Harness onTastenuebersicht={hilfe} />);
  await anpfiff(user);
  await waitFor(() => expect(zustand()).toContain('Live'));
}
/** Die Engine-Befehle laufen asynchron (fake-indexeddb): vor einer Gegenbeispiel-Erwartung abwarten, damit „nichts passiert“ nicht nur „noch nicht passiert“ heißt. */
const engineLeer = async (): Promise<void> => { await act(async () => { await new Promise((r) => { setTimeout(r, 250); }); }); };
const schliesseAuswahl = async (user: Nutzer): Promise<void> => { await user.keyboard('{Escape}'); await waitFor(() => expect(screen.queryByTestId('number-picker')).toBeNull()); };

describe('@SL-153 Am Laptop leitet Olli ein Spiel mit Tastenkürzeln', () => {
  it('Leertaste hält die Uhr an, beim nächsten Druck läuft sie weiter', async () => {
    const user = userEvent.setup();
    await starte(user);
    await user.keyboard(' ');
    await waitFor(() => expect(zustand()).toContain('Pause'));
    await user.keyboard(' ');
    await waitFor(() => expect(zustand()).toContain('Live'));
  });

  it('1 beginnt ein Tor für das links angezeigte Team: Nummernauswahl im Tastatur-Modus, „7“ + Eingabetaste → Tor Nr. 7', async () => {
    const user = userEvent.setup();
    await starte(user);
    await user.keyboard('1');
    const auswahl = await screen.findByTestId('number-picker');
    await waitFor(() => expect(toreImLog()).toHaveLength(1));
    expect(toreImLog()[0].teamId).toBe(HARNESS_CTX.teamAId);
    const feld = within(auswahl).getByRole('textbox');
    expect(feld).toHaveFocus();
    await new Promise((r) => { setTimeout(r, 350); }); // 300-ms-Sperre der Nummernauswahl (@SL-021)
    await user.keyboard('7{Enter}');
    await waitFor(() => expect(detailsVon(toreImLog()[0].id).playerNumber).toBe(7));
  });

  it('2 beginnt ein Tor für das rechts angezeigte Team', async () => {
    const user = userEvent.setup();
    await starte(user);
    await user.keyboard('2');
    await waitFor(() => expect(toreImLog()).toHaveLength(1));
    expect(toreImLog()[0].teamId).toBe(HARNESS_CTX.teamBId);
  });

  it('RL4 Seiten getauscht: „1“ gilt dem links angezeigten Team (jetzt das Gast-Team), nicht Heim', async () => {
    const user = userEvent.setup();
    await starte(user);
    await user.click(screen.getByTestId('cockpit-more-button'));
    await user.click(await screen.findByTestId('mehr-seiten-tauschen'));
    await user.keyboard('{Escape}');
    await user.keyboard('1');
    await waitFor(() => expect(toreImLog()).toHaveLength(1));
    expect(toreImLog()[0].teamId).toBe(HARNESS_CTX.teamBId);
  });

  it('F zählt ein Foul für das links, J für das rechts angezeigte Team', async () => {
    const user = userEvent.setup();
    await starte(user);
    await user.keyboard('f');
    await waitFor(() => expect(fouls()).toBe(1));
    expect(wirksameImLog().find((e) => e.type === 'FOUL')?.teamId).toBe(HARNESS_CTX.teamAId);
    await user.keyboard('j');
    await waitFor(() => expect(fouls()).toBe(2));
    expect(wirksameImLog().filter((e) => e.type === 'FOUL')[1].teamId).toBe(HARNESS_CTX.teamBId);
  });

  it('Strg+Z nimmt den letzten Eintrag zurück; ein zweites Strg+Z binnen 1 Sekunde nimmt nichts weiter zurück (@SL-108)', async () => {
    const user = userEvent.setup();
    await starte(user);
    await user.keyboard('1');
    await waitFor(() => expect(toreImLog()).toHaveLength(1));
    await schliesseAuswahl(user);
    await user.keyboard('{Control>}z{/Control}');
    await waitFor(() => expect(retractAnzahl()).toBe(1));
    await user.keyboard('{Control>}z{/Control}');
    await engineLeer();
    expect(retractAnzahl()).toBe(1);
  });

  it('A4-3 eine Sperre für Knopf und Taste: Knopf „Rückgängig“, binnen 1 s Strg+Z → nur ein Rückgängig; nach der Sperre geht der nächste', async () => {
    const user = userEvent.setup();
    await starte(user);
    await user.keyboard('f');
    await user.keyboard('j');
    await waitFor(() => expect(fouls()).toBe(2));
    await user.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(retractAnzahl()).toBe(1));
    await user.keyboard('{Control>}z{/Control}');
    await engineLeer();
    expect(retractAnzahl()).toBe(1);
    zu(1500);
    await user.keyboard('{Control>}z{/Control}');
    await waitFor(() => expect(retractAnzahl()).toBe(2));
  });

  it('? öffnet die Übersicht (Rückruf des Rahmens)', async () => {
    const hilfe = vi.fn();
    const user = userEvent.setup();
    await starte(user, hilfe);
    await user.keyboard('?');
    expect(hilfe).toHaveBeenCalledTimes(1);
  });
});

describe('@SL-154 / @SL-142 Eingabefeld, Dialog und Klick', () => {
  it('@SL-154 Zeile 2: nach einem Klick auf „Foul“ steht die Uhr bei der Leertaste, und der Foul-Zähler steigt nicht', async () => {
    const user = userEvent.setup();
    await starte(user);
    await user.click(screen.getByTestId('foul-button-away'));
    await waitFor(() => expect(fouls()).toBe(1));
    await user.keyboard(' ');
    await waitFor(() => expect(zustand()).toContain('Pause'));
    expect(fouls()).toBe(1);
  });

  it('@SL-154 Zeile 1 / A4-4: im offenen Nummern-Dialog ohne Fokus im Feld gehört die Ziffer zur Nummer, es wird kein zweites Tor gezählt', async () => {
    const user = userEvent.setup();
    await starte(user);
    await user.keyboard('1');
    const auswahl = await screen.findByTestId('number-picker');
    await waitFor(() => expect(toreImLog()).toHaveLength(1));
    await new Promise((r) => { setTimeout(r, 350); });
    within(auswahl).getByRole('button', { name: '5' }).focus(); // Fokus auf einem Nummernknopf, nicht im Feld
    await user.keyboard('1');
    await waitFor(() => expect(within(auswahl).getByRole('textbox')).toHaveValue('1'));
    expect(within(auswahl).getByRole('textbox')).toHaveFocus();
    await engineLeer();
    expect(toreImLog()).toHaveLength(1);
  });

  it('@SL-142 Gegenbeispiel Eingabefeld: „f“ und Leertaste im Feld „Andere Nr.“ lösen weder Foul noch Uhr aus', async () => {
    const user = userEvent.setup();
    await starte(user);
    await user.keyboard('1');
    const feld = within(await screen.findByTestId('number-picker')).getByRole('textbox');
    await user.type(feld, 'f ');
    await engineLeer();
    expect(fouls()).toBe(0);
    expect(zustand()).toContain('Live');
  });

  it('A4-1 bei offener Abpfiff-Rückfrage (alertdialog) schaltet die Leertaste die Uhr nicht', async () => {
    const user = userEvent.setup();
    await starte(user);
    // „Abpfiff halten“ gedrückt halten (HOLD_MS, echter Zeitgeber): danach fragt das Cockpit „Spiel beenden?“ als alertdialog
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByTestId('match-finish-button') });
    await new Promise((r) => { setTimeout(r, 1100); });
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await user.keyboard(' ');
    await engineLeer();
    expect(zustand()).toContain('Live');
  });
});

describe('@SL-188 / @SL-189 Hinweise nur mit Maus, Schalter', () => {
  it('@SL-188 mit Maus stehen „1“, „2“, „F“ und „J“ an Tor und Foul; ohne Maus (Tablet quer) stehen sie nicht da', async () => {
    mitMaus();
    const user = userEvent.setup();
    await starte(user);
    expect(screen.getByTestId('tor-taste-home')).toHaveTextContent('1');
    expect(screen.getByTestId('tor-taste-away')).toHaveTextContent('2');
    expect(screen.getByTestId('foul-taste-home')).toHaveTextContent('F');
    expect(screen.getByTestId('foul-taste-away')).toHaveTextContent('J');
    expect(screen.getByTestId('goal-button-home')).toHaveAttribute('aria-keyshortcuts', '1');
  });

  it('@SL-188 Gegenbeispiel: ohne Maus keine Hinweise, aber die Tasten wirken weiter (Tablet mit Tastatur)', async () => {
    const user = userEvent.setup();
    await starte(user);
    expect(screen.queryByTestId('tor-taste-home')).toBeNull();
    await user.keyboard('2');
    await waitFor(() => expect(toreImLog()).toHaveLength(1));
  });

  it('@SL-189 Schalter „Tastenkürzel“ aus: keine Taste löst mehr etwas aus, die Hinweise sind weg, der Schalter in den Einstellungen steht', async () => {
    mitMaus();
    const user = userEvent.setup();
    await starte(user);
    await user.click(screen.getByTestId('cockpit-more-button'));
    await user.click(await screen.findByTestId('mehr-einstellungen'));
    await user.click(await screen.findByTestId('tastenkuerzel-checkbox'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('tastenkuerzel-schalter')).toBeNull());
    expect(screen.queryByTestId('tor-taste-home')).toBeNull();
    expect(screen.getByTestId('goal-button-home')).not.toHaveAttribute('aria-keyshortcuts');
    await user.keyboard(' ');
    await user.keyboard('1');
    await user.keyboard('f');
    await engineLeer();
    expect(zustand()).toContain('Live');
    expect(toreImLog()).toHaveLength(0);
    expect(fouls()).toBe(0);
  });

  it('@SL-153 Gegenbeispiel Handy hoch (360 px): keine Tastenkürzel, auch nicht mit Tastatur', async () => {
    breite(360);
    const user = userEvent.setup();
    await starte(user);
    await user.keyboard('1');
    await user.keyboard('f');
    await engineLeer();
    expect(toreImLog()).toHaveLength(0);
    expect(fouls()).toBe(0);
    // Kein Kürzel wirkt, also meldet auch die Leiste keines (aria-keyshortcuts nur, wo die Taste wirklich wirkt)
    expect(screen.getByTestId('match-pause-button')).not.toHaveAttribute('aria-keyshortcuts');
    expect(screen.getByTestId('match-undo-button')).not.toHaveAttribute('aria-keyshortcuts');
  });
});
