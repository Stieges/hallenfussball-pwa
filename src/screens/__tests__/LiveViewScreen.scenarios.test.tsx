/**
 * Charakterisierung der Zuschauer-Seite (LiveViewScreen) über den gerenderten Screen.
 * Gemockt nur die Datenquellen (lib/supabase, Repository-Konstruktoren). Rest echt.
 * Heutiges Verhalten wird festgehalten; Soll-Verhalten, das heute verfehlt wird, als test.fails.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { generateFullSchedule } from '../../core/generators';
import type { ScheduledMatch } from '../../core/generators';
import type { Tournament } from '../../types/tournament';
import { buildLiveViewTournament, SHARE_CODE, TEAM_IDS } from './liveViewFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => { const q: Record<string, unknown> = { select: () => q, eq: () => q, limit: () => Promise.resolve({ data: [], error: null }) }; return q; }), rpc: vi.fn() },
}));
// Konstruktor-Mock als `function` (nicht Pfeil), damit `new SupabaseRepository()` funktioniert.
vi.mock('../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));
// Mit Supabase liest die Seite über die Server-Funktion (Adapter (b)), ohne Supabase über getByShareCode (Adapter (a)).
// Diese Datei prüft die Anzeige mit Daten aus den Repository-Mocks und legt deshalb den Weg ohne Supabase fest (Adapter (a)).
vi.mock('../../features/public-view/defaultPublicSource', async () => {
  const { createLegacyPublicSource } = await import('../../features/public-view/legacyPublicSource');
  return { defaultPublicTournamentSource: createLegacyPublicSource() };
});

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../test/realDeI18n')).initRealDeI18n();

const MY_TEAM_KEY = `live:${SHARE_CODE}:myTeam`;
const GROUP_B_TEAMS = ['VfL Mitte', 'FC Hafen', 'SV Berg', 'TuS Tal'];

// Zeigt die aktuelle URL-Suche im DOM, damit Klick-Tests die Schreibseite prüfen können.
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="loc" style={{ display: 'none' }}>{location.search}</output>;
}

function currentSearch(): URLSearchParams {
  return new URLSearchParams(screen.getByTestId('loc').textContent ?? '');
}

function renderScreen(query = '') {
  // RepositoryProvider mit user=null wie in der App: lokale Repos, kein Netz.
  return render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE_CODE}${query}`]}>
        <LiveViewScreen shareCode={SHARE_CODE} />
        <LocationProbe />
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

function matchOf(tournament: Tournament, matchNumber: number): ScheduledMatch {
  const found = generateFullSchedule(tournament).allMatches.find((m) => m.matchNumber === matchNumber);
  if (!found) {
    throw new Error(`Spiel ${matchNumber} fehlt im Fixture`);
  }
  return found;
}


describe('Zuschauer-Seite (LiveViewScreen) – Charakterisierung', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.mocked(localStorage.getItem).mockReset();
  });

  it('@ZM-008 Spielplan bleibt, auch wenn alle Zuschauer-Schalter aus sind', async () => {
    const t = buildLiveViewTournament({ hideScoresForPublic: true, hideRankingsForPublic: true });
    const m9 = matchOf(t, 9);
    await renderWith(t);
    expect(screen.getAllByText(m9.homeTeam).length).toBeGreaterThan(0);
    expect(screen.getAllByText(m9.awayTeam).length).toBeGreaterThan(0);
    expect(screen.getAllByText(m9.time).length).toBeGreaterThan(0);
  });

  it('Gegenprobe Tabellen an: Spielplan-Tab enthält Gruppentabellen (.standings-table)', async () => {
    const t = buildLiveViewTournament({ hideRankingsForPublic: false });
    const { container } = await renderWith(t);
    expect(container.querySelector('.standings-table')).not.toBeNull();
  });

  it.fails('@ZM-004 Gruppentabellen – Befund C-ZUSCHAUER-LIVE-ALS-BEENDET (F-B13-4): Spielplan-Tab mit ausgeschalteten Tabellen zeigt keine Tabelle (heute: leere Tabellen-Hülle)', async () => {
    const t = buildLiveViewTournament({ hideRankingsForPublic: true });
    const { container } = await renderWith(t);
    // Soll: keine Tabelle im Spielplan-Tab
    expect(container.querySelector('.standings-table')).toBeNull();
  });

  it('Bestand (F-B13-4): Spielplan-Tab mit ausgeschalteten Tabellen zeigt zwei Tabellen-Hüllen ohne Zeilen', async () => {
    const t = buildLiveViewTournament({ hideRankingsForPublic: true });
    const { container } = await renderWith(t);
    expect(container.querySelectorAll('.standings-table')).toHaveLength(2);
    expect(container.querySelectorAll('.standings-table tbody tr')).toHaveLength(0);
    expect(screen.queryByText('groupTables.empty.noGames')).toBeNull();
  });

  it('Bestand: Tabellen-Tab zeigt bei ausgeschalteten Tabellen Hinweis statt Tabelle', async () => {
    const t = buildLiveViewTournament({ hideRankingsForPublic: true });
    await renderWith(t, '?tab=standings');
    expect(screen.getByText(/Tabellen ausgeblendet/)).toBeInTheDocument();
    expect(screen.queryByText('FC Nord')).toBeNull();
  });

  it('Bestand: Tabellen-Tab zeigt bei ausgeschalteten Tabellen keine Team-Zeile von Gruppe A oder B', async () => {
    const t = buildLiveViewTournament({ hideRankingsForPublic: true });
    await renderWith(t, '?tab=standings');
    expect(screen.getByText(/Tabellen ausgeblendet/)).toBeInTheDocument();
    for (const name of ['FC Nord', 'SV Süd', 'TSV West', 'SC Ost', ...GROUP_B_TEAMS]) {
      expect(screen.queryByText(name)).toBeNull();
    }
  });

  it.fails('@ZM-005 Zuschauer-Seite – Befund C-ZUSCHAUER-LIVE-ALS-BEENDET (F-B13-4): Spielplan-Tab zeigt keine Tabelle von Gruppe A oder Gruppe B (heute: leere Hüllen)', async () => {
    const t = buildLiveViewTournament({ hideRankingsForPublic: true });
    const { container } = await renderWith(t);
    // Soll: keine Tabelle im Spielplan-Tab
    expect(container.querySelector('.standings-table')).toBeNull();
  });

  it('@ZM-019 Zuschauerin – die Zuschauer-Seite bietet keinen Schalter an', async () => {
    const t = buildLiveViewTournament();
    await renderWith(t, '?tab=settings');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.queryByText(/Torschütz|Kindermodus|Ergebnis/i)).toBeNull();
  });

  describe('@ZM-111 Uhrzeit in Ortszeit des Turniers', () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      if (originalTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTz;
      }
    });

    it('@ZM-111 Uhrzeit in Ortszeit des Turniers: Spiel 9 zeigt dieselbe Uhrzeit in einer Zone 1 h dahinter', async () => {
      const t = buildLiveViewTournament();
      const expected = matchOf(t, 9).time;
      process.env.TZ = 'Europe/London';
      await renderWith(t);
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    });
  });

  describe('Befund F-B13-11: Ergebnis-Leck trotz hideScoresForPublic', () => {
    it('Gegenbeispiel F-B13-11: ohne hideScoresForPublic steht der Stand 2:0 von Spiel 1 im Spielplan', async () => {
      const t = buildLiveViewTournament({ hideScoresForPublic: false });
      const { container } = await renderWith(t);
      const plan = container.querySelector<HTMLElement>('.group-stage-schedule');
      expect(plan).not.toBeNull();
      expect(within(plan!).getAllByText('2:0').length).toBeGreaterThan(0);
    });

    it('Befund F-B13-11 (C-ZUSCHAUER-ERGEBNIS-LECK): Soll – Stand 2:0 von Spiel 1 erscheint bei hideScoresForPublic nicht im Spielplan', async () => {
      const t = buildLiveViewTournament({ hideScoresForPublic: true });
      const { container } = await renderWith(t);
      // Soll: kein Stand im Spielplan (Torverhältnis in der Tabelle ist Befund F-B13-12, nicht hier)
      const plan = container.querySelector<HTMLElement>('.group-stage-schedule');
      expect(plan).not.toBeNull();
      expect(within(plan!).queryAllByText('2:0')).toHaveLength(0);
    });
  });

  describe('Bestand (ohne Kennung, heutiges Verhalten)', () => {
    it('Bestand: Nicht gefunden – beide Quellen liefern null → Hinweis "Turnier nicht gefunden"', async () => {
      supabaseGet.mockResolvedValue(null);
      localGet.mockResolvedValue(null);
      renderScreen();
      expect(await screen.findByText('Turnier nicht gefunden')).toBeInTheDocument();
    });

    it('Bestand: Supabase wirft → lokaler Rückfall zeigt das Turnier', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      supabaseGet.mockRejectedValue(new Error('netz weg'));
      localGet.mockResolvedValue(buildLiveViewTournament());
      renderScreen();
      expect((await screen.findAllByRole('heading', { level: 1, name: 'Hallencup Nord' })).length).toBeGreaterThan(0);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('@ZM-039 @ZM-040 (C-ZUSCHAUER-LIVE-ALS-BEENDET): laufendes Spiel 7 mit Stand 1:0 steht als laufend da, nicht als beendet', async () => {
      const t = buildLiveViewTournament({ hideRankingsForPublic: true });
      const m7 = matchOf(t, 7);
      const { container } = await renderWith(t);
      expect(screen.getAllByText(m7.homeTeam).length).toBeGreaterThan(0);
      // Stand 1:0 bleibt sichtbar (Tabellenzeile am Desktop waagerecht, Karte am Handy je Zeile)
      expect(screen.getAllByText('1:0').length).toBeGreaterThan(0);
      // Je Spiel: der Status steht am Ergebnis der Tabellenzeile (data-match-status): Spiel 7 läuft, Spiel 1 ist beendet.
      for (const circle of container.querySelectorAll(`[data-testid="match-circle-${m7.id}"]`)) {
        expect(circle).toHaveAttribute('data-match-status', 'running');
      }
      for (const circle of container.querySelectorAll(`[data-testid="match-circle-${matchOf(t, 1).id}"]`)) {
        expect(circle).toHaveAttribute('data-match-status', 'finished');
      }
      // Handy-Karte: Abzeichen „Live“ in der Kopfzeile, nur bei Spiel 7 (@OB-065)
      expect(container.querySelectorAll('[data-testid="match-status-badge"][data-state="live"]')).toHaveLength(1);
      // Regulär beendet trägt keinen Zusatz „n. V.“/„beendet i. E.“ (@OB-064); das Wort „Ende“ ist jetzt das Abzeichen (@OB-066)
      const zusatz = Array.from(container.querySelectorAll('*')).filter(
        (el) => el.children.length === 0 && ['n. V.', 'beendet i. E.'].includes(el.textContent ?? '')
      );
      expect(zusatz).toHaveLength(0);
    });

    it('@ZM-104 (F-B13-8): ausgefallenes Spiel 5 steht als „ausgefallen“ ohne Ergebnis da, nicht als geplant', async () => {
      const t = buildLiveViewTournament({ hideRankingsForPublic: true });
      const m5 = matchOf(t, 5);
      const { container } = await renderWith(t);
      expect(screen.getAllByText(m5.homeTeam).length).toBeGreaterThan(0);
      const circles = container.querySelectorAll(`[data-testid="match-circle-${m5.id}"]`);
      expect(circles.length).toBeGreaterThan(0);
      for (const circle of circles) {
        expect(circle).toHaveAttribute('data-match-status', 'skipped');
        expect(circle.textContent).toBe('ausgefallen');
      }
      // Handy-Karte: Kennzeichen „ausgefallen“, Tore ohne Zahl
      const karte = container.querySelector(`[data-testid="match-goals-${m5.id}-home"]`)?.closest('[data-match-card]');
      expect(karte?.querySelector('[data-testid="match-status-badge"]')?.textContent).toBe('ausgefallen');
      expect(container.querySelector(`[data-testid="match-goals-${m5.id}-home"]`)?.textContent).toBe('–');
    });

    it('Bestand: Status-Filter „Live“ (?s=live) zeigt nur die Paarung von Spiel 7', async () => {
      const t = buildLiveViewTournament({ hideRankingsForPublic: true });
      const m7 = matchOf(t, 7);
      const m9 = matchOf(t, 9);
      await renderWith(t, '?s=live');
      expect(screen.getAllByText(m7.homeTeam).length).toBeGreaterThan(0);
      expect(screen.queryByText(m9.homeTeam)).toBeNull();
    });

    it('Bestand: Mein Team (gespeichert + ?my=1) zeigt keine Spiele der anderen Gruppe', async () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => (key === MY_TEAM_KEY ? TEAM_IDS.nord : null));
      const t = buildLiveViewTournament({ hideRankingsForPublic: true });
      await renderWith(t, '?my=1');
      expect(screen.getAllByText('SV Süd').length).toBeGreaterThan(0);
      for (const name of GROUP_B_TEAMS) {
        expect(screen.queryByText(name)).toBeNull();
      }
    });

    it('Bestand: Team wählen speichert Mein Team und „Nur meine“ schreibt my=1 in die URL', async () => {
      const t = buildLiveViewTournament({ hideRankingsForPublic: true });
      await renderWith(t);
      fireEvent.click(screen.getByRole('button', { name: 'Team wählen' }));
      const nord = screen.getAllByRole('button', { name: /FC Nord/ });
      fireEvent.click(nord[nord.length - 1]);
      expect(localStorage.setItem).toHaveBeenCalledWith(MY_TEAM_KEY, TEAM_IDS.nord);
      fireEvent.click(screen.getByRole('button', { name: /Nur meine/ }));
      expect(currentSearch().get('my')).toBe('1');
      for (const name of GROUP_B_TEAMS) {
        expect(screen.queryByText(name)).toBeNull();
      }
    });

    it('Bestand: Filter-Chips schreiben g und s in die URL und filtern', async () => {
      const t = buildLiveViewTournament({ hideRankingsForPublic: true });
      await renderWith(t);
      fireEvent.click(screen.getByRole('button', { name: 'Gruppe B' }));
      expect(currentSearch().get('g')).toBe('B');
      expect(screen.queryByText('FC Nord')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Beendet' }));
      expect(currentSearch().get('s')).toBe('finished');
      const alle = screen.getAllByRole('button', { name: 'Alle' });
      fireEvent.click(alle[alle.length - 1]);
      expect(currentSearch().has('s')).toBe(false);
    });

    it('Bestand: Pull-to-refresh lädt das Turnier ein zweites Mal', async () => {
      const t = buildLiveViewTournament();
      const { container } = await renderWith(t);
      expect(supabaseGet).toHaveBeenCalledTimes(1);
      const root = container.querySelector('[lang="de"] > div')!;
      fireEvent.touchStart(root, { touches: [{ clientY: 0 }] });
      fireEvent.touchMove(root, { touches: [{ clientY: 200 }] });
      fireEvent.touchEnd(root);
      await waitFor(() => expect(supabaseGet).toHaveBeenCalledTimes(2));
    });
  });
});
