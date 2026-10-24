/**
 * B-04 Paket c — @W2A-008: Finalmodus wechseln behält die Entscheidungsregel.
 *
 * Gegeben die Entscheidung bei Unentschieden ist auf „Golden Goal“ eingestellt
 * Wenn die Turnierleitung den Finalmodus von „Top 4“ auf
 * „Halbfinale + Platzierungsspiele“ wechselt
 * Dann bleibt „Golden Goal“ eingestellt
 *
 * Echter Bedienweg: Oberfläche (Finalmodus + Entscheidungsregel) → gespeichertes
 * Turnier. Gegenbeispiel: Wechsel auf einen Modus ohne K.-o. → Regel wird nicht
 * angewendet, aber beim Zurückwechseln wieder angezeigt.
 *
 * UI-Ort: src/features/tournament-creation/components/FinalsConfiguration.tsx
 * (Finalmodus-Radios `finals-preset-*`, Entscheidungs-Radios `tiebreaker-*`).
 *
 * Mutation: Reset beim Moduswechsel wieder einbauen → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { FinalsConfiguration } from '../components/FinalsConfiguration';
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
  const api: WizardApi = useTournamentWizard(undefined, () => Promise.resolve(false));
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

function entwurf(): Tournament {
  fireEvent.click(screen.getByTestId('probe-create-draft'));
  const gespeichert = draftSpy.mock.calls[draftSpy.mock.calls.length - 1]?.[0];
  if (!gespeichert) {
    throw new Error('Entwurf wurde nicht erzeugt');
  }
  return gespeichert;
}

describe('B-04c @W2A-008 – Finalmodus wechseln behält die Entscheidungsregel', () => {
  it('„Golden Goal“ bleibt beim Wechsel von „Top 4“ auf „Halbfinale + Platzierungsspiele“ sichtbar und gespeichert', () => {
    draftSpy.mockClear();
    render(<Harness />);

    fireEvent.click(screen.getByTestId('finals-preset-top-4'));
    fireEvent.click(screen.getByTestId('tiebreaker-goldenGoal'));
    expect(screen.getByTestId('tiebreaker-goldenGoal')).toBeChecked();

    fireEvent.click(screen.getByTestId('finals-preset-all-places'));

    expect(screen.getByTestId('tiebreaker-goldenGoal')).toBeChecked();
    expect(entwurf().finalsConfig?.tiebreaker).toBe('goldenGoal');
  });

  it('Gegenbeispiel: Modus ohne K.-o. zeigt die Regel nicht an, beim Zurückwechseln wieder — und sie bleibt gespeichert', () => {
    draftSpy.mockClear();
    render(<Harness />);

    fireEvent.click(screen.getByTestId('finals-preset-top-4'));
    fireEvent.click(screen.getByTestId('tiebreaker-goldenGoal'));

    fireEvent.click(screen.getByTestId('finals-preset-none'));
    expect(screen.queryByTestId('tiebreaker-goldenGoal')).toBeNull();
    expect(entwurf().finalsConfig?.tiebreaker).toBe('goldenGoal');

    fireEvent.click(screen.getByTestId('finals-preset-top-4'));
    expect(screen.getByTestId('tiebreaker-goldenGoal')).toBeChecked();
    expect(entwurf().finalsConfig?.tiebreaker).toBe('goldenGoal');
  });
});
