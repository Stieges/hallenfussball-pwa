/**
 * Zwillinge der Rollen (A-27, brief-A-27.md § 6.3 Z1/Z3): SQL ↔ TS ↔ JSON.
 *
 * Z1 Rollen: CHECK tournament_collaborators_role_check (letzte Fassung, 20261110_002) = TOURNAMENT_ROLES;
 *    CHECK role_permissions_role_check (20261110_002) = ROLE_PERMISSIONS_ROLES = Schlüssel von roles der JSON.
 * Z3 Geräte-Rollen: die Liste ('helper', 'screen') in has_tournament_permission und im Guard protect_device_roles
 *    (20261110_002) = DEVICE_ROLES (permissions.ts, Grundlage von canChangeRole/canSetRoleTo, @HE-084).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import rolePermissionsJson from '../../features/auth/permissions/rolePermissions.json';
import { TOURNAMENT_ROLES } from '../../features/auth/types/auth.types';
import { DEVICE_ROLES, ROLE_PERMISSIONS_ROLES } from '../../features/auth/utils/permissions';

const A27 = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261110_002_device_roles.sql'), 'utf8');
const json = rolePermissionsJson as unknown as { roles: Record<string, string[]> };

/** Namen im ADD CONSTRAINT <name> CHECK (role IN (...)) der Datei. */
function roleCheck(name: string): string[] {
  const m = new RegExp(`ADD CONSTRAINT ${name}\\s+CHECK \\(role IN \\(([^)]*)\\)\\)`).exec(A27);
  if (!m) {
    throw new Error(`CHECK ${name} nicht gefunden`);
  }
  return [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]);
}

/** Rumpf einer Funktion der Datei (CREATE OR REPLACE FUNCTION public.<name> ... bis zum schliessenden $$;). */
function functionBody(name: string): string {
  const m = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`).exec(A27);
  if (!m) {
    throw new Error(`Funktion ${name} nicht gefunden`);
  }
  return m[1];
}

describe('Z1 Rollen: SQL-CHECKs = TS = JSON (A-27)', () => {
  it('Mitglieds-CHECK = TOURNAMENT_ROLES (inkl. helper und screen)', () => {
    expect(roleCheck('tournament_collaborators_role_check').sort()).toEqual([...TOURNAMENT_ROLES].sort());
    expect(TOURNAMENT_ROLES).toContain('helper');
    expect(TOURNAMENT_ROLES).toContain('screen');
  });

  it('Rechte-CHECK = ROLE_PERMISSIONS_ROLES = Rollen-Schlüssel der JSON (ohne owner)', () => {
    const sql = roleCheck('role_permissions_role_check').sort();
    expect([...ROLE_PERMISSIONS_ROLES].sort()).toEqual(sql);
    expect(Object.keys(json.roles).sort()).toEqual(sql);
    expect(sql).not.toContain('owner');
  });
});

describe('Z3 Geräte-Rollen-Liste: SQL (has_tournament_permission, Guard) = DEVICE_ROLES', () => {
  const listIn = (body: string): string[][] =>
    [...body.matchAll(/role IN \(('[a-z-]+'(?:, '[a-z-]+')*)\)/g)].map((m) => [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]));

  it('has_tournament_permission zählt anonym nur die Geräte-Rollen', () => {
    const lists = listIn(functionBody('has_tournament_permission'));
    expect(lists).toEqual([[...DEVICE_ROLES]]);
  });

  it('der Guard protect_device_roles sperrt genau die Geräte-Rollen', () => {
    const lists = listIn(functionBody('protect_device_roles'));
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      expect(list).toEqual([...DEVICE_ROLES]);
    }
  });
});
