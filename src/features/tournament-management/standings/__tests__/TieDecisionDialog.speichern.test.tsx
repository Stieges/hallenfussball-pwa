/**
 * Cloud-E2E N6d (@ET-055, @W2A-067), Regel „kein stiller Fehler“: Während der Dialog „Gleichstand entscheiden“ speichert, schließt
 * ihn nichts – weder Esc, Zurück-Taste, Abdunkelung, „X“ noch „Zurück“. Sonst ginge eine Ablehnung des Servers (etwa STALE) ungesehen
 * verloren: genau so blieb N6d rot ohne sichtbare Meldung (die Seite navigierte während des Speicherns, der Dialog schloss über
 * „Zurück“, die Ablehnung kam danach). Nach dem Speichern ist der Dialog wieder wie gewohnt schließbar (Gegenbeispiel).
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TieDecisionDialog } from '../TieDecisionDialog';
import { nikolaus } from '../../../../core/standings/__tests__/decisionTestKit';
import { groupTieView } from '../../../../core/standings/tieViews';
import type { DecideResult } from '../../../../core/services/StandingDecisionService';
import { fakeTie, i18nWrapper, withTie } from './tieTestKit';

vi.unmock('i18next');
vi.unmock('react-i18next');

/** Öffnet den Dialog im Nikolaus-Turnier, trägt 4:3 für Otting ein und speichert; die Antwort des Dienstes steuert der Test. */
async function speichernOffen() {
  const tie = fakeTie();
  let antworten: (result: DecideResult) => void = () => undefined;
  tie.decide.mockImplementation(() => new Promise<DecideResult>((resolve) => { antworten = resolve; }));
  const Wrapper = await i18nWrapper('de');
  const tournament = nikolaus();
  const block = groupTieView(tournament, '').open[0];
  const onClose = vi.fn();
  render(<Wrapper>{withTie(tie, <TieDecisionDialog tournament={tournament} block={block} onClose={onClose} />)}</Wrapper>);
  await userEvent.click(screen.getByTestId('tie-pick-shootout'));
  await userEvent.type(screen.getByLabelText(/DJK Otting/), '4');
  await userEvent.type(screen.getByLabelText(/TSV Petting/), '3');
  await userEvent.click(screen.getByTestId('tie-decision-save'));
  await waitFor(() => expect(tie.decide).toHaveBeenCalledTimes(1));
  const antworte = async (r: DecideResult): Promise<void> => {
    await act(async () => { antworten(r); await Promise.resolve(); });
  };
  return { tie, onClose, antworten: antworte };
}

/** Alle Wege, auf denen eine Person (oder eine Navigation) den Dialog schließen kann. */
function alleSchliesswege(): void {
  fireEvent.keyDown(document, { key: 'Escape' });
  act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
  const scrim = document.querySelector('.dialog-surface-scrim');
  if (scrim !== null) {
    fireEvent.click(scrim);
  }
  fireEvent.click(screen.getByTestId('tie-dialog-close'));
  fireEvent.click(screen.getByTestId('tie-dialog-cancel'));
}

describe('Kein stiller Fehler beim Eintragen des Strafstoßschießens (@ET-055, @W2A-067)', () => {
  it('@ET-055 während des Speicherns schließt nichts den Dialog; lehnt der Server ab (STALE), steht die Meldung im offenen Dialog', async () => {
    const { onClose, antworten } = await speichernOffen();
    expect(screen.getByTestId('tie-dialog-close')).toBeDisabled();
    expect(screen.getByTestId('tie-dialog-cancel')).toBeDisabled();
    alleSchliesswege();
    expect(onClose).not.toHaveBeenCalled();
    await antworten({ ok: false, code: 'STALE' });
    expect(await screen.findByTestId('tie-error')).toHaveTextContent('Speichern hat nicht geklappt, weil sich das Turnier gleichzeitig geändert hat');
    expect(screen.getByTestId('tie-decision-dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('@ET-055 Gegenbeispiel: nach der Ablehnung schließt Esc den Dialog wieder wie gewohnt', async () => {
    const { onClose, antworten } = await speichernOffen();
    await antworten({ ok: false, code: 'STALE' });
    await screen.findByTestId('tie-error');
    expect(screen.getByTestId('tie-dialog-close')).toBeEnabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('@ET-055 nimmt der Server an, schließt der Dialog genau einmal und die Tabelle lädt neu', async () => {
    const { tie, onClose, antworten } = await speichernOffen();
    alleSchliesswege();
    expect(onClose).not.toHaveBeenCalled();
    await antworten({ ok: true, decision: { id: 'e-1', groupId: '', teamIds: [], order: [], kind: 'shootout', basis: '' } });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(tie.onChanged).toHaveBeenCalledTimes(1);
  });
});
