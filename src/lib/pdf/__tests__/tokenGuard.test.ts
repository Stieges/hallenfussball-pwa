/**
 * Token-Wächter (B-28a3-1): In `src/lib/pdf/render/**` und `src/lib/pdf/*.ts` steht kein Zahlliteral außer 0, 1 und 2
 * (Indizes und Hälften). Jedes Maß steht in `design-tokens/print.ts`. Hexadezimale Codepunkte (`0x…`) und
 * Regex-Quantoren zählen nicht als Maß, sie sind aber in der Ausnahmeliste begründet, wo sie vorkommen.
 *
 * Die Ausnahmeliste ist kurz und begründet. Jede Zeile muss treffen (sonst meldet der Test eine veraltete Ausnahme).
 * Ziel nach a3-5: leere Liste.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PDF_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

interface Hit { file: string; line: number; literal: string; text: string }

/** Kommentare, Zeichenketten und Importe ausblenden; Zeilennummern bleiben erhalten. */
export function codeLines(source: string): string[] {
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  return noBlock.split('\n').map(line => {
    if (/^\s*import\b/.test(line)) {return '';}
    return line
      .replace(/\/\/.*$/, '')
      .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, m => ' '.repeat(m.length));
  });
}

/** Zahlliterale außer 0, 1, 2 in einer Quelle. Nur freistehende Zahlen; Hex und Namen mit Ziffern fallen heraus. */
export function literalsIn(source: string): Array<{ line: number; literal: string; text: string }> {
  const found: Array<{ line: number; literal: string; text: string }> = [];
  const raw = source.split('\n');
  codeLines(source).forEach((line, i) => {
    for (const m of line.matchAll(/(?<![\w.])\d+(?:\.\d+)?(?![\w])/g)) {
      if (!['0', '1', '2'].includes(m[0])) {
        found.push({ line: i + 1, literal: m[0], text: (raw[i] ?? '').trim() });
      }
    }
  });
  return found;
}

function renderFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {return name === '__tests__' ? [] : renderFiles(path);}
    return name.endsWith('.ts') ? [path] : [];
  });
}

/** Alle Dateien, die der Wächter prüft: `render/**` und `pdf/*.ts`. */
export function guardedFiles(): string[] {
  const top = readdirSync(PDF_DIR).filter(n => n.endsWith('.ts')).map(n => join(PDF_DIR, n));
  return [...renderFiles(join(PDF_DIR, 'render')), ...top];
}

interface Exception { file: string; pattern: RegExp; reason: string }

/** Bestand heute. Jede Ausnahme nennt Datei, Muster in der Zeile und den Grund. */
export const EXCEPTIONS: Exception[] = [
  { file: 'render/finalsTables.ts', pattern: /^\d+: \{ halign|\? 6 : 5\]/, reason: 'Spaltenindizes der Finaltabelle (Feld- und Schiedsrichter-Spalte); ersetzt durch Spaltenschlüssel in a3-5' },
  { file: 'render/standings.ts', pattern: /^\d+: \{ halign/, reason: 'Spaltenindizes der Tabelle Gruppe (Sp, S, U, N, Tore, Diff, Pkt); ersetzt durch Spaltenschlüssel' },
  { file: 'render/metaBox.ts', pattern: /DEFAULT_GROUP_DURATION_MIN = 10/, reason: 'Fachlicher Ersatzwert (10 Minuten) ohne Turnierwert; entfällt mit der Spielzeit aus dem Turnier (a3-3)' },
  { file: 'translations.ts', pattern: /ISO_DATE = |Number\(match\[/, reason: 'Regex-Quantoren und Teile des Datums JJJJ-MM-TT; kein Maß' },
];

function exceptionFor(hit: Hit): Exception | undefined {
  const rel = hit.file.slice(PDF_DIR.length + 1);
  const trimmed = hit.text.replace(/\s+/g, ' ');
  return EXCEPTIONS.find(e => e.file === rel && e.pattern.test(trimmed));
}

function allHits(): Hit[] {
  return guardedFiles().flatMap(file =>
    literalsIn(readFileSync(file, 'utf8')).map(h => ({ file, ...h })),
  );
}

describe('Token-Wächter: Render-Dateien ohne Maßzahl', () => {
  it('jedes Zahlliteral in render/** und pdf/*.ts ist begründet ausgenommen', () => {
    const unerlaubt = allHits().filter(h => !exceptionFor(h));

    expect(unerlaubt.map(h => `${h.file.slice(PDF_DIR.length + 1)}:${h.line} ${h.literal} | ${h.text}`)).toEqual([]);
  });

  it('jede Ausnahme trifft noch (keine veralteten Einträge)', () => {
    const hits = allHits();
    const veraltet = EXCEPTIONS.filter(e => !hits.some(h => h.file.endsWith(e.file) && e.pattern.test(h.text.replace(/\s+/g, ' '))));

    expect(veraltet.map(e => e.file)).toEqual([]);
  });

  it('Gegenbeispiel: eine Maßzahl in einer Render-Zeile wird gemeldet', () => {
    const treffer = literalsIn('export const x = printFonts.table * 12;\n');

    expect(treffer.map(t => t.literal)).toEqual(['12']);
  });

  it('Ausnahmen gelten nur für die genannten Muster (1, 2 und 0 sind frei)', () => {
    expect(literalsIn('const a = arr[0] + arr[1] / 2;\n')).toEqual([]);
  });
});
