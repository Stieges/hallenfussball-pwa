/**
 * B-44b Listen-Folien (Nächste Spiele, Spielplan, Tabellen) lesbar aus der Halle.
 * @ZM-125 Teamnamen mindestens 3 % der Bildhöhe, dichte Folien blättern · @ZM-087 50 Zeichen vollständig, ohne „…“
 * Messung am gerenderten Stil (Token-Wert aus dem Element), nicht gegen dieselbe Konstante gerechnet.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Team, Tournament } from '../../../types/tournament';
import { NextMatchesSlide } from '../slides/NextMatchesSlide';
import { ScheduleFieldSlide } from '../slides/ScheduleFieldSlide';
import { StandingsSlide } from '../slides/StandingsSlide';
import { AllStandingsSlide } from '../slides/AllStandingsSlide';
import { StandingsTable } from '../components/StandingsTable';
import { monitorThemes } from '../../../design-tokens';
import { calculateStandings } from '../../../utils/calculations';
import { monitorPageCount } from '../slideContent';
import { RESOLUTIONS, resolveCss } from '../../../components/monitor/__tests__/cssResolve';
import { buildTournament, FIXTURE_MATCHES, FIXTURE_TEAMS, slide } from './monitorFixture';
import { withView } from './monitorViewHelper';

const LANGER = 'Größenwahn Übungsteam Füßen Ösen Äpfel Ölkrug Ähre';
const EMOJI = /\p{Extended_Pictographic}/u;

function mitLangemNamen(): Tournament {
  const teams: Team[] = FIXTURE_TEAMS.map(t => (t.id === 'team-mitte' ? { ...t, name: LANGER } : t));
  return buildTournament({ teams });
}

/** Alle Elemente unterhalb von `root` mit Inline-Stil text-overflow: ellipsis. */
function mitEllipsis(root: HTMLElement): HTMLElement[] {
  return [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].filter(el => el.style.textOverflow === 'ellipsis');
}

describe('@ZM-125 Teamnamen skalieren mit der Bildhöhe', () => {
  it('Teamname einer Zeile in „Nächste Spiele“ hat eine vh-Schrift: bei 720p und 2160p mindestens 3 % der Höhe', () => {
    render(<NextMatchesSlide slide={slide('next-matches')} {...withView(mitLangemNamen())} theme="dark" style={{}} />);
    const name = screen.getByText('DJK Berg');
    expect(name.style.fontSize).toMatch(/vh$/);
    for (const { w, h } of RESOLUTIONS.filter(r => r.h === 720 || r.h === 2160)) {
      expect(resolveCss(name.style.fontSize, { vw: w, vh: h })).toBeGreaterThanOrEqual(0.03 * h);
    }
  });

  it('Teamname in der Tabelle: vh-Schrift mit mindestens 3 % der Höhe', () => {
    render(<StandingsSlide slide={slide('standings', { groupId: 'A' })} tournament={buildTournament()} theme="dark" style={{}} />);
    const name = screen.getByText('FC Nord');
    expect(name.style.fontSize).toMatch(/vh$/);
    expect(resolveCss(name.style.fontSize, { vw: 1280, vh: 720 })).toBeGreaterThanOrEqual(0.03 * 720);
    expect(resolveCss(name.style.fontSize, { vw: 3840, vh: 2160 })).toBeGreaterThanOrEqual(0.03 * 2160);
  });

  it('Teamname im Spielplan: vh-Schrift mit mindestens 3 % der Höhe', () => {
    render(<ScheduleFieldSlide slide={slide('schedule-field', { fieldId: 'field-1' })} {...withView(buildTournament())} theme="dark" style={{}} />);
    const name = screen.getAllByText('FC Nord')[0];
    expect(name.style.fontSize).toMatch(/vh$/);
    expect(resolveCss(name.style.fontSize, { vw: 1280, vh: 720 })).toBeGreaterThanOrEqual(0.03 * 720);
    expect(resolveCss(name.style.fontSize, { vw: 3840, vh: 2160 })).toBeGreaterThanOrEqual(0.03 * 2160);
  });

  it('Gegenbeispiel: keine feste Pixel-Schrift an Namen, Uhrzeit und Feld der Zeilen', () => {
    render(<NextMatchesSlide slide={slide('next-matches')} {...withView(buildTournament())} theme="dark" style={{}} />);
    for (const row of screen.getAllByTestId('monitor-match-row')) {
      for (const el of Array.from(row.querySelectorAll<HTMLElement>('div'))) {
        if (el.style.fontSize) { expect(el.style.fontSize).not.toMatch(/px$/); }
      }
    }
  });

  it('Inhalt nutzt die Breite: kein fester 900-px-Kasten um die Liste', () => {
    render(<NextMatchesSlide slide={slide('next-matches')} {...withView(buildTournament())} theme="dark" style={{}} />);
    const list = screen.getAllByTestId('monitor-match-row')[0].parentElement!;
    expect(list.style.maxWidth).not.toMatch(/px$/);
  });
});

describe('@ZM-087 50 Zeichen vollständig, ohne „…“', () => {
  it('Nächste Spiele: voller Name im DOM, keine ellipsis-Zelle', () => {
    const { container } = render(<NextMatchesSlide slide={slide('next-matches')} {...withView(mitLangemNamen())} theme="dark" style={{}} />);
    expect(screen.getAllByText(LANGER).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('…');
    expect(mitEllipsis(container)).toHaveLength(0);
  });

  it('Spielplan: voller Name im DOM, keine ellipsis-Zelle', () => {
    const { container } = render(<ScheduleFieldSlide slide={slide('schedule-field', { fieldId: 'field-2' })} {...withView(mitLangemNamen())} theme="dark" style={{}} />);
    expect(screen.getAllByText(LANGER).length).toBeGreaterThan(0);
    expect(mitEllipsis(container)).toHaveLength(0);
  });

  it('Tabelle: voller Name im DOM, keine ellipsis-Zelle und kein nowrap an der Namenszelle', () => {
    const t = mitLangemNamen();
    const rows = calculateStandings(t.teams, t.matches, t, 'B');
    const { container } = render(<StandingsTable rows={rows} themeColors={monitorThemes.dark} />);
    const cell = screen.getByText(LANGER);
    expect(cell.textContent).toBe(LANGER);
    expect(cell.style.whiteSpace).not.toBe('nowrap');
    expect(mitEllipsis(container)).toHaveLength(0);
  });

  it('Alle Tabellen (Seite Gruppe B): derselbe Name ohne Kürzung', () => {
    const { container } = render(<AllStandingsSlide {...withView(mitLangemNamen())} theme="dark" style={{}} page={1} />);
    expect(screen.getByText(LANGER)).toBeInTheDocument();
    expect(mitEllipsis(container)).toHaveLength(0);
  });
});

describe('Nächste Spiele: Trenner zwischen Heim und Gast', () => {
  it('jede Zeile hat einen Trenner „–“ zwischen den beiden Namen', () => {
    render(<NextMatchesSlide slide={slide('next-matches')} {...withView(buildTournament())} theme="dark" style={{}} />);
    const rows = screen.getAllByTestId('monitor-match-row');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const sep = within(row).getByTestId('monitor-match-separator');
      expect(sep.textContent).toBe('–');
    }
  });

  it('Gegenbeispiel: im Spielplan mit Ergebnissen steht dort der Stand (2:1 bzw. -:-), nie zusätzlich ein Strich', () => {
    render(<ScheduleFieldSlide slide={slide('schedule-field', { fieldId: 'field-2' })} {...withView(buildTournament())} theme="dark" style={{}} />);
    const seps = screen.getAllByTestId('monitor-match-separator').map(s => s.textContent);
    expect(seps).toContain('2:1');
    expect(seps).toContain('-:-');
    expect(seps).not.toContain('–');
  });
});

describe('Symbole statt Emojis in Folien-Überschriften', () => {
  it('Tabelle, Alle Tabellen, Spielplan und Nächste Spiele: keine Emoji-Zeichen', () => {
    const t = buildTournament();
    const { container: a } = render(<StandingsSlide slide={slide('standings', { groupId: 'A' })} tournament={t} theme="dark" style={{}} />);
    const { container: b } = render(<AllStandingsSlide {...withView(t)} theme="dark" style={{}} page={0} />);
    const { container: c } = render(<ScheduleFieldSlide slide={slide('schedule-field', { fieldId: 'field-1' })} {...withView(t)} theme="dark" style={{}} />);
    const { container: d } = render(<NextMatchesSlide slide={slide('next-matches')} {...withView(t)} theme="dark" style={{}} />);
    for (const c1 of [a, b, c, d]) { expect(c1.textContent ?? '').not.toMatch(EMOJI); }
  });

  it('Tabellen-Überschrift trägt stattdessen ein Linien-Symbol (SVG) neben dem Wort', () => {
    render(<StandingsSlide slide={slide('standings', { groupId: 'A' })} tournament={buildTournament()} theme="dark" style={{}} />);
    const heading = screen.getByTestId('slide-heading');
    expect(heading.querySelector('svg')).not.toBeNull();
    expect((heading.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('i18n-Titel des Spielplans enthalten kein Emoji (DE und EN)', async () => {
    const de = (await import('../../../i18n/locales/de/monitor.json')).default;
    const en = (await import('../../../i18n/locales/en/monitor.json')).default;
    expect(de.slides.schedule.title).not.toMatch(EMOJI);
    expect(en.slides.schedule.title).not.toMatch(EMOJI);
  });
});

describe('Tabellen: Farbe nur mit Bedeutung', () => {
  const colors = monitorThemes.dark;

  it('Siege, Unentschieden und Niederlagen sind neutral gefärbt, auch bei 0 (kein Grün/Rot für Nullen)', () => {
    const t = buildTournament();
    const rows = calculateStandings(t.teams, t.matches, t, 'A');
    const { container } = render(<StandingsTable rows={rows} themeColors={colors} />);
    const body = Array.from(container.querySelectorAll<HTMLElement>('[data-testid="standings-row"]'));
    expect(body.length).toBe(rows.length);
    for (const row of body) {
      for (const id of ['won', 'drawn', 'lost']) {
        const cell = within(row).getByTestId(`standings-${id}`);
        expect(cell.style.color).not.toBe(hex(colors.progressBar));
        expect(cell.style.color).not.toBe(hex(colors.progressBarWarning));
      }
    }
  });

  it('Tordifferenz 0 ist neutral; Differenz ungleich 0 trägt ein Vorzeichen (Farbe nie einziger Träger)', () => {
    const t = buildTournament();
    const rows = calculateStandings(t.teams, t.matches, t, 'A');
    render(<StandingsTable rows={rows} themeColors={colors} />);
    const diffs = screen.getAllByTestId('standings-goalDiff');
    for (const cell of diffs) {
      const text = cell.textContent ?? '';
      if (text === '0') {
        expect(cell.style.color).not.toBe(hex(colors.progressBar));
        expect(cell.style.color).not.toBe(hex(colors.progressBarWarning));
      } else {
        expect(text).toMatch(/^[+\-−]\d+$/);
      }
    }
  });
});

describe('@ZM-125 dichte Folien blättern statt zu verkleinern', () => {
  it('mehr als 6 offene Spiele ergeben mehrere Seiten, die Schrift bleibt gleich', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      ...FIXTURE_MATCHES[2], id: `x-${i}`, matchNumber: 20 + i, scheduledTime: new Date(2026, 9, 10, 15, i),
    }));
    const t = buildTournament({ matches: many });
    const s = slide('next-matches', { matchCount: 9 });
    expect(monitorPageCount(s, t, withView(t).view)).toBe(2);
    const { unmount } = render(<NextMatchesSlide slide={s} {...withView(t)} theme="dark" style={{}} page={0} />);
    const first = screen.getAllByTestId('monitor-match-row');
    expect(first).toHaveLength(6);
    const size0 = screen.getAllByText('DJK Berg')[0].style.fontSize;
    unmount();
    render(<NextMatchesSlide slide={s} {...withView(t)} theme="dark" style={{}} page={1} />);
    expect(screen.getAllByTestId('monitor-match-row')).toHaveLength(3);
    expect(screen.getAllByText('DJK Berg')[0].style.fontSize).toBe(size0);
  });
});

function hex(value: string): string {
  // jsdom normalisiert #rrggbb zu rgb(r, g, b)
  const m = /^#([0-9a-f]{6})$/i.exec(value);
  if (!m) { return value; }
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
