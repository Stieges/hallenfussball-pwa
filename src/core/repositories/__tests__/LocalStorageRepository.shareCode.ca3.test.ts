/**
 * CA-3 (Paket Co-Admin, Befund C-SHARE): Der Geräte-Rückfall des Teilens erzeugt Codes im Format des Servers,
 * vergibt keinen Code zweimal und überschreibt keinen vorhandenen Code.
 * Anforderungen: NEU-CA4 (Code 6 Zeichen, ohne 0/O/1/I, mit Zeitpunkt), NEU-CA3 (Rückfall-Pfad),
 * Plan-Review Auflage 5 (Code bleibt beim erneuten Teilen).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';
import { SHARE_CODE_ALPHABET } from '../../models/shareCode';
import { createMockTournament } from '../../../test/factories';

const store = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: () => Promise.resolve(structuredClone(store.list)),
      set: (_key: string, value: unknown) => { store.list = structuredClone(value as unknown[]); return Promise.resolve(); },
    }),
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { LocalStorageRepository } from '../LocalStorageRepository';

/** Zufallsquelle, die nacheinander genau diese Codes ergibt (je Zeichen ein Wert). */
function randomForCodes(...codes: string[]): void {
  const values = codes.flatMap((code) => [...code].map((ch) => (SHARE_CODE_ALPHABET.indexOf(ch) + 0.5) / SHARE_CODE_ALPHABET.length));
  let i = 0;
  vi.spyOn(Math, 'random').mockImplementation(() => values[Math.min(i++, values.length - 1)]);
}

const privat = (id: string, extra: Partial<Tournament> = {}): Tournament =>
  createMockTournament({ id, sportId: 'football-indoor', isPublic: false, ...extra });
const geteilt = (id: string, code: string, extra: Partial<Tournament> = {}): Tournament =>
  createMockTournament({ id, sportId: 'football-indoor', isPublic: true, shareCode: code, shareCodeCreatedAt: '2026-10-01T08:00:00.000Z', ...extra });
const codes = (): Array<string | undefined> => (store.list as Tournament[]).map((t) => t.shareCode);

describe('CA-3 LocalStorageRepository: Rückfall-Code', () => {
  beforeEach(() => { store.list = []; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('NEU-CA4: Code aus der Server-Zeichenmenge (nie 0/O/1/I) und mit Zeitpunkt', async () => {
    store.list = [privat('a')];
    const result = await new LocalStorageRepository().makeTournamentPublic('a');
    expect(result?.shareCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    const saved = (store.list as Tournament[])[0];
    expect(saved).toMatchObject({ isPublic: true, shareCode: result?.shareCode, shareCodeCreatedAt: result?.createdAt });
    expect(Date.parse(result?.createdAt ?? '')).not.toBeNaN();
  });

  it('Kollision lokal: hat ein anderes lokales Turnier den gewürfelten Code, wird neu gewürfelt', async () => {
    store.list = [privat('a'), geteilt('b', 'KKKKKK')];
    randomForCodes('KKKKKK', 'MMMMMM');
    const result = await new LocalStorageRepository().makeTournamentPublic('a');
    expect(result?.shareCode).toBe('MMMMMM');
    expect(new Set(codes().filter(Boolean)).size).toBe(2);
  });

  it('Gegenbeispiel Kollision: ein freier erster Wurf wird übernommen (kein unnötiges Neuwürfeln)', async () => {
    store.list = [privat('a'), geteilt('b', 'KKKKKK')];
    randomForCodes('NNNNNN', 'MMMMMM');
    const result = await new LocalStorageRepository().makeTournamentPublic('a');
    expect(result?.shareCode).toBe('NNNNNN');
  });

  it('Kollision lokal gilt auch beim Neuerzeugen (regenerateShareCode)', async () => {
    store.list = [geteilt('a', 'AAAAAA'), geteilt('b', 'KKKKKK')];
    randomForCodes('KKKKKK', 'MMMMMM');
    const result = await new LocalStorageRepository().regenerateShareCode('a');
    expect(result?.shareCode).toBe('MMMMMM');
  });

  it('Auflage 5: ein schon geteiltes Turnier behält seinen Code (kein Neuwürfeln beim erneuten Teilen)', async () => {
    store.list = [geteilt('a', 'KEEP23')];
    randomForCodes('MMMMMM');
    const result = await new LocalStorageRepository().makeTournamentPublic('a');
    expect(result).toEqual({ shareCode: 'KEEP23', createdAt: '2026-10-01T08:00:00.000Z' });
    expect(codes()).toEqual(['KEEP23']);
  });

  it('Gegenbeispiel Auflage 5: ein privates Turnier mit altem Rest-Code bekommt einen neuen Code', async () => {
    store.list = [privat('a', { shareCode: 'ALT234' })];
    randomForCodes('MMMMMM');
    const result = await new LocalStorageRepository().makeTournamentPublic('a');
    expect(result?.shareCode).toBe('MMMMMM');
  });

  it('Gegenbeispiel: der ausdrückliche Wunsch "neuer Code" (regenerate) würfelt weiter neu', async () => {
    store.list = [geteilt('a', 'KEEP23')];
    randomForCodes('MMMMMM');
    const result = await new LocalStorageRepository().regenerateShareCode('a');
    expect(result?.shareCode).toBe('MMMMMM');
  });
});
