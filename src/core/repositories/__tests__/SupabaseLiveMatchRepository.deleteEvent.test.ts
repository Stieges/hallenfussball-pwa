/**
 * SupabaseLiveMatchRepository.deleteEvent — Symmetrie mit dem Schreibpfad (Review-Fix
 * Minor 5, Fixrunde 1, 2026-09-25).
 *
 * Root cause: `save()`/`mapMatchEventToSupabase()` bilden eine lokale Alt-Kennung ohne
 * UUID-Format über `toSupabaseEventId()` deterministisch auf eine UUID ab, bevor sie an
 * Supabase geschickt wird (C-EVID). `deleteEvent()` reichte die lokale `eventId` bisher
 * UNVERÄNDERT an `.eq('id', eventId)` durch — bei einer Alt-Kennung würde das also nie die
 * tatsächlich in der DB liegende (gemappte) Zeile treffen. Praktisch niedriges Risiko (im
 * Cloud-Modus stammen UI-Kennungen aus der DB, also bereits UUIDs), aber inkonsistent mit
 * dem Schreibpfad — dieser Test sichert die Symmetrie ab.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toSupabaseEventId } from '../../utils/id';

const hoisted = vi.hoisted(() => {
  const eqMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn((table: string) => {
    if (table === 'match_events') { return { update: updateMock }; }
    throw new Error(`unexpected table in test mock: ${table}`);
  });
  return { eqMock, updateMock, fromMock, supabaseMock: { from: fromMock } };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';

const { eqMock, updateMock } = hoisted;

describe('SupabaseLiveMatchRepository.deleteEvent — Kennung wird wie beim Schreiben abgebildet (Minor 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockResolvedValue({ error: null });
  });

  it('bildet eine Alt-Kennung ohne UUID-Format auf dieselbe deterministische UUID ab wie mapMatchEventToSupabase', async () => {
    const legacyLocalId = 'match-1-goal-1790284219635-zyqvd';
    const repo = new SupabaseLiveMatchRepository();

    await repo.deleteEvent('t1', 'm1', legacyLocalId);

    expect(updateMock).toHaveBeenCalledWith({ is_deleted: true });
    expect(eqMock).toHaveBeenCalledWith('id', toSupabaseEventId(legacyLocalId));
    expect(eqMock).not.toHaveBeenCalledWith('id', legacyLocalId);
  });

  it('lässt eine echte UUID-Kennung unverändert', async () => {
    const realUuid = '550e8400-e29b-41d4-a716-446655440000';
    const repo = new SupabaseLiveMatchRepository();

    await repo.deleteEvent('t1', 'm1', realUuid);

    expect(eqMock).toHaveBeenCalledWith('id', realUuid);
  });
});
