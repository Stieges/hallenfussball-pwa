/**
 * Fixture-Grafiken für den Kopf (B-28 C4, @DR-023/@DR-024): gültige Graustufen-PNG beliebiger Größe, dazu kaputte
 * Bilddaten. Nur Testdaten; das Laden und Hochladen echter Logos ist A-29.
 */
import { deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) {
    c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(Buffer.from(type, 'latin1'), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Gültige Graustufen-PNG (8 Bit) mit Rahmen, damit sie im Ausdruck erkennbar ist. */
export function pngBytes(widthPx: number, heightPx: number): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, widthPx);
  view.setUint32(4, heightPx);
  header[8] = 8; // Bittiefe
  header[9] = 0; // Graustufen
  const rows: number[] = [];
  for (let y = 0; y < heightPx; y++) {
    rows.push(0); // Filter „none“
    for (let x = 0; x < widthPx; x++) {
      const border = x === 0 || y === 0 || x === widthPx - 1 || y === heightPx - 1;
      rows.push(border ? 0 : 160);
    }
  }
  const parts = [PNG_SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(Uint8Array.from(rows))), chunk('IEND', new Uint8Array())];
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Eine Fixture-Grafik im Format des Eingangs `logoLeft`/`logoRight`; `aspect` = Breite ÷ Höhe der Bildpunkte. */
export function fixtureLogo(aspect: number): { data: Uint8Array; format: 'PNG' } {
  const height = 40;
  return { data: pngBytes(Math.round(height * aspect), height), format: 'PNG' };
}

/** Bytes ohne erkennbares Bildformat. */
export function garbageLogo(): { data: Uint8Array; format: 'PNG' } {
  return { data: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), format: 'PNG' };
}

/** PNG-Kopf, danach Müll: besteht die Formatprüfung, lässt sich aber nicht zeichnen. */
export function truncatedPngLogo(): { data: Uint8Array; format: 'PNG' } {
  const good = pngBytes(80, 40);
  return { data: good.subarray(0, 33), format: 'PNG' };
}

/** JPEG-Kennung (FF D8 FF E0), danach Müll: besteht den Dateianfang, ist aber kein Bild. */
export function brokenJpegLogo(): { data: Uint8Array; format: 'JPEG' } {
  return { data: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 60 }, (_, i) => (i * 7) % 200)]), format: 'JPEG' };
}

/** Gültiges PNG, aber über der Größengrenze (rauschartig gefüllt, damit es sich nicht klein packen lässt). */
export function oversizedLogo(): { data: Uint8Array; format: 'PNG' } {
  const side = 1100;
  const rows: number[] = [];
  let seed = 12345;
  for (let y = 0; y < side; y++) {
    rows.push(0);
    for (let x = 0; x < side * 2; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      rows.push(seed & 0xff);
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, side * 2 / 2);
  view.setUint32(4, side);
  header[8] = 8;
  header[9] = 4; // Graustufen mit Alpha: zwei Bytes je Bildpunkt
  const idat = deflateSync(Uint8Array.from(rows), { level: 0 });
  const parts = [PNG_SIGNATURE, chunk('IHDR', header), chunk('IDAT', idat), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return { data: out, format: 'PNG' };
}
