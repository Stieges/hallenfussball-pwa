/**
 * B-28 C3 (B10e): die Abdeckung `PDF_FONT.coverage` stimmt mit der cmap der eingebetteten Teilmenge überein, in beiden
 * Schnitten. Bisher nur beim Kürzen der Schrift geprüft; hier als Dauertest, damit eine neue Schriftdatei nicht stumm
 * von der Liste abweicht (Zeichen, die gemeldet werden, aber da sind, oder umgekehrt).
 */
import { describe, expect, it } from 'vitest';
import { PDF_FONT } from '../fonts';
import { cmapCodepoints } from './pdfFontMetrics';

/** Codepunkte der Abdeckungsliste. */
function coverageSet(): Set<number> {
  const set = new Set<number>();
  for (const [from, to] of PDF_FONT.coverage) {
    for (let code = from; code <= to; code++) {
      set.add(code);
    }
  }
  return set;
}

/** Codepunkte, die nicht gedruckt werden: Steuerzeichen und .notdef. */
const nichtDruckbar = (code: number): boolean => code < 0x20 || (code >= 0x7f && code < 0xa0);

describe('B10e Abdeckung = cmap der eingebetteten Teilmenge', () => {
  it.each(['regular.ts', 'bold.ts'])('%s: jeder Codepunkt der Liste steht in der cmap und umgekehrt (ohne Steuerzeichen)', datei => {
    const cmap = new Set([...cmapCodepoints(datei)].filter(code => !nichtDruckbar(code)));
    const liste = coverageSet();

    const fehltInCmap = [...liste].filter(code => !cmap.has(code)).map(code => `U+${code.toString(16).toUpperCase().padStart(4, '0')}`);
    const fehltInListe = [...cmap].filter(code => !liste.has(code)).map(code => `U+${code.toString(16).toUpperCase().padStart(4, '0')}`);

    expect(fehltInCmap, 'in der Liste, aber nicht in der Schrift').toEqual([]);
    expect(fehltInListe, 'in der Schrift, aber nicht in der Liste').toEqual([]);
  });

  it('Gegenbeispiel: die Liste ist nicht leer und die Auswertung erkennt eine Abweichung', () => {
    const cmap = cmapCodepoints('regular.ts');

    expect(cmap.size).toBeGreaterThan(800);
    expect(cmap.has(0x0041)).toBe(true);
    expect(cmap.has(0x0645)).toBe(false);
    expect(cmap.has(0x26bd)).toBe(false);
  });
});
