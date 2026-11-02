/**
 * T2 (PDF-Paket PR 2): Akzentfarbe aus den Pixeln des Turnierlogos.
 * Gherkin: @DR-041 (Beispieltabelle, Gelbregel, Abdunkeln auf 3 : 1), @DR-001 (Zebra mindestens 12 % Schwarz,
 * Akzent in Graustufen unterscheidbar), @DR-024 (ohne Logo: Grün der App). Erwartungswerte stehen in der Notiz
 * „Turnierfarbe“ (Mockup-Runde 30.10.): TSV-Blau #2A2576, Gelb #FFD400 → #B09200, Zebra #DDDCE9 bei Grauwert 222.
 * Alle Bilder sind synthetische Pixel, kein echtes Vereinswappen.
 */
import { describe, expect, it } from 'vitest';
import { getContrastRatio, hexToHsl, hexToRgb, hslToHex } from '../../colorUtils';
import { palette } from '../../../design-tokens/colors/palette';
import { printAccent, printLimits } from '../../../design-tokens/print';
import { accentFromPixels, accentOrFallback, darkenForPrint, grayOf, zebraTone, type PixelImage } from '../accent';

type Rgba = readonly [number, number, number, number];

const WHITE = '#FFFFFF';
const opaque = (hex: string): Rgba => {
  const { r, g, b } = hexToRgb(hex);
  return [r, g, b, 255];
};

/** Bild aus Läufen (Farbe, Anzahl Pixel) der Reihe nach; der Rest bleibt durchsichtig. */
function paint(width: number, height: number, runs: ReadonlyArray<readonly [Rgba, number]>): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  let at = 0;
  for (const [color, count] of runs) {
    for (let i = 0; i < count; i++, at++) {
      data.set(color, at * 4);
    }
  }
  return { data, width, height };
}

/** 100 × 100 Bildpunkte: Anteile in Zehntelprozent von 10 000 (556 = 5,56 %). */
const square = (runs: ReadonlyArray<readonly [Rgba, number]>): PixelImage => paint(100, 100, runs);

describe('@DR-041 Akzentfarbe aus dem Turnierlogo (Beispieltabelle)', () => {
  it('@DR-041 Wappen überwiegend Blau, etwas Grün → das Blau (#2A2576, 55,6 % vor 6,9 %), nicht abgedunkelt', () => {
    const wappen = square([[opaque('#2A2576'), 5560], [opaque('#6A9329'), 690], [opaque('#FFFFFF'), 2000]]);

    expect(accentFromPixels(wappen)).toBe('#2A2576');
    expect(getContrastRatio('#2A2576', WHITE)).toBeCloseTo(12.93, 2);
  });

  it('@DR-041 Rot, Gelb und Schwarz mit etwa gleich viel Rot und Gelb → das Rot (Gelb gewinnt nur ohne 80-%-Rivalen)', () => {
    const rot = opaque('#FF0808');
    const wappen = square([[opaque('#FFD400'), 3105], [rot, 3067], [opaque('#000000'), 3000]]);

    expect(accentFromPixels(wappen)).toBe('#FF0808');
  });

  it('@DR-041 Gelb gewinnt, wenn die andere Farbe unter 80 % seiner Wertung bleibt (40 % Gelb, 25 % Rot)', () => {
    const wappen = square([[opaque('#FFD400'), 4000], [opaque('#FF0808'), 2500]]);

    expect(accentFromPixels(wappen)).toBe('#B09200');
  });

  it('@DR-041 kräftiges Gelb #FFD400 → dieses Gelb, abgedunkelt auf #B09200 (3,02 : 1)', () => {
    const gelb = square([[opaque('#FFD400'), 6000]]);

    expect(getContrastRatio('#FFD400', WHITE)).toBeLessThan(printAccent.minContrast);
    expect(accentFromPixels(gelb)).toBe('#B09200');
    expect(getContrastRatio('#B09200', WHITE)).toBeCloseTo(3.02, 2);
  });

  it('@DR-041 weißes Logo auf durchsichtigem Grund → undefined (Grün der App)', () => {
    const weiss = square([[opaque('#FFFFFF'), 5000]]);

    expect(accentFromPixels(weiss)).toBeUndefined();
  });

  it('@DR-041 Logo mit weniger als 64 Bildpunkten Kantenlänge → undefined; 64 genügt', () => {
    const blau = (edge: number): PixelImage => paint(edge, edge, [[opaque('#2A2576'), edge * edge]]);

    expect(accentFromPixels(blau(63))).toBeUndefined();
    expect(accentFromPixels(blau(64))).toBe('#2A2576');
  });

  it('@DR-041 die Grenze gilt für die angegebenen Originalmaße, nicht für die abgelegten Pixel (1200 × 60 aus 4000 × 200)', () => {
    const abgelegt = paint(1200, 60, [[opaque('#2A2576'), 1200 * 60]]);

    expect(accentFromPixels(abgelegt)).toBeUndefined();
    expect(accentFromPixels(abgelegt, { width: 4000, height: 200 })).toBe('#2A2576');
    expect(accentFromPixels(abgelegt, { width: 4000, height: 63 })).toBeUndefined();
  });

  it('@DR-041 Kürzere Seite zählt: 64 × 600 genügt, 600 × 63 nicht', () => {
    expect(accentFromPixels(paint(64, 600, [[opaque('#2A2576'), 64 * 600]]))).toBe('#2A2576');
    expect(accentFromPixels(paint(600, 63, [[opaque('#2A2576'), 600 * 63]]))).toBeUndefined();
  });

  it('@DR-041 keins: ohne Logo gilt das Grün der App (#047857 aus palette.emerald[700])', () => {
    expect(accentOrFallback(undefined)).toBe(palette.emerald[700]);
    expect(printAccent.fallback).toBe(palette.emerald[700]);
    expect(getContrastRatio(printAccent.fallback, WHITE)).toBeGreaterThanOrEqual(printAccent.minContrast);
    expect(accentOrFallback('#2A2576')).toBe('#2A2576');
  });
});

describe('@DR-041 Gegenbeispiele: was nicht zählt', () => {
  it('@DR-041 Schatten und weiche Ränder (Alpha < 0,9) zählen nicht: halbdurchsichtiges Blau allein → undefined', () => {
    const schatten = square([[[42, 37, 118, 128], 6000]]);

    expect(accentFromPixels(schatten)).toBeUndefined();
  });

  it('@DR-041 Schatten zählt nicht mit, aber der deckende Rest gewinnt (Blau mit Alpha 0,5 neben deckendem Grün)', () => {
    const logo = square([[[42, 37, 118, 128], 6000], [opaque('#6A9329'), 1000]]);

    expect(accentFromPixels(logo)).toBe('#6A9329');
  });

  it('@DR-041 Alpha genau 0,9 zählt, knapp darunter nicht', () => {
    const grenze = Math.ceil(0.9 * 255);
    const knapp = grenze - 1;

    expect(accentFromPixels(square([[[42, 37, 118, grenze], 5000]]))).toBe('#2A2576');
    expect(accentFromPixels(square([[[42, 37, 118, knapp], 5000]]))).toBeUndefined();
  });

  it('@DR-041 ein roter Punkt mit 0,3 % Fläche im schwarzen Logo → undefined (unter 2 %)', () => {
    const logo = square([[opaque('#000000'), 9000], [opaque('#E00000'), 30]]);

    expect(accentFromPixels(logo)).toBeUndefined();
  });

  it('@DR-041 Graublau mit Sättigung unter 0,25 und fast Schwarz mit Farbstich zählen nicht', () => {
    const logo = square([[opaque('#8090A0'), 4000], [opaque('#2A0000'), 4000]]);

    expect(accentFromPixels(logo)).toBeUndefined();
  });

  it('@DR-041 Orange mit 30° ist kein Gelb: knapp vor Rot gewinnt es ohne 80-%-Regel', () => {
    const orange = opaque('#FF8000');
    const logo = square([[orange, 3100], [opaque('#FF0808'), 3000]]);

    const accent = accentFromPixels(logo);

    expect(accent).toBeDefined();
    expect(Math.abs(hexToHsl(accent ?? '#000000').h - hexToHsl('#FF8000').h)).toBeLessThanOrEqual(1);
  });
});

describe('@DR-041 abgedunkelt im gleichen Farbton', () => {
  const eingaben = ['#FFD400', '#FFE680', '#00E5FF', '#FF69B4', '#9ACD32', '#FFA500'];

  it.each(eingaben)('@DR-041 %s: Farbton ±1°, Sättigung ±0,01, Kontrast ≥ 3 : 1, nicht dunkler als nötig', (eingabe) => {
    const vorher = hexToHsl(eingabe);
    const dunkler = darkenForPrint(eingabe);
    const nachher = hexToHsl(dunkler);

    expect(Math.abs(nachher.h - vorher.h)).toBeLessThanOrEqual(1);
    expect(Math.abs(nachher.s - vorher.s) / 100).toBeLessThanOrEqual(0.01);
    expect(getContrastRatio(dunkler, WHITE)).toBeGreaterThanOrEqual(printAccent.minContrast);
    // Ein Schritt (0,5 % Helligkeit) heller liegt unter 3 : 1 (Toleranz auf dem Kontrastwert wegen der Hex-Rundung).
    const heller = hslToHex({ ...nachher, l: nachher.l + 0.5 });
    expect(getContrastRatio(heller, WHITE)).toBeLessThan(printAccent.minContrast + 0.05);
  });

  it('@DR-041 Pastellgelb #FFE680 wird abgedunkelt, Sättigung bleibt (HSL-L 0,75 → erst dort würde RGB-Skalieren sie ändern)', () => {
    const vorher = hexToHsl('#FFE680');
    const dunkler = darkenForPrint('#FFE680');
    const nachher = hexToHsl(dunkler);

    expect(vorher.l).toBeGreaterThan(50);
    expect(nachher.l).toBeLessThan(vorher.l);
    expect(Math.abs(nachher.s - vorher.s) / 100).toBeLessThanOrEqual(0.01);
    expect(getContrastRatio(dunkler, WHITE)).toBeGreaterThanOrEqual(printAccent.minContrast);
  });

  it('@DR-041 eine Farbe mit ausreichendem Kontrast bleibt unverändert', () => {
    expect(darkenForPrint('#2A2576')).toBe('#2A2576');
    expect(darkenForPrint('#047857')).toBe('#047857');
  });

  it('@DR-041 ein Gelb im Logo wird beim Berechnen abgedunkelt: Pastellgelb-Bild → Farbton gleich, Kontrast ≥ 3 : 1', () => {
    const accent = accentFromPixels(square([[opaque('#FFE680'), 6000]]));

    expect(accent).toBeDefined();
    expect(getContrastRatio(accent ?? WHITE, WHITE)).toBeGreaterThanOrEqual(printAccent.minContrast);
    expect(Math.abs(hexToHsl(accent ?? WHITE).h - hexToHsl('#FFE680').h)).toBeLessThanOrEqual(1);
  });
});

describe('@DR-001 Zebra-Ton und Graustufen', () => {
  it.each([
    ['TSV-Blau', '#2A2576', '#DDDCE9'],
    ['TSV-Grün', '#6A9329', '#DAE4CA'],
    ['App-Grün', '#047857', '#CFE5DF'],
    ['Gelb abgedunkelt', '#B09200', '#E9E0B8'],
  ])('@DR-001 Zebra-Ton zu %s %s ist %s bei Grauwert 222', (_name, akzent, erwartet) => {
    expect(zebraTone(akzent)).toBe(erwartet);
    expect(grayOf(erwartet)).toBe(printAccent.zebraMaxGray);
  });

  it('@DR-001 Zebra-Ton ≥ 12 % Schwarz (Grauwert ≤ 222), auch für sehr dunklen und sehr hellen Akzent', () => {
    const sehrHell = darkenForPrint('#FFFFE0');
    for (const akzent of ['#050505', '#000001', '#2A2576', sehrHell]) {
      const grau = grayOf(zebraTone(akzent));

      expect(grau).toBeLessThanOrEqual(printAccent.zebraMaxGray);
      expect(((255 - grau) / 255) * 100).toBeGreaterThanOrEqual(printLimits.tintMinPercent);
    }
  });

  it('@DR-001 der Zebra-Ton ist die hellste Mischung mit Weiß (kein dunklerer Ton als nötig)', () => {
    const grau = grayOf(zebraTone('#2A2576'));

    expect(grau).toBeGreaterThan(printAccent.zebraMaxGray - 3);
  });

  it('@DR-001 Akzentlinie und Zebra sind in Graustufen unterscheidbar (Abstand ≥ minGrayGap) für die vier Beispiele', () => {
    for (const akzent of ['#2A2576', '#6A9329', '#047857', '#B09200']) {
      expect(grayOf(zebraTone(akzent)) - grayOf(akzent)).toBeGreaterThanOrEqual(printAccent.minGrayGap);
    }
  });

  it('@DR-001 jeder Farbton, so abgedunkelt wie die Berechnung ihn liefert, bleibt in Graustufen vom Zebra unterscheidbar', () => {
    const schwach: string[] = [];
    for (let h = 0; h < 360; h += 5) {
      const akzent = darkenForPrint(hslToHex({ h, s: 100, l: 50 }));
      if (grayOf(zebraTone(akzent)) - grayOf(akzent) < printAccent.minGrayGap) {
        schwach.push(`${h}° ${akzent}`);
      }
    }

    expect(schwach).toEqual([]);
  });
});
