/**
 * A-08f-F2 (@FU-087): loadTournament liest das Turnier genau einmal aus dem Repo (vorher zweimal:
 * direkt und in initializeSchedule). Verhalten unveraendert: Spiele kommen aus dem Turnier.
 * @W5-042: `initializeSchedule` gibt es nicht mehr; ein Turnier ohne Spiele bleibt ohne Spiele und wird nie gespeichert.
 */
import { describe, it, expect, vi } from 'vitest';
import { TournamentService } from '../TournamentService';
import type { ITournamentRepository } from '../../repositories/ITournamentRepository';
import type { Tournament } from '../../models/types';

describe('TournamentService.loadTournament -- Repo-Zugriffe (A-08f-F2)', () => {
  it('@FU-087 Turnier mit Spielen -> repository.get genau 1x, Spiele unveraendert', async () => {
    const matches = [{ id: 'm1' }, { id: 'm2' }];
    const tournament = { id: 't1', matches } as unknown as Tournament;
    const get = vi.fn().mockResolvedValue(tournament);
    const service = new TournamentService({ get } as unknown as ITournamentRepository);

    const result = await service.loadTournament('t1');

    expect(get).toHaveBeenCalledTimes(1);
    expect(result?.matches).toBe(matches);
  });

  it('@W5-042 Turnier ohne Spiele -> kein Plan erzeugt, nichts gespeichert, 1 Zugriff (Laden schreibt nie)', async () => {
    const tournament = { id: 't1', matches: [], teams: [{ id: 'a' }, { id: 'b' }] } as unknown as Tournament;
    const get = vi.fn().mockResolvedValue(tournament);
    const save = vi.fn();
    const service = new TournamentService({ get, save } as unknown as ITournamentRepository);

    const result = await service.loadTournament('t1');

    expect(result?.matches).toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it('unbekanntes Turnier -> null, 1 Zugriff', async () => {
    const get = vi.fn().mockResolvedValue(null);
    const service = new TournamentService({ get } as unknown as ITournamentRepository);
    expect(await service.loadTournament('x')).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
  });
});
