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
  `\\b(useMyTournamentRole|useEffectiveTournamentRole|hasPermission|canWithListedRole|${CAN_FUNCTIONS.join('|')})\\s*\\(`,
);

/**
 * CA-5 (Review CA-3–5 Auflage 4): `canWithListedRole(` (useCan.ts) fragt ein Recht mit der Rolle aus `Tournament.myRole` der
 * Startseiten-Liste. Erlaubt NUR in diesen Dateien, und dort nur dieser Aufruf (kein hasPermission( o. Ä.).
 * Nur kürzen, nie erweitern.
 */
const LISTED_ROLE_CALLERS = new Set([
  'src/components/TournamentCard.tsx',
  'src/features/tournament-management/MonitorTransferSheet.tsx',
]);
const LISTED_ROLE_CALL = /\bcanWithListedRole\s*\(/g;

/** Dateien, die Rechte an useCan vorbei fragen (Erlaubnisliste, Quellen und Aufrufer von canWithListedRole ausgenommen). */
function rightsOffenders(files: ReadonlyArray<{ path: string; text: string }>): string[] {
  return files
    .filter((f) => RIGHTS_PATTERN.test(f.text))
    .filter((f) => !ALLOWED.has(f.path) && !SOURCES.has(f.path))
    .filter((f) => !(LISTED_ROLE_CALLERS.has(f.path) && !RIGHTS_PATTERN.test(f.text.replace(LISTED_ROLE_CALL, ''))))
    .map((f) => f.path);
}

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
    expect(rightsOffenders(appFiles)).toEqual([]);
  });

  it('(b) Gegenprobe: das Muster erfasst einen .ts-Hook mit useMyTournamentRole + hasPermission( (Review A-11 A5)', () => {
    const probeHook = "const { role } = useMyTournamentRole(id);\nreturn role ? hasPermission(role, 'manageSchedule') : false;";
    expect(RIGHTS_PATTERN.test(probeHook)).toBe(true);
    expect(RIGHTS_PATTERN.test("return hasPermission (role, 'teams');")).toBe(true);
    expect(RIGHTS_PATTERN.test("const can = useCan('teams', id);")).toBe(false);
  });

  it('(b) Gegenprobe canWithListedRole (Review CA-3–5 Auflage 4): das Muster erfasst den Aufruf; eine dritte Datei fällt durch, und hasPermission( bleibt auch in den festen Aufrufern verboten', () => {
    expect(RIGHTS_PATTERN.test("const mayDelete = canWithListedRole(role, 'deleteTournament');")).toBe(true);
    const call = "canWithListedRole(t.myRole, 'deleteTournament')";
    expect(rightsOffenders([{ path: 'src/components/TournamentCard.tsx', text: call }])).toEqual([]);
    expect(rightsOffenders([{ path: 'src/components/AndereKarte.tsx', text: call }])).toEqual(['src/components/AndereKarte.tsx']);
    expect(rightsOffenders([{ path: 'src/components/TournamentCard.tsx', text: `${call}; hasPermission(role, 'teams')` }]))
      .toEqual(['src/components/TournamentCard.tsx']);
  });

  it('(b) die festen Aufrufer von canWithListedRole gibt es noch, und sie brauchen den Aufruf', () => {
    for (const file of LISTED_ROLE_CALLERS) {
      expect(readFileSync(join(ROOT, file), 'utf8'), file).toMatch(/\bcanWithListedRole\s*\(/);
    }
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
