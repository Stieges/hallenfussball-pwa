/**
 * R2 PR 3 – @W2A-078 (Record `2026-09-27_wizard-regelinhalte`, Befund C-WERTUNG-EINSTELLUNG-OHNE-SPERRE):
 *   Gegeben die Nichtantritt-Wertung steht auf 2:0
 *   Und ein Spiel ist als Nichtantritt gewertet
 *   Wenn die Turnierleitung … die Wertung auf 3:0 ändern will
 *   Dann ist das Feld gesperrt … Und auch ein Speichern auf anderem Weg ändert die Wertung nicht
 *   Und nimmt die Turnierleitung die Wertung des Spiels zurück, lässt sich die Einstellung wieder ändern
 * Hier der Speicherweg: jedes Speichern dieses Geräts geht durch `LocalStorageRepository.save` (Gast direkt, Konto über
 * `OfflineRepository.save` vor dem Einreihen). Eine Übernahme aus der Cloud (`cacheCloudCopy`) ist kein eigenes Speichern.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';

let gespeichert: unknown[] = [];

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
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { LocalStorageRepository } from '../LocalStorageRepository';
import { ForfeitScoreLockedError } from '../../errors';
import type { Tournament } from '../../models/types';
import { liveCup } from '../../../test/queueGuardFixtures';

/** Live-Cup mit Wertung 2:0; mit `gewertet` ist Spiel 4 als Nichtantritt (Gast fehlt) gewertet. */
function turnier(gewertet: boolean): Tournament {
  const t = liveCup(3);
  return {
    ...t,
    forfeitScore: { winner: 2, loser: 0 },
    matches: t.matches.map((m) => (m.id === 'spiel-4' && gewertet
      ? { ...m, matchStatus: 'finished' as const, scoreA: 2, scoreB: 0, decidedBy: 'forfeit' as const, forfeitAbsent: 'B' as const }
      : m)),
  };
}

async function gespeicherteWertung(): Promise<unknown> {
  return (await new LocalStorageRepository().get('T'))?.forfeitScore;
}

describe('@W2A-078 Speicherweg: die Wertung bei Nichtantritt ändert sich nicht, solange ein Spiel so gewertet ist', () => {
  beforeEach(() => { gespeichert = []; });

  it('@W2A-078 ein Spiel ist gewertet: Speichern mit 3:0 wird abgelehnt (ForfeitScoreLockedError), gespeichert bleibt 2:0', async () => {
    const repo = new LocalStorageRepository();
    await repo.save(turnier(true));
    await expect(repo.save({ ...turnier(true), forfeitScore: { winner: 3, loser: 0 } })).rejects.toBeInstanceOf(ForfeitScoreLockedError);
    expect(await gespeicherteWertung()).toEqual({ winner: 2, loser: 0 });
  });

  it('@W2A-078 auch eine Kopie ohne Wertung im Spielplan (ältere Ansicht) ändert die gespeicherte Wertung nicht, solange gespeichert eine Wertung steht', async () => {
    const repo = new LocalStorageRepository();
    await repo.save(turnier(true));
    await expect(repo.save({ ...turnier(false), forfeitScore: { winner: 5, loser: 0 } })).rejects.toBeInstanceOf(ForfeitScoreLockedError);
    expect(await gespeicherteWertung()).toEqual({ winner: 2, loser: 0 });
  });

  it('@W2A-078 ein Speichern, das eine Wertung mitbringt und zugleich die Einstellung ändert, wird abgelehnt (die Wertung gälte sonst mit einem anderen Ergebnis)', async () => {
    const repo = new LocalStorageRepository();
    await repo.save(turnier(false));
    await expect(repo.save({ ...turnier(true), forfeitScore: { winner: 3, loser: 0 } })).rejects.toBeInstanceOf(ForfeitScoreLockedError);
    expect(await gespeicherteWertung()).toEqual({ winner: 2, loser: 0 });
  });

  it('@W2A-078 Gegenbeispiel: gleicher Wert bei einer Wertung → Speichern gelingt (andere Felder dürfen sich ändern)', async () => {
    const repo = new LocalStorageRepository();
    await repo.save(turnier(true));
    await repo.save({ ...turnier(true), title: 'Neuer Titel' });
    expect((await repo.get('T'))?.title).toBe('Neuer Titel');
  });

  it('@W2A-078 Gegenbeispiel: ohne Wertung (oder nach der Rücknahme) lässt sich die Einstellung ändern', async () => {
    const repo = new LocalStorageRepository();
    await repo.save(turnier(false));
    await repo.save({ ...turnier(false), forfeitScore: { winner: 3, loser: 0 } });
    expect(await gespeicherteWertung()).toEqual({ winner: 3, loser: 0 });
  });

  it('@W2A-078 Gegenbeispiel: die Übernahme aus der Cloud ist kein Speichern dieses Geräts und wird nicht gesperrt', async () => {
    const repo = new LocalStorageRepository();
    await repo.save(turnier(true));
    await repo.cacheCloudCopy({ ...turnier(true), forfeitScore: { winner: 3, loser: 0 } });
    expect(await gespeicherteWertung()).toEqual({ winner: 3, loser: 0 });
  });
});
