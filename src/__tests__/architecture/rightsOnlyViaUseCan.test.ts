/**
 * Wächter A-11 (brief-A-11.md Schritt 5, R-A11-3/R-A11-4): Rechte fragt die App nur über useCan.
 *
 * (a) Keine Datei importiert den gelöschten Stub hooks/usePermissions.
 * (b) In src/{features,screens,components,hooks}/**\/*.{ts,tsx} kommen useMyTournamentRole, useEffectiveTournamentRole,
 *     hasPermission( und die can…-Aufrufe aus permissions.ts nur in der Erlaubnisliste vor. Die Liste wird NIE erweitert,
 *     nur gekürzt. Review A-11 A5: vorher nur .tsx ohne src/hooks und ohne hasPermission( -- ein neuer .ts-Hook mit
 *     useMyTournamentRole + hasPermission wäre durchgerutscht. Ausgenommen sind nur die beiden QUELLEN (sie definieren
 *     Rolle bzw. Rechte, sie fragen nicht): permissions.ts und useMyTournamentRole.ts.
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
  'src/features/auth/hooks/useCan.ts',
  'src/features/match-engine/useEventAuthors.ts',
  'src/features/auth/components/MemberList.tsx',
]);

/** Die Quellen selbst: hier werden Rolle und Rechte DEFINIERT (keine Erlaubnis, kein Fragen). Nie erweitern. */
const SOURCES = new Set([
  'src/features/auth/utils/permissions.ts',
  'src/features/auth/hooks/useMyTournamentRole.ts',
]);

/** can…-Funktionen aus permissions.ts, die die Rolle der FRAGENDEN Person auswerten (L8: Ziel-Rollen-Prüfungen erlaubt). */
const CAN_FUNCTIONS = [
  'canManageTournament', 'canDeleteTournament', 'canCreateInvitations', 'canEditResults', 'canEditSchedule',
  'canEditAllTeams', 'canEditTeamRoster', 'canEditTeamMetadata',
];

const RIGHTS_PATTERN = new RegExp(
  `\\b(useMyTournamentRole|useEffectiveTournamentRole|hasPermission|${CAN_FUNCTIONS.join('|')})\\s*\\(`,
);

describe('A-11 Wächter: Rechte nur über useCan', () => {
  it('(a) keine Datei importiert hooks/usePermissions, und der Stub existiert nicht mehr', () => {
    const offenders = allFiles
      .filter((f) => /from\s+['"][^'"]*hooks\/usePermissions['"]|vi\.mock\(\s*['"][^'"]*hooks\/usePermissions['"]/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
    expect(sourceFiles.map((f) => f.path)).not.toContain('src/hooks/usePermissions.ts');
  });

  it('(b) useMyTournamentRole/useEffectiveTournamentRole/hasPermission(/can…( in App-Dateien (.ts/.tsx, auch src/hooks) nur in der Erlaubnisliste', () => {
    const appFiles = sourceFiles.filter((f) => /^src\/(features|screens|components|hooks)\/.*\.tsx?$/.test(f.path));
    const offenders = appFiles
      .filter((f) => RIGHTS_PATTERN.test(f.text))
      .map((f) => f.path)
      .filter((f) => !ALLOWED.has(f) && !SOURCES.has(f));
    expect(offenders).toEqual([]);
  });

  it('(b) Gegenprobe: das Muster erfasst einen .ts-Hook mit useMyTournamentRole + hasPermission( (Review A-11 A5)', () => {
    const probeHook = "const { role } = useMyTournamentRole(id);\nreturn role ? hasPermission(role, 'manageSchedule') : false;";
    expect(RIGHTS_PATTERN.test(probeHook)).toBe(true);
    expect(RIGHTS_PATTERN.test("return hasPermission (role, 'teams');")).toBe(true);
    expect(RIGHTS_PATTERN.test("const can = useCan('teams', id);")).toBe(false);
  });

  it('(b) die Erlaubnisliste enthält nur Dateien, die es noch gibt und die sie brauchen', () => {
    for (const file of ALLOWED) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      expect(text, file).toMatch(RIGHTS_PATTERN);
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
