/**
 * @FU-128 (C-STARTTIME): Auch der Rückfall-Eintrag UPDATE_TOURNAMENT_METADATA (updateTournamentMetadata) schickt
 * keine leere Zeichenkette und keinen Anzeigetext an die Spalte start_time (Typ time), sondern NULL.
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

async function sende(startTime: string): Promise<Record<string, unknown>> {
  await new SupabaseRepository().updateTournamentMetadata('T', { startTime });
  return hoisted.updateMock.mock.calls[0][0];
}

describe('@FU-128 updateTournamentMetadata: Startzeit (C-STARTTIME)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.selectMock.mockResolvedValue({ data: [{ id: 'T' }], error: null });
  });

  it('@FU-128 eine leere Startzeit geht als NULL an den Server, ohne Fehler', async () => {
    expect((await sende('')).start_time).toBeNull();
  });

  it('@FU-128 ein Anzeigetext „09:00 - 16:00“ geht als NULL an den Server', async () => {
    expect((await sende('09:00 - 16:00')).start_time).toBeNull();
  });

  it('@FU-128 Gegenbeispiel: „09:30“ wird übertragen', async () => {
    expect((await sende('09:30')).start_time).toBe('09:30');
  });
});
