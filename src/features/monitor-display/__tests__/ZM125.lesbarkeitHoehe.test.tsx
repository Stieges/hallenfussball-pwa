/**
 * @ZM-125 @ZM-129 @ZM-087 @ZM-071 Lesbarkeit der Monitor-Folien aus der Hallentiefe: Tabellen, Nächste Spiele, Spielplan und die QR-Folie
 * nutzen die Bildhöhe innerhalb des Bildrands. Kennzahlen aus den echten Tokens und Folien (Schrift in Bruchteilen der Bildhöhe), nicht aus Testwerten:
 * - Tabelle: 6 Teams deutlich größer als die alte Stufe (3,6 %), 12 Teams mit 50-Zeichen-Namen passen in jeder Auflösung und bei jedem
 *   wirksamen Bildrand ins Bild, nie unter der harten Untergrenze von 3 % der Bildhöhe.
 * - Listen: der Maßstab wächst nur, solange jede Seite in die Höhe passt; nie unter den Stufen der Tokens.
 * - QR: Kante mindestens 45 % der Bildhöhe samt Ruhezone von 4 Modulen.
 * Die Messung im fertigen Bild (1920×1080 und 1280×720, Rand 0/48 px/5 %): `npm run visual:metrics -- --profil monitor`.
 */
import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { displayList, displayMonitor } from '../../../design-tokens';
import { resolveCss } from '../../../components/monitor/__tests__/cssResolve';
import { standingsFont, standingsHeight, standingsFontSize } from '../standingsFit';
import { listColumns, listPages, listScale, nameCharsPerLine, nameLines, rowHeight, scaledList } from '../listRows';
import { monitorSideLabel } from '../matchSides';
import { nextMatchesLayout, scheduleFieldLayout } from '../slideContent';
import { AllStandingsSlide } from '../slides/AllStandingsSlide';
import { QrSlide } from '../slides/QrSlide';
import { createMockTournament } from '../../../test/factories';
import { LANGE_NAMEN, listenTurnier } from './listFolienKit';
import { withView } from './monitorViewHelper';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: { value: string; marginSize?: number; size: number; style?: { width?: string } }) => (
    <div data-testid="qr-code" data-margin={props.marginSize} data-width={props.style?.width} />
  ),
}));
vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const HART_VH = 3;
/** Bildrand in Prozent: 0, 48 px bei 1080 (4,44 %), Vorbelegung 5 %, 48 px bei 720 (6,67 %). */
const RAENDER = [0, 4.44, 5, 6.67] as const;
const ZWOELF_LANGE_NAMEN = Array.from({ length: 12 }, (_, i) => `${LANGE_NAMEN[i % LANGE_NAMEN.length]}`.slice(0, 50));

describe('@ZM-125 Tabelle: Schrift wächst mit der freien Höhe, nie unter 3 % der Bildhöhe', () => {
  const sechs = ['SV Kirchanschöring', 'SpVgg Fridolfing', 'TSV Waging 2', 'TSV Freilassing', 'TSV Waging 1', 'SG Taching/Tengling'];

  it.each(RAENDER)('6 Teams bei %s %% Rand: mindestens 5 % der Bildhöhe statt der alten Stufe 3,6 %% und die Tabelle passt ins Bild', (rand) => {
    const font = standingsFont(sechs, rand);
    expect(font).toBeGreaterThanOrEqual(5);
    expect(font).toBeGreaterThan(parseFloat(displayList.fontSizes.team));
    expect(standingsHeight(sechs, font, rand)).toBeLessThanOrEqual(100 - 2 * rand);
  });

  it.each(RAENDER)('12 Teams mit Namen von 50 Zeichen bei %s %% Rand: Schrift mindestens 3 %%, Höhe passt in die Bildhöhe innerhalb des Rands', (rand) => {
    const font = standingsFont(ZWOELF_LANGE_NAMEN, rand);
    expect(font).toBeGreaterThanOrEqual(HART_VH);
    expect(standingsHeight(ZWOELF_LANGE_NAMEN, font, rand)).toBeLessThanOrEqual(100 - 2 * rand);
  });

  it('Gegenbeispiel: mit der alten festen Stufe 3,6 % und den alten Abständen lief eine Tabelle mit 12 Teams über den Bildrand', () => {
    const alteHoehe = 12 * (3.6 * 1.2 + 2 * 1.2 + 0.2) + (3 * 1.2 + 2 * 1.2 + 0.2) + 2 * 2 + 5 * 1.2 + 2;
    expect(alteHoehe).toBeGreaterThan(100 - 2 * 5);
  });

  it('weniger Zeilen, größere Schrift; die Obergrenze gilt (nie größer als fontMax)', () => {
    const ladder = [12, 10, 8, 6, 4, 2].map((n) => standingsFont(sechs.concat(sechs).slice(0, n), 5));
    for (let i = 1; i < ladder.length; i += 1) { expect(ladder[i]).toBeGreaterThanOrEqual(ladder[i - 1]); }
    expect(Math.max(...ladder)).toBeLessThanOrEqual(parseFloat(displayList.standings.fontMax));
  });

  it('die Folie setzt die Schrift als vh-Wert an Zeilen und Namen, der Kopf nie unter 3 % der Bildhöhe (1280×720 und 1920×1080)', () => {
    const t = listenTurnier({ namen: 'kurz', beendet: 5 });
    render(<AllStandingsSlide {...withView(t)} theme="dark" style={{}} page={0} />);
    const name = screen.getAllByTestId('standings-row')[0].querySelector<HTMLElement>('[data-teamname]')!;
    expect(name.style.fontSize).toMatch(/vh$/);
    for (const [vw, vh] of [[1280, 720], [1920, 1080]] as const) {
      const px = resolveCss(name.style.fontSize, { vw, vh });
      expect(px / vh, `${String(vw)}×${String(vh)}: Teamname`).toBeGreaterThanOrEqual(0.05);
    }
    const kopf = screen.getByText('Team').parentElement!;
    expect(kopf.style.fontSize).toContain(displayList.fontSizes.head);
    expect(standingsFontSize(['A'], 5)).toMatch(/^\d+(\.\d+)?vh$/);
    cleanup();
  });
});

describe('@ZM-125 @ZM-129 Listen: Maßstab nur, solange jede Seite in die Höhe passt', () => {
  const rahmen = { overscan: 5, notice: false } as const;

  it('Nächste Spiele (5 Zeilen, kurze Namen): Maßstab über 1, die Seitenzahl bleibt die des Maßstabs 1', () => {
    const t = listenTurnier({ namen: 'kurz', beendet: 5 });
    const { view } = withView(t);
    const layout = nextMatchesLayout(view, 5, rahmen);
    expect(layout.frame.scale).toBeGreaterThan(1);
    expect(layout.pages.length).toBe(1);
    const spalten = listColumns(false, true, view.matches);
    expect(listPages(layout.pages.flat(), spalten, undefined, rahmen).length).toBe(layout.pages.length);
  });

  it.each(RAENDER)('Spielplan Feld 1 bei %s %% Rand: jede Seite passt im vergrößerten Maßstab in die Bildhöhe, Maßstab nie unter 1', (rand) => {
    for (const namen of ['kurz', 'lang'] as const) {
      const { view } = withView(listenTurnier({ namen, beendet: 5 }));
      const layout = scheduleFieldLayout(view, 1, { overscan: rand, notice: false });
      expect(layout.frame.scale, namen).toBeGreaterThanOrEqual(1);
      const gap = parseFloat(displayList.rowGap) * (layout.frame.scale ?? 1);
      for (const seite of layout.pages) {
        const hoehe = seite.reduce((summe, m, i) => summe + rowHeight(m, layout.columns, layout.frame) + (i === 0 ? 0 : gap), 0);
        expect(hoehe, `${namen}, Rand ${String(rand)} %`).toBeLessThanOrEqual(100 - 2 * rand);
      }
    }
  });

  it.each(RAENDER)('kein Name bricht erst durch die Vergrößerung um (kein „FC / Nordstadt“), Rand %s %%', (rand) => {
    for (const namen of ['kurz', 'lang'] as const) {
      const { view } = withView(listenTurnier({ namen, beendet: 5 }));
      for (const layout of [nextMatchesLayout(view, 5, { overscan: rand, notice: false }), scheduleFieldLayout(view, 1, { overscan: rand, notice: false })]) {
        const basis = { ...layout.frame, scale: 1 };
        for (const m of layout.pages.flat()) {
          for (const seite of [m.home, m.away]) {
            const name = monitorSideLabel(seite);
            expect(nameLines(name, nameCharsPerLine(layout.frame)), `${namen}: ${name}`).toBeLessThanOrEqual(nameLines(name, nameCharsPerLine(basis)));
          }
        }
      }
    }
  });

  it('Gegenbeispiel: eine Seite, die schon im Maßstab 1 die Höhe füllt, bleibt bei Maßstab 1', () => {
    const { view } = withView(listenTurnier({ namen: 'lang', beendet: 0 }));
    const layout = nextMatchesLayout(view, 15, { overscan: 10, notice: false });
    const vollste = layout.pages.map((seite) => seite.length);
    expect(Math.max(...vollste)).toBeGreaterThan(0);
    expect(listScale([[...layout.pages.flat()]], layout.columns, { overscan: 10, notice: false })).toBe(1);
  });

  it('scaledList(1) liefert die Tokens unverändert; größere Maßstäbe vergrößern Schrift und Abstände in vh, nie die Überschrift', () => {
    expect(scaledList(1)).toBe(displayList);
    const gross = scaledList(1.5);
    expect(parseFloat(gross.fontSizes.team)).toBeCloseTo(parseFloat(displayList.fontSizes.team) * 1.5, 5);
    expect(gross.fontSizes.heading).toBe(displayList.fontSizes.heading);
    expect(gross.fontSizes.head).toBe(displayList.fontSizes.head);
  });

  it('die Zeilen der Folie tragen den Maßstab (Schrift größer als die Stufe, mindestens 3,6 % der Bildhöhe)', async () => {
    const { NextMatchesSlide } = await import('../slides/NextMatchesSlide');
    const t = listenTurnier({ namen: 'kurz', beendet: 5 });
    const slide = { id: 's', type: 'next-matches' as const, config: { matchCount: 5 }, duration: null, order: 0 };
    render(<NextMatchesSlide slide={slide} {...withView(t)} theme="dark" style={{}} />);
    const name = screen.getAllByTestId('monitor-match-row')[0].querySelector<HTMLElement>('[data-teamname]')!;
    expect(resolveCss(name.style.fontSize, { vw: 1920, vh: 1080 }) / 1080).toBeGreaterThan(0.036);
    cleanup();
  });
});

describe('@ZM-071 @ZM-125 Zuschauer-QR-Folie: großer QR-Code mit Ruhezone', () => {
  it('Kante mindestens 45 % der Bildhöhe, Ruhezone 4 Module wie in der Norm, Überschriften in vh', () => {
    const slide = displayMonitor.qr.slide;
    expect(parseFloat(slide.size)).toBeGreaterThanOrEqual(45);
    expect(slide.size).toMatch(/vh$/);
    expect(slide.quietModules).toBeGreaterThanOrEqual(4);
    for (const font of [slide.titleFont, slide.headlineFont]) { expect(parseFloat(font)).toBeGreaterThanOrEqual(HART_VH); expect(font).toMatch(/vh$/); }
  });

  it('die Folie reicht Kante und Ruhezone an den QR-Code; 1080 Zeilen: mindestens 486 px, 720 Zeilen: mindestens 324 px', () => {
    render(<QrSlide tournament={createMockTournament({ isPublic: true, shareCode: 'ABC123', title: 'Nikolaus-Turnier' })} style={{}} />);
    const qr = screen.getByTestId('qr-code');
    expect(Number(qr.getAttribute('data-margin'))).toBeGreaterThanOrEqual(4);
    const breite = qr.getAttribute('data-width')!;
    expect(resolveCss(breite, { vw: 1920, vh: 1080 })).toBeGreaterThanOrEqual(0.45 * 1080);
    expect(resolveCss(breite, { vw: 1280, vh: 720 })).toBeGreaterThanOrEqual(0.45 * 720);
    cleanup();
  });

  it('Gegenbeispiel: die alte feste Kante von 220 px war nur 20 % (1080) bzw. 31 % (720) der Bildhöhe', () => {
    expect(displayMonitor.qr.sizeLarge / 1080).toBeLessThan(0.45);
    expect(displayMonitor.qr.sizeLarge / 720).toBeLessThan(0.45);
  });
});
