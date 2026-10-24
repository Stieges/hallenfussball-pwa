/**
 * Paket TB-B / GA4 A-13b-C: Szenarien, deren letzte Zeile „wer hat wann entschieden / zurückgenommen“ nennt. Person und
 * Zeit stehen absichtlich nicht im öffentlich lesbaren `config` (@W2A-072), sondern im Verlauf der Turnierleitung
 * (`Tournament.decisionLog`, Server `bracket_log_read`); der Hinweis in der Tabelle zeigt sie nur der Turnierleitung.
 * @W2A-070: Nach dem Zurücknehmen nennt der offene Hinweis, wer wann zurückgenommen hat (nur Turnierleitung).
 */
import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Tournament } from '../../../../types/tournament';
import { TieGroupHint } from '../TieGroupHint';
import { MemoryRepo, nikolaus, shared, shootout } from '../../../../core/standings/__tests__/decisionTestKit';
import type { DecisionDraft } from '../../../../core/standings/decisions';
import { fakeTie, i18nWrapper, withTie } from './tieTestKit';

vi.unmock('i18next');
vi.unmock('react-i18next');

async function zeigeEntschieden(draft: DecisionDraft, canDecide = true): Promise<void> {
  const repo = new MemoryRepo(nikolaus());
  expect((await repo.service(['e-1']).decide(repo.tournament.id, draft)).ok).toBe(true);
  const Wrapper = await i18nWrapper('de');
  render(<Wrapper>{withTie(fakeTie({ canDecide }), <TieGroupHint tournament={repo.tournament} groupId="" />)}</Wrapper>);
}

async function mitRuecknahme(): Promise<MemoryRepo> {
  const repo = new MemoryRepo(nikolaus());
  expect((await repo.service(['e-1']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
  repo.author = 'Maria';
  expect((await repo.service().withdraw(repo.tournament.id, 'e-1')).ok).toBe(true);
  return repo;
}

async function zeigeHinweis(tournament: Tournament, canDecide: boolean): Promise<void> {
  const Wrapper = await i18nWrapper('de');
  render(<Wrapper>{withTie(fakeTie({ canDecide }), <TieGroupHint tournament={tournament} groupId="" />)}</Wrapper>);
}

describe('Person und Zeit der Entscheidung (Verlauf der Turnierleitung, GA4 A-13b-C)', () => {
  it('@W2A-004 Turnierleitung sieht, wer das Strafstoßschießen wann eingetragen hat (Verlauf, GA4 A-13b-C)', async () => {
    await zeigeEntschieden(shootout('D', 'P', 4, 3));
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent(/Olli · \d{2}:\d{2}/);
  });

  it('@ET-027 der Verlauf hält die Entscheidung mit Person, Zeit und Ergebnis fest (Anzeige für die Turnierleitung)', async () => {
    await zeigeEntschieden(shootout('D', 'P', 4, 3));
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent(/Olli/);
  });

  it('@ET-029 letzte Zeile: die Annahme steht mit Person und Zeit im Verlauf', async () => {
    await zeigeEntschieden(shared(['P', 'D']));
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent(/Olli · \d{2}:\d{2}/);
  });

  it('@W2A-070 Olli akzeptiert, Maria nimmt zurück: der offene Hinweis nennt „Zurückgenommen von Maria · Zeit“ (nur Turnierleitung)', async () => {
    const repo = await mitRuecknahme();
    await zeigeHinweis(repo.tournament, true);
    expect(screen.getByTestId('tie-hint-choice')).toBeInTheDocument();
    expect(screen.getByTestId('tie-withdrawn-by')).toHaveTextContent(/Zurückgenommen von Maria · \d{2}:\d{2}/);
  });

  it('@W2A-070 N2: nach dem Zurücknehmen steht in einer Zeile, wer den Platz geteilt und wer zurückgenommen hat („Platz geteilt von Olli · Zeit · Zurückgenommen von Maria · Zeit“, nur Turnierleitung)', async () => {
    const repo = await mitRuecknahme();
    await zeigeHinweis(repo.tournament, true);
    const zeile = screen.getByTestId('tie-withdrawn-by');
    expect(zeile).toHaveTextContent(/^Platz geteilt von Olli · \d{2}:\d{2} · Zurückgenommen von Maria · \d{2}:\d{2}$/);
  });

  it('@W2A-070 N2: war es ein Strafstoßschießen, nennt die Zeile die Art der zurückgenommenen Entscheidung', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    repo.author = 'Maria';
    expect((await repo.service().withdraw(repo.tournament.id, 'e-1')).ok).toBe(true);
    await zeigeHinweis(repo.tournament, true);
    expect(screen.getByTestId('tie-withdrawn-by')).toHaveTextContent(/^Strafstoßschießen eingetragen von Olli · \d{2}:\d{2} · Zurückgenommen von Maria/);
  });

  it('@W2A-070 N2 Gegenbeispiel: ohne Verlauf der Entscheidung bleibt es bei „Zurückgenommen von …“', async () => {
    const repo = await mitRuecknahme();
    const ohneEintragung = { ...repo.tournament, decisionLog: repo.tournament.decisionLog?.filter((e) => e.kind !== 'standing_decision') };
    await zeigeHinweis(ohneEintragung, true);
    expect(screen.getByTestId('tie-withdrawn-by')).toHaveTextContent(/^Zurückgenommen von Maria · \d{2}:\d{2}$/);
  });

  it('@W2A-070 entscheiden, zurücknehmen, neu entscheiden, Entscheidung verfällt: der offene Hinweis zeigt keine „Zurückgenommen“-Zeile mehr', async () => {
    const repo = await mitRuecknahme();
    expect((await repo.service(['e-2']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    repo.setPlaces([1, 2, 3]); // die Annahme verfällt, der Gleichstand ist wieder offen
    await zeigeHinweis(repo.tournament, true);
    expect(screen.getByTestId('tie-hint-mandatory')).toBeInTheDocument();
    expect(screen.queryByTestId('tie-withdrawn-by')).toBeNull();
  });

  it('@W2A-070 Gegenbeispiel: Tom als Helfer sieht nicht, wer zurückgenommen hat', async () => {
    const repo = await mitRuecknahme();
    await zeigeHinweis(repo.tournament, false);
    expect(screen.queryByTestId('tie-withdrawn-by')).toBeNull();
  });

  it('@W2A-070 Gegenbeispiel: eine nie zurückgenommene Entscheidung zeigt keine „zurückgenommen“-Zeile; wird danach neu entschieden, auch nicht', async () => {
    await zeigeEntschieden(shared(['P', 'D']));
    expect(screen.getByTestId('tie-decided-info')).not.toHaveTextContent(/zurückgenommen/i);
    cleanup();
    const repo = await mitRuecknahme();
    expect((await repo.service(['e-2']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    await zeigeHinweis(repo.tournament, true);
    expect(screen.queryByTestId('tie-withdrawn-by')).toBeNull();
    expect(screen.getByTestId('tie-decided-info')).not.toHaveTextContent(/zurückgenommen/i);
  });

  it('@W2A-071 Gegenbeispiel: Tom als Helfer sieht das Ergebnis, aber weder Person noch Zeit', async () => {
    await zeigeEntschieden(shootout('D', 'P', 4, 3), false);
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent('Strafstoßschießen 4:3');
    expect(screen.queryByTestId('tie-decided-by')).toBeNull();
    expect(screen.getByTestId('tie-decided-info')).not.toHaveTextContent('Olli');
  });

  it('@W2A-063 ohne Verlauf (vor dem Einspielen, ohne Recht) steht keine Person da, das Ergebnis aber schon', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    const ohneVerlauf = { ...repo.tournament, decisionLog: undefined };
    const Wrapper = await i18nWrapper('de');
    render(<Wrapper>{withTie(fakeTie(), <TieGroupHint tournament={ohneVerlauf} groupId="" />)}</Wrapper>);
    expect(screen.getByTestId('tie-decided-info')).toBeInTheDocument();
    expect(screen.queryByTestId('tie-decided-by')).toBeNull();
  });
});
