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

/**
 * Erlaubnisliste: Datei (relativ zu `src/`) -> Grund und Anzahl der Fundstellen (F3). Eine zusaetzliche
 * Schreibstelle in einer erlaubten Datei aendert die Anzahl und macht den Test rot. Gruppen aus Plan A-08 § 1.2.
 */
const SCORE_ALLOWLIST: Record<string, { reason: string; count: number }> = {
  'core/repositories/publicPayload.ts': {
    count: 2,
    reason:
      'B-14 Zod-Schema der öffentlichen Antwort (public_tournament/display_tournament, Positivliste): prüft die Spalten score_a/score_b, setzt keinen Stand',
  },
  'core/generators/scheduleGenerator.ts': {
    count: 2,
    reason:
      'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (übernimmt vorhandene Stände in den erzeugten Spielplan)',
  },
  'core/services/TournamentCreationService.ts': {
    count: 2,
    reason:
      'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (Veröffentlichen reicht die Stände des Generators durch)',
  },
  'core/models/tournamentCopy.ts': {
    count: 2,
    reason:
      'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (Kopie leert das Ergebnis, KP: kein 0:0)',
  },
  'core/models/__fixtures__/hallencupOstGespielt.ts': {
    count: 4,
    reason:
      'Testdaten: gespieltes Beispielturnier „Hallencup Ost“ für die Kopie-Tests (KP), schreibt keinen Spielverlauf',
  },
  'utils/tournamentImporter.ts': {
    count: 2,
    reason:
      'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf',
  },
  // A-10: DangerZone und Assistent setzen nicht mehr selbst zurück (Einträge entfallen), beide rufen useResultsReset –
  // das leert die Felder über SERVER_LED_MATCH_FIELDS (serverLedMatchFields.ts), ohne Feldnamen selbst zu setzen.
  'components/dialogs/ImportTemplates.ts': {
    count: 4,
    reason:
      'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (Beispielvorlage mit Ergebnissen)',
  },
  'test-data/mockTournament.ts': {
    count: 26,
    reason:
      'Anlage/Import/Zurücksetzen: setzt oder übernimmt Ergebnisse beim Erzeugen/Kopieren/Importieren/Zurücksetzen, kein Spielverlauf (Beispieldaten für Demo/Test-Bildschirm)',
  },
  'core/match/client/applyEngineOverlay.ts': {
    count: 2,
    reason:
      'Projektion aus Ereignissen: bildet die Spalten aus dem Ereignislog ab, schreibt kein Ergebnis aus eigener Quelle',
  },
  'core/match/client/cacheColumns.ts': {
    count: 2,
    reason:
      'Projektion aus Ereignissen: bildet die Spalten aus dem Ereignislog ab, schreibt kein Ergebnis aus eigener Quelle',
  },
  'core/repositories/supabaseMappers.ts': {
    count: 4,
    reason:
      'Persistenz-Mapping/Schema: bildet Spalten <-> Client-Modell ab, löst keinen Spielstand aus',
  },
  'core/models/schemas/TournamentSchema.ts': {
    count: 2,
    reason:
      'Persistenz-Mapping/Schema: bildet Spalten <-> Client-Modell ab, löst keinen Spielstand aus',
  },
  'hooks/useTournamentManager.ts': {
    count: 2,
    reason:
      'Persistenz-Schutz: stripEngineOverlayFields setzt vor dem Speichern den Rohstand zurück, damit die Engine-Überlagerung nicht gespeichert wird; schreibt kein Ergebnis aus eigener Quelle',
  },
  'features/public-view/publicScheduleFilters.ts': {
    count: 2,
    reason:
      'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts (withoutScore)',
  },
  'components/ScheduleDisplay.tsx': {
    count: 4,
    reason:
      'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts',
  },
  // B-28 (Spur C): das Einmischen der Turnier-Spiele zog aus PDFExportDialog.tsx nach lib/pdf
  'lib/pdf/tournamentState.ts': {
    count: 2,
    reason:
      'Lesende Abbildung für den PDF-Export: mischt den Stand der Turnier-Spiele in eine Kopie des Plans, speichert nichts',
  },
  'lib/pdf/matchResult.ts': {
    count: 2,
    reason:
      'Lesende Abbildung für den PDF-Export: Ergebniszustand einer Zeile (ResultState) aus dem Spiel, speichert nichts',
  },
  'lib/pdf/render/scoreCell.ts': {
    count: 2,
    reason:
      'Lesende Abbildung für den PDF-Export: Inhalt der Ergebniszelle aus dem Ergebniszustand, speichert nichts',
  },
  'components/schedule/CorrectionBanner.tsx': {
    count: 2,
    reason:
      'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts (Textparameter)',
  },
  'features/tournament-admin/categories/ActivityLog/index.tsx': {
    count: 2,
    reason:
      'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts (Textparameter)',
  },
  'features/tournament-management/ScheduleTab.tsx': {
    count: 4,
    reason:
      'Lesende Abbildung für Anzeige/Export: baut nur ein Anzeige- bzw. Exportobjekt, speichert nichts (Textparameter des Wechsel-Hinweises)',
  },
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
  // F1: berechneter Schluessel mit Literal, `{ ['scoreA']: 2 }`
  if (ts.isComputedPropertyName(node)) { return literalText(unwrap(node.expression)); }
  return undefined;
}

/** Entpackt Klammern, `as`/`satisfies`, Typ-Assertion und `!` (F2). */
function unwrap(node: ts.Expression): ts.Expression {
  let n = node;
  while (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n)
    || ts.isTypeAssertionExpression(n) || ts.isNonNullExpression(n)) { n = n.expression; }
  return n;
}

/** F2: `const NAME = 'literal'` im selben Modul (auch `as const`). */
function collectStringConsts(sf: ts.SourceFile): Map<string, string> {
  const consts = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && (ts.getCombinedNodeFlags(node) & ts.NodeFlags.Const) !== 0) {
      const text = literalText(unwrap(node.initializer));
      if (text !== undefined) { consts.set(node.name.text, text); }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return consts;
}

function resolveTable(arg: ts.Expression | undefined, consts: Map<string, string>): string | undefined {
  if (!arg) { return undefined; }
  const inner = unwrap(arg);
  return literalText(inner) ?? (ts.isIdentifier(inner) ? consts.get(inner.text) : undefined);
}

/** Findet `.from(<Tabelle>)` auf match_events/live_matches und prueft, ob die Kette dahinter schreibt. */
function checkGuardedFrom(call: ts.CallExpression, sf: ts.SourceFile, consts: Map<string, string>, out: Finding[]): void {
  if (!ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== 'from') { return; }
  // Ausnahme: Storage-Buckets (`....storage.from(bucket)`) sind keine Tabellen.
  const receiver = call.expression.expression;
  if (ts.isPropertyAccessExpression(receiver) && receiver.name.text === 'storage') { return; }
  const table = resolveTable(call.arguments[0], consts);
  if (table !== undefined && !GUARDED_TABLES.has(table)) { return; }
  const line = sf.getLineAndCharacterOfPosition(call.getStart(sf)).line + 1;
  const label = table ?? '<unbekannt>';
  let node: ts.Node = call;
  let chained = false;
  while (ts.isPropertyAccessExpression(node.parent) || ts.isCallExpression(node.parent)) {
    const parent: ts.Node = node.parent;
    if (ts.isPropertyAccessExpression(parent) && WRITE_METHODS.has(parent.name.text)) {
      out.push({ kind: 'direct-write', detail: `${label}.${parent.name.text}`, line });
      return;
    }
    chained = chained || ts.isPropertyAccessExpression(parent);
    node = parent;
  }
  // Ergebnis von `.from(...)` wird weitergereicht/zwischengespeichert: Schreibzugriff nicht ausschliessbar.
  if (!chained && table !== undefined) { out.push({ kind: 'direct-write', detail: `${label}.<indirekt>`, line }); }
}

function accessedScoreName(node: ts.Node): string | undefined {
  const n = ts.isPropertyAccessExpression(node) ? node.name.text
    : ts.isElementAccessExpression(node) ? nameOf(node.argumentExpression) : undefined;
  return n && SCORE_NAMES.has(n) ? n : undefined;
}

function scanSource(fileName: string, text: string): Finding[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Finding[] = [];
  const consts = collectStringConsts(sf);
  const at = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)) {
      const n = nameOf(node.name);
      if (n && SCORE_NAMES.has(n)) { out.push({ kind: 'score', detail: n, line: at(node) }); }
    } else if (ts.isShorthandPropertyAssignment(node) && SCORE_NAMES.has(node.name.text)) {
      out.push({ kind: 'score', detail: node.name.text, line: at(node) });
    } else if (ts.isBinaryExpression(node)
      && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      // F1: `=` und alle zusammengesetzten Zuweisungen (`+=`, `-=`, `??=` ...)
      const n = accessedScoreName(node.left);
      if (n) { out.push({ kind: 'score', detail: `${n} ${node.operatorToken.getText(sf)}`, line: at(node) }); }
    } else if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
      && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)) {
      const n = accessedScoreName(node.operand);
      if (n) { out.push({ kind: 'score', detail: `${n}${node.operator === ts.SyntaxKind.PlusPlusToken ? '++' : '--'}`, line: at(node) }); }
    } else if (ts.isCallExpression(node)) {
      checkGuardedFrom(node, sf, consts, out);
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

  it('F3 die Anzahl der Fundstellen je erlaubter Datei ist festgeschrieben', () => {
    const actual = Object.fromEntries(Object.keys(SCORE_ALLOWLIST)
      .map((rel) => [rel, findingsByFile.get(rel)?.filter((f) => f.kind === 'score').length ?? 0]));
    const expected = Object.fromEntries(Object.entries(SCORE_ALLOWLIST).map(([rel, { count }]) => [rel, count]));
    expect(actual).toEqual(expected);
  });

  it('Erlaubnisliste hat je Datei einen Grund, keine toten Eintraege und nie die gesperrten Dateien', () => {
    for (const [rel, { reason }] of Object.entries(SCORE_ALLOWLIST)) {
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
  }, 30_000); // parst den ganzen Quellbaum; unter Coverage-Last in der CI > 5 s (V3, wie B03)
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

describe('A-08e-F Waechter-Umgehungen (F1/F2)', () => {
  const kinds = (code: string): string[] => scanSource('x.ts', code).map((f) => `${f.kind}:${f.detail}`);

  it('F1 erkennt zusammengesetzte Zuweisung, ++/-- und berechneten Literal-Schluessel', () => {
    expect(kinds('m.scoreA += 1;')).toEqual(['score:scoreA +=']);
    expect(kinds('m.score_b -= 2; m["scoreB"] ??= 0;')).toEqual(['score:score_b -=', 'score:scoreB ??=']);
    expect(kinds('m.scoreB++;')).toEqual(['score:scoreB++']);
    expect(kinds('--m.scoreA;')).toEqual(['score:scoreA--']);
    expect(kinds("const a = { ['scoreA']: 2 };")).toEqual(['score:scoreA']);
  });

  it('F1 Gegenbeispiel: Lesen, Vergleichen und fremde Felder bleiben ohne Fundstelle', () => {
    expect(kinds('const x = m.scoreA + 1; if (m.scoreA === 2) {} m.homeScore += 1; m.count++; const { scoreA: r } = m;')).toEqual([]);
    expect(kinds("const a = { ['other']: 2 }; m.scoreA == 1;")).toEqual([]);
  });

  it('F2 loest das Tabellenargument auf (Konstante, as const, Klammern, Typ-Assertion)', () => {
    expect(kinds("const T = 'match_events'; await c.from(T).upsert(r);")).toEqual(['direct-write:match_events.upsert']);
    expect(kinds("const T = 'live_matches' as const; await c.from(T).delete();")).toEqual(['direct-write:live_matches.delete']);
    expect(kinds("await c.from('live_matches' as const).delete();")).toEqual(['direct-write:live_matches.delete']);
    expect(kinds("await c.from(('match_events')).insert(r);")).toEqual(['direct-write:match_events.insert']);
    expect(kinds("await c.from(<'match_events'>'match_events').update(r);")).toEqual(['direct-write:match_events.update']);
  });

  it('F2 nicht aufloesbare Tabelle mit Schreibkette wird als <unbekannt> gemeldet', () => {
    expect(kinds("await c.from('match_' + 'events').update(r);")).toEqual(['direct-write:<unbekannt>.update']);
    expect(kinds('await c.from(tableName).upsert(r);')).toEqual(['direct-write:<unbekannt>.upsert']);
  });

  it('F2 Gegenbeispiele: Lesen, andere aufgeloeste Tabellen, Storage-Buckets und unbekannt ohne Schreibkette', () => {
    expect(kinds('await c.from(tableName).select("*");')).toEqual([]);
    expect(kinds("const T = 'matches'; await c.from(T).update(r);")).toEqual([]);
    expect(kinds("await supabase.storage.from(bucket).upload(path, file);")).toEqual([]);
    expect(kinds("await c.storage.from('logos').remove([p]);")).toEqual([]);
  });
});
