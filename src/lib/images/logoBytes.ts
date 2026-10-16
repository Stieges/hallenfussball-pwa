/**
 * Bilddaten einer Kopfgrafik prüfen (B-28 C4, @DR-023/@DR-024). Rein: erkennt PNG und JPEG an den ersten Bytes, prüft
 * Größe und Format. Maße und Seitenverhältnis liest der Aufrufer aus den Bilddaten selbst (`render/headerGraphics.ts`).
 * Das Laden und Hochladen der Bilder ist A-29; hier kommen bereits geladene Daten an.
 */

export type LogoFormat = 'PNG' | 'JPEG';

/** Eine geladene Kopfgrafik: Bilddaten (Bytes oder Base64/Data-URL) und das Format, das der Aufrufer angibt. */
export interface LogoImage {
  data: Uint8Array | string;
  format: LogoFormat;
}

const SIGNATURES: Record<LogoFormat, readonly number[]> = {
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  JPEG: [0xff, 0xd8, 0xff],
};

/** Plausibler Bereich des Seitenverhältnisses (Breite ÷ Höhe) aus den Bilddaten. */
export const ASPECT_RANGE = { min: 0.1, max: 10 } as const;

function bytesOf(data: Uint8Array | string): Uint8Array | undefined {
  if (typeof data !== 'string') {
    return data;
  }
  const base64 = data.startsWith('data:') ? data.slice(data.indexOf(',') + 1) : data;
  try {
    return Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));
  } catch {
    return undefined;
  }
}

/**
 * Beginnen die Daten mit der Kennung des angegebenen Formats, und sind sie höchstens `maxBytes` groß? Eine PNG-Datei,
 * die als JPEG angegeben ist (oder umgekehrt), ist unbrauchbar.
 */
export function isUsableLogo(logo: LogoImage, maxBytes: number): boolean {
  const bytes = bytesOf(logo.data);
  const signature = SIGNATURES[logo.format] as readonly number[] | undefined;
  if (bytes === undefined || signature === undefined || bytes.length > maxBytes) {
    return false;
  }
  return signature.every((byte, i) => bytes[i] === byte);
}

/** Bildmaße in Bildpunkten. */
export interface PixelSize {
  width: number;
  height: number;
}

const SOF_MARKERS_EXCLUDED = new Set([0xc4, 0xc8, 0xcc]);

/**
 * Bildmaße aus dem Dateikopf (PNG: IHDR, JPEG: erster SOF-Block), ohne das Bild zu dekodieren. `undefined`, wenn der
 * Kopf fehlt oder unlesbar ist.
 */
export function imageSizeOf(logo: LogoImage): PixelSize | undefined {
  const bytes = bytesOf(logo.data);
  if (bytes === undefined) {
    return undefined;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (logo.format === 'PNG') {
    // Signatur (8 Byte), Blocklänge (4), „IHDR“ (4), dann Breite und Höhe als 32-Bit-Zahlen
    return bytes.length >= 24 ? { width: view.getUint32(16), height: view.getUint32(20) } : undefined;
  }
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      return undefined;
    }
    const marker = bytes[at + 1];
    if (marker >= 0xc0 && marker <= 0xcf && !SOF_MARKERS_EXCLUDED.has(marker)) {
      return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
    }
    at += 2 + view.getUint16(at + 2);
  }
  return undefined;
}
