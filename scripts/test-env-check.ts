/**
 * scripts/test-env-check.ts — Gesundheitsprüfung der gemeinsamen lokalen Supabase-Testumgebung.
 *
 * Anforderung: docs/anforderungen/plattform/2026-10-20_lokale-testumgebung-gesund.md (@LT-001 … @LT-008).
 * Ausführbar mit `npx tsx scripts/test-env-check.ts <modus>`:
 *   --vorher       Docker erreichbar + keine Versionsdateien (vor `supabase start`)
 *   --gesund       Versionsdateien + jeder Dienst der Testumgebung läuft
 *   --aufraeumen   löscht ungenutzte Images der Testumgebung und namenlose Playwright-Images
 * Die Logik steckt in `scripts/lib/localStackHealth.ts` (rein, getestet); hier nur das Gerüst.
 * Aufrufe laufen über execFileSync (kein Shell-String).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateCleanup,
  findRemovableImages,
  findUnhealthyContainers,
  findVersionPins,
  formatDockerUnreachableMessage,
  formatPinMessage,
  formatRemovableList,
  formatUnhealthyMessage,
  parseProjectId,
  type CleanupAttempt,
  type DockerContainer,
  type DockerImage,
} from './lib/localStackHealth';

interface InspectState {
  Status?: string;
  Health?: { Status?: string };
}
interface InspectEntry {
  Name?: string;
  Image?: string;
  Config?: { Image?: string };
  State?: InspectState;
}
interface ImageListEntry {
  ID?: string;
  Repository?: string;
  Tag?: string;
  Size?: string;
}

const REPO_ROOT = process.cwd();

function docker(args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000 });
}

function out(message: string): void {
  process.stdout.write(`${message}\n`);
}

function fail(message: string): never {
  console.error(`[test-env-check] ${message}`);
  process.exit(1);
}

function ensureDocker(): void {
  try {
    docker(['info']);
  } catch {
    fail(formatDockerUnreachableMessage());
  }
}

function readProjectId(): string {
  const toml = fs.readFileSync(path.join(REPO_ROOT, 'supabase', 'config.toml'), 'utf8');
  const id = parseProjectId(toml);
  if (id === null) fail('project_id in supabase/config.toml nicht lesbar.');
  return id;
}

function checkPins(): void {
  const dir = path.join(REPO_ROOT, 'supabase', '.temp');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const pins = findVersionPins(files);
  if (pins.length > 0) fail(formatPinMessage(pins));
}

function listContainers(): DockerContainer[] {
  const ids = docker(['ps', '-aq']).split('\n').filter((s) => s.length > 0);
  if (ids.length === 0) return [];
  const entries = JSON.parse(docker(['inspect', ...ids])) as InspectEntry[];
  return entries.map((e) => ({
    name: (e.Name ?? '').replace(/^\//, ''),
    imageId: e.Image ?? '',
    imageRef: e.Config?.Image ?? '',
    status: e.State?.Status ?? 'unknown',
    health: e.State?.Health?.Status,
  }));
}

function listImages(): DockerImage[] {
  return docker(['images', '--no-trunc', '--format', '{{json .}}'])
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ImageListEntry)
    .map((e) => ({ id: e.ID ?? '', repository: e.Repository ?? '', tag: e.Tag ?? '', size: e.Size ?? '' }));
}

function lastLogLine(containerName: string): string {
  try {
    // docker logs schreibt den Container-stderr nach stderr: 2>&1 über sh wäre ein Shell-String,
    // deshalb beide Ströme getrennt lesen.
    const res = spawnSync('docker', ['logs', '--tail', '5', containerName], { encoding: 'utf8', timeout: 10_000 });
    const lines = `${res.stdout}\n${res.stderr}`.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    return lines.pop() ?? '(Protokoll leer)';
  } catch {
    return '(Protokoll nicht lesbar)';
  }
}

function checkHealthy(): void {
  const findings = findUnhealthyContainers(listContainers(), readProjectId());
  if (findings.length === 0) return;
  const logs: Record<string, string> = {};
  for (const f of findings) logs[f.name] = lastLogLine(f.name);
  fail(formatUnhealthyMessage(findings, logs));
}

function cleanup(): void {
  const removable = findRemovableImages(listImages(), listContainers());
  out(formatRemovableList(removable));
  const attempts: CleanupAttempt[] = removable.map((image) => {
    try {
      docker(['rmi', image.id]);
      return { image, ok: true };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      return { image, ok: false, error: text.split('\n').filter((l) => l.length > 0).pop() };
    }
  });
  const result = evaluateCleanup(attempts);
  out(result.message);
  process.exit(result.exitCode);
}

function main(): void {
  const mode = process.argv[2];
  ensureDocker();
  switch (mode) {
    case '--vorher':
      checkPins();
      break;
    case '--gesund':
      checkPins();
      checkHealthy();
      break;
    case '--aufraeumen':
      cleanup();
      break;
    default:
      fail('Modus fehlt: --vorher | --gesund | --aufraeumen');
  }
}

main();
