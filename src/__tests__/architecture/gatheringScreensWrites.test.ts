/**
 * Architektur-Wächter A1b (@VA-034, @VA-037, @VA-043; Migration `20261120_002_gathering_screens.sql`): Bildschirme der
 * Veranstaltung, ihr Schlüssel, der Ort und das Turnier in der Halle entstehen und ändern sich nur über Server-Funktionen.
 *
 * 1. Kein Produktivcode greift per `.from('gathering_screens')` auf die Tabelle zu (Clients haben dort keine Rechte; der
 *    Schlüssel kommt nur aus `gathering_screens_overview`, die Anzeige nur aus `gathering_screen_display`).
 * 2. Kein Produktivcode schreibt per `.from('gatherings')` (insert/upsert/update/delete) – auch nicht
 *    `on_screen_tournament_id` oder `screen_location_name`; Lesen bleibt erlaubt.
 * Analyse mit der TypeScript-Compiler-API (AST), wie `scoreWritePaths.test.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';
import { describe, it, expect } from 'vitest';

const SRC = join(process.cwd(), 'src');
const WRITE_METHODS = new Set(['insert', 'upsert', 'update', 'delete']);

interface Finding { file: string; detail: string; line: number }

function literalText(node: ts.Node | undefined): string | undefined {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
}

function scan(rel: string, text: string): Finding[] {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Finding[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'from') {
      const table = literalText(node.arguments[0]);
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      if (table === 'gathering_screens') {
        out.push({ file: rel, detail: 'gathering_screens', line });
      } else if (table === 'gatherings') {
        let cur: ts.Node = node;
        while (ts.isPropertyAccessExpression(cur.parent) || ts.isCallExpression(cur.parent)) {
          const parent: ts.Node = cur.parent;
          if (ts.isPropertyAccessExpression(parent) && WRITE_METHODS.has(parent.name.text)) {
            out.push({ file: rel, detail: `gatherings.${parent.name.text}`, line });
            break;
          }
          cur = parent;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function productionFiles(dir = SRC): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { files.push(...productionFiles(full)); continue; }
    const rel = relative(SRC, full).split(sep).join('/');
    if (!/\.(ts|tsx)$/.test(rel) || rel.endsWith('.d.ts') || /\.(test|spec)\.(ts|tsx)$/.test(rel)) { continue; }
    if (rel.split('/').includes('__tests__') || rel === 'types/supabase.ts') { continue; }
    files.push(rel);
  }
  return files;
}

describe('A1b Architektur-Wächter: Bildschirme der Veranstaltung nur über Server-Funktionen', () => {
  it('@VA-043 @VA-034 kein Produktivcode liest oder schreibt gathering_screens direkt, keiner schreibt gatherings', () => {
    const findings = productionFiles().flatMap((rel) => scan(rel, readFileSync(join(SRC, rel), 'utf8')));
    expect(findings.map((f) => `${f.file}:${f.line} ${f.detail}`)).toEqual([]);
  });

  it('Gegenprobe: der Wächter erkennt direkte Zugriffe', () => {
    const sample = [
      "client.from('gathering_screens').select('screen_key');",
      "client.from('gatherings').update({ on_screen_tournament_id: id }).eq('id', g);",
      "client.from('gatherings').select('id, name');",
    ].join('\n');
    expect(scan('probe.ts', sample).map((f) => f.detail)).toEqual(['gathering_screens', 'gatherings.update']);
  });
});
