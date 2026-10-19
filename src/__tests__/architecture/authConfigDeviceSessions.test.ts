/**
 * Wächter auf supabase/config.toml (A-27, brief-A-27.md R-A27-9, § 6.3 Z4) für lokal/CI.
 *
 * @FT-006: 6 Helfer-Handys + 6 Bildschirme an einem Hallen-Anschluss, je 2 Neustarts in einer Stunde → jedes Gerät
 *          bekommt seine Kennung, ohne von der Bremse abgewiesen zu werden: 12 × (1 + 2) = 36 anonyme Anmeldungen je
 *          Stunde und IP mindestens.
 * @AN-006: Konten entstehen nicht direkt beim Server -- die Sperre macht der Hook „Before User Created“
 *          (P0-4: Registrierung bleibt technisch an, sonst scheitert auch die anonyme Gerätesitzung).
 * Z4: die uri des Hooks nennt genau die Funktion aus 20261110_002_device_roles.sql.
 * Gelesen wird der TOML-Text (kein neues Paket); die Abschnitte werden an ihren Überschriften getrennt.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const CONFIG = readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8');
const A27 = readFileSync(resolve(ROOT, 'supabase/migrations/20261110_002_device_roles.sql'), 'utf8');

/** Zeilen eines TOML-Abschnitts (ohne Kommentare) bis zur nächsten Überschrift. */
function section(name: string): string[] {
  const lines = CONFIG.split('\n');
  const start = lines.findIndex((l) => l.trim() === `[${name}]`);
  if (start < 0) {
    throw new Error(`Abschnitt [${name}] fehlt oder ist auskommentiert`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^\s*\[/.test(l));
  return (end < 0 ? rest : rest.slice(0, end)).map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'));
}

function value(name: string, key: string): string | undefined {
  const line = section(name).find((l) => l.split('=')[0].trim() === key);
  return line?.slice(line.indexOf('=') + 1).trim();
}

describe('@AN-006 Registrierung nur über den Betreiber, anonyme Gerätesitzungen an', () => {
  it('Registrierung bleibt technisch an (P0-4), anonyme Anmeldung ist an', () => {
    expect(value('auth', 'enable_signup')).toBe('true');
    expect(value('auth', 'enable_anonymous_sign_ins')).toBe('true');
  });

  it('Hook „Before User Created“ ist an und zeigt auf public.hook_before_user_created', () => {
    expect(value('auth.hook.before_user_created', 'enabled')).toBe('true');
    expect(value('auth.hook.before_user_created', 'uri')).toBe('"pg-functions://postgres/public/hook_before_user_created"');
  });

  it('Z4: die Hook-Funktion steht in 20261110_002 und nur der Auth-Dienst darf sie ausführen', () => {
    expect(A27).toMatch(/CREATE OR REPLACE FUNCTION public\.hook_before_user_created\(event jsonb\) RETURNS jsonb/);
    expect(A27).toMatch(/GRANT EXECUTE ON FUNCTION public\.hook_before_user_created\(jsonb\) TO supabase_auth_admin;/);
  });
});

describe('@FT-006 die Bremse reicht für eine Halle (12 Geräte × 3 Anmeldungen je Stunde)', () => {
  it('anonymous_users ist mindestens 36 je Stunde und IP', () => {
    const limit = Number(value('auth.rate_limit', 'anonymous_users'));
    expect(Number.isInteger(limit)).toBe(true);
    expect(limit).toBeGreaterThanOrEqual(12 * (1 + 2));
  });
});
