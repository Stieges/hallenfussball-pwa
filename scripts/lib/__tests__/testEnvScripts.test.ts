import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Verdrahtung der npm-Skripte (@LT-001, @LT-003, @LT-004): die Prüfung ist überall eingebunden. */
const pkg = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};
const script = (name: string): string => pkg.scripts[name] ?? '';

describe('package.json: Testumgebung', () => {
  it('@LT-001 test:env:up prüft --vorher VOR supabase start', () => {
    const up = script('test:env:up');
    expect(up).toContain('--vorher');
    expect(up.indexOf('--vorher')).toBeLessThan(up.indexOf('supabase start'));
  });

  it('@LT-003 test:env:up prüft --gesund direkt nach dem Start und vor dem Einspielen des Schemas', () => {
    const up = script('test:env:up');
    expect(up).toContain('supabase start --ignore-health-check');
    expect(up.indexOf('--gesund')).toBeGreaterThan(up.indexOf('supabase start'));
    expect(up.indexOf('--gesund')).toBeLessThan(up.indexOf('local-db-apply.sh'));
  });

  it('@LT-003 test:env:status enthält --gesund vor der Statusanzeige', () => {
    const status = script('test:env:status');
    expect(status).toContain('--gesund');
    expect(status.indexOf('--gesund')).toBeLessThan(status.indexOf('test-env-status.sh'));
  });

  it('@LT-003 test:e2e:cloud ruft require-local-stack.sh', () => {
    expect(script('test:e2e:cloud')).toContain('require-local-stack.sh');
  });

  it('@LT-005 test:env:aufraeumen ruft das Prüfskript im Modus --aufraeumen', () => {
    expect(script('test:env:aufraeumen')).toContain('test-env-check.ts --aufraeumen');
  });

  it('Laufzeit: Skripte rufen tsx direkt auf, nicht über npx', () => {
    for (const name of ['test:env:up', 'test:env:reset', 'test:env:seed', 'test:env:status', 'test:env:aufraeumen']) {
      expect(script(name), name).not.toContain('npx tsx');
    }
    expect(script('test:env:aufraeumen')).toMatch(/^tsx /);
  });
});
