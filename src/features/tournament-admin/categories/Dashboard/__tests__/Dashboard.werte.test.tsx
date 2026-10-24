/** @W5-038 / C-ADMIN-DASHBOARD-ZAHLEN — Dashboard und Struktur-Info zeigen die Werte des Turniers. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { initRealDeI18n } from '../../../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../../../../components/LocationForm', () => ({ LocationForm: () => null }));

import { DashboardCategory } from '../index';
import { MetadataCategory } from '../../Metadata';

function nikolaus(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1', title: 'Nikolaus-Turnier', status: 'published', ageClass: 'U11',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }],
    matches: [{ id: 'm1', field: 1, matchStatus: 'scheduled', slot: 0 }],
    numberOfTeams: 4, numberOfGroups: 2, numberOfFields: 1, groupSystem: 'roundRobin', mode: 'classic', tournamentType: 'classic',
    startDate: '2026-12-06', startTime: '10:00', location: { name: 'Halle', city: 'Ort' }, placementLogic: [],
    ...overrides,
  } as unknown as Tournament;
}

function valueNextTo(label: string): string | null {
  return screen.getByText(label).parentElement?.querySelector('span:last-child, div:last-child')?.textContent ?? null;
}

describe('Dashboard „Felder“ (@W5-038)', () => {
  function dashboard(t: Tournament) {
    render(<DashboardCategory tournamentId="t1" tournament={t} onTournamentUpdate={vi.fn()} />);
    fireEvent.click(screen.getByText('Turnier-Info'));
  }
  it('Nikolaus: 1 Feld; Jeder gegen jeden 1 Gruppe', () => {
    dashboard(nikolaus());
    expect(screen.getByText('1 Gruppe')).toBeInTheDocument();
    expect(valueNextTo('Felder')).toBe('1');
  });
  it('Gegenbeispiel: gespeichert 0 Felder, Spiele auf Feld 1 → 1; zwei Felder → 2', () => {
    dashboard(nikolaus({ numberOfFields: 0 }));
    expect(valueNextTo('Felder')).toBe('1');
  });
  it('Gegenbeispiel: 2 Felder bleiben 2', () => {
    dashboard(nikolaus({ numberOfFields: 2 }));
    expect(valueNextTo('Felder')).toBe('2');
  });
});

describe('Struktur-Info im Admin Center (@W5-038)', () => {
  it('Nikolaus: 1 Gruppe statt der gespeicherten 2, 1 Feld', () => {
    render(<MetadataCategory tournamentId="t1" tournament={nikolaus({ numberOfFields: 0 })} onTournamentUpdate={vi.fn()} />);
    fireEvent.click(screen.getByText('Struktur-Info (gesperrt)'));
    expect(screen.getByText('Anzahl Gruppen').nextElementSibling?.textContent).toBe('1');
    expect(screen.getByText('Anzahl Felder').nextElementSibling?.textContent).toBe('1');
  });
  it('Gegenbeispiel: Gruppen + Finale mit 2 Gruppen bleibt 2', () => {
    render(<MetadataCategory tournamentId="t1" tournament={nikolaus({ groupSystem: 'groupsAndFinals' })} onTournamentUpdate={vi.fn()} />);
    fireEvent.click(screen.getByText('Struktur-Info (gesperrt)'));
    expect(screen.getByText('Anzahl Gruppen').nextElementSibling?.textContent).toBe('2');
  });
});
