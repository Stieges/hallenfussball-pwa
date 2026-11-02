/**
 * Admin-Dashboard und Aktivitätslog – A-04a: Spielseiten über slotLabel (@TM-015).
 * Offene Seite zeigt ihre Herkunft; Gegenbeispiel: nach Umbenennen der neue Name, nie „ALT“ aus dem Übergangsfeld.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18next from 'i18next';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../../types/tournament';
import { teamSlot, pendingSlot } from '../../../../core/models/matchSlot';
import { testUuid } from '../../../../test/testIds';
import { DashboardCategory } from '../Dashboard';
import { ActivityLogCategory } from '../ActivityLog';

vi.mock('i18next', async () => {
  const actual = await vi.importActual<typeof import('i18next')>('i18next');
  const de = (await import('../../../../i18n/locales/de/tournament.json')).default;
  const sport = (await import('../../../../i18n/locales/de/sport.json')).default;
  const instance = actual.default.createInstance();
  await instance.init({ lng: 'de', fallbackLng: false, resources: { de: { tournament: de, sport } }, interpolation: { escapeValue: false } });
  return { default: instance };
});

// Das Wort zwischen den Teams („gegen“, @OB-076) kommt über `useTranslation('sport')` aus der Sprachdatei: dafür die echte
// Übersetzung; alle anderen Namensräume bleiben beim Durchreichen der Schlüssel wie im globalen Mock.
vi.mock('react-i18next', async () => {
  const i18n = (await import('i18next')).default;
  return {
    useTranslation: (ns?: string) => ({
      t: (key: string) => (ns === 'sport' ? (i18n.t as (k: string, o: { ns: string }) => string)(key, { ns }) : `${ns ? `${ns}:` : ''}${key}`),
      i18n: { language: 'de' },
    }),
    Trans: ({ children }: { children: unknown }) => children,
    I18nextProvider: ({ children }: { children: unknown }) => children,
    initReactI18next: { type: '3rdParty', init: () => undefined },
  };
});

const NORD = testUuid(1);

beforeEach(async () => { await i18next.changeLanguage('de'); });

function tournamentWith(teamName: string, matchPatch: object): Tournament {
  return {
    id: 't1', title: 'Hallencup', status: 'published', numberOfFields: 1, fields: [], groups: [],
    location: { name: 'Halle' },
    createdAt: '2026-10-01T10:00:00.000Z',
    teams: [{ id: NORD, name: teamName }],
    matches: [{
      id: testUuid(101), round: 1, field: 1, teamA: 'ALT', teamB: 'ALT', slot: 1,
      slotA: teamSlot(NORD), slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }),
      ...matchPatch,
    }],
  } as unknown as Tournament;
}

describe('DashboardCategory – Spielseiten über slotLabel', () => {
  const renderDashboard = (tournament: Tournament) => render(
    <MemoryRouter><DashboardCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} /></MemoryRouter>,
  );

  it('@TM-015 nächstes Spiel: Team über die Team-ID, offene Seite über ihre Herkunft', () => {
    renderDashboard(tournamentWith('FC Nord', { matchStatus: 'scheduled' }));
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    expect(screen.getByText('Zweiter Gruppe B')).toBeInTheDocument();
  });

  it('@TM-015 laufendes Spiel: „FC Nord gegen Zweiter Gruppe B“; Gegenbeispiel: nach Umbenennen der neue Name, kein „ALT“', () => {
    renderDashboard(tournamentWith('Nordlicht', { matchStatus: 'running' }));
    expect(screen.getByText(/Nordlicht gegen Zweiter Gruppe B/)).toBeInTheDocument();
    expect(screen.queryByText(/ALT/)).toBeNull();
  });
});

describe('ActivityLogCategory – Spielseiten über slotLabel', () => {
  it('@TM-015 Eintrag „Spiel beendet“ nennt die Paarung über slotLabel', () => {
    const tournament = tournamentWith('Nordlicht', {
      matchStatus: 'finished', finishedAt: '2026-10-03T10:00:00.000Z', scoreA: 1, scoreB: 0,
    });
    render(<ActivityLogCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />);
    expect(screen.getAllByText(/Nordlicht gegen Zweiter Gruppe B/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/ALT/)).toBeNull();
  });
});
