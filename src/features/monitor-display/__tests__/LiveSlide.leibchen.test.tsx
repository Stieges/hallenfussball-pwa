/**
 * Leibchen-Anzeige Schritt 1 am Monitor (Live-Folie Feld 1): @ZM-161 Trainingsleibchen, @ZM-157 Zeichen oben links, @ZM-195 Folie „Nächstes Spiel“
 * mit Kästen „0 : 0“, @ZM-159 Gast weicht aus (Entscheidung 1b: vor UND nach dem Anpfiff), @ZM-140 Team ohne Trikotfarbe, @ZM-192 Zeitstrafen-Kreis.
 * Spiel 7 „FC Nord – SV Süd“ steht auf Feld 1: läuft (1 : 0) bzw. – für die Folie „Nächstes Spiel“ – geplant. Farben kommen aus `match.kit`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveSlide } from '../slides/LiveSlide';
import type { PerformanceSettings } from '../../../types/monitor';
import type { MatchKit } from '../../../core/models/kit';
import type { Match, RuntimeMatchEvent } from '../../../types/tournament';
import { NowSourceContext } from '../../../components/schedule/useTickingNow';
import { displayLayout } from '../../../design-tokens';
import { palette } from '../../../design-tokens/colors/palette';
import { buildTournament, FIXTURE_TEAMS, slide, withMatch } from './monitorFixture';
import { withView } from './monitorViewHelper';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

const performanceSettings = {} as PerformanceSettings;
const ROT = palette.kit.red;
const BLAU = palette.kit.blue;
const GELB = palette.yellow[400];
const ORANGE = '#EF6C00';
const WEISS = palette.neutral[0];
const GRUEN = '#2E7D32';
const T0 = Date.UTC(2026, 10, 28, 14, 0, 0);

const geplant: Partial<Match> = { matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined, scheduledTime: new Date('2026-10-10T14:00:00') };

function strafe(teamId: string): RuntimeMatchEvent {
  return { id: 's5', type: 'TIME_PENALTY', timestampSeconds: 200, clockMs: 200_000, payload: { teamId, playerNumber: 5, durationSeconds: 120 }, scoreAfter: { home: 1, away: 0 } };
}
const UHR = { status: 'running', phase: 'regular', section: 1, sections: 1, sectionSeconds: 600, sectionStartMs: 0, elapsedMs: 230_000, anchorAt: T0 };

/** Folie Feld 1 mit Spiel 7; `farben` setzt die Trikotfarben der Teams, `kit` die beim Anpfiff bzw. beim Festlegen getragenen Farben. */
function zeige(patch: Partial<Match>, farben: Record<string, string | undefined> = {}) {
  const teams = FIXTURE_TEAMS.map((t) => (farben[t.id] === undefined ? t : { ...t, colors: { primary: farben[t.id]! } }));
  const tournament = buildTournament({ teams, matches: withMatch('match-7', patch) });
  return render(
    <NowSourceContext.Provider value={() => T0}>
      <LiveSlide slide={slide('live', { fieldId: 'field-1' })} {...withView(tournament)} performanceSettings={performanceSettings} theme="dark" style={{}} />
    </NowSourceContext.Provider>,
  );
}

const heim = () => screen.getByTestId('live-box-home');
const gast = () => screen.getByTestId('live-box-away');
const teile = (el: HTMLElement) => el.querySelectorAll('[data-teil]');
const kit = (k: MatchKit): Partial<Match> => ({ kit: k });

describe('@ZM-161 Spiel läuft: der Kasten mit Leibchen zeigt das Trainingsleibchen', () => {
  const FARBEN = { 'team-nord': ROT, 'team-sued': ROT };

  it('@ZM-161 SV Süd trägt gelbe Leibchen über roten Trikots: Weste Gelb mit drei Teilen in Rot, Zeichen oben links; FC Nord ganz Rot ohne Zeichen', () => {
    zeige(kit({ a: ROT, b: GELB, bibSide: 'b' }), FARBEN);
    expect(gast()).toHaveAttribute('data-fill', 'vest');
    expect(gast()).toHaveAttribute('data-color', GELB);
    expect(gast()).toHaveAttribute('data-stripes', ROT);
    expect(teile(gast())).toHaveLength(3);
    expect(screen.getByTestId('live-box-away-bib')).toBeInTheDocument();
    expect(heim()).toHaveAttribute('data-fill', 'solid');
    expect(teile(heim())).toHaveLength(0);
    expect(screen.queryByTestId('live-box-home-bib')).toBeNull();
  });

  it('@ZM-157 das Zeichen steht innen oben links, der Zeitstrafen-Kreis innen unten links (gleiche Größe, gleicher Abstand zur Kante)', () => {
    zeige({ ...kit({ a: ROT, b: GELB, bibSide: 'b' }), events: [strafe('team-sued')], liveState: UHR }, FARBEN);
    const zeichen = screen.getByTestId('live-box-away-bib');
    expect(zeichen.style.top).toBe(displayLayout.scoreArea.bibInset);
    expect(zeichen.style.left).toBe(displayLayout.scoreArea.bibInset);
    expect(zeichen.style.width).toBe(displayLayout.scoreArea.monitorCup);
    const reihe = screen.getByTestId('live-penalties-away');
    expect(reihe.style.left).toBe(displayLayout.scoreArea.bibInset);
    expect(reihe.style.bottom).toBe(displayLayout.scoreArea.bibInset);
    expect(screen.getByTestId('live-block-away')).toContainElement(reihe);
  });

  it('@ZM-192 Gegenbeispiel: ohne Leibchen gibt es nur den Kreis, kein Zeichen, keine Form', () => {
    zeige({ ...kit({ a: ROT, b: ROT }), events: [strafe('team-sued')], liveState: UHR }, FARBEN);
    expect(screen.getByTestId('live-penalties-away')).toBeInTheDocument();
    expect(screen.queryByTestId('live-box-away-bib')).toBeNull();
    expect(teile(gast())).toHaveLength(0);
  });

  it('@ZM-161 zweistelliger Stand: die Ziffer bleibt auf der Leibchenfarbe (Schriftgröße höchstens die Hälfte der Kastenbreite, Kasten mit Seitenteilen links und rechts)', () => {
    zeige({ ...kit({ a: ROT, b: GELB, bibSide: 'b' }), scoreB: 10 }, FARBEN);
    expect(screen.getByTestId('live-box-away-digits')).toHaveTextContent('10');
    expect(gast()).toHaveAttribute('data-digit-color', '#000000'); // Kontrast auf dem Gelb, nicht auf dem Rot der Teile
    const [links, rechts] = Array.from(teile(gast())) as HTMLElement[];
    const { edge, strap } = displayLayout.scoreArea.vest.large;
    expect(parseFloat(links.style.width)).toBe(strap);
    expect(parseFloat(rechts.style.width)).toBe(strap);
    // Platz zwischen den Seitenkanten: 100 − 2·edge % der Breite; zwei Stellen (≈ 1,3 em) bleiben mit der Schrift `digitsFontShare` darin
    const schrift = screen.getByTestId('live-box-away-digits').style.fontSize;
    expect(schrift).toContain(`${displayLayout.scoreArea.vest.digitsFontShare * 100}cqw`);
    expect(displayLayout.scoreArea.vest.digitsFontShare * 100 * 1.3).toBeLessThan(100 - 2 * edge);
  });

  it('@ZM-140 Team ohne Trikotfarbe mit Leibchen Orange: die Form liegt über der Standardfarbe Heim (Blau), der Gegner bleibt Blau', () => {
    zeige(kit({ a: ORANGE, b: BLAU, bibSide: 'a' }), { 'team-nord': undefined, 'team-sued': BLAU });
    expect(heim()).toHaveAttribute('data-fill', 'vest');
    expect(heim()).toHaveAttribute('data-color', ORANGE);
    expect(heim()).toHaveAttribute('data-stripes', BLAU);
    expect(screen.getByTestId('live-box-home-bib')).toBeInTheDocument();
    expect(gast()).toHaveAttribute('data-fill', 'solid');
  });

  it('@ZM-161 Kontrollfall Weiß gegen Grün ohne Leibchen: weder Form noch Zeichen', () => {
    zeige(kit({ a: WEISS, b: GRUEN }), { 'team-nord': WEISS, 'team-sued': GRUEN });
    expect(teile(heim())).toHaveLength(0);
    expect(teile(gast())).toHaveLength(0);
    expect(screen.queryByTestId('live-box-home-bib')).toBeNull();
    expect(screen.queryByTestId('live-box-away-bib')).toBeNull();
  });

  it('@ZM-161 der Kasten nennt das Leibchen für Screenreader (die Zeichen selbst sind dekorativ)', () => {
    zeige(kit({ a: ROT, b: GELB, bibSide: 'b' }), FARBEN);
    expect(gast()).toHaveAttribute('aria-label', expect.stringContaining('Leibchen'));
    expect(heim().getAttribute('aria-label')).not.toContain('Leibchen');
  });
});

describe('@ZM-195 Folie „Nächstes Spiel“: Kästen „0 : 0“ in Größe und Lage wie im Spiel', () => {
  const FARBEN = { 'team-nord': ROT, 'team-sued': ROT };

  it('@ZM-195 geplantes Spiel 7: Abzeichen „Nächstes Spiel“ links, zwei Kästen „0“ mit Doppelpunkt, Namen darunter, Anstoßzeit an der Stelle der Uhr', () => {
    zeige(geplant, FARBEN);
    expect(screen.getByTestId('live-badge')).toHaveTextContent('Nächstes Spiel');
    expect(screen.getByTestId('live-box-home-digits')).toHaveTextContent('0');
    expect(screen.getByTestId('live-box-away-digits')).toHaveTextContent('0');
    expect(screen.getByTestId('live-separator')).toHaveTextContent(':');
    expect(screen.getByTestId('live-name-home')).toHaveTextContent('FC Nord');
    expect(screen.getByTestId('live-name-away')).toHaveTextContent('SV Süd');
    const uhr = screen.getByTestId('monitor-clock');
    expect(uhr).toHaveTextContent('14:00');
    expect(screen.getByTestId('live-lower')).toContainElement(uhr); // im selben Bereich wie die Uhr des laufenden Spiels
    expect(screen.getByTestId('kickoff-time')).toHaveAttribute('data-monitor', 'uhr');
  });

  it('@ZM-195 dieselbe Rasterzelle wie im Spiel: Kastenzellen, Raster und unterer Bereich haben dieselben Maße wie bei laufendem Spiel', () => {
    const maße = () => ['live-grid', 'live-block-home', 'live-block-away', 'live-lower'].map((id) => screen.getByTestId(id).style.cssText);
    const { unmount } = zeige(geplant, FARBEN);
    const vor = maße();
    unmount();
    zeige({}, FARBEN);
    expect(maße()).toEqual(vor);
  });

  it('@ZM-159 Entscheidung 1b: gleiche Trikotfarbe ohne Leibchen – der Gast weicht schon vor dem Anpfiff auf die Standardfarbe Heim (Blau) aus', () => {
    zeige({ ...geplant, ...kit({ a: ROT, b: ROT }) }, FARBEN);
    expect(heim()).toHaveAttribute('data-color', ROT);
    expect(gast()).toHaveAttribute('data-color', BLAU);
    expect(gast()).toHaveAttribute('data-fill', 'solid');
    expect(screen.queryByTestId('live-box-away-bib')).toBeNull();
  });

  it('@ZM-159 Entscheidung 1b, derselbe Fall vorher und nachher: Rot gegen Rot ohne Leibchen zeigt vor dem Anpfiff dieselben Farben wie im laufenden Spiel (kein Springen beim Anpfiff)', () => {
    const farben = () => [heim().getAttribute('data-color'), gast().getAttribute('data-color'), gast().getAttribute('data-fill')];
    const { unmount } = zeige({ ...geplant, ...kit({ a: ROT, b: ROT }) }, FARBEN);
    const vor = farben();
    unmount();
    zeige({ ...kit({ a: ROT, b: ROT }), liveState: UHR }, FARBEN);
    expect(farben()).toEqual(vor);
    expect(vor).toEqual([ROT, BLAU, 'solid']);
  });

  it('@ZM-159 Gegenbeispiel: verschiedene Farben vor dem Anpfiff – jede Seite trägt ihre Trikotfarbe', () => {
    zeige(geplant, { 'team-nord': ROT, 'team-sued': GRUEN });
    expect(heim()).toHaveAttribute('data-color', ROT);
    expect(gast()).toHaveAttribute('data-color', GRUEN);
  });

  // Die Weste vor dem Anpfiff (@SL-201, @ZM-195 „festgelegtes Leibchen“) kommt mit Schritt 2: `wornColors` nimmt vor dem Anpfiff die Trikotfarben, nicht die
  // beim Festlegen gewählte Leibchenfarbe. Bis dahin bleibt dieser Test rot (Befund), die Folie zeigt die Trikot- bzw. Ausweichfarbe.
  it.fails('C-LEIBCHEN-VOR-ANPFIFF-SCHRITT2 @ZM-195 @ZM-161 ein festgelegtes Leibchen (Server kennt es) erscheint vor dem Anpfiff als Weste mit Zeichen (Schritt 2)', () => {
    zeige({ ...geplant, ...kit({ a: ROT, b: GELB, bibSide: 'b' }) }, FARBEN);
    expect(gast()).toHaveAttribute('data-fill', 'vest');
    expect(gast()).toHaveAttribute('data-color', GELB);
    expect(gast()).toHaveAttribute('data-stripes', ROT);
    expect(screen.getByTestId('live-box-away-bib')).toBeInTheDocument();
  });

  it('@ZM-195 Gegenbeispiel: ohne festgelegtes Leibchen kein Zeichen und keine Form vor dem Anpfiff', () => {
    zeige(geplant, FARBEN);
    expect(screen.queryByTestId('live-box-away-bib')).toBeNull();
    expect(teile(gast())).toHaveLength(0);
  });

  it('@ZM-195 Gegenbeispiel: läuft ein Spiel auf dem Feld, steht keine Anstoßzeit da, sondern die Uhr', () => {
    zeige({ liveState: UHR });
    expect(screen.queryByTestId('monitor-kickoff')).toBeNull();
    expect(screen.getByTestId('live-badge')).not.toHaveTextContent('Nächstes Spiel');
  });
});
