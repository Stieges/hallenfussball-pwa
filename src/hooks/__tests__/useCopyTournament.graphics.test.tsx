/**
 * T3 (PDF-Paket PR 2, Review B4, F6): „Turnier kopieren“ und die Probe-Kopie nehmen die Turniergrafiken des Geräts mit.
 * Gherkin: @W3-030 (Grafiken auf diesem Gerät). Dashboard und Admin Center rufen beide `useCopyTournament`; die Probe-Kopie
 * (Generalprobe, @W5-024) ist genau dieser Weg, einen zweiten gibt es nicht (Test unten hält das fest).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';

const mem = vi.hoisted(() => ({ data: new Map<string, unknown>(), failSet: false }));
vi.mock('../../core/storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(mem.data.has(key) ? structuredClone(mem.data.get(key)) : null),
    set: (key: string, value: unknown) => (mem.failSet ? Promise.reject(new Error('Speicher voll')) : (mem.data.set(key, structuredClone(value)), Promise.resolve())),
    delete: (key: string) => { mem.data.delete(key); return Promise.resolve(); },
  }),
}));
const report = vi.hoisted(() => vi.fn());
vi.mock('../../lib/sentry', () => ({ captureFeatureError: report }));
const repoGet = vi.hoisted(() => vi.fn<(id: string) => Promise<Tournament | null>>());
vi.mock('../useRepository', () => ({ useRepository: () => ({ get: repoGet }) }));

import { useCopyTournament } from '../useCopyTournament';
import { tournamentGraphicsStore } from '../../core/storage/tournamentGraphicsStore';
import { hallencupOstGespielt, OST_ID } from '../../core/models/__fixtures__/hallencupOstGespielt';

const LOGO = {
  left: { dataUrl: 'data:image/png;base64,TEVSTkVO', widthPx: 600, heightPx: 600, originalHeightPx: 1200 },
  accent: '#2A2576',
} as const;

beforeEach(() => {
  mem.data.clear();
  mem.failSet = false;
  report.mockReset();
  repoGet.mockReset();
  repoGet.mockImplementation((id) => Promise.resolve(id === OST_ID ? hallencupOstGespielt() : null));
});

function copyWith(save: (tournament: Tournament) => Promise<void>) {
  return renderHook(() => useCopyTournament(save)).result.current;
}

describe('@W3-030 Kopie auf demselben Gerät (F6)', () => {
  it('@W3-030 Kopie auf demselben Gerät hat das Logo, das Original bleibt unverändert', async () => {
    await tournamentGraphicsStore.save(OST_ID, LOGO);
    const save = vi.fn().mockResolvedValue(undefined);

    const copy = await copyWith(save)(hallencupOstGespielt(), 'Hallencup Ost (Probe)');

    expect(copy.id).not.toBe(OST_ID);
    expect(await tournamentGraphicsStore.load(copy.id)).toEqual(LOGO);
    expect(await tournamentGraphicsStore.load(OST_ID)).toEqual(LOGO);
  });

  it('@W3-030 Gegenbeispiel: ohne Grafik am Original bekommt die Kopie keinen Eintrag', async () => {
    const save = vi.fn().mockResolvedValue(undefined);

    const copy = await copyWith(save)(hallencupOstGespielt(), 'Hallencup Ost (Probe)');

    expect(await tournamentGraphicsStore.load(copy.id)).toEqual({});
    expect(mem.data.size).toBe(0);
  });

  it('@W3-030 scheitert das Speichern der Kopie, wird keine Grafik kopiert', async () => {
    await tournamentGraphicsStore.save(OST_ID, LOGO);
    const save = vi.fn().mockRejectedValue(new Error('offline'));

    await expect(copyWith(save)(hallencupOstGespielt(), 'x')).rejects.toThrow('offline');

    expect([...mem.data.keys()]).toEqual([`tournament-graphics-${OST_ID}`]);
  });

  it('@W3-030 scheitert nur das Kopieren der Grafik (Speicher voll), entsteht die Kopie trotzdem und der Fehler wird gemeldet', async () => {
    await tournamentGraphicsStore.save(OST_ID, LOGO);
    mem.failSet = true;
    const save = vi.fn().mockResolvedValue(undefined);

    const copy = await copyWith(save)(hallencupOstGespielt(), 'Hallencup Ost (Probe)');

    expect(save).toHaveBeenCalledTimes(1);
    expect(copy.title).toBe('Hallencup Ost (Probe)');
    expect(report).toHaveBeenCalledTimes(1);
  });
});

describe('@W3-030 es gibt genau einen Kopierweg (Dashboard, Admin Center und Probe-Kopie)', () => {
  const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) { return name === '__tests__' || name === '__fixtures__' ? [] : sources(path); }
      return /\.(ts|tsx)$/.test(name) && !name.includes('.test.') ? [path] : [];
    });
  }

  it('@W3-030 nur useCopyTournament.ts baut eine Kopie (buildCopiedTournament); jede andere Stelle müsste F6 selbst erfüllen', () => {
    // Eingegrenzt auf die Ordner, in denen ein Kopierweg liegen kann (ein Scan über ganz src brauchte kalt 27 s)
    const roots = ['hooks', 'features', 'screens'].map((dir) => join(SRC, dir));
    const files = [...roots.flatMap((dir) => sources(dir)), join(SRC, 'App.tsx')];
    const users = files.filter((file) => readFileSync(file, 'utf8').includes('buildCopiedTournament('));

    expect(users.map((file) => file.slice(SRC.length + 1))).toEqual(['hooks/useCopyTournament.ts']);
  }, 30_000); // Quelltext-Scan: unter Rechnerlast über der Vorgabe von 5 s (Commit-Prüfung 13.11. zweimal daran gescheitert), wie die übrigen Wächter (@TA-021)

  it.each(['App.tsx', 'features/tournament-admin/categories/Settings/index.tsx'])('@W3-030 %s kopiert über useCopyTournament', (file) => {
    expect(readFileSync(join(SRC, file), 'utf8')).toContain('useCopyTournament(');
  });
});
