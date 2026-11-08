/**
 * Prüfung einer Torhymne vor dem Hochladen (@HT-024 Zeile „Olli eine Hymne mit 14 Sekunden hochladen will“ → „höchstens
 * 10 Sekunden“; Anzeige und Hochladen-Dialog: H4). Rein, ohne React. Grenzen wie der Bucket `hallenton-sounds`
 * (20261121_001: ≤ 1 MB, MP3/WAV/M4A) und die harte Grenze der Hymne (10 s). Reihenfolge: erst das Format (ohne passendes
 * Format ist die Dauer nicht verlässlich), dann die Größe, dann die Dauer.
 */
import { TORHYMNE_MAX_MS } from './torhymne';

/** Größte Datei (wie `file_size_limit` des Buckets). */
export const TORHYMNE_MAX_BYTES = 1_048_576;

/** MIME-Typen von MP3, WAV und M4A (wie `allowed_mime_types` des Buckets). */
export const TORHYMNE_MIME_TYPEN: readonly string[] = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
];

export type TorhymnePruefung = 'ok' | 'zu_lang' | 'zu_gross' | 'falsches_format';

export interface TorhymneDatei {
  groesseBytes: number;
  dauerSek: number;
  mime: string;
}

export function pruefeTorhymne({ groesseBytes, dauerSek, mime }: TorhymneDatei): TorhymnePruefung {
  if (!TORHYMNE_MIME_TYPEN.includes(mime.trim().toLowerCase())) {
    return 'falsches_format';
  }
  if (!Number.isFinite(groesseBytes) || groesseBytes > TORHYMNE_MAX_BYTES) {
    return 'zu_gross';
  }
  if (!Number.isFinite(dauerSek) || dauerSek * 1000 > TORHYMNE_MAX_MS) {
    return 'zu_lang';
  }
  return 'ok';
}
