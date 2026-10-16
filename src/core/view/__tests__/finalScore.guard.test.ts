/**
 * A-36b Schritt 4 – Wächter „Endstand nur zentral“ (Befund C-ENDSTAND-NICHT-ZENTRAL).
 * In `src/` liest außerhalb von `core/view/finalScore.ts` niemand Verlängerungs- oder Strafstoß-Stände, außer
 * den namentlich erlaubten Dateien, die Spalten nur TRANSPORTIEREN (Typen, Mapper, Engine-Overlay, Sync) bzw. dem
 * Cockpit bis zu seinem Neubau. Eine neue Datei, die selbst einen Endstand rechnet, macht diesen Test rot.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', '..');
const READER = /(overtimeScore|penaltyScore)[AB]/;

/** Datei → Rolle. Jede Zeile ist begründet; neue Einträge nur mit Ruling. */
const ALLOWED: Readonly<Record<string, string>> = {
  'core/view/finalScore.ts': 'zentraler Endstand',
  'utils/matchScore.ts': 'Re-Export getEffectiveScore (Eingangstyp), ÜBERGANG bis Cockpit 4.3',
  // Typen und Schemas (deklarieren die Felder)
  'types/tournament.ts': 'Typ Match',
  'core/models/types.ts': 'Feldliste',
  'core/models/LiveMatch.ts': 'Typ LiveMatch',
  'core/models/schemas/TournamentSchema.ts': 'Zod-Schema',
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
  'components/match-cockpit/MatchCockpit.tsx': 'Cockpit, bis Cockpit 4.3',
  'components/match-cockpit/PenaltyShootoutDialog.tsx': 'Cockpit, bis Cockpit 4.3',
  'components/match-cockpit/TiebreakerBanner.tsx': 'Cockpit, bis Cockpit 4.3',
  'hooks/engineEventEditingSupport.ts': 'Cockpit-Ereignisbearbeitung, bis Cockpit 4.3',
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
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

function readersIn(files: ReadonlyArray<{ path: string; source: string }>): string[] {
  return files.filter((f) => READER.test(withoutComments(f.source))).map((f) => f.path);
}

describe('A-36b Wächter: Endstand nur zentral (@ET-002, @ET-013)', () => {
  it('@ET-013 kein Leser von Verlängerung/Strafstoß außerhalb der namentlichen Liste', () => {
    const files = sourceFiles(SRC).map((path) => ({ path: relative(SRC, path).split('\\').join('/'), source: readFileSync(path, 'utf8') }));
    const unexpected = readersIn(files).filter((path) => !(path in ALLOWED));
    expect(unexpected).toEqual([]);
  });

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

  it('jede erlaubte Datei existiert noch (die Liste veraltet nicht)', () => {
    for (const path of Object.keys(ALLOWED)) {
      expect(statSync(join(SRC, path)).isFile()).toBe(true);
    }
  });
});
