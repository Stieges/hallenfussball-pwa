/**
 * Paket TB, Task TB-4: die Tabellen der App (Turnierverwaltung) rechnen je Gruppe nach BFV privat.
 * `useTournamentManager.currentStandings` = Tabelle je Gruppe hintereinander (C-TABELLE-GRUPPENUEBERGREIFEND),
 * `overallStandings` = die gruppenübergreifende Gesamtwertung für den Endstand. Szenario @W2A-049 (App-Tabelle),
 * Platzziffer @W2A-047 / @ET-055. Daten: Plan v2 Abschnitt 6 (@ET-056, @ET-055).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, render, screen, waitFor, within } from '@testing-library/react';
import { useTournamentManager } from '../useTournamentManager';
import { GroupTables } from '../../components/schedule/GroupTables';
import type { Tournament } from '../../types/tournament';
import { DATA, GD_FIRST_ORDER, NAME } from '../../core/standings/__tests__/fixtures';
import { teamNameIn, zweiGruppenWaging } from '../../core/standings/__tests__/tb4Kit';

const mockLoadTournament = vi.fn();

vi.mock('../../core/services/TournamentService', () => {
  class MockTournamentService {
    loadTournament = mockLoadTournament;
    updateTournament = vi.fn();
    schedule = {};
  }
  return { TournamentService: MockTournamentService };
});
vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ tournamentRepository: {}, isRealtimeEnabled: false }),
}));
vi.mock('../useRealtimeTournament', () => ({
  useRealtimeTournament: () => ({ isConnected: false, status: 'disconnected' }),
}));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => null,
}));

async function manager(tournament: Tournament) {
  mockLoadTournament.mockResolvedValue(tournament);
  const { result } = renderHook(() => useTournamentManager(tournament.id));
  await waitFor(() => expect(result.current.tournament).not.toBeNull());
  return result.current;
}

/** Zeilen der Desktop-Tabelle (9 Zellen): Platzziffer und Teamname. */
function tabellenzeilen(): Array<[string, string]> {
  return screen.getAllByRole('row')
    .filter((row) => within(row).queryAllByRole('cell').length === 9)
    .map((row) => {
      const cells = within(row).getAllByRole('cell');
      return [cells[0].textContent?.trim() ?? '', teamNameIn(cells[1].textContent?.trim() ?? '')] as [string, string];
    });
}

describe('TB-4 App-Tabellen je Gruppe (useTournamentManager)', () => {
  beforeEach(() => { mockLoadTournament.mockReset(); });

  it('@W2A-049 C-TABELLE-GRUPPENUEBERGREIFEND App-Tabelle: Gruppe A zeigt DJK Kammer vor TSV Waging rot (direktes Spiel 2:1), nicht Waging rot (bessere Tordifferenz) zuerst', async () => {
    const tournament = zweiGruppenWaging(DATA.ET_056);
    const { currentStandings, overallStandings } = await manager(tournament);

    render(<GroupTables standings={currentStandings} teams={tournament.teams} tournament={tournament} />);
    const gruppeA = tabellenzeilen().slice(0, 6).map(([, name]) => name);
    expect(gruppeA.slice(0, 2)).toEqual([NAME.K, NAME.R]);

    // Gegenbeispiel (Gruppenblock): die Gesamtwertung über beide Gruppen kennt keinen direkten Vergleich –
    // Waging rot (+6), Waging blau (+3), Kammer (+1) – und gehört nicht in die Gruppentabellen.
    expect(overallStandings.slice(0, 3).map((s) => s.team.name)).toEqual([NAME.R, NAME.X, NAME.K]);
    expect(currentStandings.slice(0, 6).every((s) => s.team.group === 'A')).toBe(true);
    expect(currentStandings.slice(6).every((s) => s.team.group === 'B')).toBe(true);
  });

  it('@W2A-049 App-Tabelle folgt der eingestellten Reihenfolge: bei „Punkte, Tordifferenz, Tore, direkter Vergleich“ steht Waging rot vor Kammer', async () => {
    const { currentStandings } = await manager(zweiGruppenWaging(DATA.ET_056, { placementLogic: GD_FIRST_ORDER }));
    expect(currentStandings.slice(0, 2).map((s) => s.team.name)).toEqual([NAME.R, NAME.K]);
  });

  it('@W2A-047 @ET-055 Platzziffer der App-Tabelle aus der Rechnung: 3, 3, 5 nach allen Spielen; mitten in der Gruppe 2, 2, 4', async () => {
    const fertig = zweiGruppenWaging(DATA.ET_055);
    const { currentStandings } = await manager(fertig);
    render(<GroupTables standings={currentStandings} teams={fertig.teams} tournament={fertig} />);
    const ziffern = (name: string): string[] => tabellenzeilen().filter(([, n]) => n === name).map(([z]) => z);
    expect([ziffern(NAME.R), ziffern(NAME.K), ziffern(NAME.N)]).toEqual([['3'], ['3'], ['5']]);
  });

  it('@W2A-047 Gegenbeispiel: mitten in der Gruppe (drei Spiele offen) steht 2, 2, 4', async () => {
    const offen = zweiGruppenWaging(DATA.ET_055, { open: ['M–U', 'U–N', 'N–O'] });
    const { currentStandings } = await manager(offen);
    render(<GroupTables standings={currentStandings} teams={offen.teams} tournament={offen} />);
    const ziffern = (name: string): string[] => tabellenzeilen().filter(([, n]) => n === name).map(([z]) => z);
    expect([ziffern(NAME.R), ziffern(NAME.K), ziffern(NAME.U)]).toEqual([['2'], ['2'], ['4']]);
  });
});
