import { describe, expect, it } from 'vitest';
import {
  evaluateCleanup,
  findContainersWithoutImageId,
  findRemovableImages,
  findUnhealthyContainers,
  findVersionPins,
  formatDockerUnreachableMessage,
  formatPinMessage,
  formatRemovableList,
  formatStoppedStackMessage,
  formatUnhealthyMessage,
  isProjectDbRunning,
  parseProjectId,
  pickLastLogLine,
  type DockerContainer,
  type DockerImage,
} from '../localStackHealth';

/**
 * Tests aus den Gherkin-Szenarien @LT-001 bis @LT-008
 * (docs/anforderungen/plattform/2026-10-20_lokale-testumgebung-gesund.md).
 * Reine Funktionen: weder Docker noch Dateisystem werden angefasst.
 */

const PROJECT = 'hallenfussball-pwa';
const sha = (c: string): string => `sha256:${c.repeat(64)}`;

function container(overrides: Partial<DockerContainer> & { service: string }): DockerContainer {
  const { service, ...rest } = overrides;
  return {
    name: `supabase_${service}_${PROJECT}`,
    imageId: sha('a'),
    imageRef: 'public.ecr.aws/supabase/x:v1',
    status: 'running',
    ...rest,
  };
}

function image(overrides: Partial<DockerImage>): DockerImage {
  return {
    id: sha('b'),
    repository: 'public.ecr.aws/supabase/storage-api',
    tag: 'v1.0.0',
    size: '100MB',
    ...overrides,
  };
}

describe('parseProjectId', () => {
  it('liest die Projekt-ID aus dem Text der config.toml', () => {
    const toml = '# kommentar\n[api]\nport = 1\n\nproject_id = "hallenfussball-pwa"\n';
    expect(parseProjectId(toml)).toBe('hallenfussball-pwa');
  });
  it('liefert null, wenn keine Projekt-ID steht', () => {
    expect(parseProjectId('[api]\nport = 1\n')).toBeNull();
  });
});

describe('Versionsdateien (findVersionPins)', () => {
  it('@LT-001 meldet storage-version als festgeschriebene Version', () => {
    expect(findVersionPins(['storage-version', 'project-ref'])).toEqual(['storage-version']);
  });

  it('@LT-001 erkennt alle Dienst-Versionsdateien', () => {
    const pins = findVersionPins(['postgres-version', 'gotrue-version', 'rest-version', 'storage-version']);
    expect(pins).toHaveLength(4);
  });

  it('@LT-002 Gegenbeispiel: nur Verknüpfungsdaten ergeben keine Pins', () => {
    const files = [
      'cli-latest',
      'linked-project.json',
      'project-ref',
      'pooler-url',
      'storage-migration',
      'start-secrets',
    ];
    expect(findVersionPins(files)).toEqual([]);
  });

  it('@LT-002 leeres Verzeichnis ergibt keine Pins', () => {
    expect(findVersionPins([])).toEqual([]);
  });

  it('@LT-001 die Meldung nennt Datei und Löschbefehl', () => {
    const msg = formatPinMessage(['storage-version', 'rest-version']);
    expect(msg).toContain('supabase/.temp/storage-version');
    expect(msg).toContain('rm supabase/.temp/storage-version');
    expect(msg).toContain('rm supabase/.temp/rest-version');
  });
});

describe('Ausgefallene Dienste (findUnhealthyContainers)', () => {
  // @LT-003 Beispiele: storage neu startend, edge_runtime beendet, auth beendet
  it.each([
    { service: 'storage', status: 'restarting' },
    { service: 'edge_runtime', status: 'exited' },
    { service: 'auth', status: 'exited' },
  ])('@LT-003 meldet $service im Zustand $status', ({ service, status }) => {
    const found = findUnhealthyContainers([container({ service, status })], PROJECT);
    expect(found).toHaveLength(1);
    expect(found[0]?.service).toBe(service);
    expect(found[0]?.status).toBe(status);
  });

  it('@LT-003 Neustartschleife: running + starting + 3 Neustarts wird gemeldet', () => {
    const c = container({ service: 'storage', health: 'starting', restartCount: 3 });
    const found = findUnhealthyContainers([c], PROJECT);
    expect(found.map((f) => f.service)).toEqual(['storage']);
    const msg = formatUnhealthyMessage(found, {});
    expect(msg).toContain('neu startend (3 Neustarts)');
  });

  // @LT-012 Beispiele: einzelne Neustarts beim Hochfahren (logflare/analytics) sind kein Ausfall
  it.each([
    { zustand: 'laufend und gesund', status: 'running', health: 'healthy', n: 1, gemeldet: false },
    { zustand: 'laufend und gesund', status: 'running', health: 'healthy', n: 2, gemeldet: false },
    { zustand: 'laufend, Gesundheit offen', status: 'running', health: 'starting', n: 3, gemeldet: true },
    { zustand: 'neu startend', status: 'restarting', health: undefined, n: 1, gemeldet: true },
  ])('@LT-012 analytics $zustand mit $n Neustart(s): gemeldet=$gemeldet', ({ status, health, n, gemeldet }) => {
    const c = container({ service: 'analytics', status, health, restartCount: n });
    const found = findUnhealthyContainers([c], PROJECT);
    expect(found.length > 0).toBe(gemeldet);
    if (gemeldet) expect(formatUnhealthyMessage(found, {})).toContain('neu startend');
  });

  it('@LT-012 Gegenbeispiel: 1 Neustart bei laufendem, Gesundheit offenem Dienst wird nicht gemeldet', () => {
    const c = container({ service: 'storage', health: 'starting', restartCount: 1 });
    expect(findUnhealthyContainers([c], PROJECT)).toEqual([]);
  });

  it('@LT-002 running ohne Neustarts (restartCount 0) wird nicht gemeldet', () => {
    const c = container({ service: 'storage', health: 'starting', restartCount: 0 });
    expect(findUnhealthyContainers([c], PROJECT)).toEqual([]);
  });

  it('@LT-003 meldet einen laufenden, aber als unhealthy markierten Dienst', () => {
    const found = findUnhealthyContainers([container({ service: 'db', health: 'unhealthy' })], PROJECT);
    expect(found.map((f) => f.service)).toEqual(['db']);
  });

  it('@LT-002 laufende, gesunde Dienste ergeben keine Meldung', () => {
    const list = [
      container({ service: 'db', health: 'healthy' }),
      container({ service: 'edge_runtime' }),
      container({ service: 'auth', health: 'healthy' }),
    ];
    expect(findUnhealthyContainers(list, PROJECT)).toEqual([]);
  });

  it('@LT-003 Container anderer Projekte werden nicht gemeldet', () => {
    const fremd: DockerContainer = { ...container({ service: 'db' }), name: 'iwf-knowledge-postgres-1', status: 'exited' };
    const anderesProjekt: DockerContainer = { ...container({ service: 'db' }), name: 'supabase_db_anderes-projekt', status: 'exited' };
    expect(findUnhealthyContainers([fremd, anderesProjekt], PROJECT)).toEqual([]);
  });

  it('@LT-003 die Meldung nennt Dienst, Zustand, letzte Protokollzeile und den Reparaturbefehl', () => {
    const findings = findUnhealthyContainers(
      [container({ service: 'storage', status: 'restarting' }), container({ service: 'edge_runtime', status: 'exited' })],
      PROJECT,
    );
    const msg = formatUnhealthyMessage(findings, {
      [`supabase_storage_${PROJECT}`]: 'duplicate key value violates unique constraint "migrations_name_key"',
      [`supabase_edge_runtime_${PROJECT}`]: 'Deno exited',
    });
    expect(msg).toContain('storage');
    expect(msg).toContain('restarting');
    expect(msg).toContain('migrations_name_key');
    expect(msg).toContain('edge_runtime');
    expect(msg).toContain('exited');
    expect(msg).toContain('Deno exited');
    expect(msg).toContain('npm run test:env:down && npm run test:env:up');
  });
});

describe('Docker nicht erreichbar', () => {
  it('@LT-004 eigene Meldung, keine Liste ausgefallener Dienste', () => {
    const msg = formatDockerUnreachableMessage();
    expect(msg).toMatch(/Docker/);
    expect(msg).toMatch(/nicht erreichbar/);
    expect(msg).not.toContain('npm run test:env:down');
  });
});

describe('Aufräumen (findRemovableImages)', () => {
  const ECR = 'public.ecr.aws/supabase';
  // Laufende Testumgebung: Storage und Datenbank in aktueller Version, Edge-Runtime beendet.
  const storageNeu = container({ service: 'storage', imageId: sha('e'), imageRef: `${ECR}/storage-api:v1.2` });
  const dbNeu = container({ service: 'db', imageId: sha('d'), imageRef: `${ECR}/postgres:17.6` });
  const edgeBeendet = container({ service: 'edge_runtime', imageId: sha('f'), imageRef: `${ECR}/edge-runtime:v1.1`, status: 'exited' });
  const stack = [dbNeu, storageNeu, edgeBeendet];
  const storageAlt = image({ id: sha('1'), repository: `${ECR}/storage-api`, tag: 'v1.0', size: '200MB' });

  it('@LT-005 löscht abgelöstes Testumgebungs-Image und namenloses Playwright-Image, nicht das fremde', () => {
    const namenlos = image({ id: sha('2'), repository: 'mcr.microsoft.com/playwright', tag: '<none>', size: '1.5GB' });
    const fremd = image({ id: sha('3'), repository: 'postgres', tag: '17', size: '477MB' });
    const found = findRemovableImages([storageAlt, namenlos, fremd], stack, PROJECT);
    expect(found.map((i) => i.id)).toEqual([sha('1'), sha('2')]);
    expect(found.map((i) => i.size)).toEqual(['200MB', '1.5GB']);
  });

  it('@LT-005 getaggte Images werden per Referenz entfernt, namenlose per ID', () => {
    const namenlos = image({ id: sha('2'), repository: 'mcr.microsoft.com/playwright', tag: '<none>' });
    const found = findRemovableImages([storageAlt, namenlos], stack, PROJECT);
    expect(found.map((i) => i.target)).toEqual([`${ECR}/storage-api:v1.0`, sha('2')]);
  });

  it('@LT-005 erfasst alle Repository-Präfixe der Testumgebung (ECR, ghcr, Docker Hub)', () => {
    const laufend = [
      container({ service: 'a', imageId: sha('a'), imageRef: 'public.ecr.aws/supabase/postgres:2' }),
      container({ service: 'b', imageId: sha('b'), imageRef: 'ghcr.io/supabase/edge-runtime:2' }),
      container({ service: 'c', imageId: sha('c'), imageRef: 'supabase/studio:2' }),
    ];
    const alt = [
      image({ id: sha('4'), repository: 'public.ecr.aws/supabase/postgres', tag: '1' }),
      image({ id: sha('5'), repository: 'ghcr.io/supabase/edge-runtime', tag: '1' }),
      image({ id: sha('6'), repository: 'supabase/studio', tag: '1' }),
    ];
    expect(findRemovableImages(alt, laufend, PROJECT)).toHaveLength(3);
  });

  it('@LT-005 fremde Images bleiben (pgvector, searxng, postgres)', () => {
    const imgs = [
      image({ id: sha('4'), repository: 'pgvector/pgvector', tag: 'pg17' }),
      image({ id: sha('5'), repository: 'searxng/searxng', tag: 'latest' }),
      image({ id: sha('6'), repository: 'postgres', tag: '17' }),
    ];
    expect(findRemovableImages(imgs, stack, PROJECT)).toEqual([]);
  });

  // @LT-006 Beispiele: Datenbank laufend, Server-Funktionen beendet
  it.each([
    { name: 'Datenbank der Testumgebung', repository: `${ECR}/postgres`, tag: '17.6', id: sha('d') },
    { name: 'Server-Funktionen der Testumgebung', repository: `${ECR}/edge-runtime`, tag: 'v1.1', id: sha('f') },
  ])('@LT-006 Image "$name" mit Container bleibt', ({ repository, tag, id }) => {
    expect(findRemovableImages([image({ id, repository, tag })], stack, PROJECT)).toEqual([]);
  });

  it('@LT-006 auch ein namenloses Playwright-Image mit Container bleibt', () => {
    const img = image({ id: sha('9'), repository: 'mcr.microsoft.com/playwright', tag: '<none>' });
    const c = container({ service: 'x', imageId: sha('9'), status: 'exited' });
    expect(findRemovableImages([img], [...stack, c], PROJECT)).toEqual([]);
  });

  it('@LT-006 ein Image, dessen Name der Referenz eines Containers entspricht, bleibt, auch bei anderer ID', () => {
    const umgetaggt = image({ id: sha('7'), repository: `${ECR}/storage-api`, tag: 'v1.2' });
    expect(findRemovableImages([umgetaggt], stack, PROJECT)).toEqual([]);
  });

  it('@LT-007 das benannte Playwright-Image bleibt auch ohne Container', () => {
    const img = image({ id: sha('a'), repository: 'mcr.microsoft.com/playwright', tag: 'v1.63.0-noble' });
    expect(findRemovableImages([img], stack, PROJECT)).toEqual([]);
  });

  it('@LT-010 Version ohne Container, die kein Dienst abgelöst hat, bleibt', () => {
    const rest = image({ id: sha('8'), repository: `${ECR}/rest`, tag: 'v0.9' });
    // Kein Container des Projekts nutzt ein anderes rest-Tag.
    expect(findRemovableImages([rest], stack, PROJECT)).toEqual([]);
  });

  it('@LT-010 Version, die nur ein Container eines ANDEREN Projekts ablöst, bleibt', () => {
    const fremderContainer: DockerContainer = {
      ...container({ service: 'storage', imageId: sha('c'), imageRef: `${ECR}/storage-api:v2.0` }),
      name: 'supabase_storage_anderes-projekt',
    };
    expect(findRemovableImages([storageAlt], [fremderContainer], PROJECT)).toEqual([]);
  });

  it('@LT-010 abgelöst nur durch LAUFENDE Container: gestoppter Container mit neuerem Tag löst nichts ab', () => {
    const gestoppt = [container({ service: 'storage', imageId: sha('e'), imageRef: `${ECR}/storage-api:v1.2`, status: 'exited' })];
    expect(findRemovableImages([storageAlt], gestoppt, PROJECT)).toEqual([]);
  });

  it('@LT-011 zwei Supabase-Namen auf derselben ID: beide Namen werden einzeln entfernt', () => {
    const a = image({ id: sha('1'), repository: `${ECR}/storage-api`, tag: 'v1.0' });
    const b = image({ id: sha('1'), repository: `${ECR}/storage-api`, tag: 'v0.9' });
    const found = findRemovableImages([a, b], stack, PROJECT);
    expect(found.map((i) => i.target)).toEqual([`${ECR}/storage-api:v1.0`, `${ECR}/storage-api:v0.9`]);
  });

  it('@LT-011 Supabase-Name plus fremder Name auf derselben ID: nur der Supabase-Name wird entfernt', () => {
    const fremderName = image({ id: sha('1'), repository: 'anderesprojekt/storage', tag: 'x' });
    const found = findRemovableImages([storageAlt, fremderName], stack, PROJECT);
    expect(found.map((i) => i.target)).toEqual([`${ECR}/storage-api:v1.0`]);
  });

  it('@LT-011 zweiter Lauf: nach dem Entfernen des Namens ist nichts mehr zu löschen', () => {
    const fremderName = image({ id: sha('1'), repository: 'anderesprojekt/storage', tag: 'x' });
    expect(findRemovableImages([fremderName], stack, PROJECT)).toEqual([]);
  });

  it('@LT-011 namenlose Zeilen mit derselben ID werden nur einmal aufgeführt', () => {
    const a = image({ id: sha('2'), repository: 'mcr.microsoft.com/playwright', tag: '<none>' });
    expect(findRemovableImages([a, { ...a }], stack, PROJECT)).toHaveLength(1);
  });

  // Gegenbeispiele: sehen ähnlich aus, gehören aber nicht zur Testumgebung.
  it.each([
    { repository: 'supabase-foo/bar', tag: 'v1' },
    { repository: 'myregistry/supabase/x', tag: 'v1' },
    { repository: '<none>', tag: '<none>' },
    { repository: 'mcr.microsoft.com/playwright/python', tag: '<none>' },
  ])('Gegenbeispiel: $repository:$tag wird nie gelöscht', ({ repository, tag }) => {
    const ersatz = container({ service: 'x', imageId: sha('c'), imageRef: `${repository}:other` });
    const img = image({ id: sha('5'), repository, tag });
    expect(findRemovableImages([img], [...stack, ersatz], PROJECT)).toEqual([]);
  });
});

describe('Stack gestoppt (isProjectDbRunning)', () => {
  it('@LT-009 ohne Datenbank-Container gilt der Stack als gestoppt', () => {
    expect(isProjectDbRunning([], PROJECT)).toBe(false);
  });
  it('@LT-009 beendeter Datenbank-Container gilt als gestoppt', () => {
    expect(isProjectDbRunning([container({ service: 'db', status: 'exited' })], PROJECT)).toBe(false);
  });
  it('@LT-009 Datenbank eines anderen Projekts zählt nicht', () => {
    const fremd: DockerContainer = { ...container({ service: 'db' }), name: 'supabase_db_anderes-projekt' };
    expect(isProjectDbRunning([fremd], PROJECT)).toBe(false);
  });
  it('@LT-009 laufende Datenbank des Projekts gilt als laufend', () => {
    expect(isProjectDbRunning([container({ service: 'db' })], PROJECT)).toBe(true);
  });
  it('@LT-009 die Meldung nennt npm run test:env:up', () => {
    expect(formatStoppedStackMessage()).toContain('npm run test:env:up');
  });
});

describe('Hilfsfunktionen', () => {
  it('Container ohne Image-ID werden erkannt', () => {
    const ohne = container({ service: 'db', imageId: '' });
    expect(findContainersWithoutImageId([container({ service: 'a' }), ohne]).map((c) => c.name)).toEqual([ohne.name]);
  });

  it('@LT-003 letzte Protokollzeile: nach Zeitstempel über beide Ströme gemischt, ohne Zeitstempel', () => {
    const out = '2026-10-20T10:00:01.000000000Z erste\n2026-10-20T10:00:03.000000000Z dritte stdout\n';
    const err = '2026-10-20T10:00:02.000000000Z zweite\n2026-10-20T10:00:04.000000000Z letzte stderr\n';
    expect(pickLastLogLine(out, err)).toBe('letzte stderr');
  });

  it('@LT-003 leeres Protokoll ergibt einen Hinweis', () => {
    expect(pickLastLogLine('', '')).toMatch(/leer/);
  });

  it('@LT-005 die Liste nennt Image und Größe', () => {
    const text = formatRemovableList([
      { ...image({ id: sha('1'), repository: 'supabase/x', tag: '1', size: '200MB' }), target: 'supabase/x:1' },
    ]);
    expect(text).toContain('supabase/x:1');
    expect(text).toContain('200MB');
  });
});

describe('Auswertung des Aufräum-Ergebnisses (evaluateCleanup)', () => {
  const eins = image({ id: sha('1'), repository: 'public.ecr.aws/supabase/storage-api', tag: 'v0.9' });
  const zwei = image({ id: sha('2'), repository: 'public.ecr.aws/supabase/rest', tag: 'v0.8' });

  it('@LT-005 alles gelöscht: Exit 0, beide aufgeführt', () => {
    const r = evaluateCleanup([
      { image: eins, ok: true },
      { image: zwei, ok: true },
    ]);
    expect(r.exitCode).toBe(0);
    expect(r.deleted).toHaveLength(2);
    expect(r.failed).toHaveLength(0);
  });

  it('@LT-008 scheitert das erste, zählt das zweite trotzdem als gelöscht; Exit 1 und erstes Image genannt', () => {
    const r = evaluateCleanup([
      { image: eins, ok: false, error: 'image is being used' },
      { image: zwei, ok: true },
    ]);
    expect(r.exitCode).toBe(1);
    expect(r.deleted.map((i) => i.id)).toEqual([zwei.id]);
    expect(r.failed.map((i) => i.id)).toEqual([eins.id]);
    expect(r.message).toContain('storage-api:v0.9');
    expect(r.message).toContain('image is being used');
  });

  it('@LT-005 nichts zu löschen: Exit 0', () => {
    expect(evaluateCleanup([]).exitCode).toBe(0);
  });
});
