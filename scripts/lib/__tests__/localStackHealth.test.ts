import { describe, expect, it } from 'vitest';
import {
  evaluateCleanup,
  findRemovableImages,
  findUnhealthyContainers,
  findVersionPins,
  formatDockerUnreachableMessage,
  formatPinMessage,
  formatUnhealthyMessage,
  parseProjectId,
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
  it('@LT-005 löscht Testumgebungs-Image ohne Container und namenloses Playwright-Image, nicht das fremde', () => {
    const alt = image({ id: sha('1'), repository: 'public.ecr.aws/supabase/storage-api', tag: 'v0.9', size: '200MB' });
    const namenlos = image({ id: sha('2'), repository: 'mcr.microsoft.com/playwright', tag: '<none>', size: '1.5GB' });
    const fremd = image({ id: sha('3'), repository: 'postgres', tag: '17', size: '477MB' });
    const found = findRemovableImages([alt, namenlos, fremd], []);
    expect(found.map((i) => i.id)).toEqual([sha('1'), sha('2')]);
    expect(found.map((i) => i.size)).toEqual(['200MB', '1.5GB']);
  });

  it('@LT-005 erfasst alle erlaubten Repository-Präfixe der Testumgebung', () => {
    const repos = ['public.ecr.aws/supabase/postgres', 'ghcr.io/supabase/edge-runtime', 'supabase/studio'];
    const imgs = repos.map((repository, i) => image({ id: sha(String(i + 4)), repository }));
    expect(findRemovableImages(imgs, [])).toHaveLength(3);
  });

  it('@LT-005 fremde Images bleiben, auch ähnlich benannte (pgvector, searxng, postgres)', () => {
    const imgs = [
      image({ id: sha('4'), repository: 'pgvector/pgvector', tag: 'pg17' }),
      image({ id: sha('5'), repository: 'searxng/searxng', tag: 'latest' }),
      image({ id: sha('6'), repository: 'postgres', tag: '17' }),
      image({ id: sha('7'), repository: 'evil.example/supabase/db', tag: 'v1' }),
    ];
    expect(findRemovableImages(imgs, [])).toEqual([]);
  });

  // @LT-006 Beispiele: Datenbank laufend, Server-Funktionen beendet
  it.each([
    { name: 'Datenbank der Testumgebung', repository: 'public.ecr.aws/supabase/postgres', status: 'running' },
    { name: 'Server-Funktionen der Testumgebung', repository: 'public.ecr.aws/supabase/edge-runtime', status: 'exited' },
  ])('@LT-006 Image "$name" mit Container im Zustand $status bleibt', ({ repository, status }) => {
    const img = image({ id: sha('8'), repository });
    const c = container({ service: 'x', imageId: sha('8'), status });
    expect(findRemovableImages([img], [c])).toEqual([]);
  });

  it('@LT-006 auch ein namenloses Playwright-Image mit Container bleibt', () => {
    const img = image({ id: sha('9'), repository: 'mcr.microsoft.com/playwright', tag: '<none>' });
    const c = container({ service: 'x', imageId: sha('9'), status: 'exited' });
    expect(findRemovableImages([img], [c])).toEqual([]);
  });

  it('@LT-007 das benannte Playwright-Image bleibt auch ohne Container', () => {
    const img = image({ id: sha('a'), repository: 'mcr.microsoft.com/playwright', tag: 'v1.63.0-noble' });
    expect(findRemovableImages([img], [])).toEqual([]);
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
