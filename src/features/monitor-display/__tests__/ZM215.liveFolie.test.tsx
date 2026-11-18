/**
 * @ZM-215 Die Live-Folie der Monitore ohne Profil („Spielfeld (fern)“) zeigt nur, was man aus der Ferne braucht, und die Zeit so groß wie möglich.
 * Aus dem Gherkin: kein Wort „Restzeit“; ein Wort neben der Uhr nur bei Abweichung; Feld nur bei mehr als einem Feld, Gruppe nur bei mehr als einer Gruppe;
 * der Zeitbalken (Beispiel „Spielfeld (fern)“: 5 %) läuft wie die Restzeit herunter, die abgelaufene Strecke bleibt als Bahn sichtbar, angehalten grau,
 * Schlussphase violett, nie rot. Spiel 3 hat 9 Minuten, 3 sind gespielt (Restzeit „6:00“). Layout-Pixel misst die Playwright-Spec
 * (`monitor-live-sichten-zm215.spec.ts`, jsdom hat keine Geometrie); hier gelten die Zusicherungen an Bauteile, Texte, Farben und Tokens.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('@ZM-215 Restzeit ohne Beschriftung, Wort nur bei Abweichung', () => {
  it('Spiel 3 läuft, 3 von 9 Minuten gespielt: „6:00“ steht für sich, kein Wort „Restzeit“, kein Wort neben der Uhr', () => {
    const { container } = zeige({ patch: laeuft() });
    expect(screen.getByTestId('monitor-clock')).toHaveTextContent('6:00');
    expect(container.textContent ?? '').not.toContain('Restzeit');
    expect(screen.queryByTestId('clock-label')).toBeNull();
  });

  it.each([
    ['die Uhr angehalten wird', laeuft(ANGEHALTEN, { matchStatus: 'paused' }), 'angehalten'],
    ['die Halbzeitpause läuft', laeuft(HALBZEIT), 'Pause · Halbzeit'],
    ['die Spielzeit abgelaufen ist, aber noch nicht abgepfiffen', laeuft(ABGELAUFEN), 'Zeit abgelaufen'],
    ['die Verlängerung läuft', laeuft(VERLAENGERUNG), 'Verlängerung'],
  ])('Wort bei Abweichung: %s → „%s“ links neben der Uhr (nie über ihr), nie „Restzeit“', (_lage, patch, wort) => {
    const { container } = zeige({ patch });
    const wortEl = screen.getByTestId('clock-label');
    expect(wortEl).toHaveTextContent(wort);
    expect(container.textContent ?? '').not.toContain('Restzeit');
    // neben der Uhr in derselben Zeile, vor ihr im Dokument
    expect(screen.getByTestId('clock-row')).toContainElement(wortEl);
    expect(screen.getByTestId('clock-row')).toContainElement(screen.getByTestId('monitor-clock'));
    expect(wortEl.compareDocumentPosition(screen.getByTestId('monitor-clock')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Gegenbeispiel: die Zeile hat mit und ohne Wort dieselbe Spaltenaufteilung, die Uhr bleibt in der Mitte (@ZM-151)', () => {
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

describe('@ZM-215 Feld und Gruppe nur bei mehreren', () => {
  it('ein Feld und eine Gruppe: nur „Spiel 7“, weder Feld noch Gruppe', () => {
    const { container } = zeige({ patch: laeuft(), einFeld: true, turnier: { numberOfGroups: 1 } });
    expect(screen.getByTestId('live-info')).toHaveTextContent(/^Spiel 7$/);
    expect(screen.getByTestId('live-group')).toBeEmptyDOMElement();
    expect(container.textContent ?? '').not.toMatch(/Feld \d|Gruppe/);
  });

  it('Gegenbeispiel: zwei Felder und zwei Gruppen: „Feld 1 — Spiel 7“ und „Gruppe A“', () => {
    zeige({ patch: laeuft(), turnier: { numberOfGroups: 2, groupSystem: 'groupsAndFinals' } });
    expect(screen.getByTestId('live-info')).toHaveTextContent('Feld 1 — Spiel 7');
    expect(screen.getByTestId('live-group')).toHaveTextContent('Gruppe A');
  });

  it('gemischt: zwei Felder, eine Gruppe → Feld ja, Gruppe nein; ein Feld, zwei Gruppen → Feld nein, Gruppe ja', () => {
    const a = zeige({ patch: laeuft(), turnier: { numberOfGroups: 1 } });
    expect(screen.getByTestId('live-info')).toHaveTextContent('Feld 1 — Spiel 7');
    expect(screen.getByTestId('live-group')).toBeEmptyDOMElement();
    a.unmount();
    zeige({ patch: laeuft(), einFeld: true, turnier: { numberOfGroups: 2, groupSystem: 'groupsAndFinals' } });
    expect(screen.getByTestId('live-info')).toHaveTextContent(/^Spiel 7$/);
    expect(screen.getByTestId('live-group')).toHaveTextContent('Gruppe A');
  });

  it('vor dem Anpfiff (nächstes Spiel) gilt dieselbe Regel; die Anstoßzeit steht in der Größe der Uhr, „Anstoß“ links daneben', () => {
    zeige({ patch: { ...geplant, matchNumber: 7 }, einFeld: true, turnier: { numberOfGroups: 1 } });
    expect(screen.getByTestId('live-info')).toHaveTextContent(/^Spiel 7$/);
    expect(screen.getByTestId('kickoff-label')).toHaveTextContent('Anstoß');
    expect(screen.getByTestId('monitor-kickoff')).toContainElement(screen.getByTestId('kickoff-time'));
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
