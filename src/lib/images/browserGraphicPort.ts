/**
 * Browser-Anschluss der Grafik-Aufbereitung (T4): Lesen und Neuzeichnen über Canvas.
 * - Raster: `createImageBitmap(file, { imageOrientation: 'from-image' })` (EXIF-Drehung); ältere WebKit-Fassungen ohne
 *   Optionen fallen auf den einfachen Aufruf zurück.
 * - SVG: über ein Bildelement mit `decode()` (WebKit hat Lücken bei `createImageBitmap` mit SVG-Blobs). Ein SVG in einem
 *   Bildelement führt keine Skripte aus und lädt keine externen Verweise nach.
 * - JPEG hat keine Transparenz: der Grund wird vorher weiß gefüllt, sonst würde er schwarz.
 * Ein getainteter Canvas (Pixel nicht lesbar) wirft; der Aufrufer meldet „unreadable“.
 */
import { printColors } from '../../design-tokens/print';
import type { GraphicKind } from './graphicRules';
import type { DecodedImage, GraphicPort, OutputMime } from './prepareTournamentGraphic';

async function decodeSvg(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeRaster(file: File): Promise<DecodedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  return { source: bitmap, width: bitmap.width, height: bitmap.height };
}

export const browserGraphicPort: GraphicPort = {
  decode: (file: File, kind: GraphicKind) => (kind === 'svg' ? decodeSvg(file) : decodeRaster(file)),

  async render(image: DecodedImage, size, mime: OutputMime, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) { throw new Error('Canvas 2D nicht verfügbar'); }
    if (mime === 'image/jpeg') {
      const [r, g, b] = printColors.paper;
      ctx.fillStyle = `rgb(${r} ${g} ${b})`;
      ctx.fillRect(0, 0, size.width, size.height);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image.source as CanvasImageSource, 0, 0, size.width, size.height);
    if (image.source instanceof ImageBitmap) { image.source.close(); }
    const pixels = ctx.getImageData(0, 0, size.width, size.height); // wirft bei getaintetem Canvas
    return { dataUrl: canvas.toDataURL(mime, quality), pixels };
  },
};
