/**
 * B-15 an der Zuschauer-Seite (LiveViewScreen): Phasen auf dem Handy und Änderungen ohne Neuladen.
 *  - Phasen: Halbzeit mit Pausen-Restzeit, Pause vor Verlängerung und Strafstoßschießen, Verlängerung, Strafstoßschießen
 *    (@ZM-039, @ZM-042, @ZM-043, @ZM-044, @ZM-045, @ZM-041, @ZM-115).
 *  - Live: ein Tor auf dem Server steht nach höchstens 10 Sekunden auf der Seite (@ZM-021), Phasenwechsel ebenso (@ZM-046),
 *    ohne Netz bleibt der Stand mit Hinweis (@ZM-032), die Restzeit hängt nicht von der Uhr des Handys ab (@ZM-026).
 * Gemockt nur die Datenquellen; Seite, Ansicht und Karten sind echt, die Texte kommen aus der echten DE-i18n.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../types/tournament';
import type { Json } from '../../types/supabase';

const { supabaseGet, localGet } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));

// Der Takt gehört dem Adapter (b); für die Takt-Tests dieser Datei läuft der heutige Weg ausdrücklich mit 10 s.
vi.mock('../../features/public-view/defaultPublicSource', async () => {
  const { createLegacyPublicSource } = await import('../../features/public-view/legacyPublicSource');
  return { defaultPublicTournamentSource: createLegacyPublicSource(undefined, { pollIntervalMs: 10_000 }) };
});

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';
import { fPAUSE, GAME, withCloudColumns, type Hallencup } from '../../core/view/__fixtures__/hallencupNord';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../test/realDeI18n')).initRealDeI18n();

const SHARE = 'NORD28';
const TAKT = 10_000;
const idOf = (cup: Hallencup, index: number): string => cup.tournament.matches[index].id;
const kreis = (container: HTMLElement, id: string) => Array.from(container.querySelectorAll(`[data-testid="match-circle-${id}"]`));

function seite(query = '') {
  return render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE}${query}`]}>
        <LiveViewScreen shareCode={SHARE} />
      </MemoryRouter>
    </RepositoryProvider>,
  );
}

async function zeige(tournament: Tournament, query = ''): Promise<HTMLElement> {
  supabaseGet.mockResolvedValue(tournament);
  localGet.mockResolvedValue(null);
  const { container } = seite(query);
  await screen.findAllByRole('heading', { level: 1, name: tournament.title });
  return container;
}

const karteVon = (cup: Hallencup, index: number) => within(screen.getByTestId(`match-goals-${idOf(cup, index)}-home`).closest<HTMLElement>('[data-match-card]')!);

/** Spiel 7 des Hallencups wie aus der Cloud: `live_state` und Zwischenspeicher-Spalten. */
function mitSpiel7(base: Hallencup, liveState: Json, columns: { score_a: number; score_b: number; match_status: 'running' | 'paused' }): Hallencup {
  return withCloudColumns(base, GAME[7], { ...columns, timer_elapsed_seconds: 0, live_state: liveState });
}

const REGULAR = { engine: true, phase: 'regular', section: 1, sections: 2, sectionSeconds: 600, overtimeSeconds: 300, sectionStartMs: 0, anchorAt: null };

/** Der Hallencup mit Spiel 7 angehalten bei 1:0 und Spiel 8 laufend 0:0; entsteht vor den Fake-Timern. */
let FIXTURE: Hallencup;
beforeAll(async () => {
  FIXTURE = await fPAUSE();
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Phasen auf dem Handy', () => {
  it('@ZM-039 @ZM-042 Halbzeit: Abzeichen „Halbzeit“, die Pausen-Restzeit zählt herunter (Pause 2 Minuten, vor 30 Sekunden abgepfiffen → 1:30)', async () => {
    const base = await fPAUSE();
    const cup = mitSpiel7(base, { ...REGULAR, status: 'section_break', elapsedMs: 600_000, breakStartedAt: Date.now() - 30_000, breakSeconds: 120 }, { score_a: 1, score_b: 0, match_status: 'paused' });
    await zeige(cup.tournament);
    const karte = karteVon(cup, GAME[7]);
    expect(karte.getByTestId('match-status-badge').textContent).toBe('Halbzeit');
    expect(karte.getByTestId('match-clock').textContent).toMatch(/^1:(30|29)$/);
    expect(screen.getByTestId(`match-goals-${idOf(cup, GAME[7])}-home`).textContent).toBe('1');
  });

  it('@ZM-043 abgelaufene Pausen-Restzeit bleibt bei 0:00 stehen, die Phase bleibt „Halbzeit“, nie negativ', async () => {
    const base = await fPAUSE();
    const cup = mitSpiel7(base, { ...REGULAR, status: 'section_break', elapsedMs: 600_000, breakStartedAt: Date.now() - 180_000, breakSeconds: 120 }, { score_a: 1, score_b: 0, match_status: 'paused' });
    await zeige(cup.tournament);
    const karte = karteVon(cup, GAME[7]);
    expect(karte.getByTestId('match-status-badge').textContent).toBe('Halbzeit');
    expect(karte.getByTestId('match-clock').textContent).toBe('0:00');
  });

  it.each([
    ['overtime', 'Pause vor der Verlängerung'],
    ['shootout', 'Pause vor dem Strafstoßschießen'],
  ] as const)('@ZM-044 Pause vor %s: Abzeichen „Pause“, die Phase klein bei der Restzeit 0:40', async (phase, abschnitt) => {
    const base = await fPAUSE();
    const cup = mitSpiel7(base, { ...REGULAR, phase, section: 2, status: 'section_break', elapsedMs: 1_200_000, breakStartedAt: Date.now() - 20_000, breakSeconds: 60 }, { score_a: 2, score_b: 2, match_status: 'paused' });
    await zeige(cup.tournament);
    const karte = karteVon(cup, GAME[7]);
    expect(karte.getByTestId('match-status-badge').textContent).toBe('Pause');
    expect(karte.getByTestId('match-clock-section').textContent).toBe(abschnitt);
    expect(karte.getByTestId('match-clock').textContent).toMatch(/^0:(40|39)$/);
  });

  it('@ZM-039 @ZM-045 Verlängerung läuft seit 1:20: Abzeichen „Verlängerung“, Restzeit 3:40 herunterzählend, keine „Pause vor der Verlängerung“', async () => {
    const base = await fPAUSE();
    const cup = mitSpiel7(base, { ...REGULAR, phase: 'overtime', section: 2, status: 'running', sectionStartMs: 1_200_000, elapsedMs: 1_280_000, anchorAt: Date.now() }, { score_a: 2, score_b: 2, match_status: 'running' });
    const c = await zeige(cup.tournament);
    const karte = karteVon(cup, GAME[7]);
    expect(karte.getByTestId('match-status-badge').textContent).toBe('Verlängerung');
    expect(karte.getByTestId('match-clock').textContent).toMatch(/^3:(40|39|38)$/);
    expect(c.textContent).not.toContain('Pause vor der Verlängerung');
  });

  it('@ZM-039 Strafstoßschießen: Abzeichen „Strafstoßschießen“, Stand 1:1, keine Restzeit', async () => {
    const base = await fPAUSE();
    const cup = mitSpiel7(base, { ...REGULAR, phase: 'shootout', section: 2, status: 'shootout', elapsedMs: 1_200_000 }, { score_a: 1, score_b: 1, match_status: 'paused' });
    await zeige(cup.tournament);
    const karte = karteVon(cup, GAME[7]);
    expect(karte.getByTestId('match-status-badge').textContent).toBe('Strafstoßschießen');
    expect(screen.getByTestId(`match-goals-${idOf(cup, GAME[7])}-home`).textContent).toBe('1');
    expect(screen.getByTestId(`match-goals-${idOf(cup, GAME[7])}-away`).textContent).toBe('1');
    expect(karte.queryByTestId('match-clock')).toBeNull();
  });

  it.each([
    ['Halbzeit', { ...REGULAR, status: 'section_break', elapsedMs: 600_000, breakStartedAt: Date.now() - 30_000, breakSeconds: 120 }, 'paused'],
    ['Verlängerung', { ...REGULAR, phase: 'overtime', section: 2, status: 'running', sectionStartMs: 1_200_000, elapsedMs: 1_280_000, anchorAt: Date.now() }, 'running'],
    ['Strafstoßschießen', { ...REGULAR, phase: 'shootout', section: 2, status: 'shootout', elapsedMs: 1_200_000 }, 'paused'],
  ] as const)('@ZM-041 ein Spiel in der Phase „%s“ steht unter „Live“ und nie unter „Geplant“; Spiel 9 ist das kommende', async (_phase, liveState, status) => {
    const base = await fPAUSE();
    const cup = mitSpiel7(base, liveState, { score_a: 1, score_b: 1, match_status: status });
    const live = await zeige(cup.tournament, '?s=live');
    expect(kreis(live, idOf(cup, GAME[7])).length).toBeGreaterThan(0);
    expect(kreis(live, idOf(cup, GAME[9]))).toHaveLength(0);
  });

  it('@ZM-041 gleiche Spiele unter „Geplant“: nur das kommende Spiel 9, nicht das unterbrochene Spiel 7', async () => {
    const base = await fPAUSE();
    const cup = mitSpiel7(base, { ...REGULAR, phase: 'overtime', section: 2, status: 'running', sectionStartMs: 1_200_000, elapsedMs: 1_280_000, anchorAt: Date.now() }, { score_a: 2, score_b: 2, match_status: 'running' });
    const geplant = await zeige(cup.tournament, '?s=scheduled');
    expect(kreis(geplant, idOf(cup, GAME[9])).length).toBeGreaterThan(0);
    expect(kreis(geplant, idOf(cup, GAME[7]))).toHaveLength(0);
  });
});

describe('Änderungen ohne Neuladen (Fake-Timer)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T13:32:00Z')); // 14:32 Ortszeit
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function advance(ms: number): Promise<void> {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  }

  async function oeffne(tournament: Tournament): Promise<void> {
    supabaseGet.mockResolvedValue(tournament);
    localGet.mockResolvedValue(null);
    seite();
    await advance(0);
  }

  const tore = (cup: Hallencup, index: number) => [
    screen.getByTestId(`match-goals-${idOf(cup, index)}-home`).textContent,
    screen.getByTestId(`match-goals-${idOf(cup, index)}-away`).textContent,
  ];

  it('@ZM-021 Tom trägt in Spiel 7 ein Tor ein: nach höchstens 10 Sekunden steht 2:0 auf der Seite, ohne Neuladen', async () => {
    const vorher = FIXTURE;
    const nachher = withCloudColumns(vorher, GAME[7], { match_status: 'paused', score_a: 2, score_b: 0, timer_elapsed_seconds: 0 });
    await oeffne(vorher.tournament);
    expect(tore(vorher, GAME[7])).toEqual(['1', '0']);

    supabaseGet.mockResolvedValue(nachher.tournament); // das Tor fällt auf dem Server
    await advance(TAKT - 1);
    expect(tore(vorher, GAME[7])).toEqual(['1', '0']);
    await advance(1);
    expect(tore(vorher, GAME[7])).toEqual(['2', '0']);
  });

  it('@ZM-021 Gegenbeispiel: Spiel 8 bleibt bei 0:0, wenn nur in Spiel 7 ein Tor fällt', async () => {
    const vorher = FIXTURE;
    const nachher = withCloudColumns(vorher, GAME[7], { match_status: 'paused', score_a: 2, score_b: 0, timer_elapsed_seconds: 0 });
    await oeffne(vorher.tournament);
    supabaseGet.mockResolvedValue(nachher.tournament);
    await advance(TAKT);
    expect(tore(vorher, GAME[8])).toEqual(['0', '0']);
  });

  it('@ZM-046 Tom pfeift die Verlängerung an: nach höchstens 10 Sekunden steht „Verlängerung“ mit der Restzeit auf der Seite', async () => {
    const base = FIXTURE;
    const vorher = mitSpiel7(base, { ...REGULAR, status: 'running', sectionStartMs: 0, elapsedMs: 1_190_000, anchorAt: Date.now() }, { score_a: 2, score_b: 2, match_status: 'running' });
    const nachher = mitSpiel7(base, { ...REGULAR, phase: 'overtime', section: 2, status: 'running', sectionStartMs: 1_200_000, elapsedMs: 1_200_000, anchorAt: Date.now() + TAKT - 1000 }, { score_a: 2, score_b: 2, match_status: 'running' });
    await oeffne(vorher.tournament);
    expect(karteVon(vorher, GAME[7]).getByTestId('match-status-badge').textContent).toBe('Live');
    supabaseGet.mockResolvedValue(nachher.tournament);
    await advance(TAKT);
    expect(karteVon(vorher, GAME[7]).getByTestId('match-status-badge').textContent).toBe('Verlängerung');
  });

  it('@ZM-032 @ZM-109 ohne Netz bleibt der Stand stehen; spätestens nach 20 Sekunden steht „Stand von 14:32 – keine Verbindung“ darüber', async () => {
    const cup = FIXTURE;
    await oeffne(cup.tournament);
    supabaseGet.mockRejectedValue(new Error('Failed to fetch'));
    localGet.mockResolvedValue(null);
    await advance(TAKT);
    expect(screen.queryByTestId('public-connection-hint')).toBeNull();
    await advance(TAKT + 1000);
    expect(screen.getByTestId('public-connection-hint').textContent).toBe('Stand von 14:32 – keine Verbindung');
    // der Stand ist noch da, und es steht nicht „Turnier nicht gefunden“ da
    expect(tore(cup, GAME[7])).toEqual(['1', '0']);
    expect(screen.queryByText('Turnier nicht gefunden')).toBeNull();
  });

  it('@ZM-037 kommt das Netz zurück, verschwindet der Hinweis und der aktuelle Stand steht da', async () => {
    const vorher = FIXTURE;
    await oeffne(vorher.tournament);
    supabaseGet.mockRejectedValue(new Error('Failed to fetch'));
    await advance(3 * TAKT);
    expect(screen.getByTestId('public-connection-hint')).toBeTruthy();

    const nachher = withCloudColumns(vorher, GAME[7], { match_status: 'paused', score_a: 3, score_b: 1, timer_elapsed_seconds: 0 });
    supabaseGet.mockReset();
    supabaseGet.mockResolvedValue(nachher.tournament);
    await advance(TAKT);
    expect(screen.queryByTestId('public-connection-hint')).toBeNull();
    expect(tore(vorher, GAME[7])).toEqual(['3', '1']);
  });
});
