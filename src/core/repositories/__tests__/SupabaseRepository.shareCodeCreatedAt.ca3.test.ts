/**
 * CA-3 (Paket Co-Admin, Befund C-SHARE, NEU-CA4): Der Rückfall-Eintrag UPDATE_TOURNAMENT_METADATA trägt den Zeitpunkt,
 * zu dem der Code entstand, bis in die Zeile (`share_code_created_at`). Ein Fehler des Servers (z. B. 23505 auf dem
 * UNIQUE-Schlüssel des Codes) wird nicht verschluckt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const selectMock = vi.fn();
  const eqMock = vi.fn(() => ({ select: selectMock }));
  const updateMock = vi.fn((_payload: Record<string, unknown>) => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ update: updateMock }));
  return { selectMock, eqMock, updateMock, fromMock };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: hoisted.fromMock, auth: { getUser: vi.fn() } },
  isSupabaseConfigured: true,
}));

import { SupabaseRepository } from '../SupabaseRepository';
import { RepositoryError } from '../../errors';

describe('CA-3 SupabaseRepository.updateTournamentMetadata: share_code_created_at', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.selectMock.mockResolvedValue({ data: [{ id: 'T' }], error: null });
  });

  it('Code und Zeitpunkt gehen gemeinsam in die Zeile', async () => {
    await new SupabaseRepository().updateTournamentMetadata('T', {
      isPublic: true, shareCode: 'ABC234', shareCodeCreatedAt: '2026-11-01T10:00:00.000Z',
    });
    expect(hoisted.updateMock.mock.calls[0][0]).toMatchObject({
      is_public: true, share_code: 'ABC234', share_code_created_at: '2026-11-01T10:00:00.000Z',
    });
  });

  it('Gegenbeispiel: ohne shareCodeCreatedAt bleibt die Spalte unberührt', async () => {
    await new SupabaseRepository().updateTournamentMetadata('T', { title: 'Neu' });
    expect(hoisted.updateMock.mock.calls[0][0]).not.toHaveProperty('share_code_created_at');
  });

  it('Kollision am Server (23505) wird als Fehler geworfen, nicht still verschluckt', async () => {
    hoisted.selectMock.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "tournaments_share_code_key"' } });
    await expect(new SupabaseRepository().updateTournamentMetadata('T', { shareCode: 'ABC234' })).rejects.toBeInstanceOf(RepositoryError);
  });
});
