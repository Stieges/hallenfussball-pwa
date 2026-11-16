/**
 * Mannschaften des Veranstalters im Assistenten (Record wizard-zeitrahmen-fairness):
 * @W4-034 markieren, Übersicht nennt sie, Wahl erst ab zwei, bei einer nur der Hinweis;
 * @W4-033 / @W4-048 Wahl der drei Arten; @W4-041 keine Wahl ohne Runden-Spielplan; @W4-044 gelöschte Mannschaft;
 * @W4-050 Übersicht nennt die Folgen. Echte deutsche Texte, echter Generator.
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Team, Tournament } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { TournamentCreationService } from '../../../core/services/TournamentCreationService';
import { generateFullSchedule } from '../../../core/generators';
import { matchSideTeamId } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

import { Step4_Teams } from '../Step4_Teams';
import { Step5_Overview } from '../Step5_Overview';
import { hasStructuralChanges } from '../utils/structuralChanges';

const NAMES = ['TSV Petting', 'SV Kirchanschöring', 'TSV Palling', 'DJK Otting', 'TSV Waging 1', 'TSV Waging 2'];
const TEAMS: Team[] = NAMES.map((name, i) => ({ id: testUuid(i + 1), name }));
const [W1, W2] = [TEAMS[4].id, TEAMS[5].id];

function draft(overrides: Partial<Tournament> = {}): Tournament {
  return new TournamentCreationService({} as never).createDraft({
    title: 'G-Jugend', ageClass: 'G', teams: TEAMS, numberOfTeams: 6, numberOfFields: 1, groupSystem: 'roundRobin',
    date: '2026-11-28', startTime: '10:00', groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, location: { name: 'Halle' },
    ...overrides,
  });
}

/** Schritt „Teams“ mit echtem Zustand, wie ihn der Assistent hält. */
function Zustand({ start, onChange }: { start: Tournament; onChange?: (t: Tournament) => void }): React.ReactElement {
  const [formData, setFormData] = useState<Tournament>(start);
  const update = <K extends keyof Tournament>(field: K, value: Tournament[K]): void => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    onChange?.(next);
  };
  return <Step4_Teams formData={formData} onUpdate={update} onAddTeam={vi.fn()} onRemoveTeam={vi.fn()} onUpdateTeam={vi.fn()} />;
}

const box = (id: string): HTMLInputElement => screen.getByTestId(`wizard-host-team-${id}`);

describe('@W4-034 Mannschaften des Veranstalters werden beim Anlegen markiert', () => {
  it('jedes Team hat ein Ankreuzfeld „Mannschaft des Veranstalters“, anfangs nicht markiert', () => {
    render(<Zustand start={draft()} />);

    for (const team of TEAMS) { expect(box(team.id).checked).toBe(false); }
    expect(screen.getAllByText('Mannschaft des Veranstalters')).toHaveLength(6);
    expect(screen.queryByTestId('wizard-host-hint')).toBeNull();
    expect(screen.queryByTestId('wizard-host-choice')).toBeNull();
  });

  it('Ankreuzen markiert die Mannschaft und schreibt sie in den Entwurf', () => {
    let last: Tournament | undefined;
    render(<Zustand start={draft()} onChange={(t) => { last = t; }} />);

    fireEvent.click(box(W1));

    expect(box(W1).checked).toBe(true);
    expect(last?.hostTeamIds).toEqual([W1]);
  });

  it('bei genau einer markierten Mannschaft nur der Hinweis, keine Wahl', () => {
    render(<Zustand start={draft()} />);
    fireEvent.click(box(W1));

    expect(screen.getByTestId('wizard-host-hint').textContent).toContain('TSV Waging 1 bestreitet das erste Spiel als Heimmannschaft');
    expect(screen.queryByTestId('wizard-host-choice')).toBeNull();
  });

  it('die Wahl erscheint erst bei der zweiten Markierung, mit drei Arten und der Voreinstellung „Veranstalter gegen einen Gast“', () => {
    render(<Zustand start={draft()} />);
    fireEvent.click(box(W1));
    expect(screen.queryByTestId('wizard-host-choice')).toBeNull();
    fireEvent.click(box(W2));

    const choice = screen.getByTestId('wizard-host-choice');
    expect(within(choice).getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByTestId('wizard-opening-guest-opening')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('wizard-opening-club-derby')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('wizard-opening-both-home')).toHaveAttribute('aria-checked', 'false');
    expect(within(choice).getByText('Beide beginnen als Heim')).toBeInTheDocument();
    expect(within(choice).getByText('Vereinsduell eröffnet')).toBeInTheDocument();
    expect(within(choice).getByText('Veranstalter gegen einen Gast, Vereinsduell in Runde 2')).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-host-hint')).toBeNull();
  });

  it('@W4-048: „Beide beginnen als Heim“ lässt sich wählen und wird in den Entwurf geschrieben', () => {
    let last: Tournament | undefined;
    render(<Zustand start={draft()} onChange={(t) => { last = t; }} />);
    fireEvent.click(box(W1));
    fireEvent.click(box(W2));

    fireEvent.click(screen.getByTestId('wizard-opening-both-home'));

    expect(last?.openingMode).toBe('both-home');
    expect(screen.getByTestId('wizard-opening-both-home')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('wizard-opening-guest-opening')).toHaveAttribute('aria-checked', 'false');
  });

  it('@W4-044: wird eine von zwei Markierten gelöscht, verschwindet die Wahl und der Hinweis nennt die andere', () => {
    const entfernt = draft({ hostTeamIds: [W1, W2], teams: TEAMS.map((t) => (t.id === W2 ? { ...t, isRemoved: true } : t)) });
    render(<Zustand start={entfernt} />);

    expect(screen.queryByTestId('wizard-host-choice')).toBeNull();
    expect(screen.getByTestId('wizard-host-hint').textContent).toContain('TSV Waging 1');
    expect(screen.getByTestId('wizard-host-hint').textContent).not.toContain('Waging 2');
  });

  it('@W4-041 Gegenbeispiel: auf 2 Feldern gibt es keine Wahl, nur der Hinweis „eine der beiden“', () => {
    render(<Zustand start={draft({ numberOfFields: 2, hostTeamIds: [W1, W2] })} />);

    expect(screen.queryByTestId('wizard-host-choice')).toBeNull();
    expect(screen.getByTestId('wizard-host-hint').textContent).toContain('Eine der markierten Mannschaften');
  });

  it('Entmarkieren löst die Markierung wieder', () => {
    render(<Zustand start={draft({ hostTeamIds: [W1, W2] })} />);
    fireEvent.click(box(W2));

    expect(box(W2).checked).toBe(false);
    expect(screen.queryByTestId('wizard-host-choice')).toBeNull();
  });
});

function uebersicht(t: Tournament): void {
  render(<Step5_Overview formData={t} onSave={vi.fn()} createDraft={() => t} />);
}

function nummerDesDuells(t: Tournament): number {
  const reihe = generateFullSchedule(t).allMatches;
  return reihe.findIndex((m) => [matchSideTeamId(m, 'A'), matchSideTeamId(m, 'B')].every((id) => id === W1 || id === W2)) + 1;
}

describe('@W4-034 / @W4-048 / @W4-050 Die Übersicht vor dem Fertigstellen', () => {
  it('nennt die markierten Mannschaften', () => {
    uebersicht(draft({ hostTeamIds: [W1, W2] }));

    expect(screen.getByTestId('host-summary-teams').textContent).toBe('TSV Waging 1, TSV Waging 2');
  });

  it('ohne Markierung gibt es keinen Abschnitt (Gegenbeispiel)', () => {
    uebersicht(draft());

    expect(screen.queryByTestId('step5-host')).toBeNull();
  });

  it('bei einer Markierten nennt sie nur den Namen, keine Art und keine Folgen', () => {
    uebersicht(draft({ hostTeamIds: [W1] }));

    expect(screen.getByTestId('host-summary-teams').textContent).toBe('TSV Waging 1');
    expect(screen.queryByTestId('host-summary-mode')).toBeNull();
    expect(screen.queryByTestId('host-summary-follows')).toBeNull();
  });

  it('@W4-048: bei „Beide beginnen als Heim“ nennt sie die Art und das Spiel des Vereinsduells', () => {
    const t = draft({ hostTeamIds: [W1, W2], openingMode: 'both-home' });
    uebersicht(t);

    expect(screen.getByTestId('host-summary-mode').textContent).toBe('Eröffnung: Beide beginnen als Heim');
    const nummer = nummerDesDuells(t);
    expect(nummer).toBeGreaterThan(2);
    expect(screen.getByTestId('host-summary-duel').textContent).toBe(`Das Vereinsduell ist Spiel ${nummer}.`);
  });

  it('Gegenbeispiel: bei „Veranstalter gegen einen Gast“ keine Zeile zum Spiel des Vereinsduells', () => {
    uebersicht(draft({ hostTeamIds: [W1, W2] }));

    expect(screen.getByTestId('host-summary-mode').textContent).toBe('Eröffnung: Veranstalter gegen einen Gast, Vereinsduell in Runde 2');
    expect(screen.queryByTestId('host-summary-duel')).toBeNull();
  });

  it('@W4-050: nennt die verbleibende Zahl der Folgen in einem Satz', () => {
    uebersicht(draft({ hostTeamIds: [W1, W2], openingMode: 'both-home' }));

    expect(screen.getByTestId('host-summary-follows').textContent).toMatch(/noch \d+ Mal direkt auf ein Spiel der anderen|noch einmal direkt|nie direkt nacheinander/);
  });
});

describe('@W4-049 Markierung und Eröffnung zählen als Änderung, die eine Neuplanung braucht', () => {
  it('Markieren ändert die Struktur, Gleiches nicht (Gegenbeispiel)', () => {
    const vorher = draft();
    expect(hasStructuralChanges(vorher, draft({ hostTeamIds: [W1] }))).toBe(true);
    expect(hasStructuralChanges(draft({ hostTeamIds: [W1] }), draft({ hostTeamIds: [W1] }))).toBe(false);
    expect(hasStructuralChanges(vorher, draft())).toBe(false);
  });

  it('die Art der Eröffnung ändert die Struktur', () => {
    const a = draft({ hostTeamIds: [W1, W2] });
    expect(hasStructuralChanges(a, draft({ hostTeamIds: [W1, W2], openingMode: 'both-home' }))).toBe(true);
  });

  it('eine Markierung eines gelöschten Teams zählt nicht', () => {
    const geloescht = draft({ hostTeamIds: ['gibt-es-nicht'] });
    expect(hasStructuralChanges(draft(), geloescht)).toBe(false);
  });
});
