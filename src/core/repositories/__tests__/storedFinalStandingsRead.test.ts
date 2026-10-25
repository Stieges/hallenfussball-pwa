/**
 * R3-4 Der beim Abschluss gespeicherte Endstand wird gelesen (`tournament_final_standings`). Erwartung aus @ET-045 (danach gilt nur
 * die gespeicherte Kopie, nie eine Neuberechnung) und @LZ-009 (Endstand ist fest): ein formwidriger Stand gilt als nicht lesbar.
 */
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { testUuid } from '../../../test/testIds';
import { readStoredFinalStandings } from '../storedFinalStandingsRead';

function client(answer: { data: unknown; error: { message: string } | null }): SupabaseClient<Database> {
  const node: Record<string, unknown> = {};
  for (const name of ['select', 'eq']) { node[name] = vi.fn(() => node); }
  node.maybeSingle = vi.fn(() => Promise.resolve(answer));
  return { from: vi.fn(() => node) } as unknown as SupabaseClient<Database>;
}

const SNAPSHOT = {
  format: 1, appVersion: 'abc', computedAt: '2026-11-28T12:10:00.000+00:00', scorers: [],
  ranking: [{ place: 1, teamId: testUuid(1), teamName: 'FC Nord', origin: { kind: 'groupPlace', group: '', place: 1 } }],
};

describe('@ET-045 gespeicherter Endstand', () => {
  it('gültige Zeile → Endstand und Zeitpunkt', async () => {
    const result = await readStoredFinalStandings(client({ data: { snapshot: SNAPSHOT, finished_at: '2026-11-28T12:10:00+00:00' }, error: null }), 't1');
    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.snapshot.ranking[0].teamName).toBe('FC Nord');
  });

  it('keine Zeile (nie abgeschlossen oder kein Recht) → „none“', async () => {
    expect(await readStoredFinalStandings(client({ data: null, error: null }), 't1')).toEqual({ status: 'none' });
  });

  it('Gegenbeispiele: formwidriger Stand, Lesefehler, kein Client → „failed“ (nie halb gelesen)', async () => {
    expect(await readStoredFinalStandings(client({ data: { snapshot: { format: 2 }, finished_at: 'x' }, error: null }), 't1')).toEqual({ status: 'failed' });
    expect(await readStoredFinalStandings(client({ data: null, error: { message: 'x' } }), 't1')).toEqual({ status: 'failed' });
    expect(await readStoredFinalStandings(null, 't1')).toEqual({ status: 'failed' });
  });
});
