/**
 * useCockpitLeerGrund (B-10a2, @SL-159): die Props des leeren Cockpits tragen dasselbe Leitungsrecht wie die des vollen. Ohne Spiel ist es
 * wirkungslos (kein Zustand „abgepfiffen“), aber ein Leitungsgerät darf in den Props nicht als Helfer auftauchen.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tournament } from '../../../../types/tournament';
import type { SideContext } from '../../../../components/schedule/matchSides';
import { useCockpitLeerGrund, type CockpitLeerGrundArgs } from '../useCockpitLeerGrund';

vi.mock('../../../../hooks/useRedCardSuspensions', () => ({ useRedCardSuspensions: () => [] }));

const args = (istLeitung?: boolean): CockpitLeerGrundArgs => ({
  tournament: { id: 't1', title: 'Cup', teams: [], groups: [] } as unknown as Tournament, allMatches: [], currentMatchData: undefined,
  awaitingTeams: false, isOnline: true, sides: {} as unknown as SideContext, selectedFieldNumber: 1, upcomingMatches: [], onLoadNextMatch: vi.fn(),
  ...(istLeitung === undefined ? {} : { istLeitung }),
});

describe('useCockpitLeerGrund: leerProps.istLeitung', () => {
  it('Turnierleitung: die Props des leeren Cockpits tragen istLeitung = true', () => {
    expect(renderHook(() => useCockpitLeerGrund(args(true))).result.current.leerProps.istLeitung).toBe(true);
  });
  it('Gegenbeispiel: Helfer und ohne Angabe ergeben false', () => {
    expect(renderHook(() => useCockpitLeerGrund(args(false))).result.current.leerProps.istLeitung).toBe(false);
    expect(renderHook(() => useCockpitLeerGrund(args())).result.current.leerProps.istLeitung).toBe(false);
  });
  it('das leere Cockpit steuert nie: kannSteuern bleibt false, auch für die Turnierleitung', () => {
    expect(renderHook(() => useCockpitLeerGrund(args(true))).result.current.leerProps.kannSteuern).toBe(false);
  });
});
