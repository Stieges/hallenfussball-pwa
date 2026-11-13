/**
 * Leibchen-Karte im Cockpit und im Endstand (Leibchen 2b-2, Lage B): @SL-197 (Spielzeit vor dem Anpfiff, aus dem alten Test übernommen), @SL-206, @SL-208, @SL-210, @SL-211, @SL-213, @SL-215, @SL-148, @SL-149, @SL-150, @SL-196.
 * Die Wahl geht durch die echte Warteschlange und die Überlagerung der Turnierkopie (`useKitChoiceOverlay`), gesendet wird nichts (Gastkonto).
 * Gherkin: docs/anforderungen/2026-10-02_spiel-leiten.md. Teams und Farben wie in den Szenarien (TSV Waging 1, TSV Petting, SV Aschau, FC Seeon).
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makeProps } from './cockpitFixtures';
import { useKitChoiceOverlay } from '../../../hooks/useKitChoices';
import { kitChoiceQueueFor } from '../../../features/match-engine/kitChoiceRegistry';
import { teamSlot } from '../../../core/models/matchSlot';
import type { Match, Team, Tournament } from '../../../types/tournament';
import type { LiveCockpitProps } from '../types';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [], syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

const BLAU = '#1565C0';
const ROT = '#C62828';
const WEISS = '#FFFFFF';
const GELB = '#FFCC00';
const WAGING = '00000000-0000-4000-8000-0000000000a1';
const PETTING = '00000000-0000-4000-8000-0000000000a2';
const ASCHAU = '00000000-0000-4000-8000-0000000000a3';
const SEEON = '00000000-0000-4000-8000-0000000000a4';

const team = (id: string, name: string, primary: string): Team => ({ id, name, colors: { primary } });
const spiel = (id: string, a: string, b: string, extra: Partial<Match> = {}): Match => ({
  id, round: 1, field: 1, matchNumber: Number(id.slice(-1)), slotA: teamSlot(a), slotB: teamSlot(b), matchStatus: 'scheduled', scheduledTime: new Date(2026, 10, 28, 10, Number(id.slice(-1)) * 10), ...extra,
});
const turnier = (teams: Team[], matches: Match[]): Tournament => ({ id: 'tour-1', teams, matches } as unknown as Tournament);
const live2 = (extra = {}) => makeLiveMatch({ id: 'spiel-2', number: 2, status: 'NOT_STARTED', elapsedSeconds: 0, homeTeam: { id: WAGING, name: 'TSV Waging 1' }, awayTeam: { id: PETTING, name: 'TSV Petting' }, ...extra });
const live1 = () => makeLiveMatch({ id: 'spiel-1', number: 1, status: 'FINISHED', homeScore: 2, awayScore: 1, homeTeam: { id: ASCHAU, name: 'SV Aschau' }, awayTeam: { id: SEEON, name: 'FC Seeon' } });
const verschiedeneFarbe = [team(WAGING, 'TSV Waging 1', BLAU), team(PETTING, 'TSV Petting', ROT), team(ASCHAU, 'SV Aschau', ROT), team(SEEON, 'FC Seeon', GELB)];
const gleicheFarbe = [team(WAGING, 'TSV Waging 1', BLAU), team(PETTING, 'TSV Petting', BLAU), team(ASCHAU, 'SV Aschau', ROT), team(SEEON, 'FC Seeon', GELB)];

const amHandy = (): void => { window.innerWidth = 360; window.dispatchEvent(new Event('resize')); };
const amLaptop = (): void => { window.innerWidth = 1280; window.dispatchEvent(new Event('resize')); };

/** Lässt die Uhr (`Date.now`) um `ms` weiterlaufen: der Schutz gegen den Doppeltipp zählt eine Sekunde. */
const vergehe = (ms: number): void => { const jetzt = Date.now() + ms; vi.spyOn(Date, 'now').mockReturnValue(jetzt); };

beforeEach(() => {
  vi.restoreAllMocks();
  // die Warteschlange gehört der Sitzung: jeder Test beginnt ohne Wahl
  localStorage.clear();
  kitChoiceQueueFor('guest').reset();
});

/** Wie die App: die Turnierkopie mit der lokalen Wahl darüber (`useTournamentManager`). */
function Rahmen({ basis, props }: { basis: Tournament; props: LiveCockpitProps }) {
  const gezeigt = useKitChoiceOverlay(basis);
  return <LiveCockpit {...props} leibchenTurnier={gezeigt === null ? undefined : { tournament: gezeigt, epoche: 3 }} />;
}
function zeige(basis: Tournament, match: ReturnType<typeof live2>, extra: Partial<LiveCockpitProps> = {}) {
  const props = makeProps(match, extra);
  const user = userEvent.setup();
  const tipps = { n: 0 };
  const tippe = async (el: HTMLElement): Promise<void> => { tipps.n += 1; await user.click(el); };
  const ansicht = render(<Rahmen basis={basis} props={props} />);
  return { ...ansicht, props, tippe, tipps };
}

describe('@SL-218 am Laptop steht die Karte unten rechts in der Spalte der Einträge, über der Leiste', () => {
  it('@SL-218 Laptop: die Karte steht in der Spalte neben den Einträgen, nicht im Block der Leiste (der Fläche links nimmt sie nichts weg)', () => {
    amLaptop();
    zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2());
    const karte = screen.getByTestId('leibchen-karte');
    expect(karte.parentElement).not.toContainElement(screen.getByTestId('match-start-button'));
    expect(screen.getByTestId('cockpit-flaeche')).toContainElement(karte);
  });

  it('Gegenbeispiel: am Handy steht sie im Block über „Anpfeifen“, nicht in der Fläche', () => {
    amHandy();
    zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2());
    expect(screen.getByTestId('cockpit-flaeche')).not.toContainElement(screen.getByTestId('leibchen-karte'));
  });
});

describe('@SL-206 bei gleichen Trikotfarben steht direkt über der Daumenleiste die Karte', () => {
  it('@SL-206 Spiel 2 Blau gegen Blau: Karte „TSV Waging 1 zieht Gelb“ im selben Block wie „Anpfeifen“ (klebt unten), mit „Bestätigen“ und „Keine Leibchen“', () => {
    amHandy();
    zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2());
    const karte = screen.getByTestId('leibchen-karte');
    expect(screen.getByTestId('leibchen-vorschlag')).toHaveTextContent('TSV Waging 1 zieht Gelb');
    expect(karte.parentElement).toContainElement(screen.getByTestId('match-start-button'));
    expect(screen.getByTestId('leibchen-bestaetigen')).toBeInTheDocument();
    expect(screen.getByTestId('leibchen-keine')).toBeInTheDocument();
  });

  it('@SL-206 Aber Rot gegen Weiß: keine Karte, nur die kleine Taste „Leibchen festlegen“ (@SL-138, @SL-148)', () => {
    zeige(turnier([team(WAGING, 'TSV Waging 1', ROT), team(PETTING, 'TSV Petting', WEISS)], [spiel('spiel-2', WAGING, PETTING)]), live2());
    expect(screen.queryByTestId('leibchen-karte')).toBeNull();
    expect(screen.getByTestId('leibchen-festlegen')).toBeInTheDocument();
  });

  it('@SL-196 die Tafel weist auf die gleiche Trikotfarbe hin, die Kästen bleiben in den echten Farben (keine Ausweichfarbe)', () => {
    zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2());
    expect(screen.getByTestId('scoreboard-farb-hinweis')).toHaveTextContent('Gleiche Trikotfarbe');
  });

  it('@SL-149 „Ohne Leibchen anpfeifen“ gibt es nicht mehr', () => {
    zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2());
    expect(screen.queryByTestId('anpfiff-ohne-leibchen')).toBeNull();
    expect(screen.queryByText('Ohne Leibchen anpfeifen')).toBeNull();
  });

  it('@SL-215 Gegenbeispiel: im laufenden Spiel erscheint keine Karte', () => {
    zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING, { matchStatus: 'running' })]), live2({ status: 'RUNNING', elapsedSeconds: 60 }));
    expect(screen.queryByTestId('leibchen-karte')).toBeNull();
    expect(screen.queryByTestId('leibchen-festlegen')).toBeNull();
  });
});

describe('@SL-208 @SL-211 nach dem Tipp bleibt eine Zeile, die Tipps bis zum Anpfiff', () => {
  it('@SL-208 „Bestätigen“: die Zeile „TSV Waging 1 zieht Gelb · Ändern“ steht an derselben Stelle, „wird gesendet“ (Gastgerät, nie gesendet)', async () => {
    const k = zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2());
    await k.tippe(screen.getByTestId('leibchen-bestaetigen'));
    expect(screen.getByTestId('leibchen-zeile')).toHaveTextContent('TSV Waging 1 zieht Gelb');
    expect(screen.getByTestId('leibchen-aendern')).toBeInTheDocument();
    expect(screen.getByTestId('leibchen-status')).toHaveTextContent('wird gesendet');
    expect(screen.queryByTestId('leibchen-karte')).toBeNull();
  });

  it('@SL-211 Zeile 1: „Bestätigen“ und „Anpfeifen“ = 2 Tipps, der Anpfiff nennt keine eigene Wahl (der Anpfiff trägt, was bestätigt ist)', async () => {
    const k = zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2());
    await k.tippe(screen.getByTestId('leibchen-bestaetigen'));
    await k.tippe(screen.getByTestId('match-start-button'));
    expect(k.tipps.n).toBe(2);
    expect(k.props.onStart).toHaveBeenCalledWith('spiel-2');
  });

  it('@SL-211 Zeile 2: „Keine Leibchen“ und „Anpfeifen“ = 2 Tipps', async () => {
    const k = zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2());
    await k.tippe(screen.getByTestId('leibchen-keine'));
    expect(screen.getByTestId('leibchen-zeile')).toHaveTextContent('Keine Leibchen');
    await k.tippe(screen.getByTestId('match-start-button'));
    expect(k.tipps.n).toBe(2);
    expect(k.props.onStart).toHaveBeenCalledTimes(1);
  });

  it('@SL-211 Zeile 3 (@SL-210): nur „Anpfeifen“ = 1 Tipp, die Karte fragt nicht nach und sperrt nicht', async () => {
    const k = zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2());
    await k.tippe(screen.getByTestId('match-start-button'));
    expect(k.tipps.n).toBe(1);
    expect(k.props.onStart).toHaveBeenCalledWith('spiel-2');
  });

  it('@SL-208 „Ändern“ öffnet die Karte wieder an ihrem Platz (derselbe Block über der Daumenleiste)', async () => {
    amHandy();
    const k = zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2());
    await k.tippe(screen.getByTestId('leibchen-bestaetigen'));
    vergehe(1100); // ein zweiter Tipp unter einer Sekunde öffnet die Zeile nicht wieder (@SL-221)
    await k.tippe(screen.getByTestId('leibchen-aendern'));
    expect(screen.getByTestId('leibchen-karte').parentElement).toContainElement(screen.getByTestId('match-start-button'));
  });
});

describe('@SL-215 die Leibchen lassen sich schon im Endstand klären', () => {
  const basis = () => turnier(gleicheFarbe, [spiel('spiel-1', ASCHAU, SEEON, { matchStatus: 'finished' }), spiel('spiel-2', WAGING, PETTING)]);

  it('@SL-215 Spiel 1 abgepfiffen, Spiel 2 beide Blau: unter den Einträgen, direkt über „Weiter“ die Karte „TSV Waging 1 zieht Gelb“', () => {
    amHandy();
    zeige(basis(), live1(), { upcomingMatches: [live2()] });
    const karte = screen.getByTestId('leibchen-karte');
    expect(screen.getByTestId('leibchen-vorschlag')).toHaveTextContent('TSV Waging 1 zieht Gelb');
    expect(karte.parentElement).toContainElement(screen.getByTestId('match-next-button'));
    expect(screen.getByTestId('leibchen-ueberschrift')).toHaveTextContent('Leibchen für das nächste Spiel · Spiel 2'); // im Endstand gilt die Karte dem NÄCHSTEN Spiel (@SL-215)
  });

  it('@SL-215 „Bestätigen“ im Endstand: die Karte schrumpft zur Zeile, „Weiter“ bleibt', async () => {
    const k = zeige(basis(), live1(), { upcomingMatches: [live2()] });
    await k.tippe(screen.getByTestId('leibchen-bestaetigen'));
    expect(screen.getByTestId('leibchen-zeile')).toHaveTextContent('TSV Waging 1 zieht Gelb');
    expect(screen.getByTestId('match-next-button')).toBeInTheDocument();
  });

  it('@SL-215 Spiel 1 abgepfiffen, Spiel 2 Rot gegen Weiß: im Endstand keine Karte und kein Leibchen-Teil', () => {
    const t = turnier([team(ASCHAU, 'SV Aschau', ROT), team(SEEON, 'FC Seeon', GELB), team(WAGING, 'TSV Waging 1', ROT), team(PETTING, 'TSV Petting', WEISS)], [spiel('spiel-1', ASCHAU, SEEON, { matchStatus: 'finished' }), spiel('spiel-2', WAGING, PETTING)]);
    zeige(t, live1(), { upcomingMatches: [live2()] });
    expect(screen.queryByTestId('leibchen-karte')).toBeNull();
    expect(screen.queryByTestId('leibchen-festlegen')).toBeNull();
  });

  it('@SL-215 ein Team von Spiel 2 steht noch nicht fest: im Endstand keine Karte', () => {
    const t = turnier(gleicheFarbe, [spiel('spiel-1', ASCHAU, SEEON, { matchStatus: 'finished' }), { ...spiel('spiel-2', WAGING, PETTING), slotB: { kind: 'pending', source: { kind: 'groupRank', group: 'B', rank: 1 } } }]);
    zeige(t, live1(), { upcomingMatches: [live2()] });
    expect(screen.queryByTestId('leibchen-karte')).toBeNull();
  });
});

describe('@SL-202 @SL-213 ein Gerät ohne Steuerung sieht Karte und Zeile ohne Tasten', () => {
  it('@SL-213 Olli auf einem Tablet, das das Feld nicht steuert: Karte ohne „Bestätigen“ und „Keine Leibchen“, mit dem Angebot, das Feld zu übernehmen', async () => {
    const uebernehmen = vi.fn();
    const k = zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2(), { kannSteuern: false, steuerung: { leitetName: 'Tom', onUebernehmen: uebernehmen } });
    expect(screen.queryByTestId('leibchen-bestaetigen')).toBeNull();
    expect(screen.queryByTestId('leibchen-keine')).toBeNull();
    expect(screen.getByTestId('leibchen-nur-lesen')).toHaveTextContent('Nur das steuernde Gerät kann Leibchen bestätigen.');
    await k.tippe(within(screen.getByTestId('leibchen-karte')).getByTestId('leibchen-uebernehmen'));
    expect(uebernehmen).toHaveBeenCalledTimes(1);
  });
});

describe('@SL-150 Nachtragen im laufenden Spiel nur durch die Turnierleitung', () => {
  const laufend = () => turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING, { matchStatus: 'running', kit: { a: BLAU, b: BLAU } })]);

  it('@SL-150 Olli (Turnierleitung): unter „Mehr“ steht „Leibchen nachtragen“; Orange für TSV Petting speichern', async () => {
    const k = zeige(laufend(), live2({ status: 'RUNNING', elapsedSeconds: 60 }), { istLeitung: true });
    await k.tippe(screen.getByTestId('cockpit-more-button'));
    await k.tippe(screen.getByTestId('mehr-leibchen-nachtragen'));
    await k.tippe(screen.getByTestId('nachtrag-team-gast'));
    await k.tippe(screen.getByTestId('nachtrag-andere'));
    await k.tippe(screen.getByTestId('nachtrag-farbe-orange'));
    await k.tippe(screen.getByTestId('nachtrag-speichern'));
    expect(screen.queryByTestId('nachtrag-speichern')).toBeNull();
    // der Nachtrag geht als Wahl im laufenden Spiel (phase live) mit der Epoche der Feldsteuerung zum Server; Petting trägt Orange, Waging bleibt Blau
    expect(kitChoiceQueueFor('guest').entries()[0]).toMatchObject({ matchId: 'spiel-2', decision: 'bib', bibSide: 'b', bibColor: '#FF6600', phase: 'live', controlEpoch: 3 });
  });

  it('@SL-150 Gegenbeispiel: der Helfer (kein Leitungsrecht) bekommt den Punkt nicht', async () => {
    const k = zeige(laufend(), live2({ status: 'RUNNING', elapsedSeconds: 60 }), { istLeitung: false });
    await k.tippe(screen.getByTestId('cockpit-more-button'));
    expect(screen.queryByTestId('mehr-leibchen-nachtragen')).toBeNull();
  });

  it('@SL-150 Gegenbeispiel: vor dem Anpfiff gibt es den Punkt nicht (dort die Karte)', async () => {
    const k = zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2(), { istLeitung: true });
    await k.tippe(screen.getByTestId('cockpit-more-button'));
    expect(screen.queryByTestId('mehr-leibchen-nachtragen')).toBeNull();
  });
});

describe('@SL-197 vor dem Anpfiff die Spielzeit aus den Regeln (neben der Karte)', () => {
  it('@SL-197 9 Minuten → groß „9:00“, darunter „Anstoß hh:mm · Spiel 12 · Feld 1“', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch({ id: 'spiel-12', number: 12, status: 'NOT_STARTED', elapsedSeconds: 0, homeTeam: { id: 'sv-sued', name: 'SV Süd' }, awayTeam: { id: 'fc-nord', name: 'FC Nord' } }), { spielzeit: { abschnitte: 1, abschnittSekunden: 540 } })} />);
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('9:00');
    expect(screen.getByTestId('scoreboard-clock')).toHaveTextContent('Spielzeit');
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent(/^Anstoß \d{2}:\d{2} · Spiel 12 · Feld 1$/);
  });

  it('@SL-197 zwei Abschnitte zu 4 Minuten → „2 ד vor „4:00“', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch({ id: 'spiel-12', number: 12, status: 'NOT_STARTED', elapsedSeconds: 0 }), { spielzeit: { abschnitte: 2, abschnittSekunden: 240 } })} />);
    expect(screen.getByTestId('scoreboard-clock-vorsatz')).toHaveTextContent('2 ×');
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('4:00');
  });
});

describe('@SL-241 am Handy steht die Spielzeit mit Karte klein in der Zeile (Daniel „V1b“)', () => {
  const kleinText = /^Anstoß\u00A0\d{2}:\d{2} · Spiel\u00A0\d+ · Feld\u00A01 · Spielzeit\u00A09:00$/;
  const spielzeit = { spielzeit: { abschnitte: 1, abschnittSekunden: 540 } };
  it('@SL-241 Handy mit Karte: keine große Spielzeit, die Zeile nennt „Spielzeit 9:00“, die Karte steht', () => {
    amHandy();
    zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2(), spielzeit);
    expect(screen.getByTestId('leibchen-karte')).toBeInTheDocument();
    expect(screen.queryByTestId('scoreboard-clock-rest')).toBeNull();
    expect(screen.getByTestId('scoreboard-clock-sub').textContent).toMatch(kleinText);
  });
  it('@SL-241 Gegenbeispiel Handy ohne Karte (verschiedene Trikotfarben): groß wie in @SL-197', () => {
    amHandy();
    zeige(turnier(verschiedeneFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2(), spielzeit);
    expect(screen.queryByTestId('leibchen-karte')).toBeNull();
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('9:00');
  });
  it('@SL-241 Gegenbeispiel Laptop mit Karte: groß, die Tafel bleibt unverändert', () => {
    amLaptop();
    zeige(turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING)]), live2(), spielzeit);
    expect(screen.getByTestId('leibchen-karte')).toBeInTheDocument();
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('9:00');
  });
});

describe('@SL-237 @SL-221 die offene Wahl wird verlassen (am Handy)', () => {
  const handy = (): void => { window.innerWidth = 360; window.dispatchEvent(new Event('resize')); };
  const breit = (): void => { window.innerWidth = 1024; window.dispatchEvent(new Event('resize')); };
  const basis = (status: Match['matchStatus'] = 'scheduled') => turnier(gleicheFarbe, [spiel('spiel-1', ASCHAU, SEEON, { matchStatus: 'finished' }), spiel('spiel-2', WAGING, PETTING, { matchStatus: status })]);

  it('@SL-237 Zeile 2: Tom pfeift bei offener Wahl an – Karte und offene Wahl sind weg, die Tafel und die Tasten sind im laufenden Spiel wieder da (nichts bleibt versteckt)', async () => {
    handy();
    const props = makeProps(live2());
    const k = zeige(basis(), live2());
    await k.tippe(screen.getByTestId('leibchen-vorschlag'));
    expect(screen.getByTestId('live-cockpit')).toHaveAttribute('data-leibchen-offen', 'true');
    await k.tippe(screen.getByTestId('match-start-button')); // „Keine Leibchen“ gilt (@SL-210), der Anpfiff fragt nicht nach
    expect(k.props.onStart).toHaveBeenCalledWith('spiel-2');
    expect(kitChoiceQueueFor('guest').entries()).toHaveLength(0);
    // das Spiel läuft jetzt
    k.rerender(<Rahmen basis={basis('running')} props={{ ...props, currentMatch: live2({ status: 'RUNNING', elapsedSeconds: 1 }) }} />);
    expect(screen.queryByTestId('leibchen-karte')).toBeNull();
    expect(screen.getByTestId('live-cockpit')).not.toHaveAttribute('data-leibchen-offen');
    breit();
  });

  it('@SL-237 Zeile 3: die Wahl blieb im Endstand offen und die 30 Sekunden laufen ab – das nächste Spiel zeigt die Karte mit dem alten Vorschlag, Orange gilt nicht, die Wahl ist zu', async () => {
    handy();
    const props = makeProps(live1(), { upcomingMatches: [live2()] });
    const k = zeige(basis(), live1(), { upcomingMatches: [live2()] });
    await k.tippe(screen.getByTestId('leibchen-vorschlag'));
    await k.tippe(screen.getByTestId('leibchen-andere'));
    await k.tippe(screen.getByTestId('leibchen-farbe-orange'));
    k.rerender(<Rahmen basis={basis()} props={{ ...props, currentMatch: live2(), upcomingMatches: [] }} />);
    expect(screen.getByTestId('leibchen-vorschlag')).toHaveTextContent('TSV Waging 1 zieht Gelb');
    expect(screen.queryByTestId('leibchen-wahl')).toBeNull();
    expect(screen.getByTestId('live-cockpit')).not.toHaveAttribute('data-leibchen-offen');
    await k.tippe(screen.getByTestId('leibchen-bestaetigen'));
    expect(kitChoiceQueueFor('guest').entries()[0]).toMatchObject({ bibColor: GELB });
    breit();
  });

  it('@SL-237 Zeile 5: nach dem Neuladen (neue Ansicht) steht die Karte mit dem alten Vorschlag, eine offene Wahl wird nicht gespeichert', async () => {
    const k = zeige(basis(), live2());
    await k.tippe(screen.getByTestId('leibchen-vorschlag'));
    await k.tippe(screen.getByTestId('leibchen-andere'));
    await k.tippe(screen.getByTestId('leibchen-farbe-orange'));
    k.unmount();
    zeige(basis(), live2());
    expect(screen.getByTestId('leibchen-vorschlag')).toHaveTextContent('TSV Waging 1 zieht Gelb');
    expect(screen.queryByTestId('leibchen-wahl')).toBeNull();
  });
});

describe('@SL-202 @SL-230 @SL-212 Epoche, Status aus der Zeile, zurückgenommene Wahl', () => {
  const basis = (extra: Partial<Match> = {}) => turnier(gleicheFarbe, [spiel('spiel-2', WAGING, PETTING, extra)]);

  it('@SL-202 „Bestätigen“ geht mit der Epoche der Feldsteuerung zum Server (p_control_epoch), „Keine Leibchen“ ebenso', async () => {
    const k = zeige(basis(), live2());
    await k.tippe(screen.getByTestId('leibchen-bestaetigen'));
    expect(kitChoiceQueueFor('guest').entries()[0]).toMatchObject({ decision: 'bib', controlEpoch: 3, phase: 'before' });
  });

  it('@SL-230 die Zeile zeigt „gesendet“, solange die Zeile des Servers die Wahl trägt – auch nachdem der Eintrag der Warteschlange abgeschlossen ist', () => {
    zeige(basis({ kitDecision: 'bib', kit: { a: GELB, bibSide: 'a' } }), live2());
    expect(screen.getByTestId('leibchen-zeile')).toHaveTextContent('TSV Waging 1 zieht Gelb');
    expect(screen.getByTestId('leibchen-status')).toHaveTextContent('gesendet');
    expect(screen.getByTestId('leibchen-status')).not.toHaveTextContent('wird');
  });

  it('@SL-212 setzt der Server die Wahl nach einem Teamwechsel zurück, sagt das Cockpit „Leibchen zurückgenommen, bitte neu bestätigen“ und die Karte steht wieder da', async () => {
    const props = makeProps(live2());
    const k = zeige(basis({ kitDecision: 'bib', kit: { a: GELB, bibSide: 'a' } }), live2());
    expect(screen.getByTestId('leibchen-zeile')).toBeInTheDocument();
    // auf der Seite des Gastes steht jetzt ein anderes Team (ebenfalls Blau, TSV Anders statt TSV Petting): der Server hat die Wahl zurückgenommen
    const ANDERS = '00000000-0000-4000-8000-0000000000a5';
    k.rerender(<Rahmen basis={turnier([...gleicheFarbe, team(ANDERS, 'TSV Anders', BLAU)], [spiel('spiel-2', WAGING, ANDERS)])} props={props} />);
    expect(screen.getByTestId('leibchen-karte')).toBeInTheDocument();
    expect(await screen.findByText('Leibchen zurückgenommen, bitte neu bestätigen')).toBeInTheDocument();
  });
});
