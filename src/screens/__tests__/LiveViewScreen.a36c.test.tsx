/**
 * A-36c T2-UI (a): Zuschauer-Seite liest die gemeinsame Ansicht. Werte und Wortlaut stammen aus dem Gherkin der
 * Szenarien (nicht aus dem Code) und stehen als feste Literale in `core/view/__fixtures__/expected.ts`:
 *   @TM-015, @ZM-102, @ZM-004/@ZM-005, @ZM-039/@ZM-040/@ZM-041, @ZM-104, @ZM-111, @ZM-087 (Text), @OB-064.
 * Die Fixture „Hallencup Nord“ entsteht über den echten Weg (Veröffentlichen → Mapper-Rundlauf → Engine → cacheColumns).
 * Gemockt sind nur die Datenquellen; Screen, Ansicht und Karten sind echt, die Texte kommen aus der echten DE-i18n.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';
import {
  f3G, fAUS, fHF, fNEU, fPAUSE, fTAB, fZEIT, GAME, withCloudColumns, type Hallencup,
} from '../../core/view/__fixtures__/hallencupNord';
import { EXPECTED_LABEL, EXPECTED_PLAN, EXPECTED_STATE, EXPECTED_TIME, FORBIDDEN_FRAGMENTS } from '../../core/view/__fixtures__/expected';

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

/** Sichtbarer Text ohne die eingebetteten Stilregeln (`<style>`). */
const text = (container: HTMLElement): string => {
  const kopie = container.cloneNode(true) as HTMLElement;
  kopie.querySelectorAll('style').forEach((el) => el.remove());
  return kopie.textContent ?? '';
};
const idOf = (cup: Hallencup, index: number): string => cup.tournament.matches[index].id;
const finalTabelle = (container: HTMLElement) => within(container.querySelector<HTMLElement>('.final-stage-schedule .desktop-view table')!);
const kreis = (container: HTMLElement, id: string) => Array.from(container.querySelectorAll(`[data-testid="match-circle-${id}"]`));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('@TM-015 @ZM-102 Zuschauer-Seite: Herkunft offener Plätze, besetzter Platz ohne Herkunft', () => {
  it('@TM-015 F-HF: Halbfinale 1 Gast „Zweiter Gruppe B“, Heim besetzt „FC Nord“, Finale Heim „Sieger Halbfinale 1“', async () => {
    const cup = await fHF();
    const c = await zeige(cup.tournament);
    const hf1 = idOf(cup, GAME.HF1);
    const finale = idOf(cup, GAME.FINAL);
    const erwartet = EXPECTED_PLAN['F-HF'];
    expect(screen.getByTestId(`final-name-${hf1}-home`).textContent).toBe(erwartet.hf1Home.label.de);
    expect(screen.getByTestId(`final-name-${hf1}-away`).textContent).toBe(erwartet.hf1Away.label.de);
    expect(screen.getByTestId(`final-name-${finale}-home`).textContent).toBe(erwartet.finalHome.label.de);
    // Desktop-Tabelle: dieselben Texte
    expect(finalTabelle(c).getAllByText(erwartet.hf1Away.label.de)).toHaveLength(1);
    expect(finalTabelle(c).getAllByText(erwartet.finalHome.label.de)).toHaveLength(1);
  });

  it('@TM-015 Gegenbeispiel: nirgends ein Rohschlüssel („group-…“, „TBD“, „tournament:“)', async () => {
    const c = await zeige((await fHF()).tournament);
    for (const roh of FORBIDDEN_FRAGMENTS) {
      expect(text(c)).not.toContain(roh);
    }
  });

  it('@ZM-102 F-TAB: HF1 zeigt FC Nord ohne Herkunft, der Gast „noch offen“ statt „Zweiter Gruppe B“', async () => {
    const cup = await fTAB();
    const c = await zeige(cup.tournament);
    const hf1 = idOf(cup, GAME.HF1);
    const erwartet = EXPECTED_PLAN['F-TAB'];
    expect(screen.getByTestId(`final-name-${hf1}-home`).textContent).toBe(erwartet.hf1Home.label.de);
    expect(screen.getByTestId(`final-name-${hf1}-away`).textContent).toBe(erwartet.hf1Away.label.de);
    // Gegenbeispiel: weder Zuschauer-Seite noch Tabelle verraten einen Gruppenrang
    expect(text(c)).not.toContain('Erster Gruppe A');
    expect(text(c)).not.toContain('Zweiter Gruppe B');
    // „Sieger Halbfinale 1“ verrät keinen Platz und bleibt (W2)
    expect(screen.getByTestId(`final-name-${idOf(cup, GAME.FINAL)}-home`).textContent).toBe(erwartet.finalHome.label.de);
  });

  it('@ZM-102 Kindermodus: derselbe Schutz für den Gruppenrang', async () => {
    const cup = await fHF();
    const c = await zeige({ ...cup.tournament, hideScoresForPublic: true });
    expect(text(c)).not.toContain('Zweiter Gruppe B');
    expect(screen.getByTestId(`final-name-${idOf(cup, GAME.HF1)}-away`).textContent).toBe('noch offen');
  });

  it('@TM-015 F-3G: die Drift der Gruppenzahl ändert den Wortlaut nicht', async () => {
    const cup = await f3G();
    await zeige(cup.tournament);
    expect(screen.getByTestId(`final-name-${idOf(cup, GAME.HF1)}-away`).textContent).toBe(EXPECTED_PLAN['F-3G'].hf1Away.label.de);
  });

  it('F-NEU: ein neu besetzter Platz zeigt den Teamnamen „TSV West“ ohne Herkunft', async () => {
    const cup = await fNEU();
    const c = await zeige(cup.tournament);
    expect(screen.getByTestId(`final-name-${idOf(cup, GAME.HF2)}-home`).textContent).toBe(EXPECTED_PLAN['F-NEU'].hf2Home.label.de);
    expect(text(c)).not.toContain('Erster Gruppe B');
  });

  it('@ZM-141 (W7) Spielbezeichnung „Halbfinale 1“ und „Finale“ aus der Ansicht', async () => {
    const cup = await fHF();
    await zeige(cup.tournament);
    const hf1 = idOf(cup, GAME.HF1);
    expect(within(screen.getByTestId(`final-card-${hf1}`)).getByText(EXPECTED_LABEL.hf1.de)).toBeInTheDocument();
    expect(within(screen.getByTestId(`final-card-${idOf(cup, GAME.FINAL)}`)).getByText(EXPECTED_LABEL.final.de)).toBeInTheDocument();
  });
});

describe('@ZM-039 @ZM-040 @ZM-041 F-PAUSE: unterbrochen bleibt live, nie beendet, nie „nächstes“', () => {
  it('@ZM-039 Spiel 7 (angehalten bei 1:0) und Spiel 8 (läuft 0:0) stehen als „läuft“ mit Stand da', async () => {
    const cup = await fPAUSE();
    const c = await zeige(cup.tournament);
    for (const [n, key] of [[7, 'F-PAUSE spiel7'], [8, 'F-PAUSE spiel8']] as const) {
      const id = idOf(cup, GAME[n]);
      const erwartet = EXPECTED_STATE[key];
      for (const k of kreis(c, id)) {
        expect(k).toHaveAttribute('data-match-status', 'running');
      }
      const karte = within(screen.getByTestId(`match-goals-${id}-home`).closest<HTMLElement>('[data-match-card]')!);
      expect(karte.getByTestId('match-card-live').textContent).toContain(erwartet.statusText.de);
      expect(screen.getByTestId(`match-goals-${id}-home`).textContent).toBe(String(erwartet.score[0]));
      expect(screen.getByTestId(`match-goals-${id}-away`).textContent).toBe(String(erwartet.score[1]));
    }
  });

  it('@ZM-039 Gegenbeispiel: Spiel 7 mit Stand 1:0 ist nicht „beendet“ (kein Sieger fett, kein Eintrag unter „Beendet“)', async () => {
    const cup = await fPAUSE();
    const c = await zeige(cup.tournament, '?s=finished');
    const id7 = idOf(cup, GAME[7]);
    expect(kreis(c, id7)).toHaveLength(0);
    expect(c.querySelector(`[data-testid="match-goals-${id7}-home"]`)).toBeNull();
  });

  it('@ZM-039 Filter „Live“ zeigt die Spiele 7 und 8, nicht das kommende Spiel 9', async () => {
    const cup = await fPAUSE();
    const c = await zeige(cup.tournament, '?s=live');
    expect(kreis(c, idOf(cup, GAME[7])).length).toBeGreaterThan(0);
    expect(kreis(c, idOf(cup, GAME[8])).length).toBeGreaterThan(0);
    expect(kreis(c, idOf(cup, GAME[9]))).toHaveLength(0);
  });

  it('@ZM-041 Spiel 9 ist geplant, Spiel 7 (unterbrochen) steht nicht unter „Geplant“', async () => {
    const cup = await fPAUSE();
    const c = await zeige(cup.tournament, '?s=scheduled');
    expect(kreis(c, idOf(cup, GAME[9])).length).toBeGreaterThan(0);
    expect(kreis(c, idOf(cup, GAME[7]))).toHaveLength(0);
    expect(kreis(c, idOf(cup, GAME[8]))).toHaveLength(0);
  });

  it('@ZM-040 die Spielzeit steht in der Kopfzeile der Karte (aus dem Zwischenspeicher des Spiels)', async () => {
    const base = await fPAUSE();
    const gestartet = new Date(Date.now() - 95_000).toISOString();
    const cup = withCloudColumns(
      withCloudColumns(base, GAME[7], { match_status: 'paused', score_a: 1, score_b: 0, timer_elapsed_seconds: 460 }),
      GAME[8],
      { match_status: 'running', score_a: 0, score_b: 0, timer_elapsed_seconds: 0, timer_start_time: gestartet },
    );
    await zeige(cup.tournament);
    const live = (n: 7 | 8) => screen.getByTestId(`match-goals-${idOf(cup, GAME[n])}-home`).closest<HTMLElement>('[data-match-card]')!.querySelector('[data-testid="match-card-live"]')?.textContent;
    expect(live(7)).toBe('läuft 07:40'); // angehaltene Uhr: die Spielzeit steht
    expect(live(8)).toMatch(/^läuft 01:3[5-9]$/); // laufende Uhr: 95 s seit dem Anpfiff
  });
});

describe('@ZM-104 F-AUS / F-WERT: ausgefallen und gewertet', () => {
  it('@ZM-104 Spiel 9 „ausgefallen“ ohne Ergebnis, nicht laufend, nicht „nächstes Spiel“, unter „Alle“ sichtbar', async () => {
    const cup = await fAUS();
    const c = await zeige(cup.tournament);
    const id9 = idOf(cup, GAME[9]);
    const erwartet = EXPECTED_STATE['F-AUS spiel9'];
    for (const k of kreis(c, id9)) {
      expect(k).toHaveAttribute('data-match-status', 'skipped');
      expect(k.textContent).toBe(erwartet.statusText.de);
    }
    const karte = screen.getByTestId(`match-goals-${id9}-home`).closest<HTMLElement>('[data-match-card]')!;
    expect(within(karte).getByTestId('match-card-status-note').textContent).toBe(erwartet.statusText.de);
    expect(within(karte).queryByTestId('match-card-live')).toBeNull();
    expect(screen.getByTestId(`match-goals-${id9}-home`).textContent).toBe('–');
  });

  it('@ZM-104 Gegenbeispiel: ausgefallen erscheint weder unter „Live“ noch unter „Geplant“ noch unter „Beendet“', async () => {
    const cup = await fAUS();
    const id9 = idOf(cup, GAME[9]);
    for (const status of ['live', 'scheduled', 'finished']) {
      const c = await zeige(cup.tournament, `?s=${status}`);
      expect(kreis(c, id9), status).toHaveLength(0);
      document.body.innerHTML = '';
    }
  });

  it('@ZM-104 F-WERT: gewertet zeigt das Ergebnis und „gewertet“; im Kindermodus „beendet“ ohne Ergebnis und ohne Kennzeichen', async () => {
    const aus = await fAUS();
    const gewertet = withCloudColumns(aus, GAME[10], { score_a: 2, score_b: 0, match_status: 'finished', decided_by: 'forfeit' });
    const id10 = idOf(gewertet, GAME[10]);
    const c = await zeige(gewertet.tournament);
    const karte = screen.getByTestId(`match-goals-${id10}-home`).closest<HTMLElement>('[data-match-card]')!;
    expect(within(karte).getByTestId('match-card-status-note').textContent).toBe('gewertet');
    expect(screen.getByTestId(`match-goals-${id10}-home`).textContent).toBe('2');
    expect(text(c)).toContain('2:0');
    document.body.innerHTML = '';

    const kinder = await zeige({ ...gewertet.tournament, hideScoresForPublic: true });
    expect(text(kinder)).not.toContain('gewertet');
    expect(screen.getByTestId(`match-goals-${id10}-home`).textContent).toBe('–');
    const kinderKarte = screen.getByTestId(`match-goals-${id10}-home`).closest<HTMLElement>('[data-match-card]')!;
    expect(within(kinderKarte).queryByTestId('match-card-status-note')).toBeNull();
  });
});

describe('@ZM-111 F-ZEIT: Uhrzeiten in der Ortszeit des Turniers', () => {
  const vorher = process.env.TZ;
  afterEach(() => {
    if (vorher === undefined) { delete process.env.TZ; } else { process.env.TZ = vorher; }
  });

  it('@ZM-111 Spiel 9 steht mit 14:40, obwohl das Gerät in America/New_York steht', async () => {
    process.env.TZ = 'America/New_York';
    const cup = await fZEIT();
    const c = await zeige(cup.tournament);
    const karte = screen.getByTestId(`match-goals-${idOf(cup, GAME[9])}-home`).closest<HTMLElement>('[data-match-card]')!;
    expect(karte.textContent).toContain(EXPECTED_TIME.spiel9Kickoff.time);
    // Gegenbeispiel: die falsche Umrechnung in die Gerätezeit (New York liegt 6 Stunden hinter Berlin) ergäbe 08:40
    expect(text(c)).not.toContain('08:40');
    await waitFor(() => expect(text(c)).toContain(EXPECTED_TIME.spiel9Kickoff.time));
  });
});

describe('@ZM-087 Namen vollständig (Zuschauer-Seite Handy: voller Name, ohne „…“)', () => {
  it('50-Zeichen-Name bleibt ungekürzt, ohne „…“ und ohne Kürzel', async () => {
    const lang = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
    const cup = await fHF();
    const teams = cup.tournament.teams.map((t, i) => (i === 0 ? { ...t, name: lang } : t));
    const c = await zeige({ ...cup.tournament, teams });
    expect(screen.getAllByText(lang).length).toBeGreaterThan(0);
    expect(text(c)).not.toContain('…');
    // @ZM-169 (Ausnahme zu @ZM-148): nur die Mobil-Gruppentabelle trägt das Vereinskürzel, alles andere bleibt voller Name
    const mobil = c.querySelector('.standings-table .mobile-view');
    expect(mobil?.textContent).toContain('SG FF Nordheim-Süd 1921');
    const klon = c.cloneNode(true) as HTMLElement;
    klon.querySelectorAll('.standings-table .mobile-view').forEach((e) => e.remove());
    expect(klon.textContent).not.toMatch(/GÜFÖ|SFNS|SG FF Nordheim/);
  });
});
