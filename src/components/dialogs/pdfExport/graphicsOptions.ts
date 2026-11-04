/**
 * Turniergrafiken aus dem Gerätespeicher als Eingang der PDFs (PDF-Paket T8; @DR-023, @DR-024, @DR-041, @W3-030, @W3-040):
 * linke und rechte Grafik als `logoLeft`/`logoRight`, die Akzentfarbe aus der linken Grafik samt hellem Ton für Flächen.
 * Das Druckmodul rechnet keine Farbe (Wächtertest `accentGuard`), deshalb rechnet der Aufrufer hier.
 */
import type { StoredGraphic, TournamentGraphics } from '../../../core/storage/tournamentGraphicsStore';
import { zebraTone } from '../../../lib/color/accent';
import type { LogoImage } from '../../../lib/images/logoBytes';
import type { PDFExportOptions } from '../../../lib/pdf/pdfOptions';

/** Gespeichert sind nur `data:image/png` und `data:image/jpeg` (Schema des Speichers); das Format folgt der Kennung. */
function logoOf(graphic: StoredGraphic | undefined): LogoImage | undefined {
  if (graphic === undefined) { return undefined; }
  return { data: graphic.dataUrl, format: graphic.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG' };
}

/**
 * Grafiken und Akzent für `PDFExportOptions`. Der Akzent gilt nur mit einer linken Grafik (@DR-041: nur rechte Grafik →
 * Grün der App); ohne Akzent im Speicher bleibt die Vorgabe des Druckmoduls (Grün der App).
 */
export function graphicsOptions(graphics: TournamentGraphics | undefined): Pick<PDFExportOptions, 'logoLeft' | 'logoRight' | 'accent'> {
  if (graphics === undefined) { return {}; }
  const left = logoOf(graphics.left);
  const right = logoOf(graphics.right);
  const line = left !== undefined ? graphics.accent : undefined;
  return {
    ...(left ? { logoLeft: left } : {}),
    ...(right ? { logoRight: right } : {}),
    ...(line !== undefined ? { accent: { line, tint: zebraTone(line) } } : {}),
  };
}
