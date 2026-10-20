import { describe, expect, it } from 'vitest';
import { runCheck, type CheckDeps } from '../testEnvCheck';

/**
 * Tests aus den Gherkin-Szenarien @LT-001 bis @LT-011 über `runCheck` mit gefälschtem Docker
 * (docs/anforderungen/plattform/2026-10-20_lokale-testumgebung-gesund.md).
 */
const PROJECT = 'hallenfussball-pwa';
const ECR = 'public.ecr.aws/supabase';
const sha = (c: string): string => `sha256:${c.repeat(64)}`;

interface FakeContainer {
  service: string;
  imageId: string;
  imageRef: string;
  status: string;
  health?: string;
  restartCount?: number;
  log?: { stdout?: string; stderr?: string };
}
interface FakeImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
}
interface Fake {
  dockerDown?: boolean;
  containers: FakeContainer[];
  images: FakeImage[];
  rmiFails?: string[];
  pinFiles?: string[];
}

function setup(fake: Fake): { deps: CheckDeps; calls: string[][] } {
  const calls: string[][] = [];
  const names = fake.containers.map((c) => `supabase_${c.service}_${PROJECT}`);
  const deps: CheckDeps = {
    repoRoot: '/repo',
    docker: (args) => {
      calls.push(args);
      const [cmd] = args;
      if (fake.dockerDown) throw new Error('Cannot connect to the Docker daemon');
      switch (cmd) {
        case 'info':
          return { stdout: 'ok', stderr: '' };
        case 'ps':
          return { stdout: fake.containers.map((_, i) => `id${i}`).join('\n'), stderr: '' };
        case 'inspect':
          return {
            stdout: JSON.stringify(
              fake.containers.map((c, i) => ({
                Name: `/${names[i]}`,
                Image: c.imageId,
                Config: { Image: c.imageRef },
                RestartCount: c.restartCount,
                State: { Status: c.status, Health: c.health ? { Status: c.health } : undefined },
              })),
            ),
            stderr: '',
          };
        case 'images':
          return {
            stdout: fake.images
              .map((i) => JSON.stringify({ ID: i.id, Repository: i.repository, Tag: i.tag, Size: i.size }))
              .join('\n'),
            stderr: '',
          };
        case 'logs': {
          const idx = names.indexOf(args[args.length - 1] ?? '');
          const log = fake.containers[idx]?.log;
          return { stdout: log?.stdout ?? '', stderr: log?.stderr ?? '' };
        }
        case 'rmi': {
          const target = args[1] ?? '';
          if (fake.rmiFails?.includes(target)) throw new Error(`Error response: conflict ${target}`);
          return { stdout: `Untagged: ${target}`, stderr: '' };
        }
        default:
          throw new Error(`unerwarteter docker-Aufruf: ${args.join(' ')}`);
      }
    },
    readDir: () => {
      if (fake.pinFiles === undefined) throw new Error('ENOENT');
      return fake.pinFiles;
    },
    readFile: () => `project_id = "${PROJECT}"\n`,
  };
  return { deps, calls };
}

const laufend = (service: string, imageRef: string, id: string): FakeContainer => ({
  service,
  imageId: id,
  imageRef,
  status: 'running',
});

function gesunderStack(): FakeContainer[] {
  return [
    { ...laufend('db', `${ECR}/postgres:17.6`, sha('d')), health: 'healthy' },
    { ...laufend('storage', `${ECR}/storage-api:v1.2`, sha('e')), health: 'healthy' },
    laufend('edge_runtime', `${ECR}/edge-runtime:v1.1`, sha('f')),
  ];
}

const rmiCalls = (calls: string[][]): string[][] => calls.filter((c) => c[0] === 'rmi');

describe('--vorher / --gesund', () => {
  it('@LT-001 Versionsdatei: bricht ab, nennt Datei und Löschbefehl, fragt keine Container ab', () => {
    const { deps, calls } = setup({ containers: [], images: [], pinFiles: ['storage-version'] });
    const r = runCheck('--vorher', deps);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('supabase/.temp/storage-version');
    expect(r.stderr).toContain('rm supabase/.temp/storage-version');
    expect(calls.some((c) => c[0] === 'ps')).toBe(false);
  });

  it('@LT-001 fehlt der Ordner supabase/.temp, gibt es keine Pins', () => {
    const { deps } = setup({ containers: [], images: [] });
    expect(runCheck('--vorher', deps).exitCode).toBe(0);
  });

  it('@LT-002 nur Verknüpfungsdaten und laufende Dienste: Exit 0, keine Ausgabe', () => {
    const { deps } = setup({ containers: gesunderStack(), images: [], pinFiles: ['project-ref', 'linked-project.json'] });
    expect(runCheck('--gesund', deps)).toEqual({ exitCode: 0, stdout: '', stderr: '' });
  });

  it.each([
    { service: 'storage', status: 'restarting', erwartet: 'restarting' },
    { service: 'edge_runtime', status: 'exited', erwartet: 'exited' },
    { service: 'auth', status: 'exited', erwartet: 'exited' },
  ])('@LT-003 Dienst $service im Zustand $status wird gemeldet', ({ service, status, erwartet }) => {
    const stack = gesunderStack().filter((c) => c.service !== service);
    stack.push({
      service,
      imageId: sha('9'),
      imageRef: `${ECR}/x:1`,
      status,
      log: { stderr: '2026-10-20T10:00:00.000000000Z duplicate key migrations_name_key\n' },
    });
    const { deps } = setup({ containers: stack, images: [] });
    const r = runCheck('--gesund', deps);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain(service);
    expect(r.stderr).toContain(erwartet);
    expect(r.stderr).toContain('duplicate key migrations_name_key');
    expect(r.stderr).toContain('npm run test:env:down && npm run test:env:up');
  });

  it('@LT-012 analytics laufend und gesund mit 1 Neustart: keine Meldung, Exit 0', () => {
    const stack = [...gesunderStack(), { ...laufend('analytics', `${ECR}/logflare:1`, sha('7')), health: 'healthy', restartCount: 1 }];
    const { deps } = setup({ containers: stack, images: [] });
    expect(runCheck('--gesund', deps)).toEqual({ exitCode: 0, stdout: '', stderr: '' });
  });

  it('@LT-012 analytics im Zustand restarting mit 1 Neustart: wird als neu startend gemeldet', () => {
    const stack = [...gesunderStack(), { ...laufend('analytics', `${ECR}/logflare:1`, sha('7')), status: 'restarting', restartCount: 1 }];
    const { deps } = setup({ containers: stack, images: [] });
    const r = runCheck('--gesund', deps);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('analytics');
    expect(r.stderr).toContain('neu startend');
  });

  it('@LT-003 Neustartschleife: running mit 3 Neustarts wird über runCheck gemeldet', () => {
    const stack = gesunderStack().map((c) =>
      c.service === 'storage' ? { ...c, health: 'starting', restartCount: 3 } : c,
    );
    const { deps } = setup({ containers: stack, images: [] });
    const r = runCheck('--gesund', deps);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('storage');
    expect(r.stderr).toContain('3 Neustarts');
  });

  it.each(['--vorher', '--gesund', '--aufraeumen'] as const)(
    '@LT-004 Docker nicht erreichbar (%s): eigene Meldung, keine Dienstliste',
    (mode) => {
      const { deps, calls } = setup({ dockerDown: true, containers: [], images: [] });
      const r = runCheck(mode, deps);
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/nicht erreichbar/);
      expect(r.stderr).not.toContain('npm run test:env:down');
      expect(calls.every((c) => c[0] === 'info')).toBe(true);
    },
  );
});

describe('--aufraeumen', () => {
  const alt: FakeImage = { id: sha('1'), repository: `${ECR}/storage-api`, tag: 'v1.0', size: '200MB' };
  const namenlos: FakeImage = { id: sha('2'), repository: 'mcr.microsoft.com/playwright', tag: '<none>', size: '1.5GB' };
  const fremd: FakeImage = { id: sha('3'), repository: 'postgres', tag: '17', size: '477MB' };

  it('@LT-005 zeigt die beiden Images mit Größe und löscht genau diese', () => {
    const { deps, calls } = setup({ containers: gesunderStack(), images: [alt, namenlos, fremd] });
    const r = runCheck('--aufraeumen', deps);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('200MB');
    expect(r.stdout).toContain('1.5GB');
    expect(rmiCalls(calls)).toEqual([['rmi', `${ECR}/storage-api:v1.0`], ['rmi', sha('2')]]);
  });

  it('--trocken zeigt nur an und löscht nichts', () => {
    const { deps, calls } = setup({ containers: gesunderStack(), images: [alt, namenlos] });
    const r = runCheck('--aufraeumen', deps, { trocken: true });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('200MB');
    expect(rmiCalls(calls)).toEqual([]);
  });

  it('@LT-006 Images mit (auch beendetem) Container bleiben', () => {
    const stack = [...gesunderStack(), { ...laufend('vector', `${ECR}/vector:1`, sha('a')), status: 'exited' }];
    const imgs: FakeImage[] = [
      { id: sha('d'), repository: `${ECR}/postgres`, tag: '17.6', size: '1GB' },
      { id: sha('a'), repository: `${ECR}/vector`, tag: '1', size: '1GB' },
    ];
    const { deps, calls } = setup({ containers: stack, images: imgs });
    expect(runCheck('--aufraeumen', deps).exitCode).toBe(0);
    expect(rmiCalls(calls)).toEqual([]);
  });

  it('@LT-007 das benannte Playwright-Image bleibt', () => {
    const pw: FakeImage = { id: sha('4'), repository: 'mcr.microsoft.com/playwright', tag: 'v1.63.0-noble', size: '2GB' };
    const { deps, calls } = setup({ containers: gesunderStack(), images: [pw] });
    runCheck('--aufraeumen', deps);
    expect(rmiCalls(calls)).toEqual([]);
  });

  it('@LT-008 scheitert das erste rmi, wird das zweite trotzdem aufgerufen; Exit 1 und erstes genannt', () => {
    const { deps, calls } = setup({
      containers: gesunderStack(),
      images: [alt, namenlos],
      rmiFails: [`${ECR}/storage-api:v1.0`],
    });
    const r = runCheck('--aufraeumen', deps);
    expect(rmiCalls(calls)).toHaveLength(2);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('storage-api:v1.0');
  });

  it('@LT-009 gestoppte Testumgebung: kein Image wird gelöscht, Hinweis auf test:env:up', () => {
    // Nach test:env:down gibt es keine Container des Projekts mehr, alle Images wären "ungenutzt".
    const { deps, calls } = setup({ containers: [], images: [alt, namenlos] });
    const r = runCheck('--aufraeumen', deps);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('npm run test:env:up');
    expect(rmiCalls(calls)).toEqual([]);
  });

  it('@LT-009 beendete Datenbank zählt als gestoppt', () => {
    const stack = gesunderStack().map((c) => (c.service === 'db' ? { ...c, status: 'exited' } : c));
    const { deps, calls } = setup({ containers: stack, images: [alt] });
    expect(runCheck('--aufraeumen', deps).exitCode).toBe(1);
    expect(rmiCalls(calls)).toEqual([]);
  });

  it('@LT-010 Version ohne Container, die kein Dienst abgelöst hat, bleibt', () => {
    const rest: FakeImage = { id: sha('8'), repository: `${ECR}/rest`, tag: 'v0.9', size: '50MB' };
    const { deps, calls } = setup({ containers: gesunderStack(), images: [rest] });
    expect(runCheck('--aufraeumen', deps).exitCode).toBe(0);
    expect(rmiCalls(calls)).toEqual([]);
  });

  it('@LT-011 fremder Zusatzname: nur der Supabase-Name wird entfernt, zweiter Lauf findet nichts', () => {
    const fremderName: FakeImage = { id: sha('1'), repository: 'anderesprojekt/storage', tag: 'x', size: '200MB' };
    const erster = setup({ containers: gesunderStack(), images: [alt, fremderName] });
    expect(runCheck('--aufraeumen', erster.deps).exitCode).toBe(0);
    expect(rmiCalls(erster.calls)).toEqual([['rmi', `${ECR}/storage-api:v1.0`]]);
    const zweiter = setup({ containers: gesunderStack(), images: [fremderName] });
    const r = runCheck('--aufraeumen', zweiter.deps);
    expect(r.exitCode).toBe(0);
    expect(rmiCalls(zweiter.calls)).toEqual([]);
  });

  it('Container ohne Image-ID: Abbruch ohne Löschen', () => {
    const stack = [...gesunderStack(), laufend('vector', `${ECR}/vector:1`, '')];
    const { deps, calls } = setup({ containers: stack, images: [alt] });
    const r = runCheck('--aufraeumen', deps);
    expect(r.exitCode).toBe(1);
    expect(rmiCalls(calls)).toEqual([]);
  });
});
