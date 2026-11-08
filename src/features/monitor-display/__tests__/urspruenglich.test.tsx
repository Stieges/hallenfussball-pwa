/**
 * B-27 Monitor: groß die neue Uhrzeit, klein „(war hh:mm)“ (@ZP-003, @ZP-004, @ZP-005, @ZP-046, @ZP-049), ohne
 * „voraussichtlich“ bei K.-o.-Spielen (@ZM-105) auf den Folien „Nächste Spiele“, „Spielplan eines Felds“ und „Live“
 * (nächstes Spiel). Wirkliche deutsche Texte; das Turnier ist das Beispiel „Hallencup Nord“ der Monitor-Fixture.
 */
import { describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { Match } from '../../../types/tournament';
import type { PerformanceSettings } from '../../../types/monitor';
import { pageIndexOf } from '../listRows';
import { scheduleFieldLayout } from '../slideContent';
import { NextMatchesSlide } from '../slides/NextMatchesSlide';
import { ScheduleFieldSlide } from '../slides/ScheduleFieldSlide';
import { LiveSlide } from '../slides/LiveSlide';
import { cssVars, displayList } from '../../../design-tokens';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { anzeigeT } from '../../../i18n/anzeigeSprache';
import enTournament from '../../../i18n/locales/en/tournament.json';
import { buildTournament, slide, withMatch, withPlayoffs } from './monitorFixture';
import { withView } from './monitorViewHelper';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const at = (hhmm: string): Date => new Date(`2026-10-10T${hhmm}:00`);
const performanceSettings = {} as PerformanceSettings;

/** Spiel 8 (Feld 2) und Spiel 9 (Feld 1) mit den gegebenen Uhrzeiten; `original` = Uhrzeit beim ersten Anpfiff. */
function mitZeiten(spiel8: { shown: string; original?: string }, spiel9: { shown: string; original?: string }) {
  const patch = (z: { shown: string; original?: string }): Partial<Match> => ({
    scheduledTime: at(z.shown),
    ...(z.original === undefined ? {} : { originalStart: at(z.original) }),
  });
  const matches = withMatch('match-8', patch(spiel8)).map((m) => (m.id === 'match-9' ? { ...m, ...patch(spiel9) } : m));
  return buildTournament({ matches });
}

function naechste(tournament: ReturnType<typeof buildTournament>) {
  return render(<NextMatchesSlide slide={slide('next-matches', { matchCount: 5 })} {...withView(tournament)} theme="dark" style={{}} />);
}
const zeile = (id: string): HTMLElement => document.querySelector<HTMLElement>(`[data-testid="monitor-match-row"][data-match-id="${id}"]`)!;

describe('B-27 Monitor „Nächste Spiele“: ursprüngliche Uhrzeit', () => {
  it('@ZP-003 @ZP-004 Spiel 8 steht um 14:30 groß, klein „(war 14:20)“', () => {
    naechste(mitZeiten({ shown: '14:30', original: '14:20' }, { shown: '14:40' }));
    const row = within(zeile('match-8'));
    expect(row.getByTestId('monitor-match-time')).toHaveTextContent(/^14:30/);
    expect(row.getByTestId('monitor-match-original')).toHaveTextContent('(war 14:20)');
  });

  it('@ZP-004 ab 1 Minute Abweichung (14:21 statt 14:20) steht „(war …)“ dabei', () => {
    naechste(mitZeiten({ shown: '14:21', original: '14:20' }, { shown: '14:40' }));
    expect(within(zeile('match-8')).getByTestId('monitor-match-original')).toHaveTextContent('(war 14:20)');
  });

  it('@ZP-005 Gegenbeispiel: stimmt die Uhrzeit wieder überein, verschwindet der Zusatz', () => {
    naechste(mitZeiten({ shown: '14:20', original: '14:20' }, { shown: '14:40' }));
    expect(within(zeile('match-8')).queryByTestId('monitor-match-original')).toBeNull();
    expect(document.body.textContent).not.toContain('(war');
  });

  it('@ZP-049 Gegenbeispiel: Planung vor dem ersten Anpfiff (keine ursprüngliche Uhrzeit) zeigt kein „(war …)“', () => {
    naechste(mitZeiten({ shown: '14:30' }, { shown: '14:50' }));
    expect(screen.queryByTestId('monitor-match-original')).toBeNull();
  });

  it('@ZP-046 Hinweis liegt nicht unter der Lesetext-Stufe der Zeile (3,6 % der Bildhöhe) und ist in voller Textfarbe gesetzt', () => {
    naechste(mitZeiten({ shown: '14:30', original: '14:20' }, { shown: '14:40' }));
    const note = screen.getByTestId('monitor-match-original');
    expect(parseFloat(note.style.fontSize)).toBeGreaterThanOrEqual(3.6);
    expect(note.style.color).toBe(within(zeile('match-8')).getByTestId('monitor-match-time').style.color);
  });

  // @ZP-046 (geändert 2026-11-08, Daniel „das war 10:12 brauch ich nicht dick“): die neue Uhrzeit führt, „(war …)“ ist Zusatz
  it('@ZP-046 „15:25“ groß und fett, dahinter in derselben Zeile „(war 15:15)“ kleiner und nicht fett, nicht unter der kleinsten Monitor-Schrift', () => {
    naechste(mitZeiten({ shown: '14:30', original: '14:20' }, { shown: '14:40' }));
    const row = within(zeile('match-8'));
    const uhr = row.getByTestId('monitor-match-clock');
    const war = row.getByTestId('monitor-match-original');
    expect(war).toHaveTextContent('(war 14:20)');
    // in derselben Zeile, die neue Uhrzeit zuerst
    expect(war.parentElement).toBe(uhr.parentElement);
    expect(uhr.compareDocumentPosition(war) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // „(war …)“ kleiner als die Uhrzeit und nicht fett; die Uhrzeit (Zelle) fett
    expect(parseFloat(uhr.style.fontSize)).toBeGreaterThan(parseFloat(war.style.fontSize));
    expect(war.style.fontWeight).toBe(cssVars.fontWeights.normal);
    expect(row.getByTestId('monitor-match-time').style.fontWeight).toBe(cssVars.fontWeights.semibold);
    // mindestens so groß wie die kleinste erlaubte Monitor-Schrift (@ZM-125: 3,6 % der Bildhöhe) und nicht gekürzt
    expect(parseFloat(war.style.fontSize)).toBeGreaterThanOrEqual(3.6);
    expect(war.style.textOverflow).toBe('');
  });

  it('@ZM-087 die Uhrzeit-Spalte hat in jeder Zeile dieselbe feste Breite, mit und ohne Hinweis (Namensspalten bleiben)', () => {
    const { unmount } = naechste(mitZeiten({ shown: '14:20' }, { shown: '14:40' }));
    const ohne = [...document.querySelectorAll<HTMLElement>('[data-testid="monitor-match-time"]')].map((el) => el.style.flex);
    unmount();
    naechste(mitZeiten({ shown: '14:30', original: '14:20' }, { shown: '14:40' }));
    const mit = [...document.querySelectorAll<HTMLElement>('[data-testid="monitor-match-time"]')].map((el) => el.style.flex);
    expect(ohne.length).toBeGreaterThan(1);
    expect(ohne[0]).toContain(displayList.timeFieldWidth);
    expect(mit).toEqual(ohne);
  });
});

describe('B-27 Monitor „Spielplan eines Felds“: K.-o.-Uhrzeiten mit Bezeichnung, ohne „voraussichtlich“ (@ZM-105)', () => {
  const tournament = buildTournament({ matches: withPlayoffs().map((m) => (m.id.startsWith('po-') ? { ...m, isFinal: true } : m)).map((m) => (m.id === 'po-p3' ? { ...m, scheduledTime: at('15:30'), originalStart: at('15:20') } : m)) });

  it('Spiel um Platz 3 steht mit Bezeichnung und „(war 15:20)“, ohne „voraussichtlich“; Gruppenspiele ohne Bezeichnung', () => {
    // die Zeilen sind höher, die Spiele verteilen sich auf mehrere Seiten: jedes Spiel auf seiner Seite ansehen
    const seite = (id: string) => pageIndexOf(scheduleFieldLayout(withView(tournament).view, 1).pages, id);
    const zeigen = (id: string) => {
      render(<ScheduleFieldSlide slide={slide('schedule-field', { fieldId: 'field-1' })} {...withView(tournament)} theme="dark" style={{}} page={seite(id)} />);
      return within(zeile(id).parentElement!);
    };
    const p3 = zeigen('po-p3');
    expect(p3.getByTestId('monitor-match-label')).toHaveTextContent('Spiel um Platz 3');
    expect(p3.queryByTestId('monitor-match-tentative')).toBeNull();
    expect(p3.getByTestId('monitor-match-original')).toHaveTextContent('(war 15:20)');
    cleanup();
    expect(zeigen('match-9').queryByTestId('monitor-match-label')).toBeNull();
    expect(document.body.textContent).not.toContain('voraussichtlich');
  });
});

describe('B-27 Monitor „Live“, nächstes Spiel: Uhrzeit mit „(war …)“ (@ZP-003)', () => {
  it('Feld 2 hat kein laufendes Spiel: „Anstoß 14:30“ und klein „(war 14:20)“', () => {
    const t = mitZeiten({ shown: '14:30', original: '14:20' }, { shown: '14:40' });
    render(<LiveSlide slide={slide('live', { fieldId: 'field-2' })} {...withView(t)} performanceSettings={performanceSettings} theme="dark" style={{}} />);
    expect(document.body.textContent).toMatch(/Anstoß\s*14:30/);
    expect(screen.getByTestId('monitor-next-original')).toHaveTextContent('(war 14:20)');
  });

  it('Gegenbeispiel: ohne Verschiebung steht kein „(war …)“ beim nächsten Spiel', () => {
    render(<LiveSlide slide={slide('live', { fieldId: 'field-2' })} {...withView(mitZeiten({ shown: '14:20' }, { shown: '14:40' }))} performanceSettings={performanceSettings} theme="dark" style={{}} />);
    expect(screen.queryByTestId('monitor-next-original')).toBeNull();
  });
});

describe('B-27 Monitor „Live“, nächstes Spiel: K.-o.-Spiel ohne „voraussichtlich“ (@ZM-105)', () => {
  it('Feld 2: nächstes Spiel ist ein Finalspiel mit neuer Uhrzeit: „Anstoß 14:30“, „(war 14:20)“, kein „voraussichtlich“', () => {
    const matches = withMatch('match-8', { isFinal: true, label: 'Finale', scheduledTime: at('14:30'), originalStart: at('14:20') });
    const ansicht = withView(buildTournament({ matches }));
    render(<LiveSlide slide={slide('live', { fieldId: 'field-2' })} {...ansicht} performanceSettings={performanceSettings} theme="dark" style={{}} />);
    expect(document.body.textContent).toMatch(/Anstoß\s*14:30/);
    expect(screen.getByTestId('monitor-next-original')).toHaveTextContent('(war 14:20)');
    expect(document.body.textContent).not.toContain('voraussichtlich');
  });
});

describe('@ZP-001 Wortlaut „(war hh:mm)“ gilt wörtlich, auf jeder Ausgabe aus derselben Quelle', () => {
  it('Deutsch: „(war 15:30)“, nicht „ursprünglich“', () => {
    expect(anzeigeT('tournament:timeShift.original', { time: '15:30' })).toBe('(war 15:30)');
  });

  it('Englisch hat dasselbe Muster mit „(was {{time}})“', () => {
    expect(enTournament.timeShift.original).toBe('(was {{time}})');
  });
});
