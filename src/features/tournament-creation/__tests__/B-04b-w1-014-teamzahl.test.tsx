/**
 * B-04 Paket b — @W1-014: Keine Sackgasse bei abweichender Teamzahl.
 *
 * Gegeben im Schnellstart sind 8 Teams angegeben
 * Wenn die Turnierleitung ein neuntes Team einträgt
 * Dann passt sich die Teamzahl an oder die App bietet das Anpassen an derselben Stelle an
 * Und kein Zurückgehen in einen anderen Schritt ist nötig
 *
 * Echter Bedienweg: Wizard (Teams-Schritt, Schritt 5) mit echtem
 * useTournamentWizard (nur useRepository gemockt) + echtem Step4_Teams.
 * UI-Ort: src/features/tournament-creation/Step4_Teams.tsx — Meldung
 * `wizard-team-count-mismatch` mit Angebot `wizard-adjust-team-count`.
 *
 * Gegenbeispiel: Team entfernen bei 8 → ebenfalls kein Sackgasse.
 * Mutation: Angebot „Teamzahl anpassen" entfernen → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, screen, fireEvent } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import type { Team, Tournament } from '../../../types/tournament';
import { Step4_Teams } from '../Step4_Teams';

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  }),
}));

const teams8 = (): Team[] =>
  Array.from({ length: 8 }, (_, index) => ({ id: `t${index + 1}`, name: `Team ${index + 1}` }));

const existingTournament = (): Tournament =>
  ({
    id: 'turnier-1',
    title: 'Schnellstart Cup',
    date: '2030-01-01',
    location: { name: 'Halle' },
    numberOfTeams: 8,
    numberOfGroups: 2,
    groupSystem: 'roundRobin',
    teams: teams8(),
    matches: [],
    status: 'draft',
    lastVisitedStep: 5,
  }) as unknown as Tournament;

function setup() {
  const wizard = renderHook(() => useTournamentWizard(existingTournament()));
  const stepProps = () => ({
    formData: wizard.result.current.formData,
    onUpdate: wizard.result.current.updateForm,
    onAddTeam: wizard.result.current.addTeam,
    onRemoveTeam: wizard.result.current.removeTeam,
    onUpdateTeam: wizard.result.current.updateTeam,
  });
  const view = render(<Step4_Teams {...stepProps()} />);
  const sync = () => view.rerender(<Step4_Teams {...stepProps()} />);
  return { wizard, sync };
}

describe('B-04b @W1-014 – Keine Sackgasse bei abweichender Teamzahl', () => {
  it('neuntes Team: „Teamzahl anpassen" an derselben Stelle, danach Weiter ohne Rückschritt', () => {
    const { wizard, sync } = setup();

    fireEvent.click(screen.getByTestId('wizard-add-team'));
    sync();

    expect(wizard.result.current.formData.teams).toHaveLength(9);
    const mismatch = screen.getByTestId('wizard-team-count-mismatch');
    const adjust = screen.getByTestId('wizard-adjust-team-count');
    expect(mismatch).toContainElement(adjust);

    fireEvent.click(adjust);
    sync();

    expect(wizard.result.current.formData.numberOfTeams).toBe(9);
    expect(screen.queryByTestId('wizard-team-count-mismatch')).not.toBeInTheDocument();
    expect(wizard.result.current.step).toBe(5);
    expect(wizard.result.current.canGoNext()).toBe(true);
  });

  it('Gegenbeispiel: Team bei 8 entfernen → ebenfalls Angebot, danach Weiter möglich', () => {
    const { wizard, sync } = setup();

    fireEvent.click(screen.getByTestId('wizard-remove-team-t8'));
    sync();

    expect(wizard.result.current.formData.teams).toHaveLength(7);
    const mismatch = screen.getByTestId('wizard-team-count-mismatch');
    const adjust = screen.getByTestId('wizard-adjust-team-count');
    expect(mismatch).toContainElement(adjust);

    fireEvent.click(adjust);
    sync();

    expect(wizard.result.current.formData.numberOfTeams).toBe(7);
    expect(wizard.result.current.step).toBe(5);
    expect(wizard.result.current.canGoNext()).toBe(true);
  });
});
