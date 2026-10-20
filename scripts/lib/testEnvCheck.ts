/**
 * testEnvCheck.ts — Ablauf der Testumgebungs-Prüfung (@LT-001 … @LT-011) mit eingespeisten
 * Abhängigkeiten. `scripts/test-env-check.ts` liefert die echten (Docker, Dateisystem), die Tests
 * ein gefälschtes Docker. Gibt Exit-Code und Ausgaben zurück, schreibt selbst nichts.
 */
import {
  evaluateCleanup,
  findContainersWithoutImageId,
  findRemovableImages,
  findUnhealthyContainers,
  findVersionPins,
  formatDockerUnreachableMessage,
  formatEmptyImageIdMessage,
  formatPinMessage,
  formatRemovableList,
  formatStoppedStackMessage,
  formatUnhealthyMessage,
  isProjectDbRunning,
  parseProjectId,
  pickLastLogLine,
  type CleanupAttempt,
  type DockerContainer,
  type DockerImage,
} from './localStackHealth';

export type CheckMode = '--vorher' | '--gesund' | '--aufraeumen';

export interface DockerOutput {
  stdout: string;
  stderr: string;
}

export interface CheckDeps {
  repoRoot: string;
  /** Führt `docker <args>` aus; wirft bei Fehler. */
  docker: (args: string[]) => DockerOutput;
  /** Dateinamen im Ordner; wirft, wenn der Ordner fehlt. */
  readDir: (path: string) => string[];
  readFile: (path: string) => string;
}

export interface CheckResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface InspectEntry {
  Name?: string;
  Image?: string;
  Config?: { Image?: string };
  State?: { Status?: string; Health?: { Status?: string } };
}
interface ImageListEntry {
  ID?: string;
  Repository?: string;
  Tag?: string;
  Size?: string;
}

const TAG = '[test-env-check]';
const failure = (message: string): CheckResult => ({ exitCode: 1, stdout: '', stderr: `${TAG} ${message}\n` });

function listContainers(deps: CheckDeps): DockerContainer[] {
  const ids = deps.docker(['ps', '-aq']).stdout.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);
  if (ids.length === 0) return [];
  const entries = JSON.parse(deps.docker(['inspect', ...ids]).stdout) as InspectEntry[];
  return entries.map((e) => ({
    name: (e.Name ?? '').replace(/^\//, ''),
    imageId: e.Image ?? '',
    imageRef: e.Config?.Image ?? '',
    status: e.State?.Status ?? 'unknown',
    health: e.State?.Health?.Status,
  }));
}

function listImages(deps: CheckDeps): DockerImage[] {
  return deps
    .docker(['images', '--no-trunc', '--format', '{{json .}}'])
    .stdout.split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ImageListEntry)
    .map((e) => ({ id: e.ID ?? '', repository: e.Repository ?? '', tag: e.Tag ?? '', size: e.Size ?? '' }));
}

function lastLogLine(deps: CheckDeps, containerName: string): string {
  try {
    const out = deps.docker(['logs', '--timestamps', '--tail', '5', containerName]);
    return pickLastLogLine(out.stdout, out.stderr);
  } catch {
    return '(Protokoll nicht lesbar)';
  }
}

function pins(deps: CheckDeps): string[] {
  try {
    return findVersionPins(deps.readDir(`${deps.repoRoot}/supabase/.temp`));
  } catch {
    return [];
  }
}

function projectId(deps: CheckDeps): string | null {
  return parseProjectId(deps.readFile(`${deps.repoRoot}/supabase/config.toml`));
}

function cleanup(deps: CheckDeps, id: string, trocken: boolean): CheckResult {
  const containers = listContainers(deps);
  const ohneId = findContainersWithoutImageId(containers);
  if (ohneId.length > 0) return failure(formatEmptyImageIdMessage(ohneId));
  if (!isProjectDbRunning(containers, id)) return failure(formatStoppedStackMessage());

  const removable = findRemovableImages(listImages(deps), containers, id);
  const list = `${formatRemovableList(removable)}\n`;
  if (trocken || removable.length === 0) return { exitCode: 0, stdout: list, stderr: '' };

  const attempts: CleanupAttempt[] = removable.map((image) => {
    try {
      deps.docker(['rmi', image.target]);
      return { image, ok: true };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      return { image, ok: false, error: text.split('\n').filter((l) => l.length > 0).pop() };
    }
  });
  const result = evaluateCleanup(attempts);
  if (result.exitCode === 0) return { exitCode: 0, stdout: `${list}${result.message}\n`, stderr: '' };
  return { exitCode: 1, stdout: list, stderr: `${TAG} ${result.message}\n` };
}

export function runCheck(mode: CheckMode, deps: CheckDeps, options: { trocken?: boolean } = {}): CheckResult {
  try {
    deps.docker(['info']);
  } catch {
    return failure(formatDockerUnreachableMessage());
  }

  if (mode === '--aufraeumen') {
    const id = projectId(deps);
    if (id === null) return failure('project_id in supabase/config.toml nicht lesbar.');
    return cleanup(deps, id, options.trocken === true);
  }

  const found = pins(deps);
  if (found.length > 0) return failure(formatPinMessage(found));
  if (mode === '--vorher') return { exitCode: 0, stdout: '', stderr: '' };

  const id = projectId(deps);
  if (id === null) return failure('project_id in supabase/config.toml nicht lesbar.');
  const unhealthy = findUnhealthyContainers(listContainers(deps), id);
  if (unhealthy.length === 0) return { exitCode: 0, stdout: '', stderr: '' };
  const logs: Record<string, string> = {};
  for (const f of unhealthy) logs[f.name] = lastLogLine(deps, f.name);
  return failure(formatUnhealthyMessage(unhealthy, logs));
}
