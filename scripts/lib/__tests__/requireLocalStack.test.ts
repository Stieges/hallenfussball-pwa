import { spawnSync } from 'node:child_process';
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
      env: { PATH: '/usr/bin:/bin', E2E_SUPABASE_URL: 'http://127.0.0.1:54321' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain('Produktions-Sperre');
    expect(result.stderr).toContain('Kein laufender lokaler Supabase-Stack');
  });
});
