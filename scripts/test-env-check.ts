/**
 * scripts/test-env-check.ts — Gesundheitsprüfung der gemeinsamen lokalen Supabase-Testumgebung.
 *
 * Anforderung: docs/anforderungen/plattform/2026-10-20_lokale-testumgebung-gesund.md (@LT-001 … @LT-011).
 * Ausführbar mit `npx tsx scripts/test-env-check.ts <modus>`:
 *   --vorher                 Docker erreichbar + keine Versionsdateien (vor `supabase start`)
 *   --gesund                 Versionsdateien + jeder vorhandene Dienst läuft (fehlende Container meldet das NICHT)
 *   --aufraeumen [--trocken] löscht abgelöste Images der Testumgebung und namenlose Playwright-Images;
 *                            nur bei laufender Testumgebung; --trocken zeigt nur an
 * Die Logik steckt in `scripts/lib/localStackHealth.ts` und `scripts/lib/testEnvCheck.ts` (getestet);
 * hier nur die dünne Schicht mit echtem Docker und Dateisystem. Aufrufe über execFileSync/spawnSync
 * (kein Shell-String).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck, type CheckDeps, type CheckMode, type DockerOutput } from './lib/testEnvCheck';

const MODES: readonly CheckMode[] = ['--vorher', '--gesund', '--aufraeumen'];

function realDocker(args: string[]): DockerOutput {
  if (args[0] === 'logs') {
    // docker logs schreibt den Container-stderr nach stderr: beide Ströme getrennt lesen.
    const res = spawnSync('docker', args, { encoding: 'utf8', timeout: 10_000 });
    return { stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
  }
  const stdout = execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000 });
  return { stdout, stderr: '' };
}

function main(): void {
  const mode = MODES.find((m) => m === process.argv[2]);
  if (mode === undefined) {
    console.error('[test-env-check] Modus fehlt: --vorher | --gesund | --aufraeumen [--trocken]');
    process.exit(1);
  }
  const deps: CheckDeps = {
    repoRoot: join(dirname(fileURLToPath(import.meta.url)), '..'),
    docker: realDocker,
    readDir: (path) => readdirSync(path),
    readFile: (path) => readFileSync(path, 'utf8'),
  };
  const result = runCheck(mode, deps, { trocken: process.argv.includes('--trocken') });
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}

main();
