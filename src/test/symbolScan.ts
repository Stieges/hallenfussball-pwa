/**
 * Zähler für den Wächter @OB-038 (`__tests__/symbolWaechter.test.ts`): wie viele Texte der Oberfläche je Datei ein Emoji oder ein
 * Textzeichen als Symbol tragen. Siehe dort für Umfang und Ausnahmen.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';
import { OHNE_EMOJI } from './symbolText';

const SRC = join(__dirname, '..');
const ERSATZZEICHEN = /[✓✔✕✖✗✘▼▲▾▴▶◉●○⋮✉]|^\s*×\s*$/u;
const AUSGENOMMEN = [/(^|\/)__tests__\//, /\.(test|spec)\.tsx?$/, /(^|\/)test(-data)?\//, /(^|\/)(fixtures|mocks)\//, /\.d\.ts$/];

/** Wahr, wenn der Text ein Emoji oder ein Ersatzzeichen als Symbol enthält. */
export const hatSymbolersatz = (text: string): boolean => OHNE_EMOJI.test(text) || ERSATZZEICHEN.test(text);

function dateien(ordner: string, endungen: readonly string[]): string[] {
  const treffer: string[] = [];
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) {
      treffer.push(...dateien(pfad, endungen));
    } else if (endungen.some((e) => name.endsWith(e))) {
      treffer.push(pfad);
    }
  }
  return treffer;
}

const relativ = (pfad: string): string => relative(SRC, pfad).split(sep).join('/');

/** Zahl der Zeichenketten, Schablonen und JSX-Texte einer Quelldatei, die ein Emoji oder Ersatzzeichen tragen. */
export function trefferImQuelltext(quelle: string, name = 'x.tsx'): number {
  const datei = ts.createSourceFile(name, quelle, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let zahl = 0;
  const besuche = (knoten: ts.Node): void => {
    // Ausgaben in die Konsole sieht kein Nutzer
    if (ts.isCallExpression(knoten) && knoten.expression.getText(datei).startsWith('console.')) { return; }
    if (
      ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten) || ts.isTemplateHead(knoten)
      || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten) || ts.isJsxText(knoten)
    ) {
      if (hatSymbolersatz(knoten.text)) { zahl += 1; }
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(datei);
  return zahl;
}

/** Zahl der Texte einer Übersetzungsdatei (beliebig tief verschachtelt), die ein Emoji oder Ersatzzeichen tragen. */
export function trefferImJson(wert: unknown): number {
  if (typeof wert === 'string') { return hatSymbolersatz(wert) ? 1 : 0; }
  if (Array.isArray(wert)) { return wert.reduce((s: number, w) => s + trefferImJson(w), 0); }
  if (wert !== null && typeof wert === 'object') { return Object.values(wert).reduce((s: number, w) => s + trefferImJson(w), 0); }
  return 0;
}

export function zaehleAlles(): Map<string, number> {
  const zahlen = new Map<string, number>();
  for (const pfad of dateien(SRC, ['.ts', '.tsx', '.json'])) {
    const rel = relativ(pfad);
    if (AUSGENOMMEN.some((m) => m.test(rel))) { continue; }
    const text = readFileSync(pfad, 'utf8');
    let n: number;
    if (pfad.endsWith('.json')) {
      if (!/^i18n\/locales\/(de|en)\//.test(rel)) { continue; }
      n = trefferImJson(JSON.parse(text));
    } else {
      n = trefferImQuelltext(text, pfad);
    }
    if (n > 0) { zahlen.set(rel, n); }
  }
  return zahlen;
}

