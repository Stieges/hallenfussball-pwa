/**
 * useCockpitLeerGrund, @SL-243: bei einem Feld nennt die Tafel kein Feld („Heute folgt kein Spiel mehr“); bei zwei Feldern bleibt der Feldname
 * („Auf Feld 2 folgt kein Spiel mehr“).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tournament } from '../../../../types/tournament';
import type { SideContext } from '../../../../components/schedule/matchSides';
import { useCockpitLeerGrund, type CockpitLeerGrundArgs } from '../useCockpitLeerGrund';

vi.mock('../../../../hooks/useRedCardSuspensions', () => ({ useRedCardSuspensions: () => [] }));

const args = (felder: number, feld: number): CockpitLeerGrundArgs => ({
  tournament: { id: 't1', title: 'Nikolaus-Turnier', teams: [], groups: [], numberOfFields: felder, matches: [] } as unknown as Tournament,
  allMatches: [], currentMatchData: undefined, awaitingTeams: false, isOnline: true, sides: {} as unknown as SideContext,
  selectedFieldNumber: feld, upcomingMatches: [], onLoadNextMatch: vi.fn(),
});

describe('@SL-243 useCockpitLeerGrund: Feld nur bei mehreren Feldern', () => {
  it('ein Feld: kein Feldname im Grund „kein Spiel mehr“, die Props sagen showField = false', () => {
    const { leer, leerProps } = renderHook(() => useCockpitLeerGrund(args(1, 1))).result.current;
    expect(leer).toEqual({ art: 'keinSpiel' });
    expect(leerProps.showField).toBe(false);
  });

  it('Gegenbeispiel zwei Felder: der Grund nennt „Feld 2“, showField = true', () => {
    const { leer, leerProps } = renderHook(() => useCockpitLeerGrund(args(2, 2))).result.current;
    // Die Übersetzung ist hier ein Stub: geprüft wird, dass ein Feldname im Grund steht (Wortlaut „Feld 2“ prüft der Cockpit-Test)
    expect(leer).toEqual({ art: 'keinSpiel', feldName: expect.stringContaining('management.field') as unknown });
    expect(leerProps.showField).toBe(true);
  });
});
