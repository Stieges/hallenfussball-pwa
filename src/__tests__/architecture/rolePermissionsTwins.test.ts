/**
 * Zwillinge JSON ↔ SQL ↔ TS der Rechtetabelle (A-11, brief-A-11.md Abschnitt 4, Z1/Z2).
 *
 * Z1 Rechte-Namen: CHECK role_permissions_permission_check aus 20261110_001 = PERMISSIONS (permissions.ts) =
 *    Schlüssel von capabilities in rolePermissions.json.
 * Z2 Rechte je Rolle: Endstand aus den Migrationen (20260924_002 INSERT + 20260928_001 INSERT + 20261110_001
 *    INSERT/DELETE) = roles der JSON. Z3 (Policy ↔ Recht) prüft die Vollmatrix in scripts/rls-role-matrix.sh.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import rolePermissionsJson from '../../features/auth/permissions/rolePermissions.json';
import { PERMISSIONS } from '../../features/auth/utils/permissions';

const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations');
const read = (file: string): string => readFileSync(resolve(MIGRATIONS, file), 'utf8');

const A11 = read('20261110_001_role_permissions_mvp.sql');
const R5B = read('20260924_002_central_role_permissions.sql');
const B2 = read('20260928_001_match_event_log.sql');

const json = rolePermissionsJson as unknown as { capabilities: Record<string, string>; roles: Record<string, string[]> };

/** Namen im letzten ADD CONSTRAINT role_permissions_permission_check ... permission IN (...) der Datei. */
function checkNames(sql: string): string[] {
  const matches = [...sql.matchAll(/ADD CONSTRAINT\s+"?role_permissions_permission_check"?\s+CHECK\s*\(\s*"?permission"?\s+IN\s*\(([^)]*)\)/gi)];
  const last = matches.at(-1);
  if (!last) {
    throw new Error('CHECK role_permissions_permission_check nicht gefunden');
  }
  return [...last[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
}

/** Paare ('rolle', 'recht') aus allen INSERT INTO role_permissions ... VALUES ...;-Anweisungen der Datei. */
function insertedPairs(sql: string): string[] {
  const blocks = [...sql.matchAll(/^INSERT INTO\s+"?public"?\."?role_permissions"?[^;]*?VALUES([\s\S]*?)ON CONFLICT/gim)];
  return blocks.flatMap((b) => [...b[1].matchAll(/\('([a-z-]+)',\s*'([A-Za-z]+)'\)/g)].map((m) => `${m[1]}:${m[2]}`));
}

/** Paare aus DELETE FROM role_permissions WHERE role = 'x' AND permission IN (...). */
function deletedPairs(sql: string): string[] {
  const blocks = [...sql.matchAll(/^DELETE FROM\s+public\.role_permissions\s+WHERE role = '([a-z-]+)' AND permission IN \(([^)]*)\)/gim)];
  return blocks.flatMap((b) => [...b[2].matchAll(/'([A-Za-z]+)'/g)].map((m) => `${b[1]}:${m[1]}`));
}

describe('Z1 Rechte-Namen: SQL-CHECK = PERMISSIONS = capabilities', () => {
  it('der CHECK aus 20261110_001 hat genau die 13 Namen von PERMISSIONS', () => {
    expect([...checkNames(A11)].sort()).toEqual([...PERMISSIONS].sort());
    expect(PERMISSIONS).toHaveLength(13);
  });

  it('capabilities der JSON nennt genau dieselben Rechte', () => {
    expect(Object.keys(json.capabilities).sort()).toEqual([...PERMISSIONS].sort());
  });

  it('der Prognose-Wächter der Migration kennt dieselben 13 Namen', () => {
    const guard = /permission NOT IN \(([^)]*)\)/.exec(A11);
    expect(guard).not.toBeNull();
    const names = [...(guard?.[1] ?? '').matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
    expect(names.sort()).toEqual([...PERMISSIONS].sort());
  });
});

describe('Z2 Rechte je Rolle: Endstand der Migrationen = roles der JSON', () => {
  const endstand = new Set([...insertedPairs(R5B), ...insertedPairs(B2), ...insertedPairs(A11)]);
  for (const pair of deletedPairs(A11)) {
    endstand.delete(pair);
  }
  const fromJson = Object.entries(json.roles).flatMap(([role, rights]) => rights.map((r) => `${role}:${r}`));

  it('Endstand hat 11 Zeilen und ist gleich der JSON', () => {
    expect([...endstand].sort()).toEqual(fromJson.sort());
    expect(endstand.size).toBe(11);
  });

  it('@HE-042 / C-RECHTE-KORREKTUR: die Migration entzieht dem Helfer teams und correctEvents', () => {
    expect(deletedPairs(A11).sort()).toEqual(['collaborator:correctEvents', 'collaborator:teams']);
    expect(json.roles.collaborator).toEqual(['writeMatchData']);
  });

  it('die Endstand-Prüfung der Migration nennt dieselben 11 Zeilen wie die JSON', () => {
    const soll = /v_soll text := ([\s\S]*?);\s*BEGIN/.exec(A11);
    expect(soll).not.toBeNull();
    const text = [...(soll?.[1] ?? '').matchAll(/'([^']*)'/g)].map((m) => m[1]).join('');
    expect(text.split(',').sort()).toEqual(fromJson.sort());
  });
});
