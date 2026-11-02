/**
 * T4 (PDF-Paket PR 2): Turniergrafik beim Hochladen prüfen und aufbereiten (reine Teile und Ablauf gegen einen
 * Fälschungs-Anschluss ohne Browser). Der echte Weg über Canvas steht in tests/e2e/turnierlogo-aufbereiten.spec.ts.
 * Gherkin: @W3-030 (PNG, JPG oder SVG bis 2 MB; sonst nennt die App den Grund; SVG wird PNG), @DR-040 (Warnung unter 236
 * Bildpunkten Höhe, das Logo wird trotzdem übernommen), @DR-041 (Akzent nur aus der linken Grafik).
 */
import { describe, expect, it, vi } from 'vitest';
import { printHeader } from '../../../design-tokens/print-header';
import type { PixelImage } from '../../color/accent';
import { prepareTournamentGraphic, type GraphicPort } from '../prepareTournamentGraphic';

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0];

function fileOf(head: number[], size: number, name: string, type: string): File {
  const bytes = new Uint8Array(size);
  bytes.set(head);
  return new File([bytes], name, { type });
}
const png = (size = 1000): File => fileOf(PNG_HEAD, size, 'logo.png', 'image/png');
const jpg = (size = 1000): File => fileOf(JPEG_HEAD, size, 'logo.jpg', 'image/jpeg');
/** PNG mit gefälschtem IHDR: nur Signatur, Blocklänge, „IHDR“, Breite, Höhe (reicht für die Maße aus dem Kopf). */
function pngWithSize(width: number, height: number): File {
  const bytes = new Uint8Array(33);
  bytes.set(PNG_HEAD);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], 'gross.png', { type: 'image/png' });
}

/** JPEG mit gefälschtem SOF0-Block (Höhe und Breite je 16 Bit). */
function jpegWithSize(width: number, height: number): File {
  const bytes = new Uint8Array(40);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]);
  const view = new DataView(bytes.buffer);
  view.setUint16(7, height);
  view.setUint16(9, width);
  return new File([bytes], 'gross.jpg', { type: 'image/jpeg' });
}
const svg = (): File => new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>'], 'logo.svg', { type: 'image/svg+xml' });

const blue = (width: number, height: number): PixelImage => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) { data.set([42, 37, 118, 255], i * 4); }
  return { data, width, height };
};

/** Anschluss ohne Browser: meldet die Maße des „Originals“ und hält fest, mit welchen Maßen gezeichnet wurde. */
function port(original: { width: number; height: number }, options: { failDecode?: boolean; failRender?: Error } = {}) {
  const render = vi.fn(async (_image: unknown, size: { width: number; height: number }, mime: string) => {
    if (options.failRender) { throw options.failRender; }
    return { dataUrl: `data:${mime};base64,QUJD`, pixels: blue(size.width, size.height) };
  });
  const decode = vi.fn(async () => {
    if (options.failDecode) { throw new Error('nicht lesbar'); }
    return { ...original, source: 'bild' };
  });
  const fake: GraphicPort = { decode, render };
  return { fake, render, decode };
}

describe('@W3-030 Prüfung vor dem Aufbereiten', () => {
  it('@W3-030 andere Datei: Grund „Format“ (type)', async () => {
    const { fake, decode } = port({ width: 10, height: 10 });
    const pdf = fileOf([0x25, 0x50, 0x44, 0x46], 500, 'plan.pdf', 'application/pdf');
    const webp = fileOf([0x52, 0x49, 0x46, 0x46], 500, 'logo.webp', 'image/webp');

    expect(await prepareTournamentGraphic(pdf, { port: fake })).toEqual({ ok: false, reason: 'type' });
    expect(await prepareTournamentGraphic(webp, { port: fake })).toEqual({ ok: false, reason: 'type' });
    expect(decode).not.toHaveBeenCalled();
  });

  it('@W3-030 eine umbenannte Datei (Inhalt nicht PNG/JPEG) ist keine Grafik, auch mit Endung .png', async () => {
    const { fake } = port({ width: 10, height: 10 });
    const fake1 = fileOf([0x00, 0x01, 0x02], 500, 'logo.png', 'image/png');

    expect(await prepareTournamentGraphic(fake1, { port: fake })).toEqual({ ok: false, reason: 'type' });
  });

  it('@W3-030 über 2 MB: Grund „Größe“ (size) ohne zu dekodieren; Grenze 2 097 152 Byte gilt noch, 2 097 153 nicht', async () => {
    const { fake, decode } = port({ width: 800, height: 600 });
    const grenze = printHeader.logoMaxBytes;

    expect(grenze).toBe(2_097_152);
    expect((await prepareTournamentGraphic(png(grenze), { port: fake })).ok).toBe(true);
    decode.mockClear();
    expect(await prepareTournamentGraphic(png(grenze + 1), { port: fake })).toEqual({ ok: false, reason: 'size' });
    expect(decode).not.toHaveBeenCalled();
  });

  it('@W3-030 Pixelgrenze vor dem Dekodieren: ein PNG mit 16000 × 16000 px im Kopf ist „size“, decode wird nicht aufgerufen', async () => {
    const { fake, decode } = port({ width: 16000, height: 16000 });

    expect(await prepareTournamentGraphic(pngWithSize(16000, 16000), { port: fake })).toEqual({ ok: false, reason: 'size' });
    expect(decode).not.toHaveBeenCalled();
  });

  it('@W3-030 Pixelgrenze: eine Seite über logoMaxSidePx (4001) ist „size“, auch bei JPEG', async () => {
    const { fake, decode } = port({ width: 10, height: 10 });

    expect(await prepareTournamentGraphic(pngWithSize(4001, 100), { port: fake })).toEqual({ ok: false, reason: 'size' });
    expect(await prepareTournamentGraphic(pngWithSize(100, 4001), { port: fake })).toEqual({ ok: false, reason: 'size' });
    expect(await prepareTournamentGraphic(jpegWithSize(5000, 100), { port: fake })).toEqual({ ok: false, reason: 'size' });
    expect(decode).not.toHaveBeenCalled();
  });

  it('@W3-030 Gegenbeispiel: 4000 × 4000 px (genau die Grenze) und 4000 × 200 werden dekodiert und verkleinert', async () => {
    const quadrat = port({ width: 4000, height: 4000 });
    const breit = port({ width: 4000, height: 200 });

    expect((await prepareTournamentGraphic(pngWithSize(4000, 4000), { port: quadrat.fake })).ok).toBe(true);
    expect((await prepareTournamentGraphic(jpegWithSize(4000, 200), { port: breit.fake })).ok).toBe(true);
    expect(quadrat.decode).toHaveBeenCalledTimes(1);
    expect(breit.decode).toHaveBeenCalledTimes(1);
  });

  it('@W3-030 PNG, JPG und SVG werden angenommen', async () => {
    const { fake } = port({ width: 800, height: 600 });

    for (const file of [png(), jpg(), svg()]) {
      expect((await prepareTournamentGraphic(file, { port: fake })).ok).toBe(true);
    }
  });

  it('@W3-030 Datei nicht lesbar (Decoder wirft): Grund „unreadable“, nichts übernommen', async () => {
    const { fake, render } = port({ width: 10, height: 10 }, { failDecode: true });

    expect(await prepareTournamentGraphic(png(), { port: fake })).toEqual({ ok: false, reason: 'unreadable' });
    expect(render).not.toHaveBeenCalled();
  });

  it('@W3-030 getainteter Canvas (SVG mit externem Bild: Lesen der Pixel wirft SecurityError): „unreadable“, nichts übernommen', async () => {
    const tainted = new DOMException('The canvas has been tainted by cross-origin data.', 'SecurityError');
    const { fake } = port({ width: 800, height: 600 }, { failRender: tainted });

    expect(await prepareTournamentGraphic(svg(), { port: fake })).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('@W3-030 Maße 0 (Decoder liefert kein Bild): „unreadable“', async () => {
    const { fake } = port({ width: 0, height: 0 });

    expect(await prepareTournamentGraphic(png(), { port: fake })).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('@W3-030 Gegenbeispiel: eine ungültige Datei liefert nur den Grund, nichts zum Übernehmen (ein vorhandenes Logo bleibt)', async () => {
    const { fake } = port({ width: 10, height: 10 });

    const result = await prepareTournamentGraphic(fileOf([0, 0, 0], 100, 'x.png', 'image/png'), { port: fake, computeAccent: true });

    expect(Object.keys(result).sort()).toEqual(['ok', 'reason']);
  });
});

describe('@DR-040 Warnung aus der Originalhöhe, Größenbegrenzung 600 px', () => {
  it('@DR-040 235 px warnt, 236 px nicht', async () => {
    const small = await prepareTournamentGraphic(png(), { port: port({ width: 235, height: 235 }).fake });
    const enough = await prepareTournamentGraphic(png(), { port: port({ width: 236, height: 236 }).fake });

    expect(small).toMatchObject({ ok: true, warnLowRes: true });
    expect(enough).toMatchObject({ ok: true, warnLowRes: false });
  });

  it('@DR-040 ein 141 px hohes Logo wird trotzdem übernommen und warnt', async () => {
    const result = await prepareTournamentGraphic(png(), { port: port({ width: 141, height: 141 }).fake });

    expect(result).toMatchObject({ ok: true, warnLowRes: true, graphic: { heightPx: 141, originalHeightPx: 141 } });
  });

  it('@DR-040 Warnung kommt aus der Originalhöhe: 1200 px Original wird auf 600 px verkleinert und warnt nicht', async () => {
    const { fake, render } = port({ width: 1200, height: 1200 });

    const result = await prepareTournamentGraphic(png(), { port: fake });

    expect(render).toHaveBeenCalledWith(expect.anything(), { width: 600, height: 600 }, 'image/png', expect.anything());
    expect(result).toMatchObject({ ok: true, warnLowRes: false, graphic: { widthPx: 600, heightPx: 600, originalHeightPx: 1200 } });
  });

  it('@DR-040 300 px Original bleibt 300 px (nie hochskaliert)', async () => {
    const { fake, render } = port({ width: 300, height: 300 });

    const result = await prepareTournamentGraphic(png(), { port: fake });

    expect(render).toHaveBeenCalledWith(expect.anything(), { width: 300, height: 300 }, 'image/png', expect.anything());
    expect(result).toMatchObject({ ok: true, graphic: { widthPx: 300, heightPx: 300, originalHeightPx: 300 } });
  });

  it('@W3-030 Höhe auf logoStoreMaxHeightPx begrenzt, Breite ergibt sich; höchstens logoStoreMaxWidthPx', async () => {
    const tall = port({ width: 2000, height: 4000 });
    const wide = port({ width: 4000, height: 800 });

    const a = await prepareTournamentGraphic(png(), { port: tall.fake });
    const b = await prepareTournamentGraphic(png(), { port: wide.fake });

    expect(printHeader.logoStoreMaxHeightPx).toBe(600);
    expect(printHeader.logoStoreMaxWidthPx).toBe(1200);
    expect(a).toMatchObject({ graphic: { widthPx: 300, heightPx: 600 } });
    expect(b).toMatchObject({ graphic: { widthPx: 1200, heightPx: 240 } });
  });
});

describe('@W3-030 Format der Ablage', () => {
  it('@W3-030 PNG bleibt PNG (Transparenz), JPG bleibt JPG mit Qualität 0,9, SVG wird PNG', async () => {
    const p = port({ width: 800, height: 600 });
    const j = port({ width: 800, height: 600 });
    const s = port({ width: 800, height: 600 });

    const png1 = await prepareTournamentGraphic(png(), { port: p.fake });
    const jpg1 = await prepareTournamentGraphic(jpg(), { port: j.fake });
    const svg1 = await prepareTournamentGraphic(svg(), { port: s.fake });

    expect(png1.ok && png1.graphic.dataUrl).toMatch(/^data:image\/png;/);
    expect(jpg1.ok && jpg1.graphic.dataUrl).toMatch(/^data:image\/jpeg;/);
    expect(j.render).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'image/jpeg', 0.9);
    expect(svg1.ok && svg1.graphic.dataUrl).toMatch(/^data:image\/png;/);
    expect(svg1.ok && svg1.graphic.dataUrl).not.toContain('<svg');
  });

  it('@DR-040 ein SVG ist Vektor: es wird auf die Höhe der Ablage gezeichnet und warnt nie', async () => {
    const { fake, render } = port({ width: 40, height: 40 });

    const result = await prepareTournamentGraphic(svg(), { port: fake });

    expect(render).toHaveBeenCalledWith(expect.anything(), { width: 600, height: 600 }, 'image/png', expect.anything());
    expect(result).toMatchObject({ ok: true, warnLowRes: false, graphic: { heightPx: 600, originalHeightPx: 600 } });
  });
});

describe('@DR-040 breites SVG', () => {
  it('@DR-040 ein SVG mit 2000 × 200 wird als 1200 × 120 abgelegt und warnt nicht (Vektor, kein Pixelmangel)', async () => {
    const { fake, render } = port({ width: 2000, height: 200 });

    const result = await prepareTournamentGraphic(svg(), { port: fake });

    expect(render).toHaveBeenCalledWith(expect.anything(), { width: 1200, height: 120 }, 'image/png', expect.anything());
    expect(result).toMatchObject({ ok: true, warnLowRes: false, graphic: { widthPx: 1200, heightPx: 120 } });
  });

  it('@DR-040 Gegenbeispiel: ein Raster mit 2000 × 200 warnt (Höhe 200 unter 236)', async () => {
    const result = await prepareTournamentGraphic(png(), { port: port({ width: 2000, height: 200 }).fake });

    expect(result).toMatchObject({ ok: true, warnLowRes: true });
  });
});

describe('@DR-041 Akzent nur für die linke Grafik', () => {
  it('@DR-041 mit computeAccent steht der Akzent aus den gezeichneten Pixeln im Ergebnis (Blau, 100 × 100 genügt)', async () => {
    const result = await prepareTournamentGraphic(png(), { port: port({ width: 100, height: 100 }).fake, computeAccent: true });

    expect(result).toMatchObject({ ok: true, accent: '#2A2576' });
  });

  it('@DR-041 Gegenbeispiel: ohne computeAccent (rechte Grafik) kein Akzent', async () => {
    const result = await prepareTournamentGraphic(png(), { port: port({ width: 100, height: 100 }).fake });

    expect(result.ok && result.accent).toBeUndefined();
  });

  it('@DR-041 ein Logo unter 64 Bildpunkten Kantenlänge liefert keinen Akzent (App-Grün), wird aber übernommen', async () => {
    const result = await prepareTournamentGraphic(png(), { port: port({ width: 63, height: 63 }).fake, computeAccent: true });

    expect(result).toMatchObject({ ok: true, warnLowRes: true });
    expect(result.ok && result.accent).toBeUndefined();
  });

  it('@DR-041 die 64-px-Grenze gilt für die Originalmaße: 4000 × 200 wird 1200 × 60 abgelegt und hat trotzdem einen Akzent', async () => {
    const result = await prepareTournamentGraphic(png(), { port: port({ width: 4000, height: 200 }).fake, computeAccent: true });

    expect(result).toMatchObject({ ok: true, graphic: { widthPx: 1200, heightPx: 60 }, accent: '#2A2576' });
  });

  it('@DR-041 Gegenbeispiel: 4000 × 63 hat keinen Akzent (Originalhöhe unter 64)', async () => {
    const result = await prepareTournamentGraphic(png(), { port: port({ width: 4000, height: 63 }).fake, computeAccent: true });

    expect(result.ok && result.accent).toBeUndefined();
  });
});
