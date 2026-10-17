/**
 * A-36b Schritt 4 – Wächter „Endstand nur zentral“ (Befund C-ENDSTAND-NICHT-ZENTRAL).
 * In `src/` liest außerhalb von `core/view/finalScore.ts` niemand Verlängerungs- oder Strafstoß-Stände, außer
 * den namentlich erlaubten Dateien, die Spalten nur TRANSPORTIEREN (Typen, Mapper, Engine-Overlay, Sync) bzw. dem
 * Cockpit bis zu seinem Neubau. Eine neue Datei, die selbst einen Endstand rechnet, macht diesen Test rot.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', '..');
/** camelCase-Felder und snake_case-Spalten (K3: ein Leser direkt an der Cloud-Zeile zählt mit). */
const READER = /(overtimeScore|penaltyScore)[AB]|(overtime|penalty)_score_[ab]/;
/** Klammerzugriff `m['penaltyScoreA']` – vor dem Entfernen der Strings gesondert geprüft (K3). */
const BRACKET_READER = /\[\s*['"`]((overtime|penalty)Score[AB]|(overtime|penalty)_score_[ab])['"`]\s*\]/;

/** Datei → Rolle. Jede Zeile ist begründet; neue Einträge nur mit Ruling. */
const ALLOWED: Readonly<Record<string, string>> = {
  'core/view/finalScore.ts': 'zentraler Endstand',
  'utils/matchScore.ts': 'Re-Export getEffectiveScore (Eingangstyp), ÜBERGANG bis Cockpit 4.3',
  // Typen und Schemas (deklarieren die Felder)
  'types/tournament.ts': 'Typ Match',
  'types/supabase.ts': 'erzeugte Datenbank-Typen (snake_case-Spalten)',
  'core/match/client/cacheColumns.ts': 'Engine-Zustand → Cache-Spalten (schreibt, rechnet keinen Endstand)',
  'core/models/types.ts': 'Feldliste',
  'core/models/LiveMatch.ts': 'Typ LiveMatch',
  'core/models/schemas/TournamentSchema.ts': 'Zod-Schema',
  'components/live-cockpit/types.ts': 'Typ LiveMatch (Cockpit-Form, deklariert nur; B-06 aus match-cockpit/MatchCockpit.tsx umgezogen)',
  // Transport: Spalten lesen/schreiben, keinen Endstand rechnen
  'core/repositories/supabaseMappers.ts': 'Mapper Cloud ↔ Match',
  'core/repositories/liveMatchMappers.ts': 'Mapper LiveMatch',
  'core/repositories/serverLedMatchFields.ts': 'Feldliste serverführend',
  'core/match/client/applyEngineOverlay.ts': 'Engine-Cache → Match',
  'core/match/client/viewAdapters.ts': 'Engine-Zustand → Cockpit-Form',
  'core/services/TournamentCreationService.ts': 'Status beim Veröffentlichen übernehmen',
  'core/services/matchResultStatusDiff.ts': 'Feldliste Ergebnis-Diff',
  'hooks/useTournamentManager.ts': 'Rohdaten → Match',
  // Cockpit: bis Cockpit 4.3 (Neubau), danach nur noch matchFinalScore
  'components/live-cockpit/LiveCockpit.tsx': 'Cockpit, bis Cockpit 4.3',
  'hooks/engineEventEditingSupport.ts': 'Cockpit-Ereignisbearbeitung, bis Cockpit 4.3',
  // PDF (Spur C, mit main gekommen): rechnet die Endstand-Darstellung selbst – ÜBERGANG bis A-36d (dann MatchView.score)
  'lib/pdf/matchResult.ts': 'PDF liest Verlängerung/Strafstoß selbst, bis A-36d',
  'lib/pdf/tournamentState.ts': 'PDF-Eingangstyp, transportiert, bis A-36d',
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === '__fixtures__' || name === 'test' ? [] : sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

/** Kommentare und Text in einfachen Anführungszeichen entfernen, damit Erwähnungen in Doku/Meldungen nicht zählen. */
function withoutBlockAndLineComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function withoutComments(source: string): string {
  return withoutBlockAndLineComments(source)
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

function readersIn(files: ReadonlyArray<{ path: string; source: string }>): string[] {
  return files
    .filter((f) => BRACKET_READER.test(withoutBlockAndLineComments(f.source)) || READER.test(withoutComments(f.source)))
    .map((f) => f.path);
}

describe('A-36b Wächter: Endstand nur zentral (@ET-002, @ET-013)', () => {
  // Die ~860 Quelldateien werden parallel gelesen: Der Lesevorgang wartet auf das Dateisystem, nicht auf die CPU.
  // Zeitlimit nur für diesen Test: Der Wächter muss alle Quelldateien lesen (Dateisystem-Arbeit). Messung einzeln ca. 1,3–2,1 s,
  // unter voller Vitest-Last bis 16 s (Daniel, vorher). Der Prüfinhalt ist unverändert.
  it('@ET-013 kein Leser von Verlängerung/Strafstoß außerhalb der namentlichen Liste', async () => {
    const files = await Promise.all(sourceFiles(SRC).map(async (path) => ({
      path: relative(SRC, path).split('\\').join('/'),
      source: await readFile(path, 'utf8'),
    })));
    const unexpected = readersIn(files).filter((path) => !(path in ALLOWED));
    expect(unexpected).toEqual([]);
  }, 15_000);

  it('@ET-013 die Tabelle (calculations.ts) liest Verlängerung/Strafstoß nicht selbst (Auflage Tabelle)', () => {
    expect(READER.test(withoutComments(readFileSync(join(SRC, 'utils/calculations.ts'), 'utf8')))).toBe(false);
  });

  it('Gegenbeispiel: ein neuer Leser in components/ wird erkannt, eine Erwähnung im Kommentar nicht', () => {
    const files = [
      { path: 'components/Neu.tsx', source: 'const x = match.penaltyScoreA ?? 0;' },
      { path: 'components/Doku.tsx', source: "// liest nie overtimeScoreA\n/* penaltyScoreB */ const y = 'penaltyScoreA';" },
    ];
    expect(readersIn(files)).toEqual(['components/Neu.tsx']);
  });

  it('Gegenbeispiel (K3): snake_case-Spalte und Klammerzugriff werden erkannt, Text in Meldungen nicht', () => {
    const files = [
      { path: 'features/public-view/rpc.ts', source: 'const x = row.penalty_score_a ?? 0;' },
      { path: 'components/Klammer.tsx', source: "const y = match['overtimeScoreB'];" },
      { path: 'components/Meldung.tsx', source: "const z = 'kennt penalty_score_a nicht';" },
      { path: 'components/Kommentar.tsx', source: "// match['penaltyScoreA']\nconst w = 1;" },
    ];
    expect(readersIn(files)).toEqual(['features/public-view/rpc.ts', 'components/Klammer.tsx']);
  });

  it('jede erlaubte Datei existiert noch (die Liste veraltet nicht)', () => {
    for (const path of Object.keys(ALLOWED)) {
      expect(statSync(join(SRC, path)).isFile()).toBe(true);
    }
  });
});
