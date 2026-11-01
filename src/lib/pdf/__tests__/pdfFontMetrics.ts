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
  return new Set(cmapGlyphen(datei).keys());
}

/** Codepunkt → Glyph-Nummer laut cmap der Schriftdatei (ohne .notdef). Formate 4 und 12. */
export function cmapGlyphen(datei: string): Map<number, number> {
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
  const codes = new Map<number, number>();
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
          if (glyph !== 0) {codes.set(code, glyph);}
        }
      }
    } else if (format === 12) {
      const gruppen = view.getUint32(start + 12);
      for (let g = 0; g < gruppen; g++) {
        const von = view.getUint32(start + 16 + 12 * g);
        const bis = view.getUint32(start + 20 + 12 * g);
        const glyph = view.getUint32(start + 24 + 12 * g);
        for (let code = von; code <= bis; code++) {
          if (glyph + (code - von) !== 0) {codes.set(code, glyph + (code - von));}
        }
      }
    }
  }
  return codes;
}

/** Tabellenverzeichnis einer Schriftdatei: Tag → Offset. */
function tabellenOffsets(bytes: Buffer): Map<string, number> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tabellen = new Map<string, number>();
  for (let i = 0; i < view.getUint16(4); i++) {
    const eintrag = 12 + 16 * i;
    tabellen.set(String.fromCharCode(...bytes.subarray(eintrag, eintrag + 4)), view.getUint32(eintrag + 8));
  }
  return tabellen;
}

/** Anzahl der Glyphen im Standard-Mac-Satz der Tabelle `post` (Format 2): kleinere Nummern haben keinen eigenen Namen. */
const MAC_STANDARD_GLYPHS = 258;

/**
 * Glyph-Name des Zeichens laut `post` (Format 2) und cmap. Eigene Namen („one.tf“, „l.ss02“) kommen im Klartext zurück,
 * Glyphen aus dem Standard-Mac-Satz als `mac:<Nummer>`: Der Test braucht nur den Unterschied zu den Namen der Merkmale.
 */
export function glyphNameAus(datei: string, codepoint: number): string {
  const bytes = ttfBytes(datei);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const post = tabellenOffsets(bytes).get('post');
  const glyph = cmapGlyphen(datei).get(codepoint);
  if (post === undefined || glyph === undefined) {throw new Error(`post oder Glyph für U+${codepoint.toString(16)} fehlt in ${datei}`);}
  if (view.getUint32(post) !== 0x00020000) {throw new Error(`post-Format 2 erwartet (Glyph-Namen) in ${datei}`);}
  const anzahl = view.getUint16(post + 32);
  const indizes = Array.from({ length: anzahl }, (_, i) => view.getUint16(post + 34 + 2 * i));
  const index = indizes[glyph];
  if (index === undefined) {throw new Error(`Glyph ${glyph} nicht im post von ${datei}`);}
  if (index < MAC_STANDARD_GLYPHS) {return `mac:${index}`;}
  // Namen: Pascal-Strings hinter der Indexliste, Nummer index − 258
  let lesen = post + 34 + 2 * anzahl;
  for (let nr = MAC_STANDARD_GLYPHS; ; nr++) {
    const laenge = view.getUint8(lesen);
    if (nr === index) {return String.fromCharCode(...bytes.subarray(lesen + 1, lesen + 1 + laenge));}
    lesen += 1 + laenge;
  }
}

/** Vorschubbreite des Zeichens in Einheiten der Schrift (`hmtx`). */
export function advanceAus(datei: string, codepoint: number): number {
  const bytes = ttfBytes(datei);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tabellen = tabellenOffsets(bytes);
  const hmtx = tabellen.get('hmtx');
  const hhea = tabellen.get('hhea');
  const glyph = cmapGlyphen(datei).get(codepoint);
  if (hmtx === undefined || hhea === undefined || glyph === undefined) {throw new Error(`hmtx, hhea oder Glyph fehlt in ${datei}`);}
  const metriken = view.getUint16(hhea + 34);
  return view.getUint16(hmtx + 4 * Math.min(glyph, metriken - 1));
}

/** Ascent der Regular- und Bold-Datei. */
export const ASCENT_REGULAR_EM = ascentEmAus('regular.ts');
export const ASCENT_BOLD_EM = ascentEmAus('bold.ts');
export const DESCENT_REGULAR_EM = descentEmAus('regular.ts');
