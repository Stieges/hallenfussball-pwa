/**
 * @ZM-221 Die Zuschauer-Seite erklärt, wie gewertet wird (docs/anforderungen/2026-10-02_zuschauer-und-monitor.md).
 * Beispielzeilen und Wortlaut aus dem Gherkin: Einzelheiten unter dem Turniernamen, Reiter „Tabellen“, ausgeschaltete Regel,
 * Kindermodus / Tabellen aus, zugeklappt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MatchView } from '../../../core/view';
import type { Tournament } from '../../../types/tournament';
import { PublicPageHeader, type PublicPageHeaderProps } from '../components/PublicPageHeader';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));
vi.mock('../defaultPublicSource', async () => {
  const { createLegacyPublicSource } = await import('../legacyPublicSource');
  return { defaultPublicTournamentSource: createLegacyPublicSource() };
});

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

import { LiveViewScreen } from '../../../screens/LiveViewScreen';
import { RepositoryProvider } from '../../../core/contexts/RepositoryContext';
import i18n from 'i18next';
import { wertungLines } from '../publicWertung';

const alle = [
  { id: 'points', enabled: true }, { id: 'directComparison', enabled: true },
  { id: 'goalDifference', enabled: true }, { id: 'goalsFor', enabled: true },
];
const ohneDirekt = alle.map((c) => (c.id === 'directComparison' ? { ...c, enabled: false } : c));
const t = i18n.getFixedT('de', 'publicView');
const f1 = { pointSystem: { win: 3, draw: 1, loss: 0 }, placementLogic: alle };

describe('@ZM-221 wertungLines (reine Rechnung)', () => {
  it('Standard F1: Sieg 3 · Unentschieden 1 · Niederlage 0 Punkte; Reihenfolge nummeriert und kurz', () => {
    const l = wertungLines(t, f1);
    expect(l.points).toBe('Wertung: Sieg 3 · Unentschieden 1 · Niederlage 0 Punkte');
    expect(l.tiebreakNumbered).toBe('Bei Punktgleichheit: 1. direkter Vergleich · 2. Tordifferenz · 3. mehr Tore');
    expect(l.tiebreakShort).toBe('Bei Punktgleichheit: direkter Vergleich, Tordifferenz, mehr Tore');
  });
  it('die Reihenfolge des Turniers gilt (Tordifferenz vor direktem Vergleich)', () => {
    const l = wertungLines(t, { ...f1, placementLogic: [alle[0], alle[2], alle[1], alle[3]] });
    expect(l.tiebreakNumbered).toBe('Bei Punktgleichheit: 1. Tordifferenz · 2. direkter Vergleich · 3. mehr Tore');
  });
  it('ausgeschaltete Regel fehlt in beiden Angaben, die Nummern rücken nach', () => {
    const l = wertungLines(t, { ...f1, placementLogic: ohneDirekt });
    expect(l.tiebreakNumbered).toBe('Bei Punktgleichheit: 1. Tordifferenz · 2. mehr Tore');
    expect(l.tiebreakShort).toBe('Bei Punktgleichheit: Tordifferenz, mehr Tore');
  });
  it('Einzahl: Niederlage 1 Punkt; Gegenprobe Mehrzahl bei 0 und 2', () => {
    expect(wertungLines(t, { ...f1, pointSystem: { win: 2, draw: 1, loss: 1 } }).points).toBe('Wertung: Sieg 2 · Unentschieden 1 · Niederlage 1 Punkt');
    expect(wertungLines(t, { ...f1, pointSystem: { win: 1, draw: 0, loss: 0 } }).points).toBe('Wertung: Sieg 1 · Unentschieden 0 · Niederlage 0 Punkte');
  });
  it('nur „Punkte“ eingeschaltet: keine Zeile zur Punktgleichheit', () => {
    const l = wertungLines(t, { ...f1, placementLogic: [alle[0]] });
    expect(l.tiebreakNumbered).toBeUndefined();
    expect(l.tiebreakShort).toBeUndefined();
  });
});

const spiel = (status: MatchView['status'], time: string): MatchView => ({ status, kickoff: { date: '2026-11-28', time } } as MatchView);
const kopf: PublicPageHeaderProps['tournament'] = {
  title: 'Nikolaus-Turnier', ageClass: 'F1-Junioren', date: '2026-11-28', groupPhaseGameDuration: 9,
  location: { name: 'Sporthalle Waging' }, organizer: 'TSV Waging',
  teams: Array.from({ length: 6 }, (_, i) => ({ id: `t${String(i)}`, name: `Team ${String(i)}` })),
  ...f1,
};
const zeige = (showScoring: boolean, tournament = kopf) =>
  render(<PublicPageHeader tournament={tournament} matches={[spiel('scheduled', '16:30')]} shareCode="NIKO26" ended={false} showScoring={showScoring} />);

const speicher = new Map<string, string>();
beforeEach(() => {
  speicher.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => { speicher.set(k, v); }, removeItem: (k: string) => { speicher.delete(k); } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('@ZM-221 Einzelheiten unter dem Turniernamen', () => {
  it('aufgeklappt: nach der Spielzeit „Wertung“ und „Bei Punktgleichheit“ mit Nummern', () => {
    zeige(true);
    const text = screen.getByTestId('public-head-details').textContent ?? '';
    expect(screen.getByTestId('public-head-scoring')).toHaveTextContent('Wertung: Sieg 3 · Unentschieden 1 · Niederlage 0 Punkte');
    expect(screen.getByTestId('public-head-tiebreak')).toHaveTextContent('Bei Punktgleichheit: 1. direkter Vergleich · 2. Tordifferenz · 3. mehr Tore');
    expect(text.indexOf('9 Minuten')).toBeLessThan(text.indexOf('Wertung:'));
  });
  it('ausgeschaltete Regel: Nummern rücken nach', () => {
    zeige(true, { ...kopf, placementLogic: ohneDirekt });
    expect(screen.getByTestId('public-head-tiebreak')).toHaveTextContent('Bei Punktgleichheit: 1. Tordifferenz · 2. mehr Tore');
  });
  it('Kindermodus oder Tabellen aus (showScoring=false): weder „Wertung“ noch „Bei Punktgleichheit“', () => {
    const { container } = zeige(false);
    expect(container.textContent).not.toContain('Wertung');
    expect(container.textContent).not.toContain('Bei Punktgleichheit');
  });
  it('zugeklappt (eigene Wahl): nichts Neues zwischen Kopf und Spielplan sichtbar', () => {
    speicher.set('live:NIKO26:headDetails', 'closed');
    zeige(true);
    expect(screen.getByTestId('public-head-details').style.display).toBe('none');
  });
});

function renderScreen(query = '') {
  return render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE_CODE}${query}`]}>
        <LiveViewScreen shareCode={SHARE_CODE} />
      </MemoryRouter>
    </RepositoryProvider>
  );
}
async function renderWith(tournament: Tournament, query = '') {
  supabaseGet.mockResolvedValue(tournament);
  localGet.mockResolvedValue(null);
  const view = renderScreen(query);
  await screen.findAllByRole('heading', { level: 1, name: tournament.title });
  return view;
}

describe('@ZM-221 Reiter „Tabellen“', () => {
  beforeEach(() => { supabaseGet.mockReset(); localGet.mockReset(); });

  it('unter jeder der zwei Tabellen steht die Zeile mit der Reihenfolge des Turniers', async () => {
    const turnier = buildLiveViewTournament();
    await renderWith({ ...turnier, placementLogic: alle }, '?tab=standings');
    const zeilen = screen.getAllByTestId('public-standings-tiebreak');
    expect(zeilen).toHaveLength(2);
    expect(zeilen[0]).toHaveTextContent('Bei Punktgleichheit: direkter Vergleich, Tordifferenz, mehr Tore');
  });
  it('ausgeschaltete Regel fehlt auch hier', async () => {
    await renderWith({ ...buildLiveViewTournament(), placementLogic: ohneDirekt }, '?tab=standings');
    expect(screen.getAllByTestId('public-standings-tiebreak')[0]).toHaveTextContent('Bei Punktgleichheit: Tordifferenz, mehr Tore');
  });
  it('Tabellen für Zuschauer ausgeblendet: keine Zeile, in den Einzelheiten keine Wertung', async () => {
    const { container } = await renderWith(buildLiveViewTournament({ hideRankingsForPublic: true }), '?tab=standings');
    expect(screen.queryByTestId('public-standings-tiebreak')).toBeNull();
    expect(container.textContent).not.toContain('Bei Punktgleichheit');
    expect(container.textContent).not.toContain('Wertung:');
  });
  it('Kindermodus: weder Wertung noch Punktgleichheit auf der Seite', async () => {
    const { container } = await renderWith(buildLiveViewTournament({ hideScoresForPublic: true }));
    expect(container.textContent).not.toContain('Bei Punktgleichheit');
    expect(container.textContent).not.toContain('Wertung:');
  });
});
