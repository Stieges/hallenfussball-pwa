import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A-23 (@OB-029, Durchstich nur lokal): `scripts/require-local-stack.sh` verweigert den Start,
 * wenn die Supabase-URL nicht lokal ist. Die URL-Sperre greift VOR der Stack-Abfrage, der Test
 * braucht deshalb kein laufendes Docker. Gegenbeispiel (das Falsche passiert nicht): eine
 * Cloud-URL, auch getarnt als lokaler Host, kommt nie durch.
 */
const SCRIPT = join(__dirname, '../../require-local-stack.sh');

function runGuard(env: Record<string, string>): { status: number | null; stderr: string } {
  const result = spawnSync('bash', [SCRIPT], {
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
  });
  return { status: result.status, stderr: result.stderr };
}

describe('require-local-stack.sh (@OB-029)', () => {
  it.each([
    ['E2E_SUPABASE_URL', 'https://amtlqicosscsjnnthvzm.supabase.co'],
    ['VITE_SUPABASE_URL', 'https://amtlqicosscsjnnthvzm.supabase.co'],
    ['E2E_SUPABASE_URL', 'http://127.0.0.1.evil.example'],
    ['E2E_SUPABASE_URL', 'http://localhost.evil.example:54321'],
    ['E2E_SUPABASE_URL', 'https://localhost:54321'],
  ])('Gegenbeispiel: %s=%s verweigert den Start', (variable, url) => {
    const result = runGuard({ [variable]: url });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Produktions-Sperre');
  });

  it('lässt eine lokale URL an der URL-Sperre vorbei (Abbruch erst am fehlenden Stack, nicht an der URL)', () => {
    // PATH ohne `supabase`: die Stack-Abfrage scheitert, aber NICHT mit der Produktions-Sperre.
    const result = spawnSync('bash', [SCRIPT], {
      env: { PATH: '/usr/bin:/bin', E2E_SUPABASE_URL: 'http://127.0.0.1:54321', E2E_REQUIRE_LOCAL_STACK_SKIP_HEALTH: '1' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain('Produktions-Sperre');
    expect(result.stderr).toContain('Kein laufender lokaler Supabase-Stack');
  });

  // N1: den Ziel-Host bestimmt allein API_URL aus `supabase status` (Schritt 3 des Skripts).
  // Die Statusausgabe wird hier über den Test-Hook simuliert, damit die wirksame Sperre
  // ohne Docker ein Gegenbeispiel bekommt.
  describe('Schritt 3: API_URL aus "supabase status" (Test-Hook)', () => {
    const runWithStatus = (apiUrl: string): { status: number | null; stderr: string } =>
      runGuard({
        PATH: '/usr/bin:/bin',
        E2E_REQUIRE_LOCAL_STACK_SKIP_HEALTH: '1',
        E2E_REQUIRE_LOCAL_STACK_STATUS_JSON: JSON.stringify({ API_URL: apiUrl }),
      });

    it.each([
      ['https://x.supabase.co', 'Cloud-URL als API_URL'],
      ['http://localhost.evil.example', 'getarnter Host als API_URL'],
      ['http://127.0.0.1.evil.example:54321', 'getarnter Host mit Port als API_URL'],
      ['http://localhost@evil.example', 'Benutzerinfo-Trick als API_URL'],
    ])('Gegenbeispiel: nicht-lokale API_URL "%s" verweigert den Start (%s)', (apiUrl) => {
      const result = runWithStatus(apiUrl);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Produktions-Sperre');
    });

    it('lässt eine lokale API_URL aus "supabase status" durch (Exit 0)', () => {
      const result = runWithStatus('http://127.0.0.1:54321');
      expect(result.status).toBe(0);
    });
  });

  // Schalter nur für Tests ohne Docker; die Gesundheitsprüfung selbst läuft sonst über `tsx`.
  // Der Test legt ein gefälschtes `tsx` an die Spitze des PATH: echtes tsx/Docker wird nie erreicht.
  describe('Gesundheitsprüfung (@LT-003)', () => {
    it('@LT-003 reicht Exit 1 und Text der Prüfung durch, auch bei lokaler API_URL', () => {
      const dir = mkdtempSync(join(tmpdir(), 'fake-tsx-'));
      const fake = join(dir, 'tsx');
      writeFileSync(fake, '#!/bin/sh\necho "Dienste der Testumgebung sind ausgefallen: storage" >&2\nexit 1\n');
      chmodSync(fake, 0o755);
      const result = spawnSync('bash', [SCRIPT], {
        env: {
          PATH: `${dir}:/usr/bin:/bin`,
          E2E_REQUIRE_LOCAL_STACK_STATUS_JSON: JSON.stringify({ API_URL: 'http://127.0.0.1:54321' }),
        },
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Dienste der Testumgebung sind ausgefallen: storage');
    });
  });
});
