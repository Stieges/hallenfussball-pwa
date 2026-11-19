/**
 * @ZM-215 Die Live-Folie der Monitore ohne Profil („Spielfeld (fern)“) zeigt nur, was man aus der Ferne braucht, und die Zeit so groß wie möglich.
 * Aus dem Gherkin (Stand Daniel 2026-11-19: Symbole statt Text, jede Angabe nur an einer Stelle): kein Wort „Restzeit“; ein Symbol an der Uhr nur bei Abweichung (Pause-Symbol, halber Kreis, Pfeife,
 * Kreis mit Plus; jedes mit dem bisherigen Wort als zugänglichem Namen, nie ein Wort als Text); das Abzeichen oben links bleibt dabei „Live“; Abschnitt als Punkte nur bei mehr als einem Abschnitt;
 * Feld (Spielfeld-Symbol mit Nummer) nur bei mehr als einem Feld, Gruppe (Buchstabe im Kasten) nur bei mehr als einer Gruppe;
 * der Zeitbalken (Beispiel „Spielfeld (fern)“: 5 %) läuft wie die Restzeit herunter, die abgelaufene Strecke bleibt als Bahn sichtbar, angehalten grau,
 * Schlussphase violett, nie rot. Spiel 3 hat 9 Minuten, 3 sind gespielt (Restzeit „6:00“). Layout-Pixel misst die Playwright-Spec
 * (`monitor-live-sichten-zm215.spec.ts`, jsdom hat keine Geometrie); hier gelten die Zusicherungen an Bauteile, Texte, Farben und Tokens.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LiveSlide } from '../slides/LiveSlide';
import type { PerformanceSettings } from '../../../types/monitor';
import type { Match, Tournament } from '../../../types/tournament';
import { NowSourceContext } from '../../../components/schedule/useTickingNow';
import { displayBar, displayLayout } from '../../../design-tokens';
import { buildTournament, slide, withMatch } from './monitorFixture';
import { withView } from './monitorViewHelper';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

const performanceSettings = {} as PerformanceSettings;
const T0 = Date.UTC(2026, 10, 28, 14, 0, 0);

/** Neun Minuten, drei gespielt: Restzeit 6:00, der Balken ist zu zwei Dritteln gefüllt. */
const LAEUFT = { status: 'running', phase: 'regular', section: 1, sections: 1, sectionSeconds: 540, sectionStartMs: 0, elapsedMs: 180_000, anchorAt: T0 };
const ANGEHALTEN = { ...LAEUFT, status: 'paused', anchorAt: null };
const ABGELAUFEN = { ...LAEUFT, elapsedMs: 540_000, anchorAt: T0 };
const HALBZEIT = { status: 'section_break', phase: 'regular', section: 1, sections: 2, sectionSeconds: 300, sectionStartMs: 0, elapsedMs: 300_000, anchorAt: null, breakStartedAt: T0 - 20_000, breakSeconds: 60 };
const VERLAENGERUNG = { status: 'running', phase: 'overtime', section: 2, sections: 2, sectionSeconds: 300, overtimeSeconds: 240, sectionStartMs: 600_000, elapsedMs: 660_000, anchorAt: T0 };
const geplant: Partial<Match> = { matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined, scheduledTime: new Date('2026-10-10T14:00:00') };

interface Zeige { patch?: Partial<Match>; turnier?: Partial<Tournament>; einFeld?: boolean; cockpit?: Tournament['matchCockpitSettings'] }

/** Live-Folie von Feld 1 ohne Profil (Vorgabe „Spielfeld (fern)“); Spiel 7 ist das gezeigte Spiel. */
function zeige({ patch = {}, turnier = {}, einFeld = false, cockpit }: Zeige = {}) {
  const felder = einFeld ? { numberOfFields: 1, fields: [{ id: 'field-1', defaultName: 'Feld 1' }] } : {};
  const tournament = buildTournament({ matches: withMatch('match-7', patch), ...felder, ...(cockpit === undefined ? {} : { matchCockpitSettings: cockpit }), ...turnier });
  return render(
    <NowSourceContext.Provider value={() => T0}>
      <LiveSlide slide={slide('live', { fieldId: 'field-1' })} {...withView(tournament)} performanceSettings={performanceSettings} theme="dark" style={{}} />
    </NowSourceContext.Provider>,
  );
}

const laeuft = (liveState: Record<string, unknown> = LAEUFT, rest: Partial<Match> = {}): Partial<Match> => ({ scoreA: 1, scoreB: 0, liveState, ...rest });
const balken = () => screen.getByTestId('monitor-zeitbalken');
const fuellung = () => balken().firstElementChild as HTMLElement;
const rgb = (hex: string): string => `rgb(${[1, 3, 5].map((i) => String(parseInt(hex.slice(i, i + 2), 16))).join(', ')})`;
const cqh = (wert: string): number => parseFloat(wert.replace('cqh', ''));

/** Namen der Symbole in einem Bereich (z. B. neben der Uhr); in dem Bereich steht dabei nie ein Wort als Text (Daniel 2026-11-19: Symbole statt Text) */
const symbolNamen = (id: string): string[] => {
  const el = screen.getByTestId(id);
  expect(el.textContent, `in „${id}“ steht kein Wort, nur Symbole`).toBe('');
  return [el, ...Array.from(el.querySelectorAll('[aria-label]'))].filter((e) => e.hasAttribute('aria-label')).map((e) => e.getAttribute('aria-label') ?? '');
};
const abzeichen = () => screen.getByTestId('match-status-badge');
const WOERTER_DER_UHR = ['angehalten', 'Pause', 'Halbzeit', 'Zeit abgelaufen', 'Verlängerung', 'Anstoß'];

describe('@ZM-215 Restzeit ohne Beschriftung, Symbol nur bei Abweichung', () => {
  it('Spiel 3 läuft, 3 von 9 Minuten gespielt: „6:00“ steht für sich, kein Wort „Restzeit“, kein Symbol neben der Uhr, keine Punkte', () => {
    const { container } = zeige({ patch: laeuft() });
    expect(screen.getByTestId('monitor-clock')).toHaveTextContent('6:00');
    expect(container.textContent ?? '').not.toContain('Restzeit');
    expect(screen.queryByTestId('clock-label')).toBeNull();
    expect(screen.queryByTestId('clock-section')).toBeNull();
    expect(abzeichen()).toHaveTextContent('Live');
  });

  it.each([
    ['die Uhr angehalten wird', laeuft(ANGEHALTEN, { matchStatus: 'paused' }), ['angehalten'], 'pause'],
    ['die Halbzeitpause läuft', laeuft(HALBZEIT), ['Pause · Halbzeit'], 'halbzeit'],
    ['die Spielzeit abgelaufen ist, aber noch nicht abgepfiffen', laeuft(ABGELAUFEN), ['Zeit abgelaufen'], 'pfeife'],
    ['die Verlängerung läuft', laeuft(VERLAENGERUNG), ['Verlängerung'], 'verlaengerung'],
    ['die Uhr in der Verlängerung angehalten wird', laeuft({ ...VERLAENGERUNG, status: 'paused', anchorAt: null }, { matchStatus: 'paused' }), ['angehalten', 'Verlängerung'], 'pause'],
  ])('Symbol bei Abweichung: %s → %j links neben der Uhr (nie über ihr), kein Wort, nie „Restzeit“; das Abzeichen oben links bleibt „Live“', (_lage, patch, namen, erstes) => {
    const { container } = zeige({ patch });
    const symbole = screen.getByTestId('clock-label');
    expect(symbolNamen('clock-label')).toEqual(namen);
    expect(within(symbole).getAllByRole('img')[0]).toHaveAttribute('data-symbol', erstes);
    expect(container.textContent ?? '').not.toContain('Restzeit');
    // neben der Uhr in derselben Zeile, vor ihr im Dokument
    expect(screen.getByTestId('clock-row')).toContainElement(symbole);
    expect(screen.getByTestId('clock-row')).toContainElement(screen.getByTestId('monitor-clock'));
    expect(symbole.compareDocumentPosition(screen.getByTestId('monitor-clock')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // jede Angabe nur an einer Stelle: oben links „Live“, keines der Uhr-Wörter als Text irgendwo auf der Folie
    expect(abzeichen()).toHaveTextContent('Live');
    for (const wort of WOERTER_DER_UHR) { expect(container.textContent ?? '', `Wort „${wort}“ steht nicht als Text da`).not.toContain(wort); }
  });

  it('Gegenbeispiel: das Abzeichen zeigt bei angehaltener Uhr NICHT „Pause“, in der Halbzeitpause NICHT „Halbzeit“ und in der Verlängerung NICHT „Verlängerung“; die Verlängerung steht genau einmal da (an der Uhr)', () => {
    for (const [patch, gemieden] of [[laeuft(ANGEHALTEN, { matchStatus: 'paused' }), 'Pause'], [laeuft(HALBZEIT), 'Halbzeit'], [laeuft(VERLAENGERUNG), 'Verlängerung']] as const) {
      const { unmount } = zeige({ patch });
      expect(abzeichen()).not.toHaveTextContent(gemieden);
      expect(abzeichen()).toHaveTextContent('Live');
      unmount();
    }
    zeige({ patch: laeuft(VERLAENGERUNG) });
    expect(screen.getAllByRole('img', { name: 'Verlängerung' })).toHaveLength(1);
  });

  it('Gegenbeispiel: Strafstoßschießen und Ende bleiben im Abzeichen (dort ist das die Angabe der Folie, nicht der Uhr)', () => {
    zeige({ patch: { matchStatus: 'paused', scoreA: 1, scoreB: 1, liveState: { ...LAEUFT, status: 'shootout', phase: 'shootout', anchorAt: null } } });
    expect(abzeichen()).toHaveTextContent('Strafstoßschießen');
    expect(screen.queryByTestId('clock-label')).toBeNull();
  });

  it('Symbol fast so hoch wie die Ziffern: 12 % der Höhe bei 14 % Uhr (mindestens 80 % der Ziffernhöhe), die Bauteile tragen den Token', () => {
    zeige({ patch: laeuft(ANGEHALTEN, { matchStatus: 'paused' }) });
    expect(cqh(displayLayout.scoreArea.stateSymbol) / cqh(displayLayout.scoreArea.clockFont)).toBeGreaterThanOrEqual(0.8);
    expect(within(screen.getByTestId('clock-label')).getByRole('img').style.height).toBe(displayLayout.scoreArea.stateSymbol);
  });

  it('angehalten sind die Ziffern gedämpft, im laufenden Spiel nicht (Gegenbeispiel); Farbe nie allein: das Pause-Symbol steht dabei', () => {
    const ziffern = (): string => screen.getByTestId('monitor-clock').querySelector<HTMLElement>('[data-monitor="uhr"]')?.style.color ?? '';
    const lauf = zeige({ patch: laeuft() });
    const normal = ziffern();
    lauf.unmount();
    zeige({ patch: laeuft(ANGEHALTEN, { matchStatus: 'paused' }) });
    expect(ziffern()).not.toBe(normal);
    expect(symbolNamen('clock-label')).toEqual(['angehalten']);
  });

  it('Gegenbeispiel: die Zeile hat mit und ohne Symbol dieselbe Spaltenaufteilung, die Uhr bleibt in der Mitte (@ZM-151)', () => {
    const lauf = zeige({ patch: laeuft() });
    const ohne = [screen.getByTestId('clock-row').style.gridTemplateColumns, screen.getByTestId('monitor-clock').style.gridColumn];
    lauf.unmount();
    zeige({ patch: laeuft(ANGEHALTEN, { matchStatus: 'paused' }) });
    expect([screen.getByTestId('clock-row').style.gridTemplateColumns, screen.getByTestId('monitor-clock').style.gridColumn]).toEqual(ohne);
  });

  it('Uhr größer im frei gewordenen Platz: Schrift 14 % der Höhe statt 11 %, Torzahlen nicht kleiner (Stand bleibt das Größte)', () => {
    zeige({ patch: laeuft() });
    const uhr = screen.getByTestId('monitor-clock').querySelector<HTMLElement>('[data-monitor="uhr"]');
    expect(cqh(uhr?.style.fontSize ?? '')).toBeGreaterThanOrEqual(14);
    expect(cqh(displayLayout.scoreArea.clockFont)).toBeGreaterThan(11);
    expect(screen.getByTestId('live-box-home-digits')).toBeInTheDocument();
  });
});

describe('@ZM-215 Abschnitt als Punkte, nur bei mehr als einem Abschnitt', () => {
  const ZWEI_VON_DREI = { ...LAEUFT, section: 2, sections: 3, sectionSeconds: 180, sectionStartMs: 180_000, elapsedMs: 240_000 };
  const punkte = (): Array<string | null> => Array.from(screen.getByTestId('clock-section').children).map((d) => d.getAttribute('data-gefuellt'));

  it('zweiter von drei Abschnitten: zwei Punkte gefüllt, einer leer; zugänglicher Name „Abschnitt 2 von 3“, kein Wort', () => {
    zeige({ patch: laeuft(ZWEI_VON_DREI) });
    expect(symbolNamen('clock-section')).toEqual(['Abschnitt 2 von 3']);
    expect(punkte()).toEqual(['ja', 'ja', 'nein']);
    expect(screen.getByTestId('monitor-clock')).toHaveTextContent('2:00');
  });

  it('zwei Halbzeiten, zweite läuft: zwei Punkte, beide gefüllt, Name „2. Halbzeit“; rechts neben der Uhr (nach ihr im Dokument)', () => {
    zeige({ patch: laeuft({ ...LAEUFT, section: 2, sections: 2, sectionSeconds: 300, sectionStartMs: 300_000, elapsedMs: 360_000 }) });
    expect(symbolNamen('clock-section')).toEqual(['2. Halbzeit']);
    expect(punkte()).toEqual(['ja', 'ja']);
    expect(screen.getByTestId('monitor-clock').compareDocumentPosition(screen.getByTestId('clock-section')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Gegenbeispiele: bei einem Abschnitt keine Punkte; in der Halbzeitpause und in der Verlängerung keine Punkte (dort gibt es keinen regulären Abschnitt)', () => {
    for (const patch of [laeuft(), laeuft(HALBZEIT), laeuft(VERLAENGERUNG)]) {
      const { unmount } = zeige({ patch });
      expect(screen.queryByTestId('clock-section')).toBeNull();
      unmount();
    }
  });

  it('angehalten bleibt der Abschnitt zusätzlich zum Pause-Symbol stehen', () => {
    zeige({ patch: laeuft({ ...ZWEI_VON_DREI, status: 'paused', anchorAt: null }, { matchStatus: 'paused' }) });
    expect(symbolNamen('clock-section')).toEqual(['Abschnitt 2 von 3']);
    expect(symbolNamen('clock-label')).toEqual(['angehalten']);
  });
});

describe('@ZM-215 Feld und Gruppe nur bei mehreren, als Symbole', () => {
  const feld = () => screen.queryByRole('img', { name: /^Feld \d/ });
  const gruppe = () => screen.queryByRole('img', { name: /^Gruppe / });

  it('ein Feld und eine Gruppe: nur „Spiel 7“, weder Feld noch Gruppe', () => {
    const { container } = zeige({ patch: laeuft(), einFeld: true, turnier: { numberOfGroups: 1 } });
    expect(screen.getByTestId('live-info')).toHaveTextContent(/^Spiel 7$/);
    expect(screen.getByTestId('live-group')).toBeEmptyDOMElement();
    expect(feld()).toBeNull();
    expect(gruppe()).toBeNull();
    expect(container.textContent ?? '').not.toMatch(/Feld \d|Gruppe/);
  });

  it('Gegenbeispiel: zwei Felder und zwei Gruppen: Spielfeld-Symbol mit der Nummer 1 („Feld 1“) und „Spiel 7“, Gruppe als Buchstabe A im Kasten („Gruppe A“) – ohne die Wörter als Text', () => {
    const { container } = zeige({ patch: laeuft(), turnier: { numberOfGroups: 2, groupSystem: 'groupsAndFinals' } });
    expect(feld()).toHaveTextContent(/^1$/);
    expect(feld()).toHaveAttribute('aria-label', 'Feld 1');
    expect(screen.getByTestId('live-info')).toHaveTextContent('Spiel 7');
    expect(gruppe()).toHaveTextContent(/^A$/);
    expect(gruppe()).toHaveAttribute('aria-label', 'Gruppe A');
    expect(container.textContent ?? '').not.toMatch(/Feld \d|Gruppe/);
  });

  it('Feld und Gruppe haben die Höhe der Kopfzeile (Token), das Spiel bleibt Text', () => {
    zeige({ patch: laeuft(), turnier: { numberOfGroups: 2, groupSystem: 'groupsAndFinals' } });
    expect(gruppe()?.style.height).toBe(displayLayout.scoreArea.headerSymbol);
    expect(screen.getByTestId('live-field').style.height).toBe(displayLayout.scoreArea.headerSymbol);
  });

  it('gemischt: zwei Felder, eine Gruppe → Feld ja, Gruppe nein; ein Feld, zwei Gruppen → Feld nein, Gruppe ja', () => {
    const a = zeige({ patch: laeuft(), turnier: { numberOfGroups: 1 } });
    expect(feld()).toHaveAttribute('aria-label', 'Feld 1');
    expect(screen.getByTestId('live-group')).toBeEmptyDOMElement();
    a.unmount();
    zeige({ patch: laeuft(), einFeld: true, turnier: { numberOfGroups: 2, groupSystem: 'groupsAndFinals' } });
    expect(feld()).toBeNull();
    expect(screen.getByTestId('live-info')).toHaveTextContent(/^Spiel 7$/);
    expect(gruppe()).toHaveAttribute('aria-label', 'Gruppe A');
  });

  it('vor dem Anpfiff (nächstes Spiel) gilt dieselbe Regel; die Anstoßzeit steht in der Größe der Uhr, das Uhr-Symbol „Anstoß“ links daneben statt des Worts; oben „Nächstes Spiel“', () => {
    zeige({ patch: { ...geplant, matchNumber: 7 }, einFeld: true, turnier: { numberOfGroups: 1 } });
    expect(screen.getByTestId('live-info')).toHaveTextContent(/^Spiel 7$/);
    expect(symbolNamen('kickoff-label')).toEqual(['Anstoß']);
    expect(within(screen.getByTestId('kickoff-label')).getByRole('img')).toHaveAttribute('data-symbol', 'uhr');
    expect(screen.getByTestId('monitor-kickoff')).toContainElement(screen.getByTestId('kickoff-time'));
    expect(screen.getByTestId('live-badge')).toHaveTextContent('Nächstes Spiel');
    expect(screen.queryByTestId('monitor-zeitbalken')).toBeNull(); // vor dem Anpfiff läuft nichts herunter
  });
});

describe('@ZM-215 Zeitbalken: mindestens 5 %, läuft wie die Restzeit herunter, die abgelaufene Strecke bleibt sichtbar', () => {
  it('Höhe aus dem Token der Folie: mindestens 5 % der Höhe (Spielfeld (fern)), so breit wie die beiden Ergebniskästen', () => {
    zeige({ patch: laeuft() });
    expect(balken().style.height).toBe(displayLayout.scoreArea.progressHeight);
    expect(cqh(displayLayout.scoreArea.progressHeight)).toBeGreaterThanOrEqual(5);
    expect(balken().parentElement?.style.maxWidth).toBe('calc(85%)'); // jsdom rechnet den Token aus (@ZM-165: Breite der beiden Kästen)
  });

  it('3 von 9 Minuten gespielt: zwei Drittel gefüllt, links verankert (beginnt voll, das rechte Ende wandert nach links), grün', () => {
    zeige({ patch: laeuft() });
    expect(Number(balken().getAttribute('data-anteil'))).toBeCloseTo(2 / 3, 2);
    expect(balken()).toHaveAttribute('data-ton', 'gruen');
    expect(fuellung().style.width).toBe('66.67%');
    expect(fuellung().style.background).toBe(rgb(displayBar.colors.dark.gruen));
  });

  it('das rechte Drittel ist als abgelaufene Strecke zu sehen: die Bahn trägt die Farbe des Tokens (heller als der Hintergrund), nicht die Füllfarbe', () => {
    zeige({ patch: laeuft() });
    expect(balken().style.background).toBe(rgb(displayBar.colors.dark.track));
    expect(balken().style.background).not.toBe(fuellung().style.background);
  });

  it('Gegenbeispiel Zeit abgelaufen: der Balken ist leer, seine Bahn bleibt sichtbar', () => {
    zeige({ patch: laeuft(ABGELAUFEN) });
    expect(Number(balken().getAttribute('data-anteil'))).toBe(0);
    expect(parseFloat(fuellung().style.width)).toBe(0);
    expect(balken().style.background).toBe(rgb(displayBar.colors.dark.track));
  });

  it('angehalten bleibt der Balken stehen und wird grau; Halbzeitpause: gedämpft; Schlussphase: violett; nie rot', () => {
    const farben = (ton: keyof typeof displayBar.colors.dark): string => rgb(displayBar.colors.dark[ton]);
    const a = zeige({ patch: laeuft(ANGEHALTEN, { matchStatus: 'paused' }) });
    expect(balken()).toHaveAttribute('data-ton', 'grau');
    expect(Number(balken().getAttribute('data-anteil'))).toBeCloseTo(2 / 3, 2);
    expect(fuellung().style.background).toBe(farben('grau'));
    a.unmount();
    const b = zeige({ patch: laeuft(HALBZEIT) });
    expect(balken()).toHaveAttribute('data-ton', 'gedaempft');
    expect(fuellung().style.background).toBe(farben('gedaempft'));
    b.unmount();
    // Schlussphase: Uhr-Art „durchlaufend, letzte Minute angehalten“, noch 30 Sekunden
    zeige({ patch: laeuft({ ...LAEUFT, elapsedMs: 510_000 }), cockpit: { clockMode: 'durchlaufend-letzte-minute-angehalten', finalPhaseMinutes: 1 } as Tournament['matchCockpitSettings'] });
    expect(balken()).toHaveAttribute('data-ton', 'violett');
    expect(fuellung().style.background).toBe(farben('violett'));
    for (const ton of ['gruen', 'grau', 'violett', 'gedaempft'] as const) {
      const [r, g, bl] = [1, 3, 5].map((i) => parseInt(displayBar.colors.dark[ton].slice(i, i + 2), 16));
      expect(r > g + 40 && r > bl + 40, `${ton} ist nicht rot`).toBe(false);
    }
  });

  it('helles Thema: dieselbe Regel mit den Farben des hellen Themas (Füllung dunkler als die Bahn)', () => {
    const tournament = buildTournament({ matches: withMatch('match-7', laeuft()) });
    render(
      <NowSourceContext.Provider value={() => T0}>
        <LiveSlide slide={slide('live', { fieldId: 'field-1' })} {...withView(tournament)} performanceSettings={performanceSettings} theme="light" style={{}} />
      </NowSourceContext.Provider>,
    );
    expect(balken().style.background).toBe(rgb(displayBar.colors.light.track));
    expect(fuellung().style.background).toBe(rgb(displayBar.colors.light.gruen));
  });

  it('Gegenbeispiel: nach dem Ende und im Strafstoßschießen gibt es keinen Balken', () => {
    zeige({ patch: { matchStatus: 'finished', scoreA: 2, scoreB: 1, liveState: undefined } });
    expect(screen.queryByTestId('monitor-zeitbalken')).toBeNull();
  });
});

describe('@ZM-212 Das Profil „Halle (sehr fern)“ bleibt, wie es war', () => {
  it('mit Profil steht weiter die Anordnung „Farbseiten“ mit ihrem Balken (6 %), kein Wort „Restzeit“', () => {
    const tournament = buildTournament({ matches: withMatch('match-7', laeuft()) });
    const { container } = render(
      <NowSourceContext.Provider value={() => T0}>
        <LiveSlide slide={slide('live', { fieldId: 'field-1' })} {...withView(tournament)} performanceSettings={performanceSettings} theme="dark" style={{}} profile="hall-very-far" />
      </NowSourceContext.Provider>,
    );
    expect(screen.getByTestId('hall-zeitbalken').style.height).toBe('6cqh');
    expect(screen.queryByTestId('monitor-zeitbalken')).toBeNull();
    expect(container.textContent ?? '').not.toContain('Restzeit');
  });
});
