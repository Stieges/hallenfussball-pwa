/**
 * B-04 Paket c — @W2A-007: Entscheidung bei Unentschieden je K.-o.-Runde.
 *
 * Gegeben das Halbfinale ist auf „Strafstoßschießen“ und das Finale auf
 * „Verlängerung, dann Strafstoßschießen“ eingestellt
 * Wenn ein Halbfinale und das Finale unentschieden enden
 * Dann folgt im Halbfinale direkt das Schießen und im Finale zuerst die Verlängerung
 *
 * Echter Bedienweg: Wizard-Schritt mit den Finalrunden-Regeln →
 * gespeichertes Turnier → die Regel, die das Cockpit für ein Halbfinale bzw.
 * Finale nach Unentschieden ermittelt (gleiche Funktion, die das Cockpit nutzt:
 * `resolveTiebreakMode`, verdrahtet in MatchExecutionService.initializeMatch).
 *
 * UI-Ort: src/features/tournament-creation/components/FinalsConfiguration.tsx
 * (Block „Bei Unentschieden“, Selektoren `tiebreaker-round-semifinal` und
 * `tiebreaker-round-final`).
 *
 * Gegenbeispiel: Gruppenspiel unentschieden → keine Entscheidung.
 * Mutation: Regel je Runde durch eine globale ersetzen → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { FinalsConfiguration } from '../components/FinalsConfiguration';
import { resolveTiebreakMode } from '../../../core/match/tiebreakDecision';
import type { Tournament } from '../../../types/tournament';

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  }),
}));

type WizardApi = ReturnType<typeof useTournamentWizard>;
const draftSpy = vi.fn<(t: Tournament) => void>();

function Harness() {
  const api: WizardApi = useTournamentWizard();
  return (
    <>
      <FinalsConfiguration formData={api.formData} onUpdate={api.updateForm} />
      <button
        type="button"
        data-testid="probe-create-draft"
        onClick={() => {
          draftSpy(api.createDraftTournament());
        }}
      >
        Entwurf erzeugen
      </button>
    </>
  );
}

function waehleRunde(runde: 'semifinal' | 'final', modus: string) {
  fireEvent.change(screen.getByTestId(`tiebreaker-round-${runde}`), { target: { value: modus } });
}

function speichereMitRundenRegeln(): Tournament {
  draftSpy.mockClear();
  render(<Harness />);
  fireEvent.click(screen.getByTestId('finals-preset-top-4'));
  waehleRunde('semifinal', 'shootout');
  waehleRunde('final', 'overtime-then-shootout');
  fireEvent.click(screen.getByTestId('probe-create-draft'));
  const gespeichert = draftSpy.mock.calls[0]?.[0];
  if (!gespeichert) {
    throw new Error('Entwurf wurde nicht erzeugt');
  }
  return gespeichert;
}

describe('B-04c @W2A-007 – Entscheidung bei Unentschieden je K.-o.-Runde', () => {
  it('Halbfinale „Strafstoßschießen“ und Finale „Verlängerung, dann Strafstoßschießen“ werden je Runde gespeichert', () => {
    const gespeichert = speichereMitRundenRegeln();

    expect(gespeichert.finalsConfig?.tiebreakerByRound?.semifinal).toBe('shootout');
    expect(gespeichert.finalsConfig?.tiebreakerByRound?.final).toBe('overtime-then-shootout');
  });

  it('die Cockpit-Ermittlung liefert im Halbfinale das Schießen und im Finale zuerst die Verlängerung', () => {
    const gespeichert = speichereMitRundenRegeln();

    expect(resolveTiebreakMode(gespeichert.finalsConfig, 'semifinal')).toBe('shootout');
    expect(resolveTiebreakMode(gespeichert.finalsConfig, 'final')).toBe('overtime-then-shootout');
  });

  it('Gegenbeispiel: Gruppenspiel unentschieden → keine Entscheidung', () => {
    const gespeichert = speichereMitRundenRegeln();

    expect(resolveTiebreakMode(gespeichert.finalsConfig, null)).toBeUndefined();
  });
});
