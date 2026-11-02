/**
 * Turniergrafik beim Hochladen prüfen und aufbereiten (@W3-030, @DR-040, @DR-041, PDF-Paket T4).
 *
 * Datei → prüfen (Größe, Dateiart) → lesen → auf höchstens 600 px Höhe (Breite höchstens 1200 px) neu kodieren
 * (PNG bleibt PNG, JPG bleibt JPG mit Qualität 0,9, SVG wird PNG; nie hochskaliert) → Warnung aus der Originalhöhe →
 * Akzentfarbe aus den Pixeln der linken Grafik. EXIF-Drehung, CMYK-JPEG und 16-Bit-PNG erledigt das Neukodieren mit.
 * Bei `ok: false` bleibt eine schon hinterlegte Grafik unverändert; die Aufbereitung schreibt nie in den Speicher.
 * Der Browser-Anschluss (Canvas) steht in `browserGraphicPort.ts` und ist hier austauschbar (Tests ohne Browser).
 */
import { printHeader } from '../../design-tokens/print-header';
import type { StoredGraphic } from '../../core/storage/tournamentGraphicsStore';
import { accentFromPixels, type PixelImage } from '../color/accent';
import { imageSizeOf } from './logoBytes';
import { browserGraphicPort } from './browserGraphicPort';
import { SIGNATURE_BYTES, detectKind, isLowRes, storedSize, type GraphicKind, type RejectReason, type Size } from './graphicRules';

/** Ein gelesenes Bild; `source` ist für den Anschluss undurchsichtig (Bitmap oder Bildelement). */
export interface DecodedImage extends Size { source: unknown }

export type OutputMime = 'image/png' | 'image/jpeg';

export interface GraphicPort {
  /** Datei lesen (mit EXIF-Drehung). Wirft, wenn sie sich nicht lesen lässt. */
  decode(file: File, kind: GraphicKind): Promise<DecodedImage>;
  /** In den Maßen neu zeichnen und kodieren. Wirft, wenn die Pixel nicht lesbar sind (getainteter Canvas). */
  render(image: DecodedImage, size: Size, mime: OutputMime, quality: number): Promise<{ dataUrl: string; pixels: PixelImage }>;
}

export interface PrepareOptions {
  /** Akzentfarbe aus den Pixeln rechnen: nur für die linke Grafik (@DR-041). */
  computeAccent?: boolean;
  port?: GraphicPort;
}

export type PrepareResult =
  | { ok: true; graphic: StoredGraphic; warnLowRes: boolean; accent?: string }
  | { ok: false; reason: RejectReason };

const reject = (reason: RejectReason): PrepareResult => ({ ok: false, reason });

export async function prepareTournamentGraphic(file: File, options: PrepareOptions = {}): Promise<PrepareResult> {
  const port = options.port ?? browserGraphicPort;
  if (file.size > printHeader.logoMaxBytes) { return reject('size'); }
  const head = new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer());
  const kind = detectKind(head, file.type, file.name);
  if (kind === undefined) { return reject('type'); }
  // Pixelgrenze aus dem Dateikopf, bevor dekodiert wird: ein kleines PNG kann 16000 × 16000 Bildpunkte haben (etwa 1 GB RGBA).
  if (kind !== 'svg' && (await exceedsPixelLimit(file, kind))) { return reject('size'); }

  let decoded: DecodedImage;
  try {
    decoded = await port.decode(file, kind);
  } catch {
    return reject('unreadable');
  }
  if (!(decoded.width > 0) || !(decoded.height > 0)) { return reject('unreadable'); }

  const vector = kind === 'svg';
  const size = storedSize(decoded, vector);
  // Warnung aus der Originalhöhe, bevor verkleinert wird; ein SVG hat keine Pixelhöhe und warnt nie.
  const originalHeightPx = vector ? size.height : decoded.height;
  const mime: OutputMime = kind === 'jpeg' ? 'image/jpeg' : 'image/png';
  try {
    const rendered = await port.render(decoded, size, mime, printHeader.logoJpegQuality);
    return {
      ok: true,
      graphic: { dataUrl: rendered.dataUrl, widthPx: size.width, heightPx: size.height, originalHeightPx },
      // Ein SVG ist Vektor und warnt nie, auch wenn es breit und die abgelegte Höhe klein ist.
      warnLowRes: !vector && isLowRes(originalHeightPx),
      // Die 64-px-Grenze des Akzents gilt für das Original (bei SVG für die gezeichneten Maße), nicht für die Ablage.
      ...(options.computeAccent === true ? optionalAccent(accentFromPixels(rendered.pixels, vector ? size : decoded)) : {}),
    };
  } catch {
    return reject('unreadable');
  }
}

async function exceedsPixelLimit(file: File, kind: Exclude<GraphicKind, 'svg'>): Promise<boolean> {
  const dimensions = imageSizeOf({ data: new Uint8Array(await file.arrayBuffer()), format: kind === 'png' ? 'PNG' : 'JPEG' });
  if (dimensions === undefined) { return false; } // Kopf unlesbar: der Decoder entscheidet („unreadable“)
  return dimensions.width > printHeader.logoMaxSidePx
    || dimensions.height > printHeader.logoMaxSidePx
    || dimensions.width * dimensions.height > printHeader.logoMaxPixels;
}

const optionalAccent = (accent: string | undefined): { accent?: string } => (accent === undefined ? {} : { accent });
