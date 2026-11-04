/**
 * PDF-Paket T8: Grafiken und Akzent aus dem Gerätespeicher als Optionen der PDFs (@DR-023, @DR-041, @W3-030, @W3-040).
 * Erwartungswerte aus dem Gherkin und den Beispielen der Notiz „Turnierfarbe“ (TSV-Blau #2A2576 → Zebra #DDDCE9).
 */
import { describe, expect, it } from 'vitest';
import type { TournamentGraphics } from '../../../../core/storage/tournamentGraphicsStore';
import { graphicsOptions } from '../graphicsOptions';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const JPEG = 'data:image/jpeg;base64,/9j/4AAQ';
const grafik = (dataUrl: string) => ({ dataUrl, widthPx: 300, heightPx: 300, originalHeightPx: 300 });
const BLAU = '#2A2576';

describe('@DR-023 @W3-030 Grafiken aus dem Gerätespeicher', () => {
  it('links PNG und rechts JPEG: beide kommen mit dem Format der Kennung als Kopfgrafik an', () => {
    const options = graphicsOptions({ left: grafik(PNG), right: grafik(JPEG) });

    expect(options.logoLeft).toEqual({ data: PNG, format: 'PNG' });
    expect(options.logoRight).toEqual({ data: JPEG, format: 'JPEG' });
  });

  it('@W3-030 Co-Admin-Gerät ohne Eintrag: keine Grafik, kein Akzent', () => {
    expect(graphicsOptions({})).toEqual({});
    expect(graphicsOptions(undefined)).toEqual({});
  });

  it('nur die rechte Grafik: nur logoRight', () => {
    const options = graphicsOptions({ right: grafik(PNG) });

    expect(options).toEqual({ logoRight: { data: PNG, format: 'PNG' } });
  });
});

describe('@DR-041 Akzent aus dem Speicher', () => {
  it('@DR-041 Wappen-Blau #2A2576 wird zur Linienfarbe, der helle Ton für Flächen ist #DDDCE9', () => {
    const options = graphicsOptions({ left: grafik(PNG), accent: BLAU });

    expect(options.accent).toEqual({ line: BLAU, tint: '#DDDCE9' });
  });

  it('@DR-041 nur rechte Grafik: der Akzent bleibt das Grün der App (kein accent in den Optionen)', () => {
    const mitAkzent: TournamentGraphics = { right: grafik(PNG), accent: BLAU };

    expect(graphicsOptions(mitAkzent).accent).toBeUndefined();
    expect(graphicsOptions({ right: grafik(PNG) }).accent).toBeUndefined();
  });

  it('@DR-041 linke Grafik ohne brauchbare Farbe (weißes Logo): kein accent, das Grün der App bleibt', () => {
    expect(graphicsOptions({ left: grafik(PNG) }).accent).toBeUndefined();
  });

  it('@DR-001 der helle Ton liegt mindestens 60 Grauwertstufen über der Linie und höchstens bei 222', () => {
    const { accent } = graphicsOptions({ left: grafik(PNG), accent: BLAU });
    const gray = (hex: string): number => Math.round(0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16));

    expect(gray(accent?.tint ?? '#000000')).toBeLessThanOrEqual(222);
    expect(gray(accent?.tint ?? '#000000') - gray(accent?.line ?? '#ffffff')).toBeGreaterThanOrEqual(60);
  });
});
