/**
 * Paket TB-B, Task TB-6b/TB-6b' (Oberfläche): Marken und Hinweise in den Tabellen der App – Gesamtplatzierung „Jeder gegen
 * jeden“ und Gruppentabellen –, und was Zuschauer nicht sehen. Aus dem Gherkin: @ET-025, @W2A-047, @W2A-050, @W2A-059,
 * @W2A-063, @W2A-064, @W2A-067, @W2A-071. Regel T2-UI: Verhaltenstest hier, Bild gegen Mockup v3 in der Playwright-Spec.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabellenTab } from '../TabellenTab';
import { PublicStandingsTab } from '../../public-view/components/PublicStandingsTab';
import { generateFullSchedule } from '../../../core/generators';
import { calculateStandings, calculateStandingsPerGroup } from '../../../utils/calculations';
import type { Tournament } from '../../../types/tournament';
import { DATA, NAME } from '../../../core/standings/__tests__/fixtures';
import { jgj, lage048, MemoryRepo, nikolaus, shared, shootout } from '../../../core/standings/__tests__/decisionTestKit';
import { fakeTie, i18nWrapper, withTie, type FakeTie } from '../standings/__tests__/tieTestKit';

vi.unmock('i18next');
vi.unmock('react-i18next');

async function zeigeTabellenTab(tournament: Tournament, tie: FakeTie | null, showRanking: boolean): Promise<void> {
  const Wrapper = await i18nWrapper('de');
  const tab = (
    <TabellenTab
      tournament={tournament}
      schedule={generateFullSchedule(tournament)}
      currentStandings={calculateStandingsPerGroup(tournament)}
      overallStandings={calculateStandings(tournament.teams, tournament.matches, tournament)}
    />
  );
  render(<Wrapper>{tie === null ? tab : withTie(tie, tab)}</Wrapper>);
  if (showRanking) {
    await userEvent.click(screen.getByRole('button', { name: 'Gesamtplatzierung' }));
  }
}

async function zeigeZuschauer(tournament: Tournament): Promise<void> {
  const Wrapper = await i18nWrapper('de');
  render(<Wrapper><PublicStandingsTab tournament={tournament} standings={calculateStandingsPerGroup(tournament)} /></Wrapper>);
}

const zeile = (teamName: string): HTMLElement => {
  const row = screen.getAllByRole('row').find((r) => r.textContent?.includes(teamName));
  if (row === undefined) {
    throw new Error(`Zeile „${teamName}“ fehlt`);
  }
  return row;
};
const platz = (teamName: string): string | null => within(zeile(teamName)).getAllByRole('cell')[0].textContent;

describe('App-Tabelle (Gesamtplatzierung Jeder gegen jeden): Marke und Hinweis (@ET-025, @W2A-067, @W2A-064, @W2A-047)', () => {
  it('@W2A-067 Nikolaus mit Voreinstellung: Petting und Otting tragen „Gleichstand – Entscheidung nötig“ auf Platz 3, Kammer trägt keine Marke', async () => {
    await zeigeTabellenTab(nikolaus(), fakeTie(), true);
    expect(within(zeile(NAME.P)).getByTestId('tie-marker')).toHaveTextContent('Gleichstand – Entscheidung nötig');
    expect(within(zeile(NAME.D)).getByTestId('tie-marker')).toHaveTextContent('Gleichstand – Entscheidung nötig');
    expect(screen.getAllByTestId('tie-marker')).toHaveLength(2);
    expect(within(zeile(NAME.K)).queryByTestId('tie-marker')).toBeNull(); // Gegenbeispiel
    expect([platz(NAME.P), platz(NAME.D), platz(NAME.F)]).toEqual(['3', '3', '5']);
    expect(screen.getByTestId('tie-hint-choice')).toBeInTheDocument();
    expect(screen.getByTestId('tie-decide-entry')).toBeInTheDocument();
  });

  it('@W2A-064 Platz 3 eingestellt: die Marken heißen „Strafstoßschießen nötig“, der Hinweis hat nur die Taste „Strafstoßschießen eintragen“', async () => {
    await zeigeTabellenTab(nikolaus([1, 2, 3]), fakeTie(), true);
    expect(within(zeile(NAME.P)).getByTestId('tie-marker')).toHaveTextContent('Strafstoßschießen nötig');
    expect(screen.getByTestId('tie-hint-mandatory')).toBeInTheDocument();
    expect(screen.getByTestId('tie-shootout-entry')).toBeInTheDocument();
    expect(screen.queryByTestId('tie-hint-choice')).toBeNull();
  });

  it('@W2A-047 mitten in der Gruppe: gleiche Ziffer 3, 3, 5, aber keine Marke und kein Hinweis; Gegenbeispiel: nach allen Spielen markiert', async () => {
    const fertig = jgj('RKMUNO', DATA.ET_055);
    const mitten: Tournament = { ...fertig, matches: fertig.matches.map((m, i) => (i >= 12 ? { ...m, matchStatus: 'scheduled' as const, scoreA: undefined, scoreB: undefined } : m)) };
    await zeigeTabellenTab(mitten, fakeTie(), true);
    expect(screen.queryAllByTestId('tie-marker')).toHaveLength(0);
    expect(screen.queryByTestId('tie-hints')).toBeNull();
  });

  it('@ET-055 nach dem Strafstoßschießen 4:3: Marken „Strafstoßschießen 4:3“ (Otting) und „3:4“ (Petting), Otting steht vor Petting', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    await zeigeTabellenTab(repo.tournament, fakeTie(), true);
    expect(within(zeile(NAME.D)).getByTestId('tie-marker')).toHaveTextContent('Strafstoßschießen 4:3');
    expect(within(zeile(NAME.P)).getByTestId('tie-marker')).toHaveTextContent('Strafstoßschießen 3:4');
    expect([platz(NAME.D), platz(NAME.P)]).toEqual(['3', '4']);
  });

  it('@W2A-063 nach „Ergebnis so akzeptieren“: Marke „Gleicher Platz“, Ziffer 3, 3, 5', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    await zeigeTabellenTab(repo.tournament, fakeTie(), true);
    expect(screen.getAllByTestId('tie-marker').map((m) => m.textContent)).toEqual(['Gleicher Platz', 'Gleicher Platz']);
    expect([platz(NAME.P), platz(NAME.D), platz(NAME.F)]).toEqual(['3', '3', '5']);
  });

  it('@W2A-050 Helfer: Marken und Hinweis sind da, aber keine Taste in der ganzen Tabelle', async () => {
    await zeigeTabellenTab(nikolaus([1, 2, 3]), fakeTie({ canDecide: false }), true);
    expect(screen.getAllByTestId('tie-marker')).toHaveLength(2);
    expect(screen.getByTestId('tie-hint-mandatory')).toHaveTextContent('Die Turnierleitung trägt das Ergebnis des Strafstoßschießens ein.');
    expect(screen.queryByTestId('tie-shootout-entry')).toBeNull();
    expect(screen.queryByTestId('tie-decide-entry')).toBeNull();
  });
});

describe('App-Tabelle mit Gruppen: der Hinweis steht in der Gruppe, die ihn braucht (@W2A-048, @W2A-064)', () => {
  it('Gruppe A (Süd/West gleich auf 2 und 3, Platz 2 führt ins Halbfinale): Marken und Hinweis nur dort, Gruppe B bleibt unmarkiert', async () => {
    await zeigeTabellenTab(lage048(), fakeTie(), false);
    const hint = screen.getByTestId('tie-hint-mandatory');
    expect(hint).toHaveTextContent('SV Süd und TSV West sind nach allen Kriterien gleich (Platz 2 und 3).');
    expect(screen.getAllByTestId('tie-hint-mandatory')).toHaveLength(1);
    expect(within(zeile(NAME.S)).getAllByTestId('tie-marker')[0]).toHaveTextContent('Strafstoßschießen nötig');
    expect(within(zeile(NAME.M)).queryByTestId('tie-marker')).toBeNull();
  });
});

describe('Zuschauer-Ansicht: nur Reihenfolge und gemeinsame Ziffer (@W2A-059, @W2A-072)', () => {
  it('@W2A-059 Gleichstand offen: Petting und Otting beide auf 3, dahinter 5 – nur die kurze Markierung „Strafstoß folgt“ (R5), keine App-Marke, kein Hinweis', async () => {
    await zeigeZuschauer(nikolaus([1, 2, 3]));
    expect([platz(NAME.P), platz(NAME.D), platz(NAME.F)]).toEqual(['3', '3', '5']);
    expect(screen.queryByTestId('tie-marker')).toBeNull();
    expect(screen.queryByTestId('tie-hints')).toBeNull();
    expect(new Set(screen.getAllByTestId('public-tie-mark').map((m) => m.textContent))).toEqual(new Set(['Strafstoß folgt'])); // Desktop- und Handy-Tabelle je Team
    expect(document.body.textContent).not.toMatch(/Strafstoßschießen|Entscheidung nötig|Gleicher Platz/);
  });

  it('@W2A-059 entschieden (Strafstoßschießen 4:3): nur die Reihenfolge, weder Ergebnis noch Marke; Gegenbeispiel: dieselben Daten in der App zeigen sie', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    await zeigeZuschauer(repo.tournament);
    expect([platz(NAME.D), platz(NAME.P)]).toEqual(['3', '4']);
    expect(screen.queryByTestId('tie-marker')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Strafstoß/); // das Ergebnis des Schießens steht nur in der App (Tore wie „9:9“ sind Tabellenwerte)
  });
});
