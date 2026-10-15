/**
 * Kopfgrafiken (B-28 C4, @DR-023/@DR-024): Prüfung, Größe unter Höhen- und Breitengrenze mit erhaltenem Seitenverhältnis,
 * Zeichnen. Eine Grafik gilt nur dann als brauchbar, wenn Dateianfang und Größe stimmen und sich das Bild lesen lässt
 * (Probe-Zeichnen; Maße aus dem Dateikopf, Pixelgrenze als Token). Das Seitenverhältnis kommt aus den Bilddaten, nicht vom Aufrufer.
 * Sonst fehlt die Grafik im PDF; der Aufrufer meldet es vorher als Hinweis.
 */
import jsPDF from 'jspdf';
import { printHeader } from '../../../design-tokens/print-header';
import { ASPECT_RANGE, imageSizeOf, isUsableLogo, type LogoImage } from '../../images/logoBytes';

/** Eine Grafik samt Größe auf dem Papier. */
export interface PlacedLogo {
  image: LogoImage;
  w: number;
  h: number;
}

/** Größe: höchstens `logoMaxHeight` hoch und `logoMaxWidth` breit, Seitenverhältnis erhalten. */
export function placeLogo(image: LogoImage, aspect: number): PlacedLogo {
  const h = Math.min(printHeader.logoMaxHeight, printHeader.logoMaxWidth / aspect);
  return { image, w: h * aspect, h };
}

/** Prüft die Daten, liest die Maße aus dem Dateikopf und probiert das Zeichnen: nur was alles besteht, kommt in den Kopf. */
export function usableLogo(image: LogoImage | undefined): PlacedLogo | undefined {
  if (image === undefined || !isUsableLogo(image, printHeader.logoMaxBytes)) {
    return undefined;
  }
  // Maße einmal aus dem Dateikopf lesen, vor jedem Dekodieren: zu große Bilder werden nie geladen (Speicher, Zeit)
  const size = imageSizeOf(image);
  if (size === undefined) {
    return undefined;
  }
  const { width, height } = size;
  const aspect = width / height;
  const tooBig = width > printHeader.logoMaxSidePx || height > printHeader.logoMaxSidePx || width * height > printHeader.logoMaxPixels;
  if (tooBig || !(width > 0) || !(height > 0) || aspect < ASPECT_RANGE.min || aspect > ASPECT_RANGE.max) {
    return undefined;
  }
  try {
    const probe = new jsPDF({ unit: 'mm', format: 'a4' });
    const placed = placeLogo(image, aspect);
    probe.addImage(image.data, image.format, 0, 0, placed.w, placed.h);
    return placed;
  } catch {
    return undefined;
  }
}

export function drawLogo(doc: jsPDF, logo: PlacedLogo, x: number, y: number): void {
  doc.addImage(logo.image.data, logo.image.format, x, y, logo.w, logo.h);
}
