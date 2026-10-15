/**
 * Kopfgrafiken (B-28 C4, @DR-023/@DR-024): Größe unter Höhen- und Breitengrenze mit erhaltenem Seitenverhältnis,
 * Zeichnen. Ein Bild, das sich nicht zeichnen lässt, fehlt im PDF; der Aufrufer meldet es vorher als Hinweis.
 */
import jsPDF from 'jspdf';
import { printHeader } from '../../../design-tokens/print-header';
import { isUsableLogo, type LogoImage } from '../../images/logoBytes';

/** Eine Grafik samt Größe auf dem Papier. */
export interface PlacedLogo {
  image: LogoImage;
  w: number;
  h: number;
}

/** Größe: höchstens `logoMaxHeight` hoch und `logoMaxWidth` breit, Seitenverhältnis erhalten. */
export function placeLogo(image: LogoImage): PlacedLogo {
  const h = Math.min(printHeader.logoMaxHeight, printHeader.logoMaxWidth / image.aspect);
  return { image, w: h * image.aspect, h };
}

/** Prüft die Daten und probiert das Zeichnen auf einem Wegwerf-Dokument: nur was beides besteht, kommt in den Kopf. */
export function usableLogo(image: LogoImage | undefined): PlacedLogo | undefined {
  if (image === undefined || !isUsableLogo(image)) {
    return undefined;
  }
  const placed = placeLogo(image);
  try {
    new jsPDF({ unit: 'mm', format: 'a4' }).addImage(image.data, image.format, 0, 0, placed.w, placed.h);
  } catch {
    return undefined;
  }
  return placed;
}

export function drawLogo(doc: jsPDF, logo: PlacedLogo, x: number, y: number): void {
  doc.addImage(logo.image.data, logo.image.format, x, y, logo.w, logo.h);
}
