/**
 * Profil „Halle (sehr fern)“, Live-Folie in der Anordnung „Farbseiten“ (Hallentest 17.11.2026, Bildschirm 86 × 49 cm, Leseabstand rund 22 m).
 * Aus dem Gherkin: @ZM-212 (nur die Live-Folie, andere Profile unverändert), @ZM-213 (Anordnung und Mindestgrößen als Anteil der Höhe der Folienfläche),
 * @ZM-214 (Zustände: vor dem Anpfiff, angehalten, Halbzeit, Ende, Strafstoß-Ergebnis, helle Trikots, Leibchen, kein Logo), @ZM-151 (Flächen, Namen
 * und Torzahlen in jedem Zustand an derselben Stelle). Spiel 7 „FC Nord – SV Süd“ steht auf Feld 1; Farben kommen aus den Trikots bzw. `match.kit`.
 * Layout-Pixel misst die Playwright-Aufnahme (jsdom hat keine Geometrie); hier gelten die Zusicherungen an Bauteile, Texte, Farben und Tokens.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LiveSlide } from '../slides/LiveSlide';
import { ZeitBalken } from '../../../components/ui/atoms/ZeitBalken';
import type { MonitorProfile, PerformanceSettings } from '../../../types/monitor';
import type { Match, Tournament } from '../../../types/tournament';
import { NowSourceContext } from '../../../components/schedule/useTickingNow';
import { displayHall, monitorThemes } from '../../../design-tokens';
import { getContrastRatio } from '../../../design-tokens/display';
import { palette } from '../../../design-tokens/colors/palette';
import { FALLBACK_PATTERN } from '../../../core/models/scoreBoxColors';
import { buildTournament, FIXTURE_TEAMS, slide, withMatch } from './monitorFixture';
import { withView } from './monitorViewHelper';

vi.unmock('i18next');
vi.unmock('react-i18next');
import i18n from 'i18next';
import { initRealDeI18n } from '../../../test/realDeI18n';
import enMonitor from '../../../i18n/locales/en/monitor.json';
import enSport from '../../../i18n/locales/en/sport.json';
import enShort from '../../../i18n/locales/en/short.json';
import enTournament from '../../../i18n/locales/en/tournament.json';
await initRealDeI18n();

const performanceSettings = {} as PerformanceSettings;
const HALLE: MonitorProfile = 'hall-very-far';
const T0 = Date.UTC(2026, 10, 28, 14, 0, 0);
const BLAU = palette.kit.blue;
const GELB = palette.yellow[400];
const WEISS = palette.neutral[0];

/** Laufende Uhr: 250 s gespielt in einem Abschnitt von 600 s, Restzeit 5:50 (wie im Mockup). */
const LAEUFT = { status: 'running', phase: 'regular', section: 1, sections: 1, sectionSeconds: 600, sectionStartMs: 0, elapsedMs: 250_000, anchorAt: T0 };
const ANGEHALTEN = { ...LAEUFT, status: 'paused', anchorAt: null };
const HALBZEIT = { status: 'section_break', phase: 'regular', section: 1, sections: 2, sectionSeconds: 300, sectionStartMs: 0, elapsedMs: 300_000, anchorAt: null, breakStartedAt: T0 - 20_000, breakSeconds: 60 };
const geplant: Partial<Match> = { matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined, scheduledTime: new Date('2026-10-10T14:00:00') };

interface Zeige { patch?: Partial<Match>; farben?: Record<string, string | undefined>; namen?: Record<string, string>; ohneErgebnis?: boolean; profil?: MonitorProfile | null; feld?: string; pinned?: string; turnier?: Partial<Tournament> }

/** Live-Folie des Felds im Profil (Vorgabe „Halle (sehr fern)“); `patch` ändert Spiel 7, `farben` die Trikotfarben, `namen` die Teamnamen. */
function zeige({ patch = {}, farben = {}, namen = {}, ohneErgebnis = false, profil = HALLE, feld = 'field-1', pinned, turnier = {} }: Zeige = {}) {
  const teams = FIXTURE_TEAMS.map((t) => ({ ...t, name: namen[t.id] ?? t.name, ...(farben[t.id] === undefined ? {} : { colors: { primary: farben[t.id]! } }) }));
  const tournament = buildTournament({ teams, matches: withMatch('match-7', patch), hideScoresForPublic: ohneErgebnis, numberOfGroups: 2, groupSystem: 'groupsAndFinals', ...turnier });
  return render(
    <NowSourceContext.Provider value={() => T0}>
      <LiveSlide slide={slide('live', { fieldId: feld })} {...withView(tournament)} performanceSettings={performanceSettings} theme="dark" style={{}} pinnedMatchId={pinned} profile={profil ?? undefined} />
    </NowSourceContext.Provider>,
  );
}

const laeuft = (stand: [number, number] = [1, 0]): Partial<Match> => ({ scoreA: stand[0], scoreB: stand[1], liveState: LAEUFT });
const panel = (seite: 'home' | 'away') => screen.getByTestId(`hall-panel-${seite}`);
const ziffer = (seite: 'home' | 'away') => screen.getByTestId(`hall-digits-${seite}`);
const rgb = (c: string): string => `#${(c.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
const kontrast = (seite: 'home' | 'away'): number => getContrastRatio(rgb(panel(seite).style.backgroundColor), rgb(panel(seite).style.color));
const cqh = (wert: string): number => parseFloat(wert.replace('cqh', ''));

describe('@ZM-212 Profil „Halle (sehr fern)“: die Live-Folie in der Anordnung „Farbseiten“', () => {
  it('zeigt die Live-Folie als Farbseiten: zwei Flächen, darin Name oben und Torzahl darunter, kein Kopf', () => {
    zeige({ patch: laeuft() });
    expect(screen.getByTestId('hall-display')).toBeInTheDocument();
    for (const seite of ['home', 'away'] as const) {
      const name = within(panel(seite)).getByTestId(`hall-teamname-${seite}`);
      // Name steht über der Torzahl (Reihenfolge im Dokument und im Aufbau der Fläche)
      expect(name.compareDocumentPosition(ziffer(seite)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByTestId('hall-teamname-home')).toHaveTextContent('FC Nord');
    expect(screen.getByTestId('hall-teamname-away')).toHaveTextContent('SV Süd');
    expect(ziffer('home')).toHaveTextContent('1');
    expect(ziffer('away')).toHaveTextContent('0');
    expect(screen.queryByTestId('live-header')).toBeNull(); // eine Kopfzeile gibt es nicht
  });

  it('Gegenbeispiel: ohne Profil (bisherige Darstellung) bleibt die Folie unverändert: Kopfzeile und Kästen, keine Farbseiten', () => {
    zeige({ patch: laeuft(), profil: null });
    expect(screen.queryByTestId('hall-display')).toBeNull();
    expect(screen.getByTestId('live-header')).toBeInTheDocument();
    expect(screen.getByTestId('live-box-home')).toBeInTheDocument();
  });

  it('Läuft auf dem Feld kein Spiel mehr, steht der Satz „Auf Feld 1 folgt heute kein Spiel mehr“ (nicht „Kein Spiel geplant“)', () => {
    // Feld 2 mit allen Spielen beendet: kein laufendes, kein nächstes Spiel
    const alleBeendet = buildTournament({ matches: withMatch('match-8', { matchStatus: 'finished', scoreA: 1, scoreB: 0 }) });
    render(
      <NowSourceContext.Provider value={() => T0}>
        <LiveSlide slide={slide('live', { fieldId: 'field-2', whenIdle: { type: 'skip' } })} {...withView(alleBeendet)} performanceSettings={performanceSettings} theme="dark" style={{}} profile={HALLE} />
      </NowSourceContext.Provider>,
    );
    expect(screen.getByTestId('hall-no-match')).toHaveTextContent('Auf Feld 2 folgt heute kein Spiel mehr');
    expect(screen.queryByText(/Kein Spiel geplant/)).toBeNull();
    expect(screen.queryByText(/Warte auf nächstes Spiel/)).toBeNull(); // „Überspringen“ der Live-Folie gilt hier nicht
  });
});

describe('@ZM-213 Anordnung und Mindestgrößen (Anteil der Höhe der Folienfläche innerhalb des Bildrands)', () => {
  it('Torzahlen mindestens 34 %, Restzeit mindestens 26 %, Flächen die oberen 64,5 % (seit @ZM-215), Namen bis 22,5 % (kurze Namen mindestens 20 %)', () => {
    zeige({ patch: laeuft() });
    expect(cqh(displayHall.digit.font)).toBeGreaterThanOrEqual(34);
    expect(cqh(displayHall.clock.font)).toBeGreaterThanOrEqual(26);
    expect(cqh(displayHall.name.maxFont)).toBeGreaterThanOrEqual(20);
    expect(cqh(displayHall.panel.height)).toBe(64.5);
    // die Bauteile tragen genau diese Werte (nicht nur die Tokens)
    expect(ziffer('home').style.fontSize).toBe(displayHall.digit.font);
    expect(screen.getByTestId('hall-clock').parentElement?.style.fontSize).toBe(displayHall.clock.font);
    expect(screen.getByTestId('hall-panels').parentElement?.style.gridTemplateRows).toContain(displayHall.panel.height);
  });

  it('Torzahl: markiert als Stand (Messwerkzeug), Restzeit als Uhr, Feld und Gruppe als Nah-Information – Nah-Angaben mindestens 7,08 % hoch', () => {
    zeige({ patch: laeuft() });
    expect(ziffer('home')).toHaveAttribute('data-monitor', 'stand');
    expect(screen.getByTestId('hall-clock')).toHaveAttribute('data-monitor', 'uhr');
    expect(screen.getByTestId('hall-side-left')).toHaveAttribute('data-monitor', 'nah');
    expect(screen.getByTestId('hall-side-right')).toHaveAttribute('data-monitor', 'nah');
    expect(cqh(displayHall.side.font)).toBeGreaterThanOrEqual(7.08);
    expect(screen.getByTestId('hall-teamname-home')).toHaveAttribute('data-teamname');
  });

  it('Live-Abzeichen, Feld und Gruppe stehen klein links und rechts neben der Restzeit (Restzeit 5:50, Gruppe A, Feld 1)', () => {
    zeige({ patch: laeuft() });
    expect(screen.getByTestId('hall-clock')).toHaveTextContent('5:50');
    expect(within(screen.getByTestId('hall-side-left')).getByText('Live')).toBeInTheDocument();
    expect(screen.getByTestId('hall-field')).toHaveTextContent('Feld 1');
    expect(screen.getByTestId('hall-group')).toHaveTextContent('Gruppe A');
  });

  it('Der Zeitbalken läuft über die ganze Breite (außerhalb des Bands) und nimmt ab; nie Rot', () => {
    zeige({ patch: laeuft() });
    const balken = screen.getByTestId('hall-zeitbalken');
    expect(balken).toHaveAttribute('data-ton', 'gruen');
    expect(Number(balken.getAttribute('data-anteil'))).toBeCloseTo(350 / 600, 2);
    expect(screen.getByTestId('hall-bar-row')).toContainElement(balken);
    expect(screen.getByTestId('hall-band')).not.toContainElement(balken);
  });

  it('Beide Namen sind gleich groß; Umbruch nur an Leerzeichen oder nach „/“ (kein Umbruch im Bindestrich-Wort)', () => {
    zeige({ patch: laeuft(), namen: { 'team-nord': 'TSV Rot-Weiß Fridolfing', 'team-sued': 'SG Taching/Tengling' } });
    const heim = screen.getByTestId('hall-teamname-home');
    const gast = screen.getByTestId('hall-teamname-away');
    expect(heim.style.fontSize).toBe(gast.style.fontSize);
    expect(gast.innerHTML).toContain('<wbr>'); // Umbruchstelle nach dem Schrägstrich
    expect(gast.textContent).toBe('SG Taching/Tengling'); // der Text bleibt unverändert
    expect(heim.querySelector('span')?.textContent).toBe('Rot-Weiß'); // Bindestrich-Wort steht für sich
    expect(heim.querySelector('span')?.style.whiteSpace).toBe('nowrap');
    expect(heim.style.whiteSpace).toBe('normal'); // sonst nur Umbruch an Leerzeichen
  });

  it('Namen über 25 Zeichen: Kürzung nach der Liste der Vereinswörter (Monitor-Form), der Rest bleibt voll und wird eingepasst', () => {
    zeige({ patch: laeuft(), namen: { 'team-nord': 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921', 'team-sued': 'Verein Hinterwald Oberdorf Unterdorf Süd' } });
    expect(screen.getByTestId('hall-teamname-home')).toHaveTextContent('SG FF Nordheim-Süd 1921');
    expect(screen.getByTestId('hall-teamname-away')).toHaveTextContent('Verein Hinterwald Oberdorf Unterdorf Süd'); // nie „…“ und nie selbst gebildete Kürzel
    expect(screen.getByTestId('hall-teamname-away').textContent).not.toContain('…');
  });

  it('Zweistelliger Stand 10 : 12 steht in denselben Flächen an derselben Stelle wie 1 : 0', () => {
    const einstellig = zeige({ patch: laeuft([1, 0]) });
    const stil = (el: HTMLElement) => el.getAttribute('style');
    const vorher = { ziffer: stil(ziffer('home')), name: stil(screen.getByTestId('hall-name-home')), flaeche: panel('home').style.borderWidth };
    einstellig.unmount();
    zeige({ patch: laeuft([10, 12]) });
    expect(ziffer('home')).toHaveTextContent('10');
    expect(ziffer('away')).toHaveTextContent('12');
    expect({ ziffer: stil(ziffer('home')), name: stil(screen.getByTestId('hall-name-home')), flaeche: panel('home').style.borderWidth }).toEqual(vorher);
  });
});

describe('@ZM-214 Zustände ohne Sprung', () => {
  it('Vor dem Anpfiff: statt der Restzeit die Anstoßzeit, daneben „Nächstes Spiel“, Torzahlen 0 und 0, kein Zeitbalken', () => {
    zeige({ feld: 'field-2' });
    expect(screen.getByTestId('hall-kickoff')).toHaveTextContent('14:20');
    expect(within(screen.getByTestId('hall-side-left')).getByText('Nächstes Spiel')).toBeInTheDocument();
    expect(ziffer('home')).toHaveTextContent('0');
    expect(ziffer('away')).toHaveTextContent('0');
    expect(screen.queryByTestId('hall-zeitbalken')).toBeNull();
    expect(screen.queryByTestId('hall-clock')).toBeNull();
  });

  it('Uhr angehalten: neben der Restzeit „angehalten“, der Zeitbalken ist grau – die Restzeit bleibt weiß (nicht grau)', () => {
    zeige({ patch: { scoreA: 1, scoreB: 0, liveState: ANGEHALTEN, matchStatus: 'paused' } });
    expect(screen.getByTestId('hall-phase-text')).toHaveTextContent('angehalten');
    expect(screen.getByTestId('hall-zeitbalken')).toHaveAttribute('data-ton', 'grau');
    expect(screen.getByTestId('hall-clock')).toHaveTextContent('5:50');
    const slot = screen.getByTestId('hall-slot');
    expect(slot.style.color).toBe(rgbVon(monitorThemes.dark.timerNormal)); // dieselbe Farbe wie laufend
  });

  it('Gegenbeispiel: läuft die Uhr, steht kein Wort daneben (@ZM-215: auch kein „Restzeit“) und der Balken ist grün', () => {
    zeige({ patch: laeuft() });
    expect(screen.queryByTestId('hall-phase-text')).toBeNull();
    expect(screen.queryByText('Restzeit')).toBeNull();
    expect(screen.getByTestId('hall-zeitbalken')).toHaveAttribute('data-ton', 'gruen');
  });

  it('Halbzeitpause: die Pausenzeit steht an der Stelle der Restzeit, daneben „Pause“ (Abzeichen „Halbzeit“)', () => {
    zeige({ patch: { scoreA: 1, scoreB: 0, liveState: HALBZEIT } });
    expect(screen.getByTestId('hall-clock')).toHaveTextContent('0:40');
    expect(screen.getByTestId('hall-phase-text')).toHaveTextContent(/^Pause$/);
    expect(within(screen.getByTestId('hall-side-left')).getByText('Halbzeit')).toBeInTheDocument();
  });

  it('Ende 2 : 1: an der Stelle der Restzeit „Endstand“, kein Zeitbalken, keine Uhr; Sieger mit Ring, Verlierer gedämpft', () => {
    zeige({ patch: { matchStatus: 'finished', scoreA: 2, scoreB: 1, decidedBy: 'regular', liveState: undefined }, pinned: 'match-7' });
    expect(screen.getByTestId('hall-endstand')).toHaveTextContent('Endstand');
    expect(screen.queryByTestId('hall-zeitbalken')).toBeNull();
    expect(screen.queryByTestId('hall-clock')).toBeNull();
    expect(panel('home')).toHaveAttribute('data-outcome', 'winner');
    expect(panel('away')).toHaveAttribute('data-outcome', 'loser');
    expect(panel('home').style.boxShadow).toContain(displayHall.panel.ringWidth);
    expect(panel('away').style.boxShadow).toBe('');
    expect(panel('away').style.backgroundColor).not.toBe(panel('home').style.backgroundColor);
  });

  it('Gegenbeispiel: Unentschieden in der Gruppe hat weder Ring noch gedämpfte Fläche', () => {
    zeige({ patch: { matchStatus: 'finished', scoreA: 1, scoreB: 1, decidedBy: 'regular', liveState: undefined }, pinned: 'match-7' });
    expect(screen.getByTestId('hall-endstand')).toBeInTheDocument();
    expect(panel('home')).not.toHaveAttribute('data-outcome');
    expect(panel('away')).not.toHaveAttribute('data-outcome');
  });

  it('Strafstoßergebnis: die Torzahlen zeigen 1 und 1, an der Stelle der Restzeit „4 : 3 i. E.“', () => {
    zeige({ patch: { matchStatus: 'finished', scoreA: 1, scoreB: 1, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty', liveState: undefined }, pinned: 'match-7' });
    expect(ziffer('home')).toHaveTextContent('1');
    expect(ziffer('away')).toHaveTextContent('1');
    expect(screen.getByTestId('hall-shootout-result')).toHaveTextContent('4 : 3 i. E.');
    expect(screen.queryByTestId('hall-endstand')).toBeNull();
  });

  it('Gegenbeispiel: nach regulärer Zeit steht kein „i. E.“', () => {
    zeige({ patch: { matchStatus: 'finished', scoreA: 2, scoreB: 1, decidedBy: 'regular', liveState: undefined }, pinned: 'match-7' });
    expect(screen.queryByText(/i\. E\./)).toBeNull();
  });

  it.each([[WEISS, 'Weiß'], [GELB, 'Gelb']])('Ein Team in %s: Name und Torzahl dunkel, Kontrast zur Fläche mindestens 4,5 : 1 (%s)', (farbe, _name) => {
    zeige({ patch: { ...laeuft(), kit: { a: farbe, b: BLAU } } });
    expect(panel('home').style.color).toBe('rgb(0, 0, 0)');
    expect(kontrast('home')).toBeGreaterThanOrEqual(4.5);
    // Gegenbeispiel: die dunkle Fläche behält weiße Schrift
    expect(panel('away').style.color).toBe('rgb(255, 255, 255)');
    expect(kontrast('away')).toBeGreaterThanOrEqual(4.5);
  });

  it('Leibchen bestätigt: die Fläche hat die Leibchenfarbe, das Leibchen-Zeichen steht klein in der oberen Ecke – nur bei diesem Team', () => {
    zeige({ patch: { ...laeuft(), kit: { a: '#EF6C00', b: palette.kit.red, bibSide: 'a' }, kitDecision: 'bib' }, farben: { 'team-nord': BLAU, 'team-sued': palette.kit.red } });
    expect(panel('home')).toHaveAttribute('data-fill', 'vest');
    expect(panel('home').style.backgroundColor).toBe('rgb(239, 108, 0)');
    expect(screen.getByTestId('hall-bib-home')).toBeInTheDocument();
    expect(screen.queryByTestId('hall-bib-away')).toBeNull();
    expect(kontrast('home')).toBeGreaterThanOrEqual(4.5);
  });

  it('Team ohne Trikotfarbe: Fallback-Streifenmuster (@ZM-203), Schrift weiß mit mindestens 4,5 : 1', () => {
    zeige({ patch: { ...laeuft(), kit: { b: BLAU } } });
    expect(panel('home')).toHaveAttribute('data-fill', 'striped');
    // das Muster selbst (Hintergrundbild in cq-Einheiten) kennt jsdom nicht; die Schrift muss auf BEIDEN Grautönen mindestens 4,5 : 1 halten
    expect(panel('home').style.color).toBe('rgb(255, 255, 255)');
    expect(getContrastRatio(FALLBACK_PATTERN.light, WEISS)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(FALLBACK_PATTERN.dark, WEISS)).toBeGreaterThanOrEqual(4.5);
    expect(panel('away')).toHaveAttribute('data-fill', 'solid');
    expect(panel('away').style.backgroundImage).toBe('');
  });

  it('Ein Team mit Logo: die Folie zeigt das Logo nicht (kein Bild, kein Kreis in der Fläche)', () => {
    const teams = FIXTURE_TEAMS.map((t) => (t.id === 'team-nord' ? { ...t, logo: { type: 'url' as const, value: 'https://logo.example/nord.png' } } : t));
    const tournament = buildTournament({ teams, matches: withMatch('match-7', laeuft()) });
    const { container } = render(
      <NowSourceContext.Provider value={() => T0}>
        <LiveSlide slide={slide('live', { fieldId: 'field-1' })} {...withView(tournament)} performanceSettings={performanceSettings} theme="dark" style={{}} profile={HALLE} />
      </NowSourceContext.Provider>,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-testid*="logo"]')).toBeNull();
  });

  it('Kindermodus (nicht festgelegt): keine Torzahlen und kein Doppelpunkt, Flächen und Namen bleiben an ihrer Stelle', () => {
    zeige({ patch: laeuft(), ohneErgebnis: true });
    expect(screen.queryByTestId('hall-digits-home')).toBeNull();
    expect(screen.queryByTestId('hall-separator')).toBeNull();
    expect(screen.getByTestId('hall-teamname-home')).toHaveTextContent('FC Nord');
    expect(screen.getByTestId('hall-name-home').getAttribute('style')).toContain(displayHall.name.top);
  });

  it('@ZM-151 Flächen, Namenfeld und Torzahl liegen im Spiel, vor dem Anpfiff und nach dem Ende gleich', () => {
    const lage = (el: HTMLElement) => el.getAttribute('style');
    const messe = () => ({ name: lage(screen.getByTestId('hall-name-home')), ziffer: lage(ziffer('home')), reihe: lage(screen.getByTestId('hall-panels')), balkenzeile: lage(screen.getByTestId('hall-bar-row')) });
    const lauf = zeige({ patch: laeuft() });
    const imSpiel = messe();
    lauf.unmount();
    const ende = zeige({ patch: { matchStatus: 'finished', scoreA: 2, scoreB: 1, decidedBy: 'regular', liveState: undefined }, pinned: 'match-7' });
    expect(messe()).toEqual(imSpiel);
    ende.unmount();
    zeige({ feld: 'field-1', patch: geplant });
    expect(messe()).toEqual(imSpiel);
  });
});

const ZWEI_ABSCHNITTE = { ...LAEUFT, section: 2, sections: 2, sectionSeconds: 300, elapsedMs: 100_000 };
const NUR_FELD_1 = { fields: [{ id: 'field-1', defaultName: 'Feld 1' }] as Tournament['fields'], numberOfFields: 1 };
const EINE_GRUPPE = { groups: [{ id: 'A', customName: 'Gruppe A' }] as Tournament['groups'], numberOfGroups: 1 };

describe('@ZM-215 Die Live-Sicht zeigt nur, was man aus der Ferne braucht, und die Zeit so groß wie möglich (Profil „Halle (sehr fern)“)', () => {
  it('Die Zahl „6:00“ steht für sich: kein Wort „Restzeit“ (9 Minuten Spielzeit, 3 gespielt)', () => {
    zeige({ patch: { scoreA: 1, scoreB: 0, liveState: { ...LAEUFT, sectionSeconds: 540, elapsedMs: 180_000 } } });
    expect(screen.getByTestId('hall-clock')).toHaveTextContent('6:00');
    expect(screen.queryByText(/Restzeit/)).toBeNull();
    expect(screen.queryByTestId('hall-phase-text')).toBeNull();
  });

  it.each([
    ['angehalten', { patch: { scoreA: 1, scoreB: 0, liveState: ANGEHALTEN, matchStatus: 'paused' as const } }, 'angehalten'],
    ['Pause', { patch: { scoreA: 1, scoreB: 0, liveState: HALBZEIT } }, 'Pause'],
  ])('Ein Wort steht nur bei Abweichung vom laufenden Spiel: %s', (_n, eingabe, wort) => {
    zeige(eingabe);
    expect(screen.getByTestId('hall-phase-text')).toHaveTextContent(new RegExp(`^${wort}$`));
  });

  it('Feld und Gruppe stehen bei mehr als einem Feld und mehr als einer Gruppe', () => {
    zeige({ patch: laeuft() });
    expect(screen.getByTestId('hall-field')).toHaveTextContent('Feld 1');
    expect(screen.getByTestId('hall-group')).toHaveTextContent('Gruppe A');
  });

  it('Gegenbeispiel: bei einem Feld steht kein Feld, bei einer Gruppe keine Gruppe', () => {
    zeige({ patch: laeuft(), turnier: { ...NUR_FELD_1, ...EINE_GRUPPE } });
    expect(screen.queryByTestId('hall-field')).toBeNull();
    expect(screen.queryByTestId('hall-group')).toBeNull();
    expect(screen.getByTestId('hall-clock')).toHaveTextContent('5:50');
  });

  it('Gegenbeispiel: zwei Felder, aber eine Gruppe – nur das Feld steht da', () => {
    zeige({ patch: laeuft(), turnier: EINE_GRUPPE });
    expect(screen.getByTestId('hall-field')).toBeInTheDocument();
    expect(screen.queryByTestId('hall-group')).toBeNull();
  });

  it('Der frei gewordene Platz geht an Restzeit und Zeitbalken, die Torzahlen werden nicht kleiner (Tokens)', () => {
    expect(cqh(displayHall.clock.font)).toBeGreaterThan(29.3);
    expect(cqh(displayHall.bar.height)).toBeGreaterThanOrEqual(6);
    expect(cqh(displayHall.digit.font)).toBeGreaterThanOrEqual(34);
    zeige({ patch: laeuft() });
    expect(screen.getByTestId('hall-zeitbalken').style.height).toBe(displayHall.bar.height);
  });

  it('Der Zeitbalken läuft wie die Restzeit herunter: nach 3 von 9 Minuten sind zwei Drittel gefüllt, grün', () => {
    zeige({ patch: { scoreA: 1, scoreB: 0, liveState: { ...LAEUFT, sectionSeconds: 540, elapsedMs: 180_000 } } });
    const balken = screen.getByTestId('hall-zeitbalken');
    expect(Number(balken.getAttribute('data-anteil'))).toBeCloseTo(2 / 3, 2);
    expect(balken).toHaveAttribute('data-ton', 'gruen');
    expect((balken.firstElementChild as HTMLElement).style.width).toBe('66.67%'); // links verankert, die abgelaufene Strecke bleibt als Bahn
  });

  it('Die abgelaufene Strecke ist eine gefüllte Bahn in der Farbe des Tokens (dunkles Thema); die Bahn des Bestands bleibt wie sie war', () => {
    zeige({ patch: { scoreA: 1, scoreB: 0, liveState: ANGEHALTEN, matchStatus: 'paused' } });
    const balken = screen.getByTestId('hall-zeitbalken');
    expect(balken.style.background).toBe(rgbVon(displayHall.barColors.dark.track));
    expect((balken.firstElementChild as HTMLElement).style.background).toBe(rgbVon(displayHall.barColors.dark.grau));
    expect(balken.style.borderStyle).toBe('');
    const bestand = render(<ZeitBalken anteil={0.5} ton="gruen" testId="bestand-balken" />);
    expect(bestand.getByTestId('bestand-balken').style.borderStyle).toBe('');
    expect((bestand.getByTestId('bestand-balken').firstElementChild as HTMLElement).style.background).toBe('var(--color-scoreboard-ok)');
  });

  it('Bahn und Füllung heben sich in beiden Themen ab: Füllung gegen Bahn mindestens 3 : 1, Bahn gegen Hintergrund (dunkel 2,5 : 1, hell 2,0 : 1); Schlussphase und angehalten sind verschieden', () => {
    const hintergruende = { dark: ['#1E293B', '#0F172A'], light: ['#FFFFFF', '#E2E8F0'] } as const;
    const mindestBahn = { dark: 2.5, light: 2.0 } as const;
    for (const thema of ['dark', 'light'] as const) {
      const farben = displayHall.barColors[thema];
      for (const hintergrund of hintergruende[thema]) { expect(getContrastRatio(farben.track, hintergrund), `${thema}: Bahn gegen ${hintergrund}`).toBeGreaterThanOrEqual(mindestBahn[thema]); }
      for (const ton of ['gruen', 'grau', 'violett', 'gedaempft'] as const) { expect(getContrastRatio(farben[ton], farben.track), `${thema}: ${ton} gegen Bahn`).toBeGreaterThanOrEqual(3); }
      // helles Thema: die Füllung ist der kräftige Teil (dunkler als die Bahn), dunkles Thema: heller als die Bahn
      for (const ton of ['gruen', 'grau', 'violett', 'gedaempft'] as const) { expect(getContrastRatio(farben[ton], hintergruende[thema][0]) >= getContrastRatio(farben.track, hintergruende[thema][0]) * (thema === 'light' ? 1 : 0), `${thema}: ${ton} kräftig`).toBe(true); }
    }
    // dunkel: Violett ist das Violett der Uhr in der Schlussphase und von „angehalten“ (hell, kaum gesättigt) und der Pause (gedämpft) zu unterscheiden
    expect(displayHall.barColors.dark.violett).toBe(palette.purple[300]);
    expect(getContrastRatio(displayHall.barColors.dark.violett, displayHall.barColors.dark.grau)).toBeGreaterThanOrEqual(1.5);
    expect(getContrastRatio(displayHall.barColors.dark.gedaempft, displayHall.barColors.dark.grau)).toBeGreaterThanOrEqual(1.3);
  });

  it('Gegenbeispiel: angehalten wird der Balken grau, nie rot', () => {
    zeige({ patch: { scoreA: 1, scoreB: 0, liveState: ANGEHALTEN, matchStatus: 'paused' } });
    expect(screen.getByTestId('hall-zeitbalken')).toHaveAttribute('data-ton', 'grau');
  });

  it('Abschnitt (@ZM-213): bei zwei Abschnitten steht rechts neben der Restzeit „2. Halbzeit“, klein wie Feld und Gruppe', () => {
    zeige({ patch: { scoreA: 1, scoreB: 0, liveState: ZWEI_ABSCHNITTE } });
    expect(screen.getByTestId('hall-section')).toHaveTextContent('2. Halbzeit');
    expect(screen.getByTestId('hall-side-right')).toContainElement(screen.getByTestId('hall-section'));
    expect(screen.getByTestId('hall-clock')).toHaveTextContent('3:20');
  });

  it('Abschnitt: angehalten steht der Abschnitt zusätzlich zum Wort', () => {
    zeige({ patch: { scoreA: 1, scoreB: 0, liveState: { ...ZWEI_ABSCHNITTE, status: 'paused', anchorAt: null }, matchStatus: 'paused' } });
    expect(screen.getByTestId('hall-section')).toHaveTextContent('2. Halbzeit');
    expect(screen.getByTestId('hall-phase-text')).toHaveTextContent('angehalten');
  });

  it.each([['läuft', 'running', T0], ['angehalten', 'paused', null]] as const)('Gegenbeispiel: in der Verlängerung (%s) steht kein „2. Halbzeit“ und kein „Abschnitt 3 von 2“', (_n, status, anker) => {
    const verlaengerung = { ...ZWEI_ABSCHNITTE, phase: 'overtime', section: 3, sections: 2, overtimeSeconds: 300, sectionSeconds: 300, status, anchorAt: anker, elapsedMs: 60_000 };
    zeige({ patch: { scoreA: 1, scoreB: 1, liveState: verlaengerung, matchStatus: status } });
    expect(screen.getByTestId('hall-clock')).toBeInTheDocument();
    expect(screen.queryByTestId('hall-section')).toBeNull();
    expect(screen.queryByText(/Halbzeit|Abschnitt/)).toBeNull();
    // angehalten sagt das Abzeichen „Pause“: dann muss „Verlängerung“ rechts stehen; läuft sie, steht es im Abzeichen
    if (status === 'paused') { expect(screen.getByTestId('hall-overtime-text')).toHaveTextContent('Verlängerung'); } else { expect(screen.queryByTestId('hall-overtime-text')).toBeNull(); }
  });

  it('Gegenbeispiel: bei einem Abschnitt steht kein Abschnitt', () => {
    zeige({ patch: laeuft() });
    expect(screen.queryByTestId('hall-section')).toBeNull();
  });

  it('Gegenbeispiel: in der Halbzeitpause steht kein Abschnitt (das Abzeichen sagt „Halbzeit“)', () => {
    zeige({ patch: { scoreA: 1, scoreB: 0, liveState: HALBZEIT } });
    expect(screen.queryByTestId('hall-section')).toBeNull();
  });

  it('Bestandsschutz: ohne Profil bleibt der Zeitbalken der bisherigen Folie unverändert (Wort „Restzeit“, Höhe aus dem bisherigen Token)', () => {
    zeige({ patch: laeuft(), profil: null });
    expect(screen.getByTestId('live-header')).toBeInTheDocument();
    expect(screen.queryByTestId('hall-zeitbalken')).toBeNull();
    expect(screen.getByText('Restzeit')).toBeInTheDocument();
  });
});

describe('Texte des Uhrbands und Vorlesetext in Deutsch und Englisch (Sprachwerte, kein fester Text)', () => {
  const ende = { matchStatus: 'finished' as const, scoreA: 1, scoreB: 1, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' as const, liveState: undefined };

  it('Deutsch: Strafstoß-Ergebnis in der Kurzform des Glossars „i. E.“', () => {
    zeige({ patch: ende, pinned: 'match-7' });
    expect(screen.getByTestId('hall-shootout-result')).toHaveTextContent(/^4 : 3 i\. E\.$/);
  });

  describe('Englisch', () => {
    beforeAll(async () => {
      for (const [ns, res] of [['monitor', enMonitor], ['sport', enSport], ['short', enShort], ['tournament', enTournament]] as const) { i18n.addResourceBundle('en', ns, res, true, true); }
      await i18n.changeLanguage('en');
    });
    afterAll(async () => { await i18n.changeLanguage('de'); });

    it('Strafstoß-Ergebnis „4 : 3 on penalties“, Endstand „Final score“', () => {
      const lauf = zeige({ patch: ende, pinned: 'match-7' });
      expect(screen.getByTestId('hall-shootout-result')).toHaveTextContent('4 : 3 on penalties');
      lauf.unmount();
      zeige({ patch: { matchStatus: 'finished', scoreA: 2, scoreB: 1, decidedBy: 'regular', liveState: undefined }, pinned: 'match-7' });
      expect(screen.getByTestId('hall-endstand')).toHaveTextContent('Final score');
    });

    it('Abschnitt „2nd half“, angehalten „stopped“, Vorlesetext mit Teamname', () => {
      zeige({ patch: { scoreA: 1, scoreB: 0, liveState: { ...ZWEI_ABSCHNITTE, status: 'paused', anchorAt: null }, matchStatus: 'paused' } });
      expect(screen.getByTestId('hall-section')).toHaveTextContent('2nd half');
      expect(screen.getByTestId('hall-phase-text')).toHaveTextContent('stopped');
      expect(panel('home')).toHaveAttribute('aria-label', 'FC Nord: 1');
    });
  });

  it('Kindermodus nach dem Abschluss (@ZM-121): im Profil steht der Satz „Turnier beendet – danke fürs Mitspielen“, nicht „Endstand“ über Flächen ohne Torzahlen', () => {
    zeige({ patch: { matchStatus: 'finished', scoreA: 2, scoreB: 1, decidedBy: 'regular', liveState: undefined }, ohneErgebnis: true, turnier: { lifecycleStatus: 'finished' } });
    expect(screen.getByTestId('hall-ended-kids')).toHaveTextContent('Turnier beendet – danke fürs Mitspielen');
    expect(screen.queryByTestId('hall-endstand')).toBeNull();
    expect(screen.queryByTestId('hall-digits-home')).toBeNull();
  });

  it('Gegenbeispiel: Kindermodus während des Turniers zeigt das Spiel ohne Torzahlen, nicht den Satz; mit Ergebnissen nach dem Abschluss „Endstand“', () => {
    const lauf = zeige({ patch: laeuft(), ohneErgebnis: true });
    expect(screen.queryByTestId('hall-ended-kids')).toBeNull();
    expect(screen.getByTestId('hall-display')).toBeInTheDocument();
    lauf.unmount();
    zeige({ patch: { matchStatus: 'finished', scoreA: 2, scoreB: 1, decidedBy: 'regular', liveState: undefined }, turnier: { lifecycleStatus: 'finished' } });
    expect(screen.getByTestId('hall-endstand')).toHaveTextContent('Endstand');
    expect(screen.queryByTestId('hall-ended-kids')).toBeNull();
  });

  it('Abschluss, letztes Spiel nach Strafstoßschießen: „4 : 3 i. E.“ bleibt stehen (nur im Profil, ohne gepinntes Spiel)', () => {
    zeige({ patch: { matchStatus: 'finished', scoreA: 1, scoreB: 1, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty', liveState: undefined }, turnier: { lifecycleStatus: 'finished' } });
    expect(screen.getByTestId('hall-shootout-result')).toHaveTextContent('4 : 3 i. E.');
    expect(screen.getByTestId('hall-digits-home')).toHaveTextContent('1');
  });

  it('Vorlesetext: Teamname und Torzahl statt „Heim/Gast“', () => {
    zeige({ patch: laeuft() });
    expect(panel('home')).toHaveAttribute('aria-label', 'FC Nord: 1');
    expect(panel('away')).toHaveAttribute('aria-label', 'SV Süd: 0');
    expect(panel('home').getAttribute('aria-label')).not.toMatch(/Heim|Gast/);
  });

  it('Vorlesetext: ohne Trikotfarbe (Streifenmuster) steht „Trikotfarbe unbekannt“ dabei, Gegenbeispiel: mit Farbe nicht', () => {
    zeige({ patch: { ...laeuft(), kit: { b: BLAU } } });
    expect(panel('home').getAttribute('aria-label')).toContain('Trikotfarbe unbekannt');
    expect(panel('away').getAttribute('aria-label')).not.toContain('Trikotfarbe unbekannt');
  });
});

function rgbVon(hex: string): string {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}
