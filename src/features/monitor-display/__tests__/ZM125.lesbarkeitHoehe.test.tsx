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
import { AllStandingsSlide } from '../slides/AllStandingsSlide';
import { QrSlide } from '../slides/QrSlide';
import { createMockTournament } from '../../../test/factories';
import { LANGE_NAMEN, listenTurnier } from './listFolienKit';
import { withView } from './monitorViewHelper';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: { value: string; marginSize?: number; size: number; style?: { height?: string; minHeight?: string; flex?: string } }) => (
    <div data-testid="qr-code" data-margin={props.marginSize} data-height={props.style?.height} data-min={props.style?.minHeight} data-flex={props.style?.flex} />
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
    const kante = qr.getAttribute('data-height')!;
    expect(resolveCss(kante, { vw: 1920, vh: 1080 })).toBeGreaterThanOrEqual(0.45 * 1080);
    expect(resolveCss(kante, { vw: 1280, vh: 720 })).toBeGreaterThanOrEqual(0.45 * 720);
    // schrumpft bei knapper Höhe (zweizeiliger Titel, Rand 10 %, Hinweis), damit die Adresse im Bild bleibt (@ZM-208), aber nicht unter die Mindestkante
    expect(qr.getAttribute('data-flex')).toBe(`0 1 ${displayMonitor.qr.slide.size}`);
    expect(resolveCss(qr.getAttribute('data-min')!, { vw: 1920, vh: 1080 })).toBeGreaterThanOrEqual(0.3 * 1080);
    cleanup();
  });

  it('Gegenbeispiel: die alte feste Kante von 220 px war nur 20 % (1080) bzw. 31 % (720) der Bildhöhe', () => {
    expect(displayMonitor.qr.sizeLarge / 1080).toBeLessThan(0.45);
    expect(displayMonitor.qr.sizeLarge / 720).toBeLessThan(0.45);
  });
});
