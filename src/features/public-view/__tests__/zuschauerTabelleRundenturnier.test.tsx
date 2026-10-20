/**
 * C-ZUSCHAUER-TABELLE-OHNE-GRUPPEN: Zuschauer-Seite „Tabellen“ bei „Jeder gegen jeden“ (Teams ohne Gruppe, der Assistent
 * entfernt sie). Früher: „Noch keine Spiele gespielt“ auch nach beendeten Spielen. Geprüft wird die ganze Kette
 * Turnier -> usePublicTournament (Tabellenrechnung) -> PublicStandingsTab -> GroupTables.
 * Szenario: Turniermodi „Jeder gegen jeden = eine Gruppe“; @W2A-049 (Zuschaueransicht zeigt die Tabelle eines privaten
 * Turniers „Jeder gegen jeden“). Die Reihenfolge prüft das Paket „Tabelle nach BFV privat“, hier nur: Tabelle ist da.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import type { Match, Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';
import { createMockTeam, createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { usePublicTournament, type PublicTournamentSource } from '../usePublicTournament';
import { PublicStandingsTab } from '../components/PublicStandingsTab';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';

vi.unmock('i18next'); vi.unmock('react-i18next'); // echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const [KAMMER, WAGING, PETTING, FRIDOLFING] = [1, 2, 3, 4].map(testUuid);
const TEAMS = [
  createMockTeam({ id: KAMMER, name: 'DJK Kammer', group: undefined }),
  createMockTeam({ id: WAGING, name: 'TSV Waging', group: undefined }),
  createMockTeam({ id: PETTING, name: 'SV Petting', group: undefined }),
  createMockTeam({ id: FRIDOLFING, name: 'SC Fridolfing', group: undefined }),
];

/** Jeder gegen jeden mit vier Teams, Spiel 1 beendet 2:0 – Teams ohne `group`, wie nach dem Assistenten. */
function jederGegenJeden(): Tournament {
  const base = createMockTournament({
    id: 'tour-rr', title: 'Nikolausturnier', teams: TEAMS, matches: [], groupSystem: 'roundRobin',
    numberOfGroups: 1, numberOfFields: 1, shareCode: SHARE_CODE, isPublic: true, hideRankingsForPublic: false,
  });
  const matches: Match[] = generateFullSchedule(base).allMatches.map((m) => {
    const match: Match = { id: m.id, slotA: m.slotA, slotB: m.slotB, group: m.group, round: (m.slot ?? 0) + 1, field: m.field, slot: m.slot, phase: 'groupStage', matchNumber: m.matchNumber };
    return m.matchNumber === 1 ? { ...match, matchStatus: 'finished', scoreA: 2, scoreB: 0 } : { ...match, matchStatus: 'scheduled' };
  });
  return { ...base, matches };
}

async function zuschauerTabelle(tournament: Tournament) {
  const source: PublicTournamentSource = { getByShareCode: vi.fn().mockResolvedValue(tournament) };
  const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source));
  await waitFor(() => expect(result.current.loadingState).toBe('success'));
  const loaded = result.current.tournament!;
  return render(<PublicStandingsTab tournament={loaded} standings={result.current.standings} />);
}

describe('Zuschauer-Tabelle „Jeder gegen jeden“', () => {
  it('Voraussetzung: die Teams des Turniers haben keine Gruppe', () => {
    expect(jederGegenJeden().teams.every((team) => team.group === undefined)).toBe(true);
  });

  it('nach einem beendeten Spiel steht EINE Tabelle mit allen Teams und dem Ergebnis, nicht „Noch keine Spiele gespielt“', async () => {
    const { container } = await zuschauerTabelle(jederGegenJeden());

    expect(screen.queryByText(/Noch keine Spiele gespielt/)).toBeNull();
    const tables = container.querySelectorAll('.standings-table');
    expect(tables).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Gesamttabelle' })).toBeInTheDocument();
    const table = within(tables[0] as HTMLElement);
    for (const name of ['DJK Kammer', 'TSV Waging', 'SV Petting', 'SC Fridolfing']) {
      expect(table.getAllByText(name).length).toBeGreaterThan(0);
    }
    // Sieger des beendeten Spiels 1 hat 3 Punkte und 2:0 Tore – das Spiel zählt in der Tabelle
    expect(tables[0].textContent).toContain('2:0');
  });

  it('Gegenbeispiel: ein Turnier mit zwei Gruppen zeigt weiter zwei Tabellen, Gruppe A und Gruppe B', async () => {
    const { container } = await zuschauerTabelle(buildLiveViewTournament());

    expect(container.querySelectorAll('.standings-table')).toHaveLength(2);
    expect(screen.getAllByText('Gruppe A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gruppe B').length).toBeGreaterThan(0);
  });
});
