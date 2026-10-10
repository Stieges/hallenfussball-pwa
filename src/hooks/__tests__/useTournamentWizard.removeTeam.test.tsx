/**
 * A-05 Fixrunde 1 (@FU-086): Team im Wizard-Bearbeiten entfernen darf kein Spiel mit der entfernten Team-ID
 * zuruecklassen (sonst scheitert das Speichern in der Cloud mit 23514).
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from '../../types/tournament';
import { createMatchRow, createTeamRow, createTournamentRow } from '../../../tests/factories/supabase';
import { mapTournamentFromSupabase } from '../../core/repositories/supabaseMappers';
import { testUuid } from '../../test/testIds';

const save = vi.fn<(t: Tournament) => Promise<void>>();
vi.mock('../useRepository', () => ({
  useRepository: () => ({
    save: (t: Tournament) => save(t),
    get: () => Promise.resolve(null),
  }),
}));

import { useTournamentWizard } from '../useTournamentWizard';

const A = testUuid(1);
const B = testUuid(2);
const C = testUuid(3);

function tournament(withResult = false): Tournament {
  return mapTournamentFromSupabase(
    createTournamentRow({ version: null }),
    [createTeamRow({ id: A, name: 'FC Nord' }), createTeamRow({ id: B, name: 'SV Sued' }), createTeamRow({ id: C, name: 'TSV Ost' })],
    [
      createMatchRow({ id: 'm-ab', team_a_id: A, team_b_id: B, ...(withResult ? { score_a: 2, score_b: 1, match_status: 'finished' } : {}) }),
      createMatchRow({ id: 'm-bc', team_a_id: B, team_b_id: C }),
    ]
  );
}

const teamIdsOf = (t: Partial<Tournament>) => (t.matches ?? []).flatMap((m) => [m.slotA, m.slotB]).flatMap((s) => (s?.kind === 'team' ? [s.teamId] : []));

describe('useTournamentWizard.removeTeam (@FU-086)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    save.mockResolvedValue(undefined);
  });

  it('@FU-086 Team entfernen und speichern: kein Spiel mehr mit dieser Team-ID', async () => {
    const { result } = renderHook(() => useTournamentWizard(tournament()));
    act(() => result.current.removeTeam(A));
    await act(async () => { await result.current.saveDraft(); });

    const saved = save.mock.calls[0][0];
    expect(saved.teams.map((t) => t.id)).not.toContain(A);
    expect(teamIdsOf(saved)).not.toContain(A);
    expect(saved.matches.map((m) => m.id)).toEqual(['m-bc']);
  });

  it('@FU-086 Gegenbeispiel: Spiele anderer Teams bleiben stehen', () => {
    const { result } = renderHook(() => useTournamentWizard(tournament()));
    act(() => result.current.removeTeam(A));
    expect(result.current.formData.matches?.map((m) => m.id)).toEqual(['m-bc']);
    expect(result.current.formData.teams).toHaveLength(2);
  });

  it('@FU-086 Team mit Ergebnis-Spiel bleibt als isRemoved, nur Spiele ohne Ergebnis fallen weg (wie deleteTeamSafely)', () => {
    const { result } = renderHook(() => useTournamentWizard(tournament(true)));
    act(() => result.current.removeTeam(B));
    expect(result.current.formData.teams?.find((t) => t.id === B)?.isRemoved).toBe(true);
    expect(result.current.formData.matches?.map((m) => m.id)).toEqual(['m-ab']);
  });

  it('@FU-086 Gegenbeispiel: Team ohne Spielplan entfernen aendert nichts an den Spielen (Entwurf)', () => {
    const base = tournament();
    const { result } = renderHook(() => useTournamentWizard({ ...base, matches: [] }));
    act(() => result.current.removeTeam(A));
    expect(result.current.formData.teams?.map((t) => t.id)).toEqual([B, C]);
    expect(result.current.formData.matches).toEqual([]);
  });
});
