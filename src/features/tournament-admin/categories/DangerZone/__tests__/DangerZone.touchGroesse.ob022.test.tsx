/**
 * @OB-022 Beispielseite „das Admin Center, Gefahrenbereich“: jede Taste ist mindestens 44 Bildpunkte hoch.
 * Vorher: eigene `<button>` mit Innenabstand `spacing.sm` und ohne Mindesthöhe (rund 32 Bildpunkte). Jetzt der Baustein `Button`
 * (Mindesthöhe 44 Bildpunkte aus der Größe „md“). Gemessen wird der gesetzte Stil; die gerenderte Höhe steht in den Bildern (optik-o1-bilder).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';

vi.mock('../../../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, isLoading: false }),
}));

import { DangerZoneCategory } from '../index';

const turnier = {
  id: 't1', title: 'Wintercup', status: 'published',
  teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  matches: [{ id: 'm1', matchStatus: 'scheduled' }],
  startDate: '2026-03-01', startTime: '10:00',
} as unknown as Tournament;

const mindestens44 = (taste: HTMLElement): boolean => parseInt(taste.style.minHeight, 10) >= 44;

beforeEach(() => {
  vi.clearAllMocks();
  render(<DangerZoneCategory tournamentId="t1" tournament={turnier} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);
});

describe('@OB-022 Admin Center, Gefahrenbereich: Tasten mindestens 44 Bildpunkte', () => {
  it('@OB-022 die beiden Tasten der Karten („Ergebnisse zurücksetzen“, „Turnier löschen“) haben die Mindesthöhe des Bausteins', () => {
    const loeschen = screen.getByTestId('danger-zone-delete');
    const zuruecksetzen = screen.getByTestId('danger-zone-action');
    expect(mindestens44(loeschen)).toBe(true);
    expect(mindestens44(zuruecksetzen)).toBe(true);
    // Baustein `Button` erkennbar am gesetzten Wischschutz und der Farbe aus dem Token
    expect(loeschen.style.touchAction).toBe('manipulation');
    expect(loeschen.style.background).toBe('var(--color-error)');
  });

  it('@OB-022 in der Rückfrage haben „Abbrechen“ und die Bestätigungstaste dieselbe Mindesthöhe, die Reihenfolge bleibt', () => {
    fireEvent.click(screen.getByTestId('danger-zone-delete'));
    const abbrechen = screen.getByText(/dangerZone\.cancel/).closest('button')!;
    const knoepfe = abbrechen.parentElement!.querySelectorAll('button');
    expect(knoepfe).toHaveLength(2);
    expect(knoepfe[0]).toBe(abbrechen); // Abbrechen zuerst, die Haupttaste zuletzt (@OB-061)
    expect(mindestens44(abbrechen)).toBe(true);
    expect(mindestens44(knoepfe[1] as HTMLElement)).toBe(true);
  });
});
