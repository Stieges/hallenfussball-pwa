/**
 * B-05 — @W4-020 Verdrahtung: Der Smart-Config-Hook übergibt Gruppenzahl und
 * Finalrunden-Wahl aus dem echten Wizard-Zustand (formData) an den Rechenkern.
 *
 * Gegeben die Turnierleitung wählt „Gruppen + Finalrunde“ mit 2 Gruppen zu je 4
 * Teams und Top 4 (Halbfinale, Platz 3, Finale)
 * Wenn die Empfehlung berechnet wird
 * Dann basiert sie auf 16 Spielen (12 Gruppen- + 4 Finalspiele)
 * Gegenbeispiel: dieselben 8 Teams als „Jeder gegen jeden“ → 28 Spiele.
 * Mutation: Verdrahtung entfernt (kein Strukturargument) → rot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { useSmartConfig } from '../hooks/useSmartConfig';

vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showWarning: vi.fn(), showSuccess: vi.fn(), showError: vi.fn() }),
}));

const gruppenFormData = (): Partial<Tournament> => ({
  numberOfTeams: 8,
  groupSystem: 'groupsAndFinals',
  numberOfGroups: 2,
  finalsConfig: { preset: 'top-4' },
});

describe('@W4-020 Verdrahtung Smart Config', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Gruppen + Finalrunde (2 Gruppen, Top 4) → Empfehlung basiert auf 16 Spielen', () => {
    const { result } = renderHook(() =>
      useSmartConfig({ formData: gruppenFormData(), onApply: vi.fn() })
    );
    act(() => {
      result.current.handleCalculate();
    });
    expect(result.current.recommendation?.totalMatches).toBe(16);
  });

  it('Gegenbeispiel: gleiche 8 Teams als Jeder-gegen-jeden → 28 Spiele', () => {
    const { result } = renderHook(() =>
      useSmartConfig({
        formData: { ...gruppenFormData(), groupSystem: 'roundRobin', finalsConfig: undefined },
        onApply: vi.fn(),
      })
    );
    act(() => {
      result.current.handleCalculate();
    });
    expect(result.current.recommendation?.totalMatches).toBe(28);
  });
});
