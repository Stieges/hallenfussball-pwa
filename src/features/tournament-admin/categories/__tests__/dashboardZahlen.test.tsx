/**
 * Admin-Center-Dashboard zeigt richtige Zahlen (@OB-069, C-ADMIN-DASHBOARD-ZAHLEN).
 * Szenario: docs/anforderungen/2026-10-02_oberflaeche.md. Jeder gegen jeden mit 4 Teams, Spiel 1 beendet 1:0,
 * Spiel 2 läuft und steht 2:1 -> 1 Gruppe, 1 Tor aus beendeten Spielen, Schnitt 1,0 je beendetem Spiel.
 * Aber: ist noch kein Spiel beendet, steht kein Schnitt da (nicht „0,0“, keine Division durch null).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../../types/tournament';
import { initRealDeI18n } from '../../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

import { DashboardCategory } from '../Dashboard';

function jgj(spiele: object[], extra: object = {}): Tournament {
  return {
    id: 't1', title: 'Hallencup', status: 'published', groupSystem: 'roundRobin', numberOfGroups: 2,
    numberOfFields: 1, fields: [], groups: [], location: { name: 'Halle' }, createdAt: '2026-10-01T10:00:00.000Z',
    teams: ['A', 'B', 'C', 'D'].map((name, i) => ({ id: `t${i}`, name })),
    matches: spiele.map((m, i) => ({ id: `m${i}`, round: 1, field: 1, slot: i + 1, teamA: 'A', teamB: 'B', ...m })),
    ...extra,
  } as unknown as Tournament;
}

function zeige(t: Tournament) {
  render(<MemoryRouter><DashboardCategory tournamentId="t1" tournament={t} onTournamentUpdate={vi.fn()} /></MemoryRouter>);
}

const BEENDET_1_0 = { matchStatus: 'finished', scoreA: 1, scoreB: 0 };
const LAUFEND_2_1 = { matchStatus: 'running', scoreA: 2, scoreB: 1 };

describe('Dashboard: richtige Zahlen (@OB-069, C-ADMIN-DASHBOARD-ZAHLEN)', () => {
  it('@OB-069 Jeder gegen jeden mit 4 Teams zeigt 1 Gruppe, nicht 2', () => {
    zeige(jgj([BEENDET_1_0, LAUFEND_2_1]));
    expect(screen.getByText('1 Gruppe')).toBeTruthy();
    expect(screen.queryByText(/2 Gruppen/)).toBeNull();
  });

  it('@OB-069 Tore zählen nur beendete Spiele: 1 Tor, Schnitt 1,0 je beendetem Spiel', () => {
    zeige(jgj([BEENDET_1_0, LAUFEND_2_1]));
    const toreKarte = screen.getByText('Tore').parentElement!;
    expect(toreKarte.textContent).toContain('1');
    expect(toreKarte.textContent).not.toMatch(/\b4\b/);
    expect(toreKarte.textContent).toContain('Ø 1,0 pro Spiel');
  });

  it('@OB-069 Aber: ohne beendetes Spiel steht kein Schnitt da (weder „0,0“ noch „0“)', () => {
    zeige(jgj([LAUFEND_2_1, { matchStatus: 'scheduled' }]));
    const toreKarte = screen.getByText('Tore').parentElement!;
    expect(toreKarte.textContent).not.toMatch(/Ø/);
    expect(toreKarte.textContent).toContain('0');
  });

  it('@OB-069 Gegenbeispiel: bei Gruppen + Finalrunde mit 2 Gruppen bleibt „2 Gruppen“', () => {
    zeige(jgj([BEENDET_1_0], { groupSystem: 'groupsAndFinals', numberOfGroups: 2 }));
    expect(screen.getByText('2 Gruppen')).toBeTruthy();
  });
});
