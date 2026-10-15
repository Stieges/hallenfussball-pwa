/**
 * Bilddaten einer Kopfgrafik prüfen (B-28 C4, @DR-023/@DR-024). Rein: erkennt PNG und JPEG an den ersten Bytes und
 * prüft das Seitenverhältnis. Das Laden und Hochladen der Bilder ist A-29; hier kommen bereits geladene Daten an.
 */

export type LogoFormat = 'PNG' | 'JPEG';

/** Eine geladene Kopfgrafik: Bilddaten (Bytes oder Base64/Data-URL), Format, Seitenverhältnis Breite ÷ Höhe. */
export interface LogoImage {
  data: Uint8Array | string;
  format: LogoFormat;
  aspect: number;
}

const SIGNATURES: Record<LogoFormat, readonly number[]> = {
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  JPEG: [0xff, 0xd8, 0xff],
};

/** Plausibler Bereich des Seitenverhältnisses (Breite ÷ Höhe). */
const ASPECT_RANGE = { min: 0.1, max: 10 } as const;

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

/** Beginnen die Daten mit der Kennung des angegebenen Formats, und ist das Seitenverhältnis plausibel? */
export function isUsableLogo(logo: LogoImage): boolean {
  if (!Number.isFinite(logo.aspect) || logo.aspect < ASPECT_RANGE.min || logo.aspect > ASPECT_RANGE.max) {
    return false;
  }
  const bytes = bytesOf(logo.data);
  const signature = SIGNATURES[logo.format] as readonly number[] | undefined;
  if (bytes === undefined || signature === undefined) {
    return false;
  }
  return signature.every((byte, i) => bytes[i] === byte);
}
