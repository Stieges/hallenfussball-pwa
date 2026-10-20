/**
 * Paket TB-B, Lücken-Tabelle „Teil bis A-13b“: Szenarien, deren letzte Zeile „wer hat wann entschieden / zurückgenommen“
 * nennt. Solange das Verlaufsprotokoll fehlt (GA4 A-13b, RPC `log_standing_decision`), steht in der App weder Person noch Zeit –
 * absichtlich nicht im öffentlich lesbaren `config` (@W2A-072, Befund C-ENTSCHEIDUNG-PERSON-OEFFENTLICH). Diese Fälle sind
 * `it.fails` mit Besitzer GA4 A-13b und werden grün, sobald der Verlauf angebunden ist. Sie gelten NICHT als erfüllt.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TieGroupHint } from '../TieGroupHint';
import { MemoryRepo, nikolaus, shared, shootout } from '../../../../core/standings/__tests__/decisionTestKit';
import type { DecisionDraft } from '../../../../core/standings/decisions';
import { fakeTie, i18nWrapper, withTie } from './tieTestKit';

vi.unmock('i18next');
vi.unmock('react-i18next');

async function zeigeEntschieden(draft: DecisionDraft): Promise<void> {
  const repo = new MemoryRepo(nikolaus());
  expect((await repo.service(['e-1']).decide(repo.tournament.id, draft)).ok).toBe(true);
  const Wrapper = await i18nWrapper('de');
  render(<Wrapper>{withTie(fakeTie(), <TieGroupHint tournament={repo.tournament} groupId="" />)}</Wrapper>);
}

describe('Person und Zeit der Entscheidung (Besitzer GA4 A-13b, Befund C-ENTSCHEIDUNG-PERSON-OEFFENTLICH)', () => {
  it.fails('@W2A-004 Turnierleitung sieht, wer das Strafstoßschießen wann eingetragen hat', async () => {
    await zeigeEntschieden(shootout('D', 'P', 4, 3));
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent(/Olli · \d{2}:\d{2}/);
  });

  it.fails('@ET-027 der Verlauf hält die Entscheidung mit Person, Zeit und Ergebnis fest (Anzeige für die Turnierleitung)', async () => {
    await zeigeEntschieden(shootout('D', 'P', 4, 3));
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent(/Olli/);
  });

  it.fails('@ET-029 letzte Zeile: die Annahme steht mit Person und Zeit im Verlauf', async () => {
    await zeigeEntschieden(shared(['P', 'D']));
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent(/Olli · \d{2}:\d{2}/);
  });

  it.fails('@W2A-070 die Turnierleitung sieht, wer wann akzeptiert und zurückgenommen hat', async () => {
    await zeigeEntschieden(shared(['P', 'D']));
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent(/zurückgenommen von/);
  });
});
