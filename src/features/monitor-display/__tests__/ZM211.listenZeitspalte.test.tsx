/**
 * @ZM-211 Auf den Listen-Folien „Nächste Spiele“ und „Spielplan Feld 1“ gehört der Platz neben der Uhrzeit den Teamnamen: schmale Zeitspalte, „(war hh:mm)“
 * unter der Uhrzeit, Teamnamen größer. @ZM-187 (gleiche Spalten, keine Zeile verschiebt die anderen, kein Spiel wechselt die Seite) und @ZM-150
 * (Schrift nie kleiner als bisher, Namen mit 45 bis 50 Zeichen brechen wie bisher um, Seitenaufteilung unverändert).
 * Die Prüfung der Namensbreite an der gerenderten Seite steht im Browser-Test `tests/e2e/listen-folien-monitor.spec.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { displayList } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import { resolveCss } from '../../../components/monitor/__tests__/cssResolve';
import { nextMatchesLayout, scheduleFieldLayout, monitorPageCount } from '../slideContent';
import { compactRowHeight, compactScale, compactTokens, namenBreiteEm, nameZeilen, textBreiteEm } from '../listCompact';
import { listColumns, listPages, SCHEDULE_MAX_ROWS } from '../listRows';
import { NextMatchesSlide } from '../slides/NextMatchesSlide';
import { ScheduleFieldSlide } from '../slides/ScheduleFieldSlide';
import { listenTurnier } from './listFolienKit';
import { slide } from './monitorFixture';
import { withView } from './monitorViewHelper';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

/** Die Folie liest das Bildschirmverhältnis der Sichtfläche (jsdom hat keine: dann 16:9); die Tests setzen es ausdrücklich. */
function fenster(breite: number, hoehe: number): void {
  Object.defineProperty(document.documentElement, 'clientWidth', { value: breite, configurable: true });
  Object.defineProperty(document.documentElement, 'clientHeight', { value: hoehe, configurable: true });
}
beforeEach(() => { fenster(1920, 1080); });
afterEach(() => { fenster(0, 0); });

const ECHT = ['SV Kirchanschöring', 'SpVgg Fridolfing', 'TSV Waging 2', 'TSV Freilassing', 'TSV Waging 1', 'SG Taching/Tengling'];
const RAENDER = [0, 5] as const;
const GROESSEN = [[1920, 1080], [1280, 720]] as const;

function turnier(opts: { namen?: readonly string[]; verschoben?: boolean } = {}): Tournament {
  const t = listenTurnier({ beendet: 5, ...(opts.verschoben ? { verschoben: true } : {}) });
  return opts.namen === undefined ? { ...t, teams: t.teams.map((tm, i) => ({ ...tm, name: ECHT[i] })) } : { ...t, teams: t.teams.map((tm, i) => ({ ...tm, name: opts.namen![i % opts.namen!.length] })) };
}
const naechste = slide('next-matches', { matchCount: 5 });
const plan = slide('schedule-field', { fieldId: 'field-1' });

function zeigen(t: Tournament, art: 'naechste' | 'plan', overscan = 5) {
  const view = withView(t);
  if (art === 'naechste') { render(<NextMatchesSlide slide={naechste} {...view} theme="dark" style={{}} overscanPercent={overscan} />); } else { render(<ScheduleFieldSlide slide={plan} {...view} theme="dark" style={{}} overscanPercent={overscan} />); }
  const zeilen = screen.getAllByTestId('monitor-match-row');
  const daten = zeilen.map(z => ({
    id: z.dataset.matchId ?? '', schrift: z.querySelector<HTMLElement>('[data-teamname]')!.style.fontSize, hoehe: z.parentElement!.dataset.heightVh ?? '',
    zeitBreite: z.querySelector<HTMLElement>('[data-testid="monitor-match-time"]')!.style.flex, original: z.querySelector('[data-testid="monitor-match-original"]')?.textContent ?? null,
    uhrZeile: z.querySelector('[data-testid="monitor-match-clockline"]')!, warZeile: z.querySelector('[data-testid="monitor-match-warline"]'),
  }));
  cleanup();
  return daten;
}

describe('@ZM-211 Aufteilung', () => {
  it.each(RAENDER)('Nächste Spiele (6 Teams, längster Name „SG Taching/Tengling“), Rand %s %%: schmale Zeitspalte, Teamnamen deutlich größer als 3,6 %% der Bildhöhe', (rand) => {
    const { view } = withView(turnier());
    const layout = nextMatchesLayout(view, 5, { overscan: rand, notice: false });
    expect(layout.frame.compact).toBe(true);
    expect(layout.frame.scale).toBeGreaterThanOrEqual(1.15);
    const [zeile] = zeigen(turnier(), 'naechste', rand);
    expect(zeile.zeitBreite).toBe(`0 0 ${displayList.timeColumnWidth}`);
    expect(parseFloat(zeile.schrift)).toBeGreaterThanOrEqual(1.15 * parseFloat(displayList.fontSizes.team));
  });

  it('Spielplan Feld 1: dieselbe Aufteilung, Seitenaufteilung wie bisher (4 + 4 + 4 + 3), Seitenzahl für den Takt unverändert', () => {
    const t = turnier();
    const { view } = withView(t);
    const layout = scheduleFieldLayout(view, 1, { overscan: 5, notice: false });
    expect(layout.frame.compact).toBe(true);
    expect(layout.pages.map(p => p.length)).toEqual([4, 4, 4, 3]);
    const spalten = listColumns(true, false, view.matches.filter(m => m.field === 1));
    const bisher = listPages(view.matches.filter(m => m.field === 1).sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0)), spalten, SCHEDULE_MAX_ROWS, { overscan: 5, notice: false });
    expect(layout.pages.map(p => p.map(m => m.id))).toEqual(bisher.map(p => p.map(m => m.id)));
    expect(monitorPageCount(plan, t, view, undefined, { overscan: 5, notice: false })).toBe(4);
  });

  it.each(['naechste', 'plan'] as const)('%s: ein Spiel verschieben ändert weder Schrift, Spalten, Zeilenhöhe noch Seite; der Zusatz „(war …)“ steht in einer eigenen Zeile unter der Uhrzeit (@ZM-187)', (art) => {
    const ohne = zeigen(turnier(), art);
    const mit = zeigen(turnier({ verschoben: true }), art);
    expect(mit.map(z => z.id)).toEqual(ohne.map(z => z.id));
    expect(mit.map(z => z.schrift)).toEqual(ohne.map(z => z.schrift));
    expect(mit.map(z => z.hoehe)).toEqual(ohne.map(z => z.hoehe));
    expect(mit.map(z => z.zeitBreite)).toEqual(ohne.map(z => z.zeitBreite));
    expect(new Set(mit.map(z => z.schrift)).size).toBe(1);
    expect(mit.some(z => z.original !== null) || art === 'plan').toBe(true);
    for (const z of mit) {
      expect(z.warZeile, 'jede Zeile hat die Zeile für den Zusatz').not.toBeNull();
      expect(z.uhrZeile.contains(z.warZeile), 'nicht in der Uhrzeit-Zeile').toBe(false);
      expect(z.uhrZeile.compareDocumentPosition(z.warZeile!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(ohne.every(z => z.original === null)).toBe(true);
  });

  it('Seitenaufteilung beim Verschieben unverändert (Nächste Spiele und Spielplan)', () => {
    for (const verschoben of [false, true]) {
      const { view } = withView(turnier({ verschoben }));
      expect(scheduleFieldLayout(view, 1, { overscan: 5, notice: false }).pages.map(p => p.length)).toEqual([4, 4, 4, 3]);
    }
  });

  it('die Schrift ist nie kleiner als bisher, auch bei Namen mit 45 bis 50 Zeichen (dort höchstens Maßstab 1)', () => {
    const lang = turnier({ namen: ['Mannschaftsgemeinschaft Oberweiler Unterweiler Nord', 'Freizeitfußballer Großkarolinenfeld Süd Ost Vereinigte', 'Spielgemeinschaft Hammerau Piding Anger Nordwest', 'Hallenfreunde Bergheim Teisendorf Land Mannschaft 1928', 'Jugendspielgemeinschaft Chiemgau Ost Mannschaft Zwei', 'Eintracht Oberweiler-Niederstetten Hallenteam 1919'] });
    const { view } = withView(lang);
    const layout = nextMatchesLayout(view, 5, { overscan: 5, notice: false });
    expect(layout.frame.compact === true ? (layout.frame.scale ?? 1) : 1).toBeGreaterThanOrEqual(1);
    for (const z of zeigen(lang, 'naechste')) { expect(parseFloat(z.schrift)).toBeGreaterThanOrEqual(parseFloat(displayList.fontSizes.team)); }
  });

  it('jede Seite passt in die freie Höhe, auch im größten Maßstab (Rand 0, 5 und 10 %)', () => {
    for (const rand of [0, 5, 10]) {
      const { view } = withView(turnier());
      for (const layout of [nextMatchesLayout(view, 5, { overscan: rand, notice: false }), scheduleFieldLayout(view, 1, { overscan: rand, notice: false })]) {
        if (layout.frame.compact !== true) { continue; }
        const s = layout.frame.scale ?? 1;
        for (const seite of layout.pages) {
          const hoehe = seite.reduce((sum, m, i) => sum + compactRowHeight(m, layout.columns, layout.frame, s) + (i === 0 ? 0 : parseFloat(displayList.rowGap)), 0);
          expect(hoehe, `Rand ${String(rand)} %`).toBeLessThanOrEqual(100 - 2 * rand);
        }
      }
    }
  });

  it('Gegenbeispiel: reicht die Höhe schon im Maßstab 1 nicht, bleibt die Folie, wie sie war (kein Maßstab)', () => {
    const { view } = withView(turnier());
    const layout = nextMatchesLayout(view, 5, { overscan: 5, notice: false });
    const zu = layout.pages.map(p => [...p, ...p, ...p, ...p]);
    expect(compactScale(zu, layout.columns, { overscan: 5, notice: false })).toBeNull();
  });

  it.each(GROESSEN)('die Schrift ist an der Bildhöhe gebunden (%s×%s): vh-Werte, Teamname mindestens 3,6 %%', (vw, vh) => {
    const [zeile] = zeigen(turnier(), 'naechste');
    expect(zeile.schrift).toMatch(/vh$/);
    expect(resolveCss(zeile.schrift, { vw, vh }) / vh).toBeGreaterThanOrEqual(0.036);
  });
});

describe('@ZM-211 Bildschirmverhältnis', () => {
  it('bei 16:10 und 4:3 wächst die Schrift weniger (oder die Folie bleibt, wie sie war); die Seitenaufteilung ist dieselbe wie bei 16:9', () => {
    const { view } = withView(turnier());
    const breit = nextMatchesLayout(view, 5, { overscan: 5, notice: false });
    const seiten = breit.pages.map(p => p.map(m => m.id));
    let letzter = breit.frame.scale ?? 1;
    for (const aspect of [16 / 10, 4 / 3]) {
      const layout = nextMatchesLayout(view, 5, { overscan: 5, notice: false, aspect });
      expect(layout.pages.map(p => p.map(m => m.id))).toEqual(seiten);
      const scale = layout.frame.compact === true ? (layout.frame.scale ?? 1) : 1;
      expect(scale).toBeLessThanOrEqual(letzter);
      letzter = scale;
    }
  });

  it('die Folie liest das Verhältnis des Fensters: bei 4:3 ist der Maßstab nicht größer als bei 16:9', () => {
    fenster(1920, 1080);
    const breit = zeigen(turnier(), 'naechste')[0].schrift;
    fenster(1440, 1080);
    const schmal = zeigen(turnier(), 'naechste')[0].schrift;
    expect(parseFloat(schmal)).toBeLessThanOrEqual(parseFloat(breit));
  });
});

describe('@ZM-211 Namensbreite (Modell; die gerenderte Breite prüft der Browser-Test)', () => {
  it('Zeichenbreiten der Schrift: „SG Taching/Tengling“ rund 9 bis 10 em, nie schmaler als ein schmaler Mittelwert', () => {
    const breite = textBreiteEm('SG Taching/Tengling', 1);
    expect(breite).toBeGreaterThan(8.5);
    expect(breite).toBeLessThan(11);
    expect(textBreiteEm('SG Taching/Tengling')).toBeGreaterThan(breite);
  });

  it('die schmale Zeitspalte gibt den Namen mehr Breite als die bisherige', () => {
    const frame = { overscan: 5, notice: false };
    expect(namenBreiteEm(frame, { state: false, field: false }, 1)).toBeGreaterThan(namenBreiteEm(frame, null, 1));
    expect(namenBreiteEm(frame, { state: false, field: false }, 1.3)).toBeLessThan(namenBreiteEm(frame, { state: false, field: false }, 1));
    expect(namenBreiteEm(frame, { state: true, field: false }, 1)).toBeLessThan(namenBreiteEm(frame, { state: false, field: false }, 1));
  });

  it('Umbruch an Leerzeichen und nach „/“, Bindestrich-Wort bleibt zusammen, solange es passt', () => {
    expect(nameZeilen('SG Taching/Tengling', 20)).toBe(1);
    expect(nameZeilen('SG Taching/Tengling', 8)).toBe(2);
    expect(nameZeilen('Fußballfreunde Nordheim-Süd', 8)).toBe(2);
    expect(nameZeilen('Fußballfreunde Nordheim-Süd', 30)).toBe(1);
  });

  it('compactTokens: nur die Schriftstufen wachsen, Zeitspalte ist die schmale', () => {
    const t = compactTokens(1.25, { state: false, field: false });
    expect(parseFloat(t.fontSizes.team)).toBeCloseTo(4.5, 5);
    expect(t.fontSizes.heading).toBe(displayList.fontSizes.heading);
    expect(t.rowPaddingY).toBe(displayList.rowPaddingY);
    expect(t.timeFieldWidth).toBe(displayList.timeColumnWidth);
    expect(compactTokens(1, { state: true, field: false }).timeFieldWidth).toBe(displayList.timeColumnStateWidth);
  });
});
