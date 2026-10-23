/**
 * GA4 A-13b-C: Verlauf lesen (`bracket_log_read`, Migration `20261110_006`). Anforderungen: @TM-113, @W2A-071 („Olli hat
 * entschieden, und wann“), @W2A-072 (nie die E-Mail; kein Zugriff ohne Recht). Fehlerpolitik wie `eventAuthorNamesRpc`:
 * der Verlauf verhindert das Laden des Turniers nie.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { captureFeatureError } from '../../../lib/sentry';
import { mapBracketLogRow, readBracketLog, resetBracketLogReporting, type BracketLogRow } from '../bracketLogCloud';

vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

const rpcClient = (response: { data: unknown; error: { code?: string; message: string } | null } | Error) => {
  const rpc = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
};

const ROW: BracketLogRow = {
  id: 12, kind: 'standing_decision', match_id: null, group_id: '', detail: { id: 'e-1', kind: 'shared' }, reason: null,
  actor_name: 'Olli', actor_role: 'owner', created_at: '2026-12-06T14:32:00Z',
};

describe('Verlauf lesen: bracket_log_read → Tournament.decisionLog (@TM-113, @W2A-071)', () => {
  beforeEach(() => { vi.mocked(captureFeatureError).mockClear(); resetBracketLogReporting(); });

  it('@W2A-071 Name, Rolle, Zeit und Kennung der Entscheidung kommen an; fehlende Angaben fehlen (nie null)', () => {
    expect(mapBracketLogRow(ROW)).toEqual({
      id: 12, kind: 'standing_decision', groupId: '', detail: { id: 'e-1', kind: 'shared' }, actorName: 'Olli', actorRole: 'owner', at: '2026-12-06T14:32:00Z',
    });
    expect(mapBracketLogRow({ ...ROW, group_id: null, actor_name: null, actor_role: null })).not.toHaveProperty('actorName');
  });

  it('@W2A-004 der Grund einer Reihenfolge steht nur hier im Verlauf', () => {
    expect(mapBracketLogRow({ ...ROW, reason: 'Strafstoßschießen nach Spielende' })).toMatchObject({ reason: 'Strafstoßschießen nach Spielende' });
  });

  it('ruft bracket_log_read mit dem Turnier auf und liefert die Einträge in Reihenfolge (bigint kommt als Text oder Zahl)', async () => {
    const { client, rpc } = rpcClient({ data: [ROW, { ...ROW, id: '13', kind: 'standing_withdraw' }], error: null });
    const log = await readBracketLog(client, 't1');
    expect(rpc).toHaveBeenCalledWith('bracket_log_read', { p_tournament_id: 't1' });
    expect(log?.map((e) => [e.id, e.kind])).toEqual([[12, 'standing_decision'], [13, 'standing_withdraw']]);
  });

  it('@W2A-071 ohne Recht (Helfer): der Server liefert 0 Zeilen → leerer Verlauf, keine Meldung', async () => {
    expect(await readBracketLog(rpcClient({ data: [], error: null }).client, 't1')).toEqual([]);
    expect(captureFeatureError).not.toHaveBeenCalled();
  });

  it('@W2A-072 ohne Anmeldung (42501) oder ohne Netz: kein Verlauf (undefined), keine Meldung', async () => {
    expect(await readBracketLog(rpcClient({ data: null, error: { code: '42501', message: 'permission denied' } }).client, 't1')).toBeUndefined();
    expect(await readBracketLog(rpcClient(new TypeError('Failed to fetch')).client, 't1')).toBeUndefined();
    expect(await readBracketLog(null, 't1')).toBeUndefined();
    expect(captureFeatureError).not.toHaveBeenCalled();
  });

  it('Funktion fehlt (vor dem Einspielen von _006): kein Verlauf, genau eine Meldung je Sitzung', async () => {
    const fehlt = rpcClient({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    expect(await readBracketLog(fehlt.client, 't1')).toBeUndefined();
    expect(await readBracketLog(fehlt.client, 't1')).toBeUndefined();
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
  });

  it('eine unerwartete Antwort wird nicht übernommen (undefined + Meldung), das Turnier lädt trotzdem', async () => {
    expect(await readBracketLog(rpcClient({ data: [{ id: 1, kind: 'unbekannt' }], error: null }).client, 't1')).toBeUndefined();
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
  });
});
