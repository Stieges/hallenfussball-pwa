/**
 * Architektur-Waechter A-08e (@FU-084, @FU-085): Schreibwege fuer den Spielstand.
 *
 * 1. Spielstand-Felder (`scoreA|scoreB|score_a|score_b`) werden im Produktivcode nur in Dateien
 *    der Erlaubnisliste gesetzt (Objektliteral-Eigenschaft oder Zuweisung `x.scoreA = ...`).
 *    Die Liste wird NICHT erweitert, um rote Funde zu verstecken: eine unerwartete Fundstelle
 *    heisst anhalten und melden.
 * 2. Kein Produktivcode schreibt direkt in `match_events` oder `live_matches` (Supabase
 *    `.from(...)` mit insert/upsert/update/delete); einziger Schreibweg ist der RPC
 *    `append_match_events` (`appendMatchEventsRpc.ts`, ruft `.rpc`, nie `.from`).
 * 3. Die entfernten Alt-Dateien kommen nicht zurueck und niemand importiert sie.
 * Analyse mit der TypeScript-Compiler-API (AST), nicht per Regex.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';
import { describe, it, expect } from 'vitest';

const SRC = join(process.cwd(), 'src');
const SCORE_NAMES = new Set(['scoreA', 'scoreB', 'score_a', 'score_b']);
const GUARDED_TABLES = new Set(['match_events', 'live_matches']);
const WRITE_METHODS = new Set(['insert', 'upsert', 'update', 'delete']);

/** Erlaubnisliste: Datei (relativ zu `src/`) -> Grund. Gruppen aus Plan A-08 § 1.2. */
const SCORE_ALLOWLIST: Record<string, string> = {
  'features/tournament-management/hooks/useScheduleTabActions.ts':
    'Schnelleingabe/Rückgängig (§ 1.2): einzige erlaubte Ausnahme für Spiele, die die Engine nicht trägt (Seiten offen, abgesetzt, Altbestand); bleibt bis B-07/B-12b',
  'core/generators/scheduleGenerator.ts':
    'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (übernimmt vorhandene Stände in den erzeugten Spielplan)',
  'core/services/TournamentCreationService.ts':
    'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (Veröffentlichen reicht die Stände des Generators durch)',
  'core/models/tournamentCopy.ts':
    'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (Kopie setzt 0:0)',
  'utils/tournamentImporter.ts':
    'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf',
  'features/tournament-admin/categories/DangerZone/index.tsx':
    'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (Spielplan zurücksetzen)',
  'hooks/useTournamentWizard.ts':
    'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (Wizard-Daten zurücksetzen)',
  'screens/LocalTestScreen.tsx':
    'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (Testbildschirm blendet Stände aus)',
  'components/dialogs/ImportTemplates.ts':
    'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (Beispielvorlage mit Ergebnissen)',
  'test-data/mockTournament.ts':
    'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (Beispieldaten für Demo/Test-Bildschirm)',
  'core/match/client/applyEngineOverlay.ts':
    'Projektion aus Ereignissen: bildet die Spalten aus dem Ereignislog ab, schreibt kein Ergebnis aus eigener Quelle',
  'core/match/client/cacheColumns.ts':
    'Projektion aus Ereignissen: bildet die Spalten aus dem Ereignislog ab, schreibt kein Ergebnis aus eigener Quelle',
  'core/repositories/supabaseMappers.ts':
    'Persistenz-Mapping/Schema: bildet Spalten <-> Client-Modell ab, löst keinen Spielstand aus',
  'core/models/schemas/TournamentSchema.ts':
    'Persistenz-Mapping/Schema: bildet Spalten <-> Client-Modell ab, löst keinen Spielstand aus',
  'hooks/useTournamentManager.ts':
    'Projektion aus Ereignissen: bildet die Spalten aus dem Ereignislog ab, schreibt kein Ergebnis aus eigener Quelle (stellt beim Abgleich den Rohstand wieder her)',
  'screens/PublicLiveViewScreen.tsx':
    'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts (versteckt Stände für die Öffentlichkeit)',
  'screens/PublicTournamentViewScreen.tsx':
    'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts (versteckt Stände für die Öffentlichkeit)',
  'features/public-view/publicScheduleFilters.ts':
    'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts (withoutScore)',
  'components/ScheduleDisplay.tsx':
    'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts',
  'components/dialogs/PDFExportDialog.tsx':
    'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts',
  'components/schedule/CorrectionBanner.tsx':
    'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts (Textparameter)',
  'features/tournament-admin/categories/ActivityLog/index.tsx':
    'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts (Textparameter)',
  'features/tournament-management/ScheduleTab.tsx':
    'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts (Textparameter des Wechsel-Hinweises)',
};

/** Dateien bzw. Ordner, die NIE in der Erlaubnisliste stehen duerfen (Plan A-08e Punkt 3). */
const NEVER_ALLOWED = [
  'features/tournament-management/ManagementTab.tsx',
  'components/live-cockpit/',
  'hooks/useCockpitExecution.ts',
  'hooks/useEngineCommandWiring.ts',
];

interface Finding { kind: 'score' | 'direct-write'; detail: string; line: number }

function literalText(node: ts.Node | undefined): string | undefined {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
}

function nameOf(node: ts.PropertyName | ts.Expression): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) { return node.text; }
  return undefined;
}

/** Findet `.from('match_events'|'live_matches')` und prueft, ob die Kette dahinter schreibt. */
function checkGuardedFrom(call: ts.CallExpression, sf: ts.SourceFile, out: Finding[]): void {
  if (!ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== 'from') { return; }
  const table = literalText(call.arguments[0]);
  if (table === undefined || !GUARDED_TABLES.has(table)) { return; }
  const line = sf.getLineAndCharacterOfPosition(call.getStart(sf)).line + 1;
  let node: ts.Node = call;
  let chained = false;
  while (ts.isPropertyAccessExpression(node.parent) || ts.isCallExpression(node.parent)) {
    const parent: ts.Node = node.parent;
    if (ts.isPropertyAccessExpression(parent) && WRITE_METHODS.has(parent.name.text)) {
      out.push({ kind: 'direct-write', detail: `${table}.${parent.name.text}`, line });
      return;
    }
    chained = chained || ts.isPropertyAccessExpression(parent);
    node = parent;
  }
  // Ergebnis von `.from(...)` wird weitergereicht/zwischengespeichert: Schreibzugriff nicht ausschliessbar.
  if (!chained) { out.push({ kind: 'direct-write', detail: `${table}.<indirekt>`, line }); }
}

function scanSource(fileName: string, text: string): Finding[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Finding[] = [];
  const at = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)) {
      const n = nameOf(node.name);
      if (n && SCORE_NAMES.has(n)) { out.push({ kind: 'score', detail: n, line: at(node) }); }
    } else if (ts.isShorthandPropertyAssignment(node) && SCORE_NAMES.has(node.name.text)) {
      out.push({ kind: 'score', detail: node.name.text, line: at(node) });
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = node.left;
      const n = ts.isPropertyAccessExpression(left) ? left.name.text
        : ts.isElementAccessExpression(left) ? nameOf(left.argumentExpression) : undefined;
      if (n && SCORE_NAMES.has(n)) { out.push({ kind: 'score', detail: `${n} =`, line: at(node) }); }
    } else if (ts.isCallExpression(node)) {
      checkGuardedFrom(node, sf, out);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function isProductionFile(rel: string): boolean {
  if (!/\.(ts|tsx)$/.test(rel) || rel.endsWith('.d.ts')) { return false; }
  if (/\.(test|spec)\.(ts|tsx)$/.test(rel)) { return false; }
  const parts = rel.split('/');
  if (parts.includes('__tests__') || parts[0] === 'test') { return false; }
  return rel !== 'types/supabase.ts';
}

function listProductionFiles(dir = SRC): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { files.push(...listProductionFiles(full)); continue; }
    const rel = relative(SRC, full).split(sep).join('/');
    if (isProductionFile(rel)) { files.push(rel); }
  }
  return files;
}

const findingsByFile = new Map<string, Finding[]>();
for (const rel of listProductionFiles()) {
  const found = scanSource(rel, readFileSync(join(SRC, rel), 'utf8'));
  if (found.length > 0) { findingsByFile.set(rel, found); }
}

const describeFindings = (rel: string, list: Finding[]): string =>
  `${rel}: ${list.map((f) => `${f.detail}@${f.line}`).join(', ')}`;

describe('A-08e Architektur-Waechter: Schreibwege fuer den Spielstand', () => {
  it('@FU-084 Spielstand-Felder werden nur in Dateien der Erlaubnisliste gesetzt (echter Quellbaum)', () => {
    const unexpected = [...findingsByFile]
      .map(([rel, list]) => [rel, list.filter((f) => f.kind === 'score')] as const)
      .filter(([rel, list]) => list.length > 0 && !(rel in SCORE_ALLOWLIST))
      .map(([rel, list]) => describeFindings(rel, [...list]));
    expect(unexpected).toEqual([]);
  });

  it('Erlaubnisliste hat je Datei einen Grund, keine toten Eintraege und nie die gesperrten Dateien', () => {
    for (const [rel, reason] of Object.entries(SCORE_ALLOWLIST)) {
      expect(reason.trim().length, `Grund fuer ${rel}`).toBeGreaterThan(10);
      expect(existsSync(join(SRC, rel)), `${rel} existiert`).toBe(true);
      expect(findingsByFile.get(rel)?.some((f) => f.kind === 'score') ?? false, `${rel} hat noch eine Fundstelle`).toBe(true);
      expect(NEVER_ALLOWED.some((p) => rel === p || (p.endsWith('/') && rel.startsWith(p))), `${rel} darf nie erlaubt sein`).toBe(false);
    }
  });

  it('@FU-085 kein Produktivcode schreibt direkt in match_events oder live_matches (einziger Weg: RPC append_match_events)', () => {
    const direct = [...findingsByFile]
      .map(([rel, list]) => [rel, list.filter((f) => f.kind === 'direct-write')] as const)
      .filter(([, list]) => list.length > 0)
      .map(([rel, list]) => describeFindings(rel, [...list]));
    expect(direct).toEqual([]);
    const rpc = readFileSync(join(SRC, 'core/repositories/appendMatchEventsRpc.ts'), 'utf8');
    expect(rpc).toContain(".rpc('append_match_events'");
  });

  it('Alt-Dateien useMatchExecution/MatchExecutionService existieren nicht und werden nicht importiert', () => {
    expect(existsSync(join(SRC, 'hooks/useMatchExecution.ts'))).toBe(false);
    expect(existsSync(join(SRC, 'core/services/MatchExecutionService.ts'))).toBe(false);
    const importers: string[] = [];
    for (const rel of listProductionFiles()) {
      const sf = ts.createSourceFile(rel, readFileSync(join(SRC, rel), 'utf8'), ts.ScriptTarget.Latest, true);
      for (const stmt of sf.statements) {
        const spec = ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt) ? literalText(stmt.moduleSpecifier) : undefined;
        if (spec && /(^|\/)(useMatchExecution|MatchExecutionService)$/.test(spec)) { importers.push(rel); }
      }
    }
    expect(importers).toEqual([]);
  });
});

describe('A-08e Waechter-Gegenbeispiele (Scanner erkennt, was er erkennen soll)', () => {
  const kinds = (code: string): string[] => scanSource('x.ts', code).map((f) => `${f.kind}:${f.detail}`);

  it('erkennt Objektliteral, Shorthand und Zuweisung auf Spielstand-Felder', () => {
    expect(kinds('const a = { scoreA: 1 }; const scoreB = 2; const b = { scoreB }; m.score_a = 3; m["scoreB"] = 4;'))
      .toEqual(['score:scoreA', 'score:scoreB', 'score:score_a =', 'score:scoreB =']);
  });

  it('erkennt direkte Schreibzugriffe auf match_events/live_matches (auch indirekt)', () => {
    expect(kinds("await supabase.from('match_events').upsert(rows);")).toEqual(['direct-write:match_events.upsert']);
    expect(kinds("await client.from('live_matches').delete().eq('id', 1);")).toEqual(['direct-write:live_matches.delete']);
    expect(kinds("const q = client.from('match_events'); q.insert(x);")).toEqual(['direct-write:match_events.<indirekt>']);
  });

  it('meldet Lesezugriffe, den RPC und andere Tabellen NICHT', () => {
    expect(kinds("await c.from('match_events').select('*').eq('match_id', id);")).toEqual([]);
    expect(kinds("await c.rpc('append_match_events', { p_events: e });")).toEqual([]);
    expect(kinds("await c.from('matches').update({ x: 1 });")).toEqual([]);
    expect(kinds('const a = { homeScore: 1 }; x.scores = 2;')).toEqual([]);
  });
});
