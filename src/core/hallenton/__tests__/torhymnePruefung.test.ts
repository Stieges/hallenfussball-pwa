/**
 * @HT-024 Zeile „Olli eine Hymne mit 14 Sekunden hochladen will“ → „nimmt die App sie nicht an und sagt ‚höchstens
 * 10 Sekunden‘“: hier nur die Prüffunktion (Anzeige und Hochladen: H4). Dazu die Gegenbeispiele aus @HT-028 (Größe, Format)
 * für die Hymne: ≤ 1 MB, MP3/WAV/M4A.
 */
import { describe, expect, it } from 'vitest';
import { TORHYMNE_MAX_BYTES, pruefeTorhymne } from '../torhymnePruefung';

describe('@HT-024 Prüfung einer Torhymne vor dem Hochladen', () => {
  it('@HT-024 Olli will eine Hymne mit 14 Sekunden hochladen → zu_lang („höchstens 10 Sekunden“)', () => {
    expect(pruefeTorhymne({ groesseBytes: 400_000, dauerSek: 14, mime: 'audio/mpeg' })).toBe('zu_lang');
  });

  it('genau 10 Sekunden → ok; 10,01 Sekunden → zu_lang', () => {
    expect(pruefeTorhymne({ groesseBytes: 400_000, dauerSek: 10, mime: 'audio/mpeg' })).toBe('ok');
    expect(pruefeTorhymne({ groesseBytes: 400_000, dauerSek: 10.01, mime: 'audio/mpeg' })).toBe('zu_lang');
  });

  it('„Hymne A“ als MP3, WAV und iPhone-Aufnahme M4A (0,8 MB, 9 s) → ok', () => {
    for (const mime of ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4']) {
      expect(pruefeTorhymne({ groesseBytes: 800_000, dauerSek: 9, mime })).toBe('ok');
    }
  });

  it('größer als 1 MB → zu_gross; genau 1 MB → ok', () => {
    expect(pruefeTorhymne({ groesseBytes: TORHYMNE_MAX_BYTES + 1, dauerSek: 8, mime: 'audio/mpeg' })).toBe('zu_gross');
    expect(pruefeTorhymne({ groesseBytes: TORHYMNE_MAX_BYTES, dauerSek: 8, mime: 'audio/mpeg' })).toBe('ok');
  });

  it('kein MP3, WAV oder M4A (OGG, Video) → falsches_format, auch wenn es zugleich zu lang ist', () => {
    expect(pruefeTorhymne({ groesseBytes: 400_000, dauerSek: 8, mime: 'audio/ogg' })).toBe('falsches_format');
    expect(pruefeTorhymne({ groesseBytes: 400_000, dauerSek: 14, mime: 'video/mp4' })).toBe('falsches_format');
  });

  it('Gegenbeispiel: unbekannte Dauer (NaN) → zu_lang, nicht ok', () => {
    expect(pruefeTorhymne({ groesseBytes: 400_000, dauerSek: Number.NaN, mime: 'audio/mpeg' })).toBe('zu_lang');
  });
});
