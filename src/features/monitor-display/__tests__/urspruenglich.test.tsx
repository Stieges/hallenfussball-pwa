/**
 * B-27 Monitor: groß die neue Uhrzeit, klein „ursprünglich hh:mm“ (@ZP-003, @ZP-004, @ZP-005, @ZP-046, @ZP-049) und
 * „voraussichtlich“ bei K.-o.-Spielen (@ZM-105) auf den Folien „Nächste Spiele“, „Spielplan eines Felds“ und „Live“
 * (nächstes Spiel). Wirkliche deutsche Texte; das Turnier ist das Beispiel „Hallencup Nord“ der Monitor-Fixture.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Match } from '../../../types/tournament';
import type { PerformanceSettings } from '../../../types/monitor';
import { NextMatchesSlide } from '../slides/NextMatchesSlide';
import { ScheduleFieldSlide } from '../slides/ScheduleFieldSlide';
import { LiveSlide } from '../slides/LiveSlide';
import { displayList } from '../../../design-tokens';
import { initRealDeI18n } from '../../../test/realDeI18n';
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
  it('@ZP-003 @ZP-004 Spiel 8 steht um 14:30 groß, klein „ursprünglich 14:20“', () => {
    naechste(mitZeiten({ shown: '14:30', original: '14:20' }, { shown: '14:40' }));
    const row = within(zeile('match-8'));
    expect(row.getByTestId('monitor-match-time')).toHaveTextContent(/^14:30/);
    expect(row.getByTestId('monitor-match-original')).toHaveTextContent('ursprünglich 14:20');
  });

  it('@ZP-004 ab 1 Minute Abweichung (14:21 statt 14:20) steht „ursprünglich“ dabei', () => {
    naechste(mitZeiten({ shown: '14:21', original: '14:20' }, { shown: '14:40' }));
    expect(within(zeile('match-8')).getByTestId('monitor-match-original')).toHaveTextContent('ursprünglich 14:20');
  });

  it('@ZP-005 Gegenbeispiel: stimmt die Uhrzeit wieder überein, verschwindet der Zusatz', () => {
    naechste(mitZeiten({ shown: '14:20', original: '14:20' }, { shown: '14:40' }));
    expect(within(zeile('match-8')).queryByTestId('monitor-match-original')).toBeNull();
    expect(document.body.textContent).not.toContain('ursprünglich');
  });

  it('@ZP-049 Gegenbeispiel: Planung vor dem ersten Anpfiff (keine ursprüngliche Uhrzeit) zeigt kein „ursprünglich“', () => {
    naechste(mitZeiten({ shown: '14:30' }, { shown: '14:50' }));
    expect(screen.queryByTestId('monitor-match-original')).toBeNull();
  });

  it('@ZP-046 Hinweis liegt nicht unter der Lesetext-Stufe der Zeile (3,6 % der Bildhöhe) und ist in voller Textfarbe gesetzt', () => {
    naechste(mitZeiten({ shown: '14:30', original: '14:20' }, { shown: '14:40' }));
    const note = screen.getByTestId('monitor-match-original');
    expect(parseFloat(note.style.fontSize)).toBeGreaterThanOrEqual(3.6);
    expect(note.style.color).toBe(within(zeile('match-8')).getByTestId('monitor-match-time').style.color);
  });

  // Befund C-MONITOR-URSPRUENGLICH-ZU-KLEIN: @ZP-046 verlangt 9,4 % der Bildhöhe (Sehwinkel 16′), die Listen-Folien setzen
  // Zeilen mit 3,6 % – erst das Paket „Monitor-Schriftstufen“ (Fern-Fassung) löst das. Bis dahin erwartet rot.
  it.fails('@ZP-046 C-MONITOR-URSPRUENGLICH-ZU-KLEIN „ursprünglich“ ist mindestens 9,4 % der Bildhöhe hoch, die Uhrzeit deutlich größer', () => {
    naechste(mitZeiten({ shown: '14:30', original: '14:20' }, { shown: '14:40' }));
    const note = parseFloat(screen.getByTestId('monitor-match-original').style.fontSize);
    const time = parseFloat(within(zeile('match-8')).getByTestId('monitor-match-time').style.fontSize);
    expect(note).toBeGreaterThanOrEqual(9.4);
    expect(time).toBeGreaterThan(note);
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

describe('B-27 Monitor „Spielplan eines Felds“: K.-o.-Uhrzeiten sind voraussichtlich (@ZM-105)', () => {
  const tournament = buildTournament({ matches: withPlayoffs().map((m) => (m.id.startsWith('po-') ? { ...m, isFinal: true } : m)).map((m) => (m.id === 'po-p3' ? { ...m, scheduledTime: at('15:30'), originalStart: at('15:20') } : m)) });

  it('Spiel um Platz 3 steht als „voraussichtlich“ mit „ursprünglich 15:20“, Gruppenspiele ohne „voraussichtlich“', () => {
    render(<ScheduleFieldSlide slide={slide('schedule-field', { fieldId: 'field-1' })} {...withView(tournament)} theme="dark" style={{}} />);
    const p3 = within(zeile('po-p3'));
    expect(p3.getByTestId('monitor-match-tentative')).toHaveTextContent('voraussichtlich');
    expect(p3.getByTestId('monitor-match-original')).toHaveTextContent('ursprünglich 15:20');
    expect(within(zeile('match-9')).queryByTestId('monitor-match-tentative')).toBeNull();
  });
});

describe('B-27 Monitor „Live“, nächstes Spiel: Uhrzeit mit „ursprünglich“ (@ZP-003)', () => {
  it('Feld 2 hat kein laufendes Spiel: „Anstoß 14:30“ und klein „ursprünglich 14:20“', () => {
    const t = mitZeiten({ shown: '14:30', original: '14:20' }, { shown: '14:40' });
    render(<LiveSlide slide={slide('live', { fieldId: 'field-2' })} {...withView(t)} performanceSettings={performanceSettings} theme="dark" style={{}} />);
    expect(document.body.textContent).toMatch(/Anstoß 14:30/);
    expect(screen.getByTestId('monitor-next-original')).toHaveTextContent('ursprünglich 14:20');
  });

  it('Gegenbeispiel: ohne Verschiebung steht kein „ursprünglich“ beim nächsten Spiel', () => {
    render(<LiveSlide slide={slide('live', { fieldId: 'field-2' })} {...withView(mitZeiten({ shown: '14:20' }, { shown: '14:40' }))} performanceSettings={performanceSettings} theme="dark" style={{}} />);
    expect(screen.queryByTestId('monitor-next-original')).toBeNull();
  });
});
