/**
 * Schriftmaße aus der eingebetteten Schriftdatei selbst (B-28a3-2 Nachbesserung). Unabhängig vom Token `printFont`:
 * der Test misst die Oberkante mit diesem Wert und prüft das Token dagegen. Liest `fontData/*.ts` (base64 einer TTF)
 * und daraus die Tabelle `hhea` (Ascender) und `head` (unitsPerEm).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fontData');

/** Base64-Inhalt einer Schriftdatei-Quelle (erste lange Zeichenkette). */
function ttfBytes(datei: string): Buffer {
  const quelle = readFileSync(join(FONT_DIR, datei), 'utf8');
  const treffer = /'([A-Za-z0-9+/=]{200,})'/.exec(quelle);
  if (!treffer?.[1]) {throw new Error(`keine base64-Schrift in ${datei}`);}
  return Buffer.from(treffer[1], 'base64');
}

/** Ascender in em aus `hhea` geteilt durch `unitsPerEm` aus `head`. */
export function ascentEmAus(datei: string): number {
  const bytes = ttfBytes(datei);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const anzahl = view.getUint16(4);
  const tabellen = new Map<string, number>();
  for (let i = 0; i < anzahl; i++) {
    const eintrag = 12 + 16 * i;
    const tag = String.fromCharCode(...bytes.subarray(eintrag, eintrag + 4));
    tabellen.set(tag, view.getUint32(eintrag + 8));
  }
  const head = tabellen.get('head');
  const hhea = tabellen.get('hhea');
  if (head === undefined || hhea === undefined) {throw new Error(`head oder hhea fehlt in ${datei}`);}
  const unitsPerEm = view.getUint16(head + 18);
  const ascender = view.getInt16(hhea + 4);
  return ascender / unitsPerEm;
}

/** Descender in em (positiv gezählt) aus `hhea` geteilt durch `unitsPerEm` aus `head`: tiefste Unterlänge der Schrift. */
export function descentEmAus(datei: string): number {
  const bytes = ttfBytes(datei);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const anzahl = view.getUint16(4);
  const tabellen = new Map<string, number>();
  for (let i = 0; i < anzahl; i++) {
    const eintrag = 12 + 16 * i;
    tabellen.set(String.fromCharCode(...bytes.subarray(eintrag, eintrag + 4)), view.getUint32(eintrag + 8));
  }
  const head = tabellen.get('head');
  const hhea = tabellen.get('hhea');
  if (head === undefined || hhea === undefined) {throw new Error(`head oder hhea fehlt in ${datei}`);}
  return -view.getInt16(hhea + 6) / view.getUint16(head + 18);
}

/** Alle Codepunkte, die die cmap der Schriftdatei auf ein Glyph (ungleich .notdef) abbildet. Formate 4 und 12. */
export function cmapCodepoints(datei: string): Set<number> {
  const bytes = ttfBytes(datei);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const anzahl = view.getUint16(4);
  let cmap: number | undefined;
  for (let i = 0; i < anzahl; i++) {
    const eintrag = 12 + 16 * i;
    if (String.fromCharCode(...bytes.subarray(eintrag, eintrag + 4)) === 'cmap') {
      cmap = view.getUint32(eintrag + 8);
    }
  }
  if (cmap === undefined) {throw new Error(`cmap fehlt in ${datei}`);}
  const codes = new Set<number>();
  const teiltabellen = view.getUint16(cmap + 2);
  for (let i = 0; i < teiltabellen; i++) {
    const platform = view.getUint16(cmap + 4 + 8 * i);
    const kodierung = view.getUint16(cmap + 6 + 8 * i);
    const start = cmap + view.getUint32(cmap + 8 + 8 * i);
    // Unicode: Plattform 0, oder Windows (3) mit BMP (1) bzw. voller Bereich (10)
    if (!(platform === 0 || (platform === 3 && (kodierung === 1 || kodierung === 10)))) {continue;}
    const format = view.getUint16(start);
    if (format === 4) {
      const segmente = view.getUint16(start + 6) / 2;
      const endCodes = start + 14;
      const startCodes = endCodes + segmente * 2 + 2;
      const deltas = startCodes + segmente * 2;
      const offsets = deltas + segmente * 2;
      for (let s = 0; s < segmente; s++) {
        const ende = view.getUint16(endCodes + 2 * s);
        const anfang = view.getUint16(startCodes + 2 * s);
        const delta = view.getInt16(deltas + 2 * s);
        const offset = view.getUint16(offsets + 2 * s);
        for (let code = anfang; code <= ende && code < 0xffff; code++) {
          let glyph: number;
          if (offset === 0) {
            glyph = (code + delta) & 0xffff;
          } else {
            const adresse = offsets + 2 * s + offset + 2 * (code - anfang);
            const roh = view.getUint16(adresse);
            glyph = roh === 0 ? 0 : (roh + delta) & 0xffff;
          }
          if (glyph !== 0) {codes.add(code);}
        }
      }
    } else if (format === 12) {
      const gruppen = view.getUint32(start + 12);
      for (let g = 0; g < gruppen; g++) {
        const von = view.getUint32(start + 16 + 12 * g);
        const bis = view.getUint32(start + 20 + 12 * g);
        const glyph = view.getUint32(start + 24 + 12 * g);
        for (let code = von; code <= bis; code++) {
          if (glyph + (code - von) !== 0) {codes.add(code);}
        }
      }
    }
  }
  return codes;
}

/** Ascent der Regular- und Bold-Datei. */
export const ASCENT_REGULAR_EM = ascentEmAus('regular.ts');
export const ASCENT_BOLD_EM = ascentEmAus('bold.ts');
export const DESCENT_REGULAR_EM = descentEmAus('regular.ts');
