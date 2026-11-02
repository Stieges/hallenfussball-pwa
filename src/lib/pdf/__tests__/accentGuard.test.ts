/**
 * Wächter zur Akzentfarbe (T2, @DR-041): Im Druckmodul steht keine Farbe als Hex-Literal, und keine Datei
 * rechnet selbst eine Akzentfarbe aus. Die Farbe kommt nur über `PdfInput.accent` herein (Anbindung: T8);
 * `printAccent` liefert dort höchstens den Rückfall.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PDF_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Alle Quelldateien des Druckmoduls außer den Tests (rekursiv). */
function guardedFiles(dir: string = PDF_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { return entry.name === '__tests__' ? [] : guardedFiles(path); }
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('@DR-041 Akzentfarbe im Druckmodul', () => {
  it('@DR-041 kein Hex-Farbliteral in src/lib/pdf (Farben kommen aus Tokens oder aus PdfInput.accent)', () => {
    const treffer = guardedFiles().filter(file => /#[0-9a-fA-F]{6}\b/.test(readFileSync(file, 'utf8')));

    expect(treffer).toEqual([]);
  });

  it('@DR-041 keine Datei im Druckmodul rechnet die Akzentfarbe selbst aus dem Logo', () => {
    const treffer = guardedFiles().filter(file => /lib\/color\/accent|\.\.\/color\/accent/.test(readFileSync(file, 'utf8')));

    expect(treffer).toEqual([]);
  });

  it('Gegenbeispiel: das Muster erkennt ein Hex-Literal', () => {
    expect(/#[0-9a-fA-F]{6}\b/.test("fill('#2A2576')")).toBe(true);
  });
});
