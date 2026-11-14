/**
 * Paket Z2 (Zuschauer-Seite, Kopfblock): oben steht, was gerade läuft / als Nächstes kommt / zuletzt beendet war.
 * Szenarien: @ZM-141 (Grundriss, 4 Lagen, „darunter folgt der Spielplan“), @ZM-039/@ZM-040/@ZM-041 (unterbrochen = laufend),
 * @OB-066 (Wort im Abzeichen), @ZM-104 (ausgefallen nie „als Nächstes“).
 * Werte und Wortlaut stammen aus dem Gherkin, nicht aus dem Code. Gemockt sind nur die Datenquellen (Harness wie A-36c).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../types/tournament';

const { supabaseGet, localGet } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));
vi.mock('../../features/public-view/defaultPublicSource', async () => {
  const { createLegacyPublicSource } = await import('../../features/public-view/legacyPublicSource');
  return { defaultPublicTournamentSource: createLegacyPublicSource() };
});

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';
import { fAUS, fES, fNV, fPAUSE, fZEIT, GAME, hf1Besetzt, withCloudColumns } from '../../core/view/__fixtures__/hallencupNord';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../test/realDeI18n')).initRealDeI18n();

const SHARE = 'NORD28';

async function zeige(tournament: Tournament, query = ''): Promise<HTMLElement> {
  supabaseGet.mockResolvedValue(tournament);
  localGet.mockResolvedValue(null);
  const { container } = render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE}${query}`]}>
        <LiveViewScreen shareCode={SHARE} />
      </MemoryRouter>
    </RepositoryProvider>,
  );
  await screen.findAllByRole('heading', { level: 1, name: tournament.title });
  return container;
}

const idOf = (t: Tournament, index: number): string => t.matches[index].id;
const kopf = () => screen.getByTestId('public-current');
const imKopf = (id: string, seite: 'home' | 'away') => within(kopf()).getByTestId(`match-goals-kopf-${id}-${seite}`);
const alleBeendet = (t: Tournament): Tournament => ({
  ...t,
  matches: t.matches.map((m) => ({ ...m, matchStatus: 'finished' as const, scoreA: 2, scoreB: 1 })),
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('@ZM-141 Lage „Spiel 7 läuft“ / „Spiel 7 ist angehalten“: oben als laufend, nie als nächstes', () => {
  it('@ZM-141 @ZM-039 Überschrift „Läuft gerade“, Spiel 7 (1:0, Abzeichen „Pause“) und Spiel 8 (0:0, „Live“) mit Stand', async () => {
    const cup = await fPAUSE();
    await zeige(cup.tournament);
    expect(within(kopf()).getByRole('heading', { name: 'Läuft gerade' })).toBeInTheDocument();
    const id7 = idOf(cup.tournament, GAME[7]);
    const id8 = idOf(cup.tournament, GAME[8]);
    expect([imKopf(id7, 'home').textContent, imKopf(id7, 'away').textContent]).toEqual(['1', '0']);
    expect([imKopf(id8, 'home').textContent, imKopf(id8, 'away').textContent]).toEqual(['0', '0']);
    expect(within(kopf()).getByTestId(`public-current-badge-${id7}`).textContent).toBe('Pause');
    expect(within(kopf()).getByTestId(`public-current-badge-${id8}`).textContent).toBe('Live');
  });

  it('@ZM-041 Gegenbeispiel: Spiel 9 (danach) steht im Kopf nicht, es gibt keine Überschrift „Als Nächstes“', async () => {
    const cup = await fPAUSE();
    await zeige(cup.tournament);
    expect(within(kopf()).queryByTestId(`match-goals-kopf-${idOf(cup.tournament, GAME[9])}-home`)).toBeNull();
    expect(within(kopf()).queryByRole('heading', { name: 'Als Nächstes' })).toBeNull();
  });

  it('@ZM-040 @OB-066 angehaltene Uhr bei Restzeit 2:20: „Pause“, klein „1. Halbzeit“, Restzeit 2:20 im Kopf', async () => {
    const base = await fPAUSE();
    const liveState = { engine: true, status: 'paused', phase: 'regular', section: 1, sections: 2, sectionSeconds: 600, elapsedMs: 460_000, anchorAt: null, sectionStartMs: 0, breakStartedAt: null, breakSeconds: 60 };
    const cup = withCloudColumns(base, GAME[7], { match_status: 'paused', score_a: 1, score_b: 0, timer_elapsed_seconds: 460, live_state: liveState });
    await zeige(cup.tournament);
    expect(within(kopf()).getByTestId(`public-current-badge-${idOf(cup.tournament, GAME[7])}`).textContent).toBe('Pause');
    expect(within(kopf()).getByTestId(`public-current-clock-${idOf(cup.tournament, GAME[7])}-section`).textContent).toBe('1. Halbzeit');
    expect(within(kopf()).getByTestId(`public-current-clock-${idOf(cup.tournament, GAME[7])}`).textContent).toBe('2:20');
  });
});

describe('@ZM-141 Lage „kein Spiel läuft, Spiel 9 beginnt um 14:40“: Spiel 9 als nächstes Spiel mit Uhrzeit', () => {
  it('@ZM-141 @ZM-209 Überschrift „Als Nächstes“, Spiel 9 um 14:40, vor dem Anpfiff „–“ bei beiden Teams (kein „0“, kein Kasten), ohne Uhr', async () => {
    const cup = await fZEIT();
    await zeige(cup.tournament);
    expect(within(kopf()).getByRole('heading', { name: 'Als Nächstes' })).toBeInTheDocument();
    const id9 = idOf(cup.tournament, GAME[9]);
    expect(within(kopf()).getByTestId(`public-current-badge-${id9}`).textContent).toBe('14:40');
    expect(within(kopf()).getByText(/Spiel 9/)).toBeInTheDocument();
    expect(imKopf(id9, 'home').textContent).toBe('–');
    expect(imKopf(id9, 'away').textContent).toBe('–');
    expect(within(kopf()).queryByRole('heading', { name: 'Läuft gerade' })).toBeNull();
    expect(kopf().querySelector('[data-testid^="public-current-clock-"]')).toBeNull();
  });

  it('@ZM-104 Gegenbeispiel: Spiel 9 ausgefallen – im Kopf steht Spiel 10, nie das ausgefallene Spiel', async () => {
    const cup = await fAUS();
    await zeige(cup.tournament);
    expect(within(kopf()).queryByTestId(`match-goals-kopf-${idOf(cup.tournament, GAME[9])}-home`)).toBeNull();
    expect(within(kopf()).getByTestId(`match-goals-kopf-${idOf(cup.tournament, GAME[10])}-home`)).toBeInTheDocument();
  });
});

describe('@ZM-141 Lage „alle Spiele beendet, Turnier nicht abgeschlossen“: das zuletzt beendete Spiel mit Ergebnis', () => {
  it('@ZM-141 Überschrift „Zuletzt beendet“, Abzeichen „Ende“, Ergebnis 2:1', async () => {
    const cup = await fZEIT();
    const beendet = alleBeendet(cup.tournament);
    await zeige(beendet);
    expect(within(kopf()).getByRole('heading', { name: 'Zuletzt beendet' })).toBeInTheDocument();
    const letztes = kopf().querySelector<HTMLElement>('[data-testid^="public-current-badge-"]')!;
    expect(letztes.textContent).toBe('Ende');
    const id = letztes.dataset.testid!.replace('public-current-badge-', '');
    expect([imKopf(id, 'home').textContent, imKopf(id, 'away').textContent]).toEqual(['2', '1']);
  });

  it('@ZM-141 Gegenbeispiel: im Kindermodus (Ergebnisse aus) steht kein Block „Zuletzt beendet“ und kein Ergebnis', async () => {
    const cup = await fZEIT();
    await zeige({ ...alleBeendet(cup.tournament), hideScoresForPublic: true });
    expect(screen.queryByTestId('public-current')).toBeNull();
  });
});

describe('@ZM-147 Strafstoßschießen im Kopf', () => {
  it('@ZM-141 beendetes Finale 1:1, Strafstoßschießen 4:3: Kopf „Zuletzt beendet“ trägt Strafstoß (4) und (3)', async () => {
    const cup = await fES();
    const beendet = { ...cup.tournament, matches: cup.tournament.matches.map((m) => (m.matchStatus === 'finished' ? m : { ...m, matchStatus: 'finished' as const, scoreA: 1, scoreB: 0 })) };
    await zeige(beendet);
    const id = idOf(cup.tournament, GAME.FINAL);
    expect(within(kopf()).getByTestId(`match-penalty-kopf-${id}-home`).textContent).toBe('(4)');
    expect(within(kopf()).getByTestId(`match-penalty-kopf-${id}-away`).textContent).toBe('(3)');
  });
});

describe('@ZM-141 Aufbau der Seite: ein Turnier-Kopf, danach das Geschehen, darunter der Spielplan', () => {
  it('@ZM-141 Befund Z2: der Titel steht genau einmal als Überschrift, keine zweite Turnierkarte mit Info-Box', async () => {
    const cup = await fPAUSE();
    const c = await zeige(cup.tournament);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(c.querySelector('.tournament-header')).toBeNull();
    expect(c.textContent).not.toContain('Veranstaltungsort');
  });

  it('@ZM-141 Reihenfolge: Titel, dann der Kopfblock, dann „Mein Team“ und Filter, zuletzt der Spielplan', async () => {
    const cup = await fPAUSE();
    const c = await zeige(cup.tournament);
    const folge = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const titel = screen.getByRole('heading', { level: 1 });
    expect(folge(titel, kopf())).toBe(true);
    expect(folge(kopf(), screen.getByTestId('my-team-bar'))).toBe(true);
    expect(folge(kopf(), c.querySelector('.group-stage-schedule')!)).toBe(true);
  });

  it.each(['?s=finished', '?s=scheduled', '?g=B', '?g=A&s=finished', '?p=final'])('@ZM-141 der Kopf folgt keinem Filter: mit %s steht oben unverändert, was im ganzen Turnier läuft', async (query) => {
    const cup = await fPAUSE();
    await zeige(cup.tournament, query);
    expect(within(kopf()).getByRole('heading', { name: 'Läuft gerade' })).toBeInTheDocument();
    expect(within(kopf()).getAllByTestId(/^public-current-badge-/)).toHaveLength(2);
  });

  it('@ZM-141 Voreinstellung: alle Filter stehen auf „Alle“', async () => {
    const cup = await fPAUSE();
    await zeige(cup.tournament);
    expect(screen.getAllByRole('button', { name: 'Alle', pressed: true }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('button', { name: 'Alle', pressed: false })).toHaveLength(0);
  });
});

describe('@ZM-158 @ZM-161 Ergebniskästen im Kopf', () => {
  it('@ZM-158 die Torzahl des laufenden Spiels steht im Kopf im Kasten in der Farbe des Teams (laufend und nächstes Spiel, nie bei „zuletzt beendet“)', async () => {
    const cup = await fPAUSE();
    await zeige(cup.tournament);
    const id7 = idOf(cup.tournament, GAME[7]);
    expect(within(kopf()).getByTestId(`match-box-kopf-${id7}-home`)).toBeInTheDocument();
    expect(within(kopf()).getByTestId(`match-box-kopf-${id7}-away`)).toBeInTheDocument();
  });

  it('@ZM-209 nächstes Spiel vor dem Anpfiff, keine Leibchen bestätigt: weder im Kopf noch im Spielplan ein Kasten oder „0 : 0“ (alle Spiele „–“)', async () => {
    const cup = await fZEIT();
    const c = await zeige(cup.tournament);
    const id9 = idOf(cup.tournament, GAME[9]);
    expect(kopf().querySelector('[data-testid^="match-box-kopf-"]')).toBeNull();
    expect(c.querySelector(`[data-testid="match-box-${id9}-home"]`)).toBeNull();
    expect(c.querySelector('[data-testid^="match-box-"]')).toBeNull();
    expect(c.querySelector(`[data-testid="match-goals-${id9}-home"]`)?.textContent).toBe('–');
  });

  it('@ZM-209 Ausnahme: ist für das nächste Spiel ein Leibchen bestätigt, bleiben die Kästen mit Weste und „0“ im Kopf und im Spielplan (@ZM-161)', async () => {
    const cup = await fZEIT();
    const id9 = idOf(cup.tournament, GAME[9]);
    const mitLeibchen = { ...cup.tournament, matches: cup.tournament.matches.map((m) => (m.id === id9 ? { ...m, kitDecision: 'bib' as const, kit: { a: '#FFCC00', bibSide: 'a' as const } } : m)) };
    const c = await zeige(mitLeibchen);
    expect(within(kopf()).getByTestId(`match-box-kopf-${id9}-home`)).toBeInTheDocument();
    expect(within(kopf()).getByTestId(`match-box-kopf-${id9}-home-bib`)).toBeInTheDocument();
    expect(within(kopf()).getByTestId(`match-box-kopf-${id9}-home-digits`)).toHaveTextContent('0');
    expect(c.querySelector(`[data-testid="match-box-${id9}-home"]`)).not.toBeNull();
  });

  it('@ZM-158 @OB-064 Gegenbeispiel: im Kindermodus (Ergebnisse aus) kein Kasten, auch nicht bei laufendem und nächstem Spiel', async () => {
    const cup = await fPAUSE();
    await zeige({ ...cup.tournament, hideScoresForPublic: true });
    expect(kopf().querySelector('[data-testid^="match-box-kopf-"]')).toBeNull();
  });
});

describe('@ZM-141 @ZM-158 @OB-064 Zuletzt beendet: Kasten mit Ring beim Sieger, Pokal in der Finalrunde', () => {
  const box = (id: string, seite: 'home' | 'away') => within(kopf()).getByTestId(`match-box-kopf-${id}-${seite}`);
  const nurBeendet = (t: Tournament, beendet: (index: number) => boolean, ergebnis: (index: number) => [number, number]): Tournament => ({
    ...t,
    matches: t.matches.map((m, i) => (beendet(i)
      ? { ...m, matchStatus: 'finished' as const, scoreA: ergebnis(i)[0], scoreB: ergebnis(i)[1] }
      : { ...m, matchStatus: 'skipped' as const })),
  });

  it('@ZM-141 @OB-064 Finale 2:1 zuletzt beendet: Sieger mit Ring und Pokal, Verlierer zurückgenommen ohne Pokal', async () => {
    const cup = await fZEIT();
    await zeige(alleBeendet(cup.tournament));
    const id = idOf(cup.tournament, GAME.FINAL);
    expect(within(kopf()).getByTestId(`public-current-badge-${id}`).textContent).toBe('Ende');
    expect(box(id, 'home')).toHaveAttribute('data-outcome', 'winner');
    expect(within(kopf()).getByTestId(`match-box-kopf-${id}-home-cup`)).toBeInTheDocument();
    expect(box(id, 'away')).toHaveAttribute('data-outcome', 'loser');
    expect(within(kopf()).queryByTestId(`match-box-kopf-${id}-away-cup`)).toBeNull();
  });

  it('@OB-064 Gruppenspiel 2:1 zuletzt beendet: Sieger mit Ring, aber ohne Pokal (kein Spiel der Finalrunde)', async () => {
    const cup = await fZEIT();
    await zeige(nurBeendet(cup.tournament, (i) => i < 12, () => [2, 1]));
    const id = idOf(cup.tournament, 11);
    expect(box(id, 'home')).toHaveAttribute('data-outcome', 'winner');
    expect(within(kopf()).queryByTestId(`match-box-kopf-${id}-home-cup`)).toBeNull();
  });

  it('@OB-064 Gegenbeispiel: Unentschieden in der Gruppe hat weder Ring noch Pokal', async () => {
    const cup = await fZEIT();
    await zeige(nurBeendet(cup.tournament, (i) => i < 12, () => [1, 1]));
    const id = idOf(cup.tournament, 11);
    expect(box(id, 'home')).not.toHaveAttribute('data-outcome');
    expect(box(id, 'away')).not.toHaveAttribute('data-outcome');
    expect(kopf().querySelector('[data-testid$="-cup"]')).toBeNull();
  });

  it('@OB-064 @ZM-158 Halbfinale 4:1 nach Verlängerung: klein „nach Verlängerung“ beim Stand des Siegers, rechtsbündig unter seiner Zeile – nicht beim Namen', async () => {
    const cup = await fNV();
    const id = idOf(cup.tournament, GAME.HF2);
    await zeige({ ...cup.tournament, matches: cup.tournament.matches.map((m) => (m.id === id ? m : { ...m, matchStatus: 'skipped' as const })) });
    const note = within(kopf()).getByTestId(`match-overtime-kopf-${id}-home`);
    expect(note.textContent).toBe('nach Verlängerung');
    expect(within(kopf()).queryByTestId(`match-overtime-kopf-${id}-away`)).toBeNull();
    // Lage: eigene Rasterzeile direkt unter der Zeile des Siegers (Heim = Zeile 1), über die ganze Breite rechtsbündig – der Name steht allein in seiner Zelle
    expect(note.style.gridRow).toMatch(/^2( \/ auto)?$/);
    expect(note.style.textAlign).toBe('right');
    // hängt am Kasten des Siegers: der Rasterabstand (spacing.md) nach oben ist aufgehoben (Token, kein fester Wert)
    expect(note.style.marginTop).toContain('--spacing-md');
    const name = within(kopf()).getByTestId(`match-name-kopf-${id}-home`);
    expect(note.contains(name) || name.closest('[style*="grid-column: 1"]')?.contains(note)).toBe(false);
    // die Zeile des Gastes rutscht eine Zeile nach unten
    expect(within(kopf()).getByTestId(`match-box-kopf-${id}-away`).closest('button')!.style.gridRow).toMatch(/^3( \/ auto)?$/);
    expect(note.compareDocumentPosition(within(kopf()).getByTestId(`match-box-kopf-${id}-home`)) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });
});

describe('@ZM-104 @OB-066 Vorlesetext des Stands ohne Ergebnis nennt den Zustand, nie „Spiel starten“', () => {
  const vorlesen = (id: string) => screen.getAllByTestId(`match-goals-${id}-home`)[0].getAttribute('aria-label');

  it('@ZM-104 ausgefallenes Spiel 9 (Karte im Spielplan): „ausgefallen“, nicht „Noch nicht angepfiffen“', async () => {
    const cup = await fAUS();
    await zeige(cup.tournament);
    expect(vorlesen(idOf(cup.tournament, GAME[9]))).toBe('ausgefallen');
  });

  it('@OB-066 Kindermodus, beendetes Spiel ohne Ergebnis: „Ende“', async () => {
    const cup = await fZEIT();
    await zeige({ ...cup.tournament, hideScoresForPublic: true });
    expect(vorlesen(idOf(cup.tournament, GAME[3]))).toBe('Ende');
  });

  it('@ZM-141 Gegenbeispiel: ein noch nicht angepfiffenes Spiel heißt „Noch nicht angepfiffen“', async () => {
    const cup = await fZEIT();
    await zeige(cup.tournament);
    expect(within(kopf()).getByTestId(`match-goals-kopf-${idOf(cup.tournament, GAME[9])}-home`).getAttribute('aria-label')).toContain('Noch nicht angepfiffen');
  });
});

describe('@ZM-116 Live-Stand ausgeschaltet: das laufende Spiel steht da, ohne Stand', () => {
  it('@ZM-116 Kopf: laufende Spiele ohne Kasten und ohne Zahl, Vorlesetext nennt „Läuft“, nie „Spiel starten“', async () => {
    const cup = await fPAUSE();
    await zeige({ ...cup.tournament, publicLiveScore: false });
    const id7 = idOf(cup.tournament, GAME[7]);
    expect(within(kopf()).getByRole('heading', { name: 'Läuft gerade' })).toBeInTheDocument();
    expect(within(kopf()).getByTestId(`public-current-badge-${id7}`).textContent).toBe('Pause');
    expect(kopf().querySelector('[data-testid^="match-box-kopf-"]')).toBeNull();
    expect(imKopf(id7, 'home').textContent).toBe('–');
    expect(imKopf(id7, 'home').getAttribute('aria-label')).toBe('Läuft, ohne Stand');
  });

  it('@ZM-116 auch die Karte im Spielplan zeigt das laufende Spiel ohne Kasten (Gruppe und Finalrunde)', async () => {
    const cup = await fPAUSE();
    const c = await zeige({ ...cup.tournament, publicLiveScore: false });
    for (const n of [7, 8] as const) {
      expect(c.querySelector(`[data-testid="match-box-${idOf(cup.tournament, GAME[n])}-home"]`)).toBeNull();
    }
    document.body.innerHTML = '';
    const hf = withCloudColumns(await hf1Besetzt(), GAME.HF1, { match_status: 'running', score_a: 1, score_b: 0 });
    const id = idOf(hf.tournament, GAME.HF1);
    const mit = await zeige(hf.tournament);
    expect(mit.querySelector(`[data-testid="final-box-${id}-home"]`)).not.toBeNull();
    document.body.innerHTML = '';
    const ohne = await zeige({ ...hf.tournament, publicLiveScore: false });
    expect(ohne.querySelector(`[data-testid="final-box-${id}-home"]`)).toBeNull();
  });
});
