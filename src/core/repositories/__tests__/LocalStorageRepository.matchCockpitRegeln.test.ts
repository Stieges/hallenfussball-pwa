/**
 * ZA-0 Fixrunde 1 (A1) – Spielregeln „Spiel leiten“ im lokalen Lesepfad.
 *
 * Lokal gespeicherte Altkonfigurationen, Gast-Turniere und per JSON wiederhergestellte
 * Turniere (Restore speichert roh, gelesen wird über loadList) bekommen die Vorgaben.
 * Gespeicherte Werte bleiben unverändert, auch `foulLimit: null` (= aus).
 * Werte aus dem Gherkin (@SL-002, @SL-024, @SL-101, @W2A-013, @W2A-017, @W2A-035, @W2A-037).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';

let gespeichert: unknown[] = [];

// Nur der Schluessel `tournaments` zaehlt; andere Schluessel (z. B. serverRevisions) bleiben getrennt.
vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(key === 'tournaments' ? gespeichert : undefined),
      set: (key: string, value: unknown) => {
        if (key === 'tournaments') { gespeichert = value as unknown[]; }
        return Promise.resolve();
      },
    } as unknown as IStorageAdapter),
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

import { LocalStorageRepository } from '../LocalStorageRepository';
import type { Tournament } from '../../models/types';

const ALTES_TURNIER = {
  id: 't1',
  status: 'draft',
  createdAt: '2026-10-01T08:00:00.000Z',
  matches: [],
  matchCockpitSettings: { penaltyShootersPerTeam: 5 },
};

describe('LocalStorageRepository — Spielregeln „Spiel leiten“ (Fixrunde A1)', () => {
  beforeEach(() => {
    gespeichert = [];
  });

  it('lokal gespeicherte Altkonfiguration ohne Regelfelder bekommt die Vorgaben', async () => {
    gespeichert = [ALTES_TURNIER];

    const turnier = await new LocalStorageRepository().get('t1');

    expect(turnier?.matchCockpitSettings?.penaltyShootersPerTeam).toBe(5);
    expect(turnier?.matchCockpitSettings?.clockMode).toBe('durchlaufend-letzte-minute-angehalten');
    expect(turnier?.matchCockpitSettings?.enabledCards).toEqual({
      yellow: true,
      yellowRed: true,
      red: true,
      timePenalty: true,
    });
    expect(turnier?.matchCockpitSettings?.foulLimit).toBe(5);
    expect(turnier?.matchCockpitSettings?.penaltyEndsOnGoal).toBe(true);
    expect(turnier?.matchCockpitSettings?.shortHandedSeconds).toBe(120);
  });

  it('Gegenbeispiel: gespeicherte Werte bleiben, auch foulLimit null (= aus)', async () => {
    gespeichert = [
      {
        ...ALTES_TURNIER,
        matchCockpitSettings: {
          clockMode: 'immer-angehalten',
          foulLimit: null,
          enabledCards: { red: false },
          penaltyEndsOnGoal: false,
          shortHandedSeconds: 60,
        },
      },
    ];

    const turnier = await new LocalStorageRepository().get('t1');

    expect(turnier?.matchCockpitSettings?.clockMode).toBe('immer-angehalten');
    expect(turnier?.matchCockpitSettings?.foulLimit).toBeNull();
    expect(turnier?.matchCockpitSettings?.enabledCards).toEqual({
      yellow: true,
      yellowRed: true,
      red: false,
      timePenalty: true,
    });
    expect(turnier?.matchCockpitSettings?.penaltyEndsOnGoal).toBe(false);
    expect(turnier?.matchCockpitSettings?.shortHandedSeconds).toBe(60);
  });

  it('Gast-Turnier (kein Konto, Gast-Sicht) bekommt die Vorgaben', async () => {
    gespeichert = [ALTES_TURNIER];

    const turnier = await new LocalStorageRepository({ viewer: 'guest' }).get('t1');

    expect(turnier?.matchCockpitSettings?.clockMode).toBe('durchlaufend-letzte-minute-angehalten');
    expect(turnier?.matchCockpitSettings?.foulLimit).toBe(5);
  });

  it('JSON-Restore: ein roh gespeichertes Turnier ohne Regelfelder liest mit den Vorgaben', async () => {
    const wiederhergestellt = JSON.parse(JSON.stringify(ALTES_TURNIER)) as Tournament;
    const repo = new LocalStorageRepository();

    await repo.save(wiederhergestellt);
    const turnier = await repo.get('t1');

    expect(turnier?.matchCockpitSettings?.clockMode).toBe('durchlaufend-letzte-minute-angehalten');
    expect(turnier?.matchCockpitSettings?.enabledCards.timePenalty).toBe(true);
    expect(turnier?.matchCockpitSettings?.foulLimit).toBe(5);
  });

  it('ohne Cockpit-Konfiguration bleibt das Turnier ohne Einstellungen', async () => {
    gespeichert = [{ ...ALTES_TURNIER, matchCockpitSettings: undefined }];

    const turnier = await new LocalStorageRepository().get('t1');

    expect(turnier?.matchCockpitSettings).toBeUndefined();
  });
});
