/**
 * Wächter A-11 (brief-A-11.md Schritt 5, R-A11-3/R-A11-4): Rechte fragt die App nur über useCan.
 *
 * (a) Keine Datei importiert den gelöschten Stub hooks/usePermissions.
 * (b) In src/{features,screens,components}/**\/*.tsx kommen useMyTournamentRole, useEffectiveTournamentRole und die
 *     can…-Aufrufe aus permissions.ts nur in der Erlaubnisliste vor. Die Liste wird NIE erweitert, nur gekürzt.
 * (c) Die RLS-Matrix ist ein Pflicht-Check: der Workflow hat unter pull_request keinen paths-Filter, und der Jobname
 *     (Kontextname des Branch-Schutzes) ist unverändert.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const isTest = (file: string): boolean => /__tests__|\.test\.|\.spec\./.test(file);
const rel = (file: string): string => relative(ROOT, file).split('\\').join('/');
// Einmal lesen (die Suite läuft parallel mit allen anderen; mehrfaches Lesen sprengte die Zeitgrenze).
const allFiles = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => ({ path: rel(f), text: readFileSync(f, 'utf8') }));
const sourceFiles = allFiles.filter((f) => !isTest(f.path));

/** Nur kürzen, nie erweitern (Brief Schritt 5). */
const ALLOWED = new Set([
  'src/features/auth/components/MemberList.tsx',
]);

/** can…-Funktionen aus permissions.ts, die die Rolle der FRAGENDEN Person auswerten (L8: Ziel-Rollen-Prüfungen erlaubt). */
const CAN_FUNCTIONS = [
  'canManageTournament', 'canDeleteTournament', 'canCreateInvitations', 'canEditResults', 'canEditSchedule',
  'canEditAllTeams', 'canEditTeamRoster', 'canEditTeamMetadata',
];

describe('A-11 Wächter: Rechte nur über useCan', () => {
  it('(a) keine Datei importiert hooks/usePermissions, und der Stub existiert nicht mehr', () => {
    const offenders = allFiles
      .filter((f) => /from\s+['"][^'"]*hooks\/usePermissions['"]|vi\.mock\(\s*['"][^'"]*hooks\/usePermissions['"]/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
    expect(sourceFiles.map((f) => f.path)).not.toContain('src/hooks/usePermissions.ts');
  });

  it('(b) useMyTournamentRole/useEffectiveTournamentRole/can…( in UI-Dateien nur in der Erlaubnisliste', () => {
    const uiFiles = sourceFiles.filter((f) => /^src\/(features|screens|components)\/.*\.tsx$/.test(f.path));
    const pattern = new RegExp(`\\b(useMyTournamentRole|useEffectiveTournamentRole|${CAN_FUNCTIONS.join('|')})\\s*\\(`);
    const offenders = uiFiles.filter((f) => pattern.test(f.text)).map((f) => f.path).filter((f) => !ALLOWED.has(f));
    expect(offenders).toEqual([]);
  });

  it('(b) die Erlaubnisliste enthält nur Dateien, die es noch gibt und die sie brauchen', () => {
    for (const file of ALLOWED) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      expect(text, file).toMatch(/useMyTournamentRole|useEffectiveTournamentRole|can[A-Z]\w*\(/);
    }
  });

  it('(c) RLS-Matrix läuft bei jedem PR: kein paths-Filter unter pull_request, Jobname unverändert', () => {
    const workflow = readFileSync(join(ROOT, '.github/workflows/rls-role-matrix.yml'), 'utf8');
    const trigger = /^on:\n([\s\S]*?)^\S/m.exec(workflow)?.[1] ?? '';
    expect(trigger).toMatch(/pull_request/);
    expect(trigger).not.toMatch(/^\s+paths(-ignore)?:/m);
    expect(workflow).toContain('name: Rechte-Matrix gegen echtes RLS (Postgres-Wegwerfcontainer)');
  });
});
