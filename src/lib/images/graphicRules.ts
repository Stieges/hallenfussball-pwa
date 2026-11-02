/**
 * Reine Regeln für das Aufbereiten einer Turniergrafik beim Hochladen (@W3-030, @DR-040): Dateiart erkennen, Maße der
 * Ablage rechnen, Warnschwelle. Ohne DOM; der Ablauf steht in `prepareTournamentGraphic.ts`.
 */
import { printHeader } from '../../design-tokens/print-header';

export type GraphicKind = 'png' | 'jpeg' | 'svg';

/** Warum eine Datei nicht angenommen wird: andere Dateiart, zu groß, nicht lesbar (@W3-030). */
export type RejectReason = 'type' | 'size' | 'unreadable';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
/** So viele Anfangsbytes genügen, um PNG und JPEG zu erkennen. */
export const SIGNATURE_BYTES = PNG_SIGNATURE.length;

const startsWith = (head: Uint8Array, signature: number[]): boolean => signature.every((byte, i) => head[i] === byte);

/** PNG und JPEG erkennt die Datei an den ersten Bytes (nicht an der Endung), SVG an Dateityp oder Endung. */
export function detectKind(head: Uint8Array, mime: string, name: string): GraphicKind | undefined {
  if (startsWith(head, PNG_SIGNATURE)) { return 'png'; }
  if (startsWith(head, JPEG_SIGNATURE)) { return 'jpeg'; }
  if (mime === 'image/svg+xml' || name.toLowerCase().endsWith('.svg')) { return 'svg'; }
  return undefined;
}

export interface Size { width: number; height: number }

/**
 * Maße der Ablage: Höhe höchstens `logoStoreMaxHeightPx`, Breite höchstens `logoStoreMaxWidthPx`, Seitenverhältnis bleibt.
 * Ein Bild wird nie hochskaliert (`vector: false`); ein SVG ist Vektor und wird auf die Ablagehöhe gezeichnet.
 */
export function storedSize(original: Size, vector: boolean): Size {
  const fit = Math.min(printHeader.logoStoreMaxHeightPx / original.height, printHeader.logoStoreMaxWidthPx / original.width);
  const scale = vector ? fit : Math.min(1, fit);
  return {
    width: Math.max(1, Math.round(original.width * scale)),
    height: Math.max(1, Math.round(original.height * scale)),
  };
}

/** Warnung „kann im Druck unscharf wirken“ (@DR-040): aus der Höhe des Originals, vor dem Verkleinern. */
export function isLowRes(originalHeightPx: number): boolean {
  return originalHeightPx < printHeader.logoWarnBelowHeightPx;
}
