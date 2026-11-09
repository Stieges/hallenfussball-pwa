/**
 * Zuschauer-Seite „Schneller zum Spielplan“ (@ZM-196, @ZM-197, @ZM-175), Bildschirm-Ebene mit Fixture „Hallencup Nord“.
 * Gemockt sind nur die Datenquellen (Harness wie `LiveViewScreen.kopf.test.tsx`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
import { fPAUSE, fZEIT, GAME, NORD } from '../../core/view/__fixtures__/hallencupNord';

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

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('@ZM-196 Unter dem Kopf folgt der Spielplan ohne langen Umweg', () => {
  it('@ZM-196 Reihenfolge: Kopf, Mein Team (eine Zeile), Filterzeile, Teilnehmer (8), dann der Spielplan; Seitenkopf ohne Freigabe-Code', async () => {
    const cup = await fPAUSE();
    const c = await zeige(cup.tournament);
    const folge = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const kopf = screen.getByTestId('public-current');
    const mein = screen.getByTestId('my-team-bar');
    const filter = screen.getByTestId('public-filter-bar');
    const teil = screen.getByTestId('public-participants');
    const plan = c.querySelector('.group-stage-schedule')!;
    expect([folge(kopf, mein), folge(mein, filter), folge(filter, teil), folge(teil, plan)]).toEqual([true, true, true, true]);
    expect(mein.textContent).toContain('Team wählen');
    expect(screen.getByTestId('public-participants-toggle').textContent).toContain('Teilnehmer (8)');
    expect(c.textContent).not.toContain('LIVE:');
    expect(c.textContent).not.toContain(SHARE);
  });

  it('@ZM-196 Gegenbeispiel: kein zweiter Turnierkopf und kein ausgeklappter Teilnehmer-Block im Spielplan', async () => {
    const c = await zeige((await fPAUSE()).tournament);
    expect(c.querySelector('.tournament-header')).toBeNull();
    expect(c.querySelector('.participants-and-groups')).toBeNull();
    expect(screen.queryAllByRole('listitem').filter((li) => li.closest('[data-testid="public-participants-list"]'))).toHaveLength(0);
  });

  it('@ZM-175 mit gewähltem Team: der Block mit Name, „ändern“ und Tabellenplatz statt der einen Zeile', async () => {
    // localStorage ist in den Tests ein Spion (setup): der gespeicherte Wert kommt über `getItem`
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => (key === `live:${SHARE}:myTeam` ? NORD : null));
    const cup = await fZEIT();
    await zeige(cup.tournament);
    expect(await screen.findByTestId('my-team-name')).toHaveTextContent('FC Nord');
    expect(screen.getByRole('button', { name: 'ändern' })).toBeInTheDocument();
    expect(screen.getByTestId('my-team-next').textContent).toMatch(/Spiel \d+ · \d\d:\d\d Uhr · Feld \d gegen|Kein weiteres Spiel/);
    expect(screen.getByTestId('my-team-table').textContent).toMatch(/Platz \d in Gruppe A · \d+ Punkte/);
    expect(screen.queryByRole('button', { name: 'Team wählen' })).toBeNull();
  });
});

describe('@ZM-197 Ein Filter hinter der Taste „Filter“ bleibt sichtbar, solange er wirkt', () => {
  it('@ZM-197 Link mit Status „Beendet“: „Filter (1)“, über dem Spielplan „Beendet“ mit „Alle zeigen“', async () => {
    await zeige((await fPAUSE()).tournament, '?s=finished');
    expect(screen.getByRole('button', { name: 'Filter, 1 gewählt' }).textContent).toBe('Filter (1)');
    const hinweis = screen.getByTestId('public-filter-note');
    expect(within(hinweis).getByText('Beendet')).toBeInTheDocument();
  });

  it('@ZM-197 „Alle zeigen“: Hinweis weg, die Taste heißt wieder „Filter“', async () => {
    await zeige((await fPAUSE()).tournament, '?s=finished');
    fireEvent.click(screen.getByRole('button', { name: 'Alle zeigen' }));
    expect(screen.queryByTestId('public-filter-note')).toBeNull();
    expect(screen.getByTestId('public-filter-button').textContent).toBe('Filter');
  });

  it('@ZM-197 QR-Einstieg: alles „Alle“, die Taste heißt „Filter“ ohne Zahl, keine Hinweiszeile', async () => {
    await zeige((await fPAUSE()).tournament);
    expect(screen.getByTestId('public-filter-button').textContent).toBe('Filter');
    expect(screen.queryByTestId('public-filter-note')).toBeNull();
  });

  it('@ZM-196 Phase und Status im Blatt: Status „Live“ im Blatt setzt „Filter (1)“ und die Hinweiszeile „Live“', async () => {
    await zeige((await fPAUSE()).tournament);
    fireEvent.click(screen.getByTestId('public-filter-button'));
    fireEvent.click(screen.getByTestId('public-filter-opt-status-live'));
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(screen.getByTestId('public-filter-button').textContent).toBe('Filter (1)');
    expect(within(screen.getByTestId('public-filter-note')).getByText('Live')).toBeInTheDocument();
  });
});

// @ZM-175 – Zeilen, die der Block „Mein Team“ heute (noch) nicht erfüllt. Rot ohne Fix (it.fails), Befund C-ZUSCHAUER-WEG-ZUM-SPIELPLAN:
// „Ihr pfeift“ und die Weste brauchen Daten, die die öffentliche Ansicht noch nicht liefert (Schiri-Zuordnung, Leibchen im Block), die
// Markierungen sind nicht Teil des Pakets „Schneller zum Spielplan“.
describe('@ZM-175 Mein Team steht oben als Block, Spielplan und Tabelle bleiben vollständig – noch nicht erfüllte Zeilen', () => {
  const mitTeam = (): void => {
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => (key === `live:${SHARE}:myTeam` ? NORD : null));
  };

  it.fails('@ZM-175 C-ZUSCHAUER-WEG-ZUM-SPIELPLAN: der Block nennt „Ihr pfeift: Spiel 9 um 14:40“, wenn das Team Spiel 9 pfeift (Teams pfeifen selbst)', async () => {
    mitTeam();
    const cup = await fZEIT();
    const spiel9 = cup.tournament.matches[GAME[9]];
    const matches = cup.tournament.matches.map((m) => (m.id === spiel9.id ? { ...m, referee: 1 } : m));
    await zeige({ ...cup.tournament, matches, refereeConfig: { mode: 'teams' } });
    expect((await screen.findByTestId('my-team-bar')).textContent).toMatch(/Ihr pfeift: Spiel 9 um 14:40/);
  });

  it.fails('@ZM-175 @ZM-201 C-ZUSCHAUER-WEG-ZUM-SPIELPLAN: zeigt der Block das nächste Spiel eines Teams mit bestätigten Leibchen, steht die Weste dort wie in der Karte „Als Nächstes“', async () => {
    mitTeam();
    await zeige((await fZEIT()).tournament);
    const block = await screen.findByTestId('my-team-bar');
    expect(block.querySelector('[data-testid$="-bib"], [data-fill="vest"]')).not.toBeNull();
  });

  it.fails('@ZM-175 C-ZUSCHAUER-WEG-ZUM-SPIELPLAN: im Spielplan sind die Spiele des gewählten Teams markiert', async () => {
    mitTeam();
    const c = await zeige((await fZEIT()).tournament);
    await screen.findByTestId('my-team-name');
    expect(c.querySelectorAll('.schedule-display [data-my-team="true"]').length).toBeGreaterThan(0);
  });

  it.fails('@ZM-175 C-ZUSCHAUER-WEG-ZUM-SPIELPLAN: in der Tabelle ist die Zeile des gewählten Teams markiert', async () => {
    mitTeam();
    const c = await zeige((await fZEIT()).tournament, '?tab=standings');
    await screen.findByTestId('my-team-name').catch(() => null);
    expect(c.querySelectorAll('.standings-table [data-my-team="true"]').length).toBeGreaterThan(0);
  });
});
