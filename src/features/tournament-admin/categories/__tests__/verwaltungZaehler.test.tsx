/**
 * Verwaltung zählt richtig: „ausstehend“ im Dashboard und „Spiele beendet“ im Activity Log
 * (@LZ-092, Befund C-VERWALTUNG-ZAEHLT-AUSSTEHEND-FALSCH, Usability-Durchgang 30.10.; Zähler des Spielplans/Tabelle als Maßstab).
 * Lage wie in der Beobachtung: 10 Spiele, 6 beendet (ohne Endzeit am Spiel), 1 läuft, 3 noch nicht begonnen
 * (Spiele ohne gespeicherten Status gelten als geplant, `Match.matchStatus` hat den Standard „scheduled“).
 * Gegenbeispiel: ein beendetes Spiel mit Endzeit wird nur einmal gezählt.
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
import { ActivityLogCategory } from '../ActivityLog';

function turnier(spiele: object[]): Tournament {
  return {
    id: 't1', title: 'Hallencup', status: 'published', groupSystem: 'roundRobin', numberOfGroups: 1,
    numberOfFields: 1, fields: [], groups: [], location: { name: 'Halle' }, createdAt: '2026-10-01T10:00:00.000Z',
    teams: ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({ id: `t${i}`, name })),
    matches: spiele.map((m, i) => ({ id: `m${i}`, round: 1, field: 1, slot: i + 1, teamA: 't0', teamB: 't1', ...m })),
  } as unknown as Tournament;
}

const BEENDET = { matchStatus: 'finished', scoreA: 1, scoreB: 0 };
const LAGE = turnier([
  ...Array.from({ length: 6 }, () => BEENDET),
  { matchStatus: 'running', scoreA: 0, scoreB: 0 },
  {}, {}, {},
]);

describe('@LZ-092 Dashboard: „ausstehend“ zählt die noch nicht begonnenen Spiele (C-VERWALTUNG-ZAEHLT-AUSSTEHEND-FALSCH)', () => {
  it('@LZ-092 6 beendet, 1 läuft, 3 ohne Status: „Spiele 6/10“ und „3 ausstehend“, nicht „0 ausstehend“', () => {
    render(<MemoryRouter><DashboardCategory tournamentId="t1" tournament={LAGE} onTournamentUpdate={vi.fn()} /></MemoryRouter>);
    const karte = screen.getByText('Spiele').parentElement!;
    expect(karte.textContent).toContain('6/10');
    expect(karte.textContent).toContain('3 ausstehend');
  });

  it('Gegenbeispiel: ausdrücklich „scheduled“ zählt genauso, ein laufendes Spiel zählt nicht mit', () => {
    const t = turnier([BEENDET, { matchStatus: 'running' }, { matchStatus: 'scheduled' }, {}]);
    render(<MemoryRouter><DashboardCategory tournamentId="t1" tournament={t} onTournamentUpdate={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('Spiele').parentElement!.textContent).toContain('2 ausstehend');
  });
});

describe('@LZ-092 Activity Log: „Spiele beendet“ zählt beendete Spiele auch ohne Endzeit (C-VERWALTUNG-ZAEHLT-AUSSTEHEND-FALSCH)', () => {
  it('@LZ-092 6 beendete Spiele ohne Endzeit: die Aktivitätsliste fasst „6 Spiele beendet“ zusammen, nicht „0“', () => {
    render(<ActivityLogCategory tournamentId="t1" tournament={LAGE} onTournamentUpdate={vi.fn()} />);
    // der Zähler steht in der Zusammenfassung über dem Etikett „Spiele beendet“ (das Filter-Etikett ist eine <option>)
    const etikett = screen.getAllByText('Spiele beendet').find((el) => el.tagName !== 'OPTION')!;
    expect(etikett.previousElementSibling!.textContent).toBe('6');
  });

  it('Gegenbeispiel: ein beendetes Spiel mit Endzeit wird nur einmal gezählt', () => {
    const t = turnier([{ ...BEENDET, finishedAt: '2026-10-03T10:00:00.000Z' }, {}]);
    render(<ActivityLogCategory tournamentId="t1" tournament={t} onTournamentUpdate={vi.fn()} />);
    const etikett = screen.getAllByText('Spiele beendet').find((el) => el.tagName !== 'OPTION')!;
    expect(etikett.previousElementSibling!.textContent).toBe('1');
  });
});
