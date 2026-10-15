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

/** Ascent der Regular- und Bold-Datei. */
export const ASCENT_REGULAR_EM = ascentEmAus('regular.ts');
export const ASCENT_BOLD_EM = ascentEmAus('bold.ts');
