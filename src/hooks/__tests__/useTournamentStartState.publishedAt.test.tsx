/**
 * B-01a Fixrunde 2, P3 — „festgelegt" auch über publishedAt (U0, F1).
 *
 * „festgelegt" = veröffentlicht (status ODER der monotone Freigabe-Marker
 * publishedAt — „Im Wizard bearbeiten" setzt transient auf 'draft' zurück).
 * Ein festgelegtes Turnier hat immer Spiele (publish() erzeugt sie); eine leere
 * Liste heißt dann: Daten nicht geladen → „nicht feststellbar" (fail-closed).
 *
 * Test:    publishedAt ohne Status 'published' und ohne Spiele in der Liste
 *          → 'unknown' (nicht feststellbar).
 * Gegenbeispiel: Entwurf ohne publishedAt ohne Spiele → 'not-started'
 *          (nicht angepfiffen).
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTournamentStartState } from '../useTournamentStartState';
import type { Tournament } from '../../types/tournament';

function tournamentWith(extra: Partial<Tournament>): Pick<
  Tournament,
  'id' | 'matches' | 'status' | 'publishedAt'
> {
  return {
    id: 't1',
    matches: [],
    status: 'draft',
    ...extra,
  };
}

describe('useTournamentStartState — „festgelegt" über publishedAt (B-01a Fixrunde 2, P3)', () => {
  it('publishedAt ohne Spiele in der Liste: nicht feststellbar', () => {
    const { result } = renderHook(() =>
      useTournamentStartState(tournamentWith({ publishedAt: '2026-03-01T09:00:00Z' }))
    );

    expect(result.current).toBe('unknown');
  });

  it('Gegenbeispiel: Entwurf ohne publishedAt: nicht angepfiffen', () => {
    const { result } = renderHook(() => useTournamentStartState(tournamentWith({})));

    expect(result.current).toBe('not-started');
  });
});
