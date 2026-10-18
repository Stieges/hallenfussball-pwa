/**
 * MS1 – Vereinskürzel an den Monitor-Folien (@ZM-087, @ZM-149) und Gegenbeispiel Zuschauer-Seite (@ZM-148).
 * Der volle Name steht nur noch dort, wo er laut Record gilt; am Monitor kürzt die Liste immer (Auslegung 16.10.).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Team, Tournament } from '../../../types/tournament';
import { LiveMatchDisplay } from '../../../components/monitor/LiveMatchDisplay';
import { NextMatchesSlide } from '../slides/NextMatchesSlide';
import { StandingsSlide } from '../slides/StandingsSlide';
import { ScheduleFieldSlide } from '../slides/ScheduleFieldSlide';
import { buildTournament, FIXTURE_MATCHES, FIXTURE_TEAMS, slide } from './monitorFixture';
import { buildLiveViewTournament, TEAM_IDS, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));

import { LiveViewScreen } from '../../../screens/LiveViewScreen';
import { RepositoryProvider } from '../../../core/contexts/RepositoryContext';
import { liveMatchOf, withView } from './monitorViewHelper';

const VOLL = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
const KUERZEL = 'SG FF Nordheim-Süd 1921';
const OHNE_LISTENWORT = 'Eintracht Oberweiler-Niederstetten 1919';
const INITIALEN = /GÜFÖ|SFNS/;

function mitName(name: string): Tournament {
  const teams: Team[] = FIXTURE_TEAMS.map(t => (t.id === 'team-mitte' ? { ...t, name } : t));
  return buildTournament({ teams });
}

describe('@ZM-087 Monitor-Folien zeigen das Vereinskürzel nach Liste', () => {
  it('Live-Folie (LiveMatchDisplay): „SG FF Nordheim-Süd 1921“, kein „…“, keine Initialen', () => {
    const t = mitName(VOLL);
    const match = t.matches.find(m => m.id === 'match-9');
    if (!match) { throw new Error('Fixture-Spiel fehlt'); }
    const { container } = render(<LiveMatchDisplay match={liveMatchOf(match, t)} />);
    expect(screen.getByText(KUERZEL)).toBeInTheDocument();
    expect(container.textContent).not.toContain('…');
    expect(container.textContent).not.toMatch(INITIALEN);
    expect(container.textContent).not.toContain(VOLL);
  });

  it('Nächste Spiele: „SG FF Nordheim-Süd 1921“ in der Zeile, kein „…“, keine Initialen', () => {
    const { container } = render(<NextMatchesSlide slide={slide('next-matches')} {...withView(mitName(VOLL))} theme="dark" style={{}} />);
    expect(screen.getAllByText(KUERZEL).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('…');
    expect(container.textContent).not.toMatch(INITIALEN);
    expect(container.textContent).not.toContain(VOLL);
  });

  it('Tabelle Gruppe B: „SG FF Nordheim-Süd 1921“ in der Namenszelle', () => {
    const { container } = render(<StandingsSlide slide={slide('standings', { groupId: 'B' })} tournament={mitName(VOLL)} theme="dark" style={{}} />);
    expect(screen.getByText(KUERZEL)).toBeInTheDocument();
    expect(container.textContent).not.toContain('…');
  });

  it('Spielplan Feld: Name gekürzt, jede Namenszelle trägt die Markierung data-teamname', () => {
    const { container } = render(<ScheduleFieldSlide slide={slide('schedule-field', { fieldId: 'field-1' })} {...withView(mitName(VOLL))} theme="dark" style={{}} />);
    expect(screen.getAllByText(KUERZEL).length).toBeGreaterThan(0);
    for (const el of Array.from(container.querySelectorAll('[data-teamname]'))) {
      expect(el.textContent).not.toContain(VOLL);
    }
  });

  it('Markierung: Nächste Spiele hat je Zeile zwei data-teamname-Zellen', () => {
    const { container } = render(<NextMatchesSlide slide={slide('next-matches')} {...withView(buildTournament())} theme="dark" style={{}} />);
    const zeilen = screen.getAllByTestId('monitor-match-row');
    expect(container.querySelectorAll('[data-teamname]')).toHaveLength(zeilen.length * 2);
  });
});

describe('@ZM-149 Gegenbeispiele am Monitor', () => {
  it.each([
    ['Eintracht ohne Listenwort', OHNE_LISTENWORT],
    ['Sportvereinigung (Listenwort nur als Teil)', 'Sportvereinigung Nordheim'],
  ])('Live-Folie: %s bleibt unverändert', (_titel, name) => {
    const t = mitName(name);
    const match = FIXTURE_MATCHES.find(m => m.id === 'match-9');
    if (!match) { throw new Error('Fixture-Spiel fehlt'); }
    render(<LiveMatchDisplay match={liveMatchOf(match, t)} />);
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it('Live-Folie: „Turn- und Sportverein Ost“ wird „TSV Ost“ (nicht „Turn- und SV Ost“)', () => {
    const t = mitName('Turn- und Sportverein Ost');
    const match = FIXTURE_MATCHES.find(m => m.id === 'match-9');
    if (!match) { throw new Error('Fixture-Spiel fehlt'); }
    render(<LiveMatchDisplay match={liveMatchOf(match, t)} />);
    expect(screen.getByText('TSV Ost')).toBeInTheDocument();
  });
});

describe('@ZM-148 Zuschauer-Seite zeigt den vollen Namen (Gegenbeispiel zu @ZM-087)', () => {
  beforeEach(() => {
    supabaseGet.mockReset();
    localGet.mockReset();
    localStorage.clear();
  });

  it('Zuschauer-Seite: voller Name, kein Vereinskürzel, kein „…“ im Namen', async () => {
    const basis = buildLiveViewTournament();
    const t: Tournament = {
      ...basis,
      teams: basis.teams.map(x => (x.id === TEAM_IDS.nord ? { ...x, name: VOLL } : x)),
    };
    supabaseGet.mockResolvedValue(t);
    localGet.mockResolvedValue(null);
    const { container } = render(
      <RepositoryProvider user={null}>
        <MemoryRouter initialEntries={[`/live/${SHARE_CODE}`]}>
          <LiveViewScreen shareCode={SHARE_CODE} />
        </MemoryRouter>
      </RepositoryProvider>,
    );
    await screen.findAllByRole('heading', { level: 1, name: t.title });
    expect(screen.getAllByText(new RegExp(VOLL)).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain(KUERZEL);
  });
});
