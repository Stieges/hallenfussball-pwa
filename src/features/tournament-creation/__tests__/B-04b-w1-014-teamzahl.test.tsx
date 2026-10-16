/**
 * B-04b Fixrunde 1 — @W1-014: entfernte Teams und Gruppen.
 *
 * Gegeben im Schnellstart sind 8 Teams angelegt, ein Team hat ein Spiel mit
 * Ergebnis und wird entfernt (bleibt als isRemoved stehen)
 * Wenn die Turnierleitung „Teamzahl anpassen“ wählt
 * Dann ist das Weitergehen wieder möglich — ohne Rückschritt
 *
 * Und bei Gruppen (groupsAndFinals): ein neuntes Team ohne Gruppe sperrt das
 * Weitergehen („N Teams ohne Gruppe“), bis es über „Gruppen automatisch zuweisen“
 * an derselben Stelle eine Gruppe hat. Danach führt generateFullSchedule das
 * neunte Team in mindestens einem Spiel.
 *
 * Echter Bedienweg: Wizard (Teams-Schritt, Schritt 5) mit echtem
 * useTournamentWizard + echtem Step4_Teams + echtem generateFullSchedule.
 * UI-Ort: src/features/tournament-creation/Step4_Teams.tsx — „Teamzahl anpassen“
 * (`wizard-adjust-team-count`) und „Gruppen automatisch zuweisen“
 * (`wizard-auto-assign-groups`) im Remedie-Block `wizard-teams-without-group`.
 * Prüfung: TournamentCreationService.validateStep, Fall 5 (aktive Teams, F-209,
 * Teams ohne Gruppe).
 *
 * Gegenbeispiel: roundRobin mit neuntem Team verlangt keine Gruppenzuweisung
 * (Weiter direkt nach dem Anpassen).
 * Mutation: F-209 wieder auf `data.teams.length` → Fall (i) rot.
 * Gruppenprüfung entfernen → Fall (ii) rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, screen, fireEvent } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { generateFullSchedule } from '../../../core/generators';
import type { Team, Tournament } from '../../../types/tournament';
import { Step4_Teams } from '../Step4_Teams';
import { looseVs, testUuid } from '../../../test/matchSlotFixtures';

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  }),
}));

const teams8 = (): Team[] =>
  Array.from({ length: 8 }, (_, index) => ({ id: testUuid(index + 1), name: `Team ${index + 1}` }));

const teams8WithGroups = (): Team[] =>
  teams8().map((team, index) => ({ ...team, group: index % 2 === 0 ? 'A' : 'B' }));

const existingTournament = (overrides: Partial<Tournament> = {}): Tournament =>
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
    ...overrides,
  }) as unknown as Tournament;

function setup(tournament: Tournament) {
  const wizard = renderHook(() => useTournamentWizard(tournament));
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

describe('B-04b @W1-014 – entfernte Teams und Gruppen, keine Sackgasse', () => {
  it('(i) Team mit Ergebnis entfernen: „Teamzahl anpassen“, danach Weiter möglich', () => {
    const { wizard, sync } = setup(
      existingTournament({
        matches: [
          {
            id: 'm1',
            round: 1,
            field: 1,
            ...looseVs(testUuid(8), testUuid(1)),
            scoreA: 2,
            scoreB: 1,
          },
        ] as unknown as Tournament['matches'],
      })
    );

    fireEvent.click(screen.getByTestId(`wizard-remove-team-${testUuid(8)}`));
    sync();

    expect((wizard.result.current.formData.teams ?? []).find((team) => team.id === testUuid(8))?.isRemoved).toBe(true);
    const mismatch = screen.getByTestId('wizard-team-count-mismatch');
    const adjust = screen.getByTestId('wizard-adjust-team-count');
    expect(mismatch).toContainElement(adjust);

    fireEvent.click(adjust);
    sync();

    expect(wizard.result.current.formData.numberOfTeams).toBe(7);
    expect(wizard.result.current.step).toBe(5);
    expect(wizard.result.current.canGoNext()).toBe(true);
  });

  it('(ii) Gruppen: neuntes Team ohne Gruppe sperrt, bis „Gruppen automatisch zuweisen“ gewählt ist', () => {
    const { wizard, sync } = setup(
      existingTournament({
        groupSystem: 'groupsAndFinals',
        teams: teams8WithGroups(),
      })
    );

    fireEvent.click(screen.getByTestId('wizard-add-team'));
    sync();
    const ninthId = (wizard.result.current.formData.teams ?? []).find((team) => !team.group)?.id ?? '';
    expect(ninthId).not.toBe('');

    expect(screen.getByTestId('wizard-team-count-mismatch')).toContainElement(
      screen.getByTestId('wizard-adjust-team-count')
    );
    const remedy = screen.getByTestId('wizard-teams-without-group');
    expect(remedy).toContainElement(screen.getByTestId('wizard-auto-assign-groups'));

    fireEvent.click(screen.getByTestId('wizard-adjust-team-count'));
    sync();

    expect(wizard.result.current.formData.numberOfTeams).toBe(9);
    expect(wizard.result.current.canGoNext()).toBe(false);
    expect(wizard.result.current.validateStep(5).join(' ')).toMatch(/ohne Gruppe/);

    fireEvent.click(screen.getByTestId('wizard-auto-assign-groups'));
    sync();

    expect(screen.queryByTestId('wizard-teams-without-group')).not.toBeInTheDocument();
    expect(wizard.result.current.canGoNext()).toBe(true);

    const schedule = generateFullSchedule(wizard.result.current.createDraftTournament());
    const inSchedule = schedule.allMatches.some(
      (match) => match.originalTeamA === ninthId || match.originalTeamB === ninthId
    );
    expect(inSchedule).toBe(true);
  });

  it('Gegenbeispiel: roundRobin verlangt keine Gruppenzuweisung (Weiter direkt nach dem Anpassen)', () => {
    const { wizard, sync } = setup(existingTournament({ groupSystem: 'roundRobin' }));

    fireEvent.click(screen.getByTestId('wizard-add-team'));
    sync();
    expect(screen.queryByTestId('wizard-teams-without-group')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('wizard-adjust-team-count'));
    sync();

    expect(wizard.result.current.formData.numberOfTeams).toBe(9);
    expect(wizard.result.current.canGoNext()).toBe(true);
  });
});
