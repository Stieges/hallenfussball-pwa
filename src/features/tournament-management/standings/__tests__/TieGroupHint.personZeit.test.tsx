/**
 * Paket TB-B / GA4 A-13b-C: Szenarien, deren letzte Zeile „wer hat wann entschieden / zurückgenommen“ nennt. Person und
 * Zeit stehen absichtlich nicht im öffentlich lesbaren `config` (@W2A-072), sondern im Verlauf der Turnierleitung
 * (`Tournament.decisionLog`, Server `bracket_log_read`); der Hinweis in der Tabelle zeigt sie nur der Turnierleitung.
 * Der Fall @W2A-070 „zurückgenommen von“ bleibt `it.fails`: Er verlangt den Text an einer GELTENDEN Entscheidung, die nie
 * zurückgenommen wurde (Befund C-ENTSCHEIDUNG-PERSON-OEFFENTLICH, siehe Bericht A-13b-C).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it.fails('@W2A-070 die Turnierleitung sieht, wer wann akzeptiert und zurückgenommen hat – Befund C-ENTSCHEIDUNG-PERSON-OEFFENTLICH', async () => {
    await zeigeEntschieden(shared(['P', 'D']));
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent(/zurückgenommen von/);
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
