/**
 * @W5-038 — Einstellungen und Feld-Management zeigen die Werte des Turniers (Nikolaus-Turnier:
 * eine Gruppe, Jeder gegen jeden, Feld 1; kein interner Begriff wie „classic“).
 * Szenario: docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../auth/hooks/useTournamentMembers', () => ({ useTournamentMembers: () => ({ myMembership: null, isLoading: false }) }));

vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({ tournaments: [], loading: false, saveTournament: vi.fn() }),
}));

import { SettingsTab } from '../SettingsTab';
import { FieldManagement } from '../FieldManagement';

function nikolaus(overrides: Partial<Tournament> = {}, matchStatus = 'scheduled'): Tournament {
  return {
    id: 't1', title: 'Nikolaus-Turnier', status: 'published',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }],
    matches: [{ id: 'm1', field: 1, matchStatus }, { id: 'm2', field: 1, matchStatus }],
    numberOfTeams: 4, numberOfGroups: 2, numberOfFields: 1,
    groupSystem: 'roundRobin', mode: 'classic', tournamentType: 'classic',
    startDate: '2026-12-06', startTime: '10:00', ageClass: 'U11',
    location: { name: 'Halle Süd', city: 'Musterstadt' }, placementLogic: [],
    ...overrides,
  } as unknown as Tournament;
}

function renderSettings(tournament: Tournament): HTMLElement {
  const { container } = render(<SettingsTab tournament={tournament} onTournamentUpdate={vi.fn()} onEditInWizard={vi.fn()} />);
  fireEvent.click(screen.getByRole('heading', { level: 2 }));
  return container;
}

describe('@W5-038 Einstellungen zeigen die Werte des Turniers', () => {
  it('Nikolaus: 1 Gruppe, Jeder gegen jeden, Feld 1, nirgends „classic“', () => {
    const container = renderSettings(nikolaus());
    expect(screen.getByText('Anzahl Gruppen (1)')).toBeInTheDocument();
    expect(screen.getByText('Spielsystem (Jeder gegen jeden)')).toBeInTheDocument();
    expect(screen.getByText('Anzahl Felder (1)')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/classic/i);
  });

  it('Gegenbeispiel: 2 Gruppen + Finalrunde bleibt 2 Gruppen, „Gruppen + Finale“', () => {
    renderSettings(nikolaus({ groupSystem: 'groupsAndFinals', numberOfGroups: 2 }));
    expect(screen.getByText('Anzahl Gruppen (2)')).toBeInTheDocument();
    expect(screen.getByText('Spielsystem (Gruppen + Finale)')).toBeInTheDocument();
  });

  it('Felder: gespeichertes numberOfFields 0, Spiele auf Feld 1 → Anzahl Felder (1)', () => {
    renderSettings(nikolaus({ numberOfFields: 0 }));
    expect(screen.getByText('Anzahl Felder (1)')).toBeInTheDocument();
  });

  it('Erklärtext: vor dem Anpfiff ohne Recht neutral, nach dem Anpfiff „seit dem ersten Anpfiff fest“', () => {
    renderSettings(nikolaus({}, 'running'));
    expect(screen.getByText(/seit dem ersten Anpfiff fest/)).toBeInTheDocument();
    expect(screen.queryByText(/nach Veröffentlichung/)).not.toBeInTheDocument();
  });
});

describe('@W5-038 Feld-Management zeigt die Felder des Turniers', () => {
  it('Nikolaus ohne gespeicherte Feldliste: Feld 1 statt „Keine Felder“', () => {
    render(<FieldManagement tournament={nikolaus()} onTournamentUpdate={vi.fn()} />);
    expect(screen.getByText('Feld 1')).toBeInTheDocument();
    expect(screen.getByText('1 Feld')).toBeInTheDocument();
    expect(screen.queryByText(/Keine Felder/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wizard/)).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: ohne Feldliste und ohne Spiele bleibt der Leerzustand', () => {
    render(<FieldManagement tournament={nikolaus({ matches: [], numberOfFields: 0 })} onTournamentUpdate={vi.fn()} />);
    expect(screen.getByText('Keine Felder vorhanden')).toBeInTheDocument();
  });
});
