/**
 * LiveCockpit H4-12: Ton je Gerät (C-TON-TURNIERWEIT, @HT-009, @SL-125) und die Hinweise zum Hallen-Lautsprecher unter der Tafel
 * (@HT-034, @HT-040, @HT-050, @HT-016, @HT-038), mit echten deutschen Texten.
 * Das Cockpit liest `soundEnabled`/`soundVolume` des Turniers nicht mehr; Ton an/aus und Lautstärke kommen aus dem Speicher des Geräts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import deHallenton from '../../../i18n/locales/de/hallenton.json';
import i18n from 'i18next';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makeProps } from './cockpitFixtures';
import { installiereGeraet } from '../../../test/geraetSpeicher';
import { COCKPIT_TON_SCHLUESSEL, __setzeCockpitTonFuerTests } from '../hooks/useCockpitTon';
import { setzeLeitung } from '../../../features/hallenton/leitungGeraet';
import type { LeitungLebenszeichen, LeitungStand } from '../../../features/hallenton/runtime/leitungLebenszeichen';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();
i18n.addResourceBundle('de', 'hallenton', deHallenton, true, true);

const ton = vi.hoisted(() => ({ aufrufe: [] as unknown[][], isActivated: false }));
vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: (...args: unknown[]) => {
    ton.aufrufe.push(args);
    return { play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: ton.isActivated, error: null };
  },
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false,
  }),
}));
// Server-Stand des Lautsprechers (`hall_sound_status`): hier von Hand, standardmäßig ohne Antwort
const hallStatus = vi.hoisted(() => ({ stand: 'laedt', felder: {} }));
vi.mock('../../../features/hallenton/useHallStatus', () => ({
  useHallStatus: () => ({ stand: hallStatus.stand, antwort: null, felder: hallStatus.felder, lautsprecherBekannt: false, testtonAnfordern: vi.fn(), gehoert: vi.fn() }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

const letzterAufruf = (): unknown[] => ton.aufrufe[ton.aufrufe.length - 1] ?? [];
const ABZEICHEN = 'Ton für das Spielende ist aus – antippen zum Einschalten';

beforeEach(() => {
  ton.aufrufe = [];
  ton.isActivated = false;
  hallStatus.stand = 'laedt';
  hallStatus.felder = {};
  installiereGeraet();
  __setzeCockpitTonFuerTests();
});
afterEach(() => { setzeLeitung(null); vi.restoreAllMocks(); });

describe('@HT-009 @SL-125 Cockpit-Ton je Gerät', () => {
  it('Gegenbeispiel C-TON-TURNIERWEIT: das Turnier sagt „aus“ und 10 %, das Gerät hat nichts gespeichert → Ton an, 100 % (die Turnier-Werte zählen nicht)', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { cockpitSettings: { soundEnabled: false, soundVolume: 10 } as never })} />);
    expect(letzterAufruf().slice(1, 3)).toEqual([100, true]);
  });

  it('die Lautstärke und das Ausschalten dieses Geräts erreichen den Ton (Lautstärke 35 %)', () => {
    window.localStorage.setItem(COCKPIT_TON_SCHLUESSEL, JSON.stringify({ an: true, lautstaerke: 35 }));
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(letzterAufruf().slice(1, 3)).toEqual([35, true]);
  });

  it('@SL-125 Tom hat den Ton auf seinem Gerät aus: der Ton ist aus, das Abzeichen „Ton aus“ steht nicht (er hat es so gewollt)', () => {
    window.localStorage.setItem(COCKPIT_TON_SCHLUESSEL, JSON.stringify({ an: false, lautstaerke: 100 }));
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(letzterAufruf()[2]).toBe(false);
    expect(screen.queryByRole('button', { name: ABZEICHEN })).toBeNull();
  });

  it('@SL-125 Gegenbeispiel: Claras Gerät (anderer Speicher) hat den Ton an, obwohl Tom ihn ausgeschaltet hat', () => {
    window.localStorage.setItem(COCKPIT_TON_SCHLUESSEL, JSON.stringify({ an: false, lautstaerke: 100 }));
    const tom = render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(letzterAufruf()[2]).toBe(false);
    tom.unmount();
    installiereGeraet(); // Claras Gerät: eigener, leerer Speicher
    __setzeCockpitTonFuerTests();
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(letzterAufruf()[2]).toBe(true);
    expect(screen.getByRole('button', { name: ABZEICHEN })).toBeInTheDocument();
  });

  it('ohne gewählten Ton im Turnier („Kein Ton“) bleibt der Ton aus, auch mit Ton an am Gerät', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { cockpitSettings: { soundId: null } as never })} />);
    expect(letzterAufruf()[2]).toBe(false);
  });
});

describe('Cockpit-Dialog: nur Ton an/aus und Lautstärke dieses Geräts', () => {
  async function oeffneDialog(onUpdateSettings = vi.fn()) {
    const user = userEvent.setup();
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'PAUSED' }), { onUpdateSettings })} />);
    await user.click(screen.getByTestId('cockpit-more-button'));
    await user.click(screen.getByTestId('mehr-einstellungen'));
    return { user, onUpdateSettings };
  }

  it('der Dialog zeigt „Ton dieses Geräts“ mit Schalter und Regler, aber keine Tonwahl des Turniers und keinen Hochladen-Knopf', async () => {
    await oeffneDialog();
    const abschnitt = screen.getByTestId('cockpit-geraet-ton');
    expect(within(abschnitt).getByText('Ton dieses Geräts')).toBeInTheDocument();
    expect(within(abschnitt).getByRole('switch', { name: 'Ton auf diesem Gerät' })).toBeInTheDocument();
    expect(within(abschnitt).getByTestId('cockpit-ton-regler')).toHaveValue('100');
    expect(screen.queryByTestId('settings-end-sound-select')).toBeNull();
    expect(screen.queryByRole('button', { name: /Hochladen/ })).toBeNull();
  });

  it('@SL-125 der Schalter schreibt nur auf dieses Gerät: das Turnier wird nicht geändert (kein onUpdateSettings), der Speicher des Geräts schon', async () => {
    const { user, onUpdateSettings } = await oeffneDialog();
    await user.click(screen.getByTestId('cockpit-ton-schalter'));
    expect(onUpdateSettings).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem(COCKPIT_TON_SCHLUESSEL) ?? 'null')).toMatchObject({ an: false });
    expect(screen.queryByTestId('cockpit-ton-regler')).toBeNull(); // ohne Ton keine Lautstärke
  });

  it('die Lautstärke wird auf dem Gerät gespeichert, das Turnier bleibt unberührt', async () => {
    const { onUpdateSettings } = await oeffneDialog();
    fireEvent.change(screen.getByTestId('cockpit-ton-regler'), { target: { value: '40' } });
    expect(onUpdateSettings).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem(COCKPIT_TON_SCHLUESSEL) ?? 'null')).toMatchObject({ lautstaerke: 40 });
  });

  it('Gegenbeispiel: ohne Steuerrecht (nur ansehen) bleibt der Ton dieses Geräts bedienbar – es ist keine Einstellung des Turniers', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'PAUSED' }), { kannSteuern: false })} />);
    await user.click(screen.getByTestId('cockpit-more-button'));
    await user.click(screen.getByTestId('mehr-einstellungen'));
    expect(screen.getByTestId('cockpit-ton-schalter')).toBeEnabled();
  });
});

describe('Hinweise zum Hallen-Lautsprecher unter der Tafel', () => {
  const stand = (state: NonNullable<LeitungStand['speaker']>['state']): LeitungStand => ({
    status: 'ok', speaker: { state, ageMs: 2000, outputHint: false }, serverNow: 1_000_000, empfangenUm: 900,
  });
  const leitung = (s: LeitungStand | null): LeitungLebenszeichen => ({
    start: vi.fn(), stop: vi.fn(), stand: () => s, versuchGescheitert: () => false, version: () => 1, jetzt: () => 1000, subscribe: () => () => undefined,
  });

  it('@HT-040 Kasten steht unter der Tafel (nach ihr im Dokument), nicht darüber, und die Uhr bleibt sichtbar', () => {
    setzeLeitung(leitung(stand('not_activated')));
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    const kasten = screen.getByTestId('cockpit-hall-aus');
    expect(kasten).toHaveTextContent('Hallen-Lautsprecher aus – Ende selbst anzeigen');
    expect(screen.getByTestId('scoreboard').compareDocumentPosition(kasten) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('scoreboard-clock')).toBeVisible();
    expect(getComputedStyle(kasten).position).not.toBe('fixed');
    expect(getComputedStyle(kasten).position).not.toBe('absolute');
  });

  it('@HT-039 Kasten schon vor dem Anpfiff (Server-Stand, Leitung hat noch keinen Stand); Anpfiff bleibt möglich und der Kasten bleibt stehen', async () => {
    hallStatus.stand = 'aktuell';
    hallStatus.felder = { 1: { art: 'nichtBereit', grund: 'volume_zero', pruefen: false } };
    const onStart = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'NOT_STARTED', elapsedSeconds: 0 }), { onStart })} />);
    expect(screen.getByTestId('cockpit-hall-aus')).toHaveTextContent('Grund: Lautstärke 0 %');
    await user.click(screen.getByTestId('match-start-button'));
    expect(onStart).toHaveBeenCalled();
    // Tom pfeift an: das Spiel läuft, die Leitung hat noch keinen Stand – der Kasten bleibt stehen
    rerender(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'RUNNING', elapsedSeconds: 1 }), { onStart })} />);
    expect(screen.getByTestId('cockpit-hall-aus')).toHaveTextContent('Grund: Lautstärke 0 %');
  });

  it('@HT-039 Gegenbeispiel: ohne Steuerrecht (nur ansehen) kein Kasten aus dem Server-Stand', () => {
    hallStatus.stand = 'aktuell';
    hallStatus.felder = { 1: { art: 'nichtBereit', grund: 'volume_zero', pruefen: false } };
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'NOT_STARTED', elapsedSeconds: 0 }), { kannSteuern: false })} />);
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
  });

  it('@HT-038 @HT-016 Gegenbeispiel: ohne Lautsprecher am Feld kein Kasten, und der Anpfiff geht', () => {
    setzeLeitung(leitung({ status: 'ok', speaker: null, serverNow: 1_000_000, empfangenUm: 900 }));
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'NOT_STARTED', elapsedSeconds: 0 }))} />);
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
    expect(screen.getByTestId('match-start-button')).toBeEnabled();
  });

  it('@HT-050 ruhige Zeile bei laufendem Spiel; Gegenbeispiel: beendetes Spiel ohne Leitungsstand zeigt keinen Hinweis', () => {
    setzeLeitung(leitung({ ...stand('ready'), speaker: { state: 'ready', ageMs: 1000, outputHint: true } }));
    const { unmount } = render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    expect(screen.getByTestId('cockpit-hall-ausgang-geaendert')).toHaveTextContent('Hallenton-Ausgang geändert');
    unmount();
    setzeLeitung(leitung(null));
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'FINISHED' }))} />);
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
  });

  it('Rand: Grund „meldet sich nicht“ mit Uhrzeit (Überlauf und Umbruch misst Playwright)', () => {
    setzeLeitung(leitung({ ...stand('ready'), speaker: { state: 'ready', ageMs: 30_000, outputHint: false } }));
    render(<LiveCockpit {...makeProps(makeLiveMatch({ homeTeam: { id: 'a', name: 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921' } }))} />);
    expect(screen.getByTestId('cockpit-hall-aus')).toHaveTextContent(/Grund: meldet sich nicht \(zuletzt \d\d:\d\d\)/);
  });
});
