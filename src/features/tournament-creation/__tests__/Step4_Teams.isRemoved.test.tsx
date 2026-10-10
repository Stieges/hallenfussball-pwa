import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Team, Tournament } from '../../../types/tournament';
import { Step4_Teams } from '../Step4_Teams';

const teams: Team[] = [
  { id: '1', name: 'A' },
  { id: '2', name: 'Rot' },
  { id: '3', name: 'Rot', isRemoved: true },
  { id: '4', name: 'B' },
];

const formData = {
  teams,
  numberOfTeams: 3,
  numberOfGroups: 1,
  groupSystem: 'roundRobin',
} as unknown as Tournament;

const noop = vi.fn();

describe('Step4_Teams – isRemoved-Filter (Zähler, Duplikatprüfung)', () => {
  it('B-02 – entferntes Team erscheint nicht und löst keinen Dubletten-Fehler aus', () => {
    render(
      <Step4_Teams
        formData={formData}
        onUpdate={noop}
        onAddTeam={noop}
        onRemoveTeam={noop}
        onUpdateTeam={noop}
      />
    );

    expect(screen.getByDisplayValue('A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('B')).toBeInTheDocument();
    // nur EIN aktives „Rot" – das isRemoved-Team wird nicht gerendert
    expect(screen.getAllByDisplayValue('Rot')).toHaveLength(1);
    expect(screen.queryByText('step4.duplicateName')).not.toBeInTheDocument();

    // Zähler: 3 aktive Teams statt 4 Einträge
    expect(screen.getByText(/step4\.teamsAdded/)).toBeInTheDocument();
  });
});
