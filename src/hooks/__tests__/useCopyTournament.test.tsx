/**
 * Dashboard-Einstieg der Kopie fürs Proben (Paket KP): @W5-024 bis @W5-027.
 * Der Hook ist der Weg, den App.tsx („Kopieren“ im Dashboard) und das Admin Center gemeinsam nutzen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCopyTournament } from '../useCopyTournament';
import { hallencupOstGespielt, OST_ID, OST_CODE } from '../../core/models/__fixtures__/hallencupOstGespielt';
import type { Tournament } from '../../types/tournament';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Das Repository liefert das volle Turnier; Standard: gleiches Objekt wie die Liste
const repoGet = vi.fn<(id: string) => Promise<Tournament | null>>();
vi.mock('../useRepository', () => ({ useRepository: () => ({ get: repoGet }) }));

beforeEach(() => { repoGet.mockReset(); repoGet.mockImplementation((id) => Promise.resolve(id === OST_ID ? hallencupOstGespielt() : null)); });

function copyWith(save: (tournament: Tournament) => Promise<void>) {
  return renderHook(() => useCopyTournament(save)).result.current;
}

describe('useCopyTournament (Dashboard und Admin Center)', () => {
  it('@W5-024 speichert genau EINE neue Zeile ohne Freigabe-Code und nicht öffentlich', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await copyWith(save)(hallencupOstGespielt(), 'Hallencup Ost (Kopie)');
    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0][0] as Tournament;
    expect(saved).toMatchObject({ isPublic: false, shareCode: undefined });
    expect(JSON.stringify(saved)).not.toContain(OST_CODE);
  });

  it('@W5-025 C-COPY-AC-ID: gespeicherte Kopie hat echte UUIDs und startet leer', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await copyWith(save)(hallencupOstGespielt(), 'Hallencup Ost (Kopie)');
    const saved = save.mock.calls[0][0] as Tournament;
    expect(saved.id).toMatch(UUID);
    expect(saved.id).not.toBe(OST_ID);
    for (const spiel of saved.matches) {
      expect(spiel.id).toMatch(UUID);
      expect(spiel).toMatchObject({ matchStatus: 'scheduled', scoreA: undefined, finishedAt: undefined });
    }
    expect(saved.finishedAt).toBeUndefined();
  });

  it('@W5-026 gespeicherte Kopie hat keine Monitore; Gegenbeispiel: das Original behält sie', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const original = hallencupOstGespielt();
    await copyWith(save)(original, 'Hallencup Ost (Kopie)');
    expect((save.mock.calls[0][0] as Tournament).monitors).toBeUndefined();
    expect(original).toEqual(hallencupOstGespielt());
  });

  it('@W5-027 es wird nur die Kopie gespeichert, nie das Original (kein zweiter Speichervorgang)', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await copyWith(save)(hallencupOstGespielt(), 'Hallencup Ost (Kopie)');
    expect(save.mock.calls.map(([saved]) => (saved as Tournament).id)).not.toContain(OST_ID);
  });

  it('Gegenbeispiel: scheitert das Speichern, erfährt der Aufrufer davon (kein stiller Erfolg)', async () => {
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(copyWith(save)(hallencupOstGespielt(), 'x')).rejects.toThrow('offline');
  });

  // B1 (Review #280): angemeldet liefert die Startseiten-Liste nur Kopfdaten ohne Teams und Spiele
  it('@W5-025 C-COPY-DASH: ein Listen-Turnier ohne Teams und Spiele ergibt eine Kopie MIT Teams und Spielplan', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const listenEintrag = { ...hallencupOstGespielt(), teams: [], matches: [] };
    await copyWith(save)(listenEintrag, 'Hallencup Ost (Probe)');
    const saved = save.mock.calls[0][0] as Tournament;
    expect(repoGet).toHaveBeenCalledWith(OST_ID);
    expect(saved.teams).toHaveLength(hallencupOstGespielt().teams.length);
    expect(saved.matches).toHaveLength(hallencupOstGespielt().matches.length);
  });

  it('Gegenbeispiel: lässt sich das volle Turnier nicht laden, wird nichts angelegt', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    repoGet.mockRejectedValue(new Error('offline'));
    await expect(copyWith(save)(hallencupOstGespielt(), 'x')).rejects.toThrow('offline');
    expect(save).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: findet das Repository das Turnier nicht, wird nichts angelegt', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    repoGet.mockResolvedValue(null);
    await expect(copyWith(save)(hallencupOstGespielt(), 'x')).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ein veröffentlichtes Turnier ohne Spielplan nach dem Laden wird nicht als leere Kopie angelegt', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    repoGet.mockResolvedValue({ ...hallencupOstGespielt(), matches: [] });
    await expect(copyWith(save)(hallencupOstGespielt(), 'x')).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
  });
});
