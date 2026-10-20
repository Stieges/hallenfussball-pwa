/**
 * localStackHealth.ts — reine Prüflogik für die gemeinsame lokale Supabase-Testumgebung.
 *
 * Anforderung: docs/anforderungen/plattform/2026-10-20_lokale-testumgebung-gesund.md (@LT-001 … @LT-008).
 * KEINE Docker- und KEINE Dateizugriffe: `scripts/test-env-check.ts` liest Docker und das
 * Dateisystem und reicht die Daten hierher (Muster wie `assertLocalSupabaseTarget.ts`).
 */

export const REPAIR_COMMAND = 'npm run test:env:down && npm run test:env:up';

export interface DockerContainer {
  name: string;
  /** Volle Image-ID (sha256:…), wie `docker inspect` sie liefert. */
  imageId: string;
  imageRef: string;
  /** State.Status: running | restarting | exited | created | paused | dead … */
  status: string;
  /** State.Health.Status, falls der Container einen Gesundheitstest hat. */
  health?: string;
}

export interface DockerImage {
  /** Volle Image-ID (sha256:…), wie `docker images --no-trunc` sie liefert. */
  id: string;
  repository: string;
  tag: string;
  size: string;
}

export interface UnhealthyContainer {
  service: string;
  name: string;
  status: string;
  health?: string;
}

export interface CleanupAttempt {
  image: DockerImage;
  ok: boolean;
  error?: string;
}

export interface CleanupResult {
  deleted: DockerImage[];
  failed: DockerImage[];
  exitCode: 0 | 1;
  message: string;
}

/** Dateien in `supabase/.temp`, die auf `-version` enden, schreiben Dienst-Versionen fest. */
export function findVersionPins(fileNames: string[]): string[] {
  return fileNames.filter((name) => name.endsWith('-version'));
}

/** `project_id = "…"` aus dem Text der `supabase/config.toml`. */
export function parseProjectId(configToml: string): string | null {
  const match = /^\s*project_id\s*=\s*"([^"]+)"/m.exec(configToml);
  return match?.[1] ?? null;
}

function serviceOf(containerName: string, projectId: string): string | null {
  const prefix = 'supabase_';
  const suffix = `_${projectId}`;
  if (!containerName.startsWith(prefix) || !containerName.endsWith(suffix)) return null;
  const service = containerName.slice(prefix.length, containerName.length - suffix.length);
  return service.length > 0 ? service : null;
}

export function findUnhealthyContainers(containers: DockerContainer[], projectId: string): UnhealthyContainer[] {
  const result: UnhealthyContainer[] = [];
  for (const c of containers) {
    const service = serviceOf(c.name, projectId);
    if (service === null) continue;
    if (c.status !== 'running' || c.health === 'unhealthy') {
      result.push({ service, name: c.name, status: c.status, health: c.health });
    }
  }
  return result;
}

const SUPABASE_REPO_PREFIXES = ['public.ecr.aws/supabase/', 'ghcr.io/supabase/', 'supabase/'];
const PLAYWRIGHT_REPO = 'mcr.microsoft.com/playwright';
const NONE = '<none>';

/** Ein löschbares Image; `target` ist das Argument für `docker rmi` (Referenz oder ID). */
export interface RemovableImage extends DockerImage {
  target: string;
}

function splitRef(ref: string): { repository: string; tag: string } {
  const lastSlash = ref.lastIndexOf('/');
  const colon = ref.indexOf(':', lastSlash + 1);
  return colon === -1
    ? { repository: ref, tag: 'latest' }
    : { repository: ref.slice(0, colon), tag: ref.slice(colon + 1) };
}

function isSupabaseRepo(repository: string): boolean {
  return SUPABASE_REPO_PREFIXES.some((p) => repository.startsWith(p));
}

/**
 * Löschbar sind nur
 *  - namenlose Playwright-Images (Repository exakt, Tag <none>) ohne Container, und
 *  - Supabase-Images ohne Container, die ABGELÖST sind: ein Container dieses Projekts nutzt ein
 *    anderes Tag desselben Repositorys.
 * Getaggte Images werden per Referenz entfernt (nimmt nur diesen Namen weg), namenlose per ID.
 */
export function findRemovableImages(
  images: DockerImage[],
  containers: DockerContainer[],
  projectId: string,
): RemovableImage[] {
  const usedIds = new Set(containers.map((c) => c.imageId));
  const usedRefs = new Set(containers.map((c) => splitRef(c.imageRef)).map((r) => `${r.repository}:${r.tag}`));
  const currentTags = new Map<string, Set<string>>();
  for (const c of containers) {
    if (serviceOf(c.name, projectId) === null) continue;
    const { repository, tag } = splitRef(c.imageRef);
    const tags = currentTags.get(repository) ?? new Set<string>();
    tags.add(tag);
    currentTags.set(repository, tags);
  }

  const result: RemovableImage[] = [];
  const seenTargets = new Set<string>();
  for (const img of images) {
    if (usedIds.has(img.id)) continue;
    if (usedRefs.has(`${img.repository}:${img.tag}`)) continue;

    let target: string | null = null;
    if (img.repository === PLAYWRIGHT_REPO && img.tag === NONE) {
      target = img.id;
    } else if (isSupabaseRepo(img.repository)) {
      if (img.tag === NONE) {
        target = currentTags.has(img.repository) ? img.id : null;
      } else {
        const aktuelle = currentTags.get(img.repository);
        const abgeloest = aktuelle !== undefined && [...aktuelle].some((t) => t !== img.tag);
        target = abgeloest ? `${img.repository}:${img.tag}` : null;
      }
    }
    if (target === null || seenTargets.has(target)) continue;
    seenTargets.add(target);
    result.push({ ...img, target });
  }
  return result;
}

/** Laufender Datenbank-Container dieses Projekts = Testumgebung ist oben (Vorbedingung fürs Aufräumen). */
export function isProjectDbRunning(containers: DockerContainer[], projectId: string): boolean {
  return containers.some((c) => c.name === `supabase_db_${projectId}` && c.status === 'running');
}

export function findContainersWithoutImageId(containers: DockerContainer[]): DockerContainer[] {
  return containers.filter((c) => c.imageId.trim().length === 0);
}

export function formatStoppedStackMessage(): string {
  return 'Die Testumgebung läuft nicht (Datenbank-Container fehlt oder ist beendet). Es wurde nichts gelöscht – zuerst „npm run test:env:up“ ausführen, dann erneut aufräumen.';
}

export function formatEmptyImageIdMessage(containers: DockerContainer[]): string {
  return `Container ohne Image-ID gefunden (${containers.map((c) => c.name).join(', ')}). Es wurde nichts gelöscht.`;
}

/** Letzte Protokollzeile aus `docker logs --timestamps`, beide Ströme gemischt, ohne Zeitstempel. */
export function pickLastLogLine(stdout: string, stderr: string): string {
  const lines = `${stdout}\n${stderr}`
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l, index) => {
      const m = /^(\d{4}-\d{2}-\d{2}T[^\s]+)\s?(.*)$/.exec(l);
      return { time: m?.[1] ?? '', text: m ? (m[2] ?? '') : l, index };
    });
  if (lines.length === 0) return '(Protokoll leer)';
  lines.sort((x, y) => (x.time === y.time ? x.index - y.index : x.time < y.time ? -1 : 1));
  return lines[lines.length - 1]?.text ?? '(Protokoll leer)';
}

export function formatDockerUnreachableMessage(): string {
  return 'Docker ist nicht erreichbar. Docker Desktop starten und den Befehl erneut ausführen.';
}

export function formatPinMessage(pins: string[]): string {
  const lines = [
    'Festgeschriebene Dienst-Versionen gefunden – alle Arbeitskopien teilen EINEN Stack, daher darf keine Versionsdatei liegen:',
  ];
  for (const pin of pins) {
    lines.push(`  supabase/.temp/${pin}   entfernen mit: rm supabase/.temp/${pin}`);
  }
  lines.push('Danach den Befehl erneut ausführen.');
  return lines.join('\n');
}

export function formatUnhealthyMessage(
  findings: UnhealthyContainer[],
  lastLogLines: Record<string, string>,
): string {
  const lines = ['Dienste der Testumgebung sind ausgefallen:'];
  for (const f of findings) {
    const state = f.health === 'unhealthy' && f.status === 'running' ? 'unhealthy' : f.status;
    const log = lastLogLines[f.name] ?? '(keine Protokollzeile)';
    lines.push(`  ${f.service}: ${state} – letzte Protokollzeile: ${log}`);
  }
  lines.push(`Reparatur: ${REPAIR_COMMAND}`);
  lines.push('Nur neu starten, wenn gerade keine Spur gegen den Stack testet.');
  return lines.join('\n');
}

function imageLabel(img: DockerImage): string {
  return `${img.repository}:${img.tag}`;
}

export function evaluateCleanup(attempts: CleanupAttempt[]): CleanupResult {
  const deleted = attempts.filter((a) => a.ok).map((a) => a.image);
  const failedAttempts = attempts.filter((a) => !a.ok);
  const failed = failedAttempts.map((a) => a.image);
  const lines = [`${deleted.length} Image(s) gelöscht.`];
  if (failedAttempts.length > 0) {
    lines.push(`${failedAttempts.length} Image(s) konnten nicht gelöscht werden:`);
    for (const a of failedAttempts) {
      lines.push(`  ${imageLabel(a.image)} (${a.image.id}): ${a.error ?? 'unbekannter Fehler'}`);
    }
  }
  return { deleted, failed, exitCode: failedAttempts.length > 0 ? 1 : 0, message: lines.join('\n') };
}

export function formatRemovableList(images: RemovableImage[]): string {
  if (images.length === 0) return 'Nichts zu löschen.';
  return ['Löschbare Images:', ...images.map((i) => `  ${imageLabel(i)}  ${i.size}  ${i.id}`)].join('\n');
}
