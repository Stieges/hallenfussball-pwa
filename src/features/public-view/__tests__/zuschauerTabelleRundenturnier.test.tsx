/**
 * C-ZUSCHAUER-TABELLE-OHNE-GRUPPEN: Zuschauer-Seite „Tabellen“ bei „Jeder gegen jeden“ (Teams ohne Gruppe, der Assistent
 * entfernt sie). Früher: „Noch keine Spiele gespielt“ auch nach beendeten Spielen. Geprüft wird die ganze Kette
 * Turnier -> usePublicTournament (Tabellenrechnung) -> PublicStandingsTab -> GroupTables.
 * Szenario @ZM-170 (Record Zuschauer und Monitor; Turniermodi: „Jeder gegen jeden = eine Gruppe“): 6 Teams ohne Gruppen,
 * 3 Spiele beendet -> Tabelle „Gesamttabelle“ mit allen 6 Teams und den Ergebnissen der 3 Spiele, nicht „Noch keine Spiele
 * gespielt“. Die Reihenfolge prüft das Paket „Tabelle nach BFV privat“ (@W2A-049), hier nur: die Tabelle ist da.
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

const NAMEN = ['DJK Kammer', 'TSV Waging', 'SV Petting', 'SC Fridolfing', 'FC Otting', 'SG Tittmoning'];
const TEAMS = NAMEN.map((name, i) => createMockTeam({ id: testUuid(i + 1), name, group: undefined }));

/** Ergebnisse der Spiele 1 bis 3 (Heim:Gast) – Spiel n des Generators, die übrigen 12 Spiele sind noch offen. */
const ERGEBNISSE: Record<number, [number, number]> = { 1: [2, 0], 2: [3, 1], 3: [4, 4] };

/** Nikolaus-Turnier: Jeder gegen jeden mit 6 Teams ohne `group` (wie nach dem Assistenten), 3 Spiele beendet. */
function jederGegenJeden(): Tournament {
  const base = createMockTournament({
    id: 'tour-rr', title: 'Nikolausturnier', teams: TEAMS, matches: [], groupSystem: 'roundRobin',
    numberOfGroups: 1, numberOfFields: 1, shareCode: SHARE_CODE, isPublic: true, hideRankingsForPublic: false,
  });
  const matches: Match[] = generateFullSchedule(base).allMatches.map((m) => {
    const match: Match = { id: m.id, slotA: m.slotA, slotB: m.slotB, group: m.group, round: (m.slot ?? 0) + 1, field: m.field, slot: m.slot, phase: 'groupStage', matchNumber: m.matchNumber };
    const ergebnis = m.matchNumber === undefined ? undefined : ERGEBNISSE[m.matchNumber];
    return ergebnis ? { ...match, matchStatus: 'finished', scoreA: ergebnis[0], scoreB: ergebnis[1] } : { ...match, matchStatus: 'scheduled' };
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

  it('@ZM-170 6 Teams ohne Gruppen, 3 Spiele beendet: „Gesamttabelle“ mit allen 6 Teams und den Ergebnissen, nicht „Noch keine Spiele gespielt“', async () => {
    const turnier = jederGegenJeden();
    expect(turnier.matches.filter((m) => m.matchStatus === 'finished')).toHaveLength(3);
    const { container } = await zuschauerTabelle(turnier);

    expect(screen.queryByText(/Noch keine Spiele gespielt/)).toBeNull();
    const tables = container.querySelectorAll('.standings-table');
    expect(tables).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Gesamttabelle' })).toBeInTheDocument();
    const table = within(tables[0] as HTMLElement);
    for (const name of NAMEN) {
      expect(table.getAllByText(name).length).toBeGreaterThan(0);
    }
    // Ergebnisse der 3 Spiele stehen in der Tabelle: Tore je Team (Heim:Gast) 2:0, 3:1, 4:4 -> 6 Teams mit 1 Spiel
    const text = tables[0].textContent ?? '';
    for (const tore of ['2:0', '0:2', '3:1', '1:3', '4:4']) {
      expect(text).toContain(tore);
    }
  });

  it('Gegenbeispiel: ein Turnier mit zwei Gruppen zeigt weiter zwei Tabellen, Gruppe A und Gruppe B', async () => {
    const { container } = await zuschauerTabelle(buildLiveViewTournament());

    expect(container.querySelectorAll('.standings-table')).toHaveLength(2);
    expect(screen.getAllByText('Gruppe A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gruppe B').length).toBeGreaterThan(0);
  });
});
