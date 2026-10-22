/**
 * Paket TB-B, Task TB-6c/TB-6c' (Dialog „Gleichstand entscheiden“): Wahl (Strafstoßschießen/Reihenfolge oder „Ergebnis so
 * akzeptieren“, ohne Grundfeld), Ergebnis des Strafstoßschießens, Reihenfolge von drei Teams mit Grund, Feldmeldung ohne
 * Sieger, „schon entschieden“, ohne Netz, Modus „mit Abschluss“. Aus dem Gherkin: @ET-055, @W2A-044, @W2A-060, @W2A-061,
 * @W2A-062, @W2A-063, @W2A-064, @W2A-067, @TM-146. Mockup v3, Daniel G1/G2. „Von wem“ (Maria) nennt der Dienst aus dem Verlauf (GA4 A-13b-C).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TieDecisionDialog } from '../TieDecisionDialog';
import { DATA, id } from '../../../../core/standings/__tests__/fixtures';
import { jgj, lage048, nikolaus } from '../../../../core/standings/__tests__/decisionTestKit';
import { groupTieView } from '../../../../core/standings/tieViews';
import type { Tournament } from '../../../../types/tournament';
import { fakeTie, i18nWrapper, withTie, type FakeTie } from './tieTestKit';

vi.unmock('i18next');
vi.unmock('react-i18next');

async function open(tournament: Tournament, groupId: string, tie: FakeTie, extra: { mode?: 'table' | 'withClose'; onDraft?: (d: unknown) => void; lng?: 'de' | 'en' } = {}) {
  const Wrapper = await i18nWrapper(extra.lng ?? 'de');
  const block = groupTieView(tournament, groupId).open[0];
  const onClose = vi.fn();
  render(
    <Wrapper>{withTie(tie, <TieDecisionDialog tournament={tournament} block={block} onClose={onClose} mode={extra.mode} onDraft={extra.onDraft} />)}</Wrapper>,
  );
  return { onClose, block };
}

const dialog = () => screen.getByTestId('tie-decision-dialog');

describe('Wahl: Strafstoßschießen eintragen oder Ergebnis so akzeptieren (@W2A-063, @W2A-067)', () => {
  it('@W2A-067 Nikolaus mit Voreinstellung öffnet die Wahl: Haupttaste „Strafstoßschießen eintragen“, daneben „Ergebnis so akzeptieren“, kein Grundfeld', async () => {
    await open(nikolaus(), '', fakeTie());
    expect(within(dialog()).getByRole('heading', { name: 'Gleichstand entscheiden' })).toBeInTheDocument();
    expect(screen.getByTestId('tie-dialog-context')).toHaveTextContent('Gleichauf auf Platz 3 und 4 nach allen Kriterien: TSV Petting und DJK Otting.');
    expect(screen.getByTestId('tie-pick-shootout')).toHaveTextContent('Strafstoßschießen eintragen');
    expect(screen.getByTestId('tie-accept-result')).toHaveTextContent('Ergebnis so akzeptieren');
    expect(screen.getByText(/Ein Tipp genügt, einen Grund brauchst du nicht\. TSV Petting und DJK Otting teilen dann Platz 3, das nächste Team steht auf Platz 5\./)).toBeInTheDocument();
    expect(screen.queryByTestId('tie-reason')).toBeNull(); // Gegenbeispiel: kein Grundfeld bei der Annahme
  });

  it('@W2A-063 „Ergebnis so akzeptieren“ speichert in einem Tipp ohne Grund und ohne Rückfrage, lädt neu und schließt', async () => {
    const tie = fakeTie();
    const t = nikolaus();
    const { onClose } = await open(t, '', tie);
    await userEvent.click(screen.getByTestId('tie-accept-result'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(tie.decide).toHaveBeenCalledTimes(1);
    expect(tie.decide).toHaveBeenCalledWith(t.id, expect.objectContaining({ kind: 'shared', teamIds: [id('P'), id('D')] }));
    expect(tie.decide.mock.calls[0][1]).not.toHaveProperty('reason');
    expect(tie.onChanged).toHaveBeenCalled();
  });

  it('@W2A-044 bei drei Teams heißt der Normalweg „Reihenfolge festlegen“ (Daniel G1), mit der Zeile „Nach dem Strafstoßschießen“', async () => {
    await open(jgj('WOUMNB', DATA.W2A_044), '', fakeTie());
    expect(screen.getByTestId('tie-pick-shootout')).toHaveTextContent('Reihenfolge festlegen');
    expect(screen.getByText('Nach dem Strafstoßschießen. Du nennst kurz den Grund.')).toBeInTheDocument();
    expect(screen.getByTestId('tie-accept-result')).toHaveTextContent('Ergebnis so akzeptieren');
  });
});

describe('Strafstoßschießen eintragen (@ET-055, @W2A-061, @W2A-064)', () => {
  it('@ET-055 4:3 für Otting: Der Dienst bekommt Otting als Sieger mit {winner: 4, loser: 3}; „Zurück“ führt zur Wahl', async () => {
    const tie = fakeTie();
    const t = nikolaus();
    const { onClose } = await open(t, '', tie);
    await userEvent.click(screen.getByTestId('tie-pick-shootout'));
    expect(within(dialog()).getByRole('heading', { name: 'Strafstoßschießen eintragen' })).toBeInTheDocument();
    expect(screen.getByTestId('tie-decision-save')).toBeDisabled(); // ohne Zahlen nichts zu speichern
    await userEvent.type(screen.getByLabelText(/DJK Otting/), '4');
    await userEvent.type(screen.getByLabelText(/TSV Petting/), '3');
    expect(screen.getByTestId('tie-effect')).toHaveTextContent('Danach in der Tabelle: 3. DJK Otting, 4. TSV Petting');
    await userEvent.click(screen.getByTestId('tie-decision-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(tie.decide).toHaveBeenCalledWith(t.id, expect.objectContaining({ kind: 'shootout', order: [id('D'), id('P')], shootout: { winner: 4, loser: 3 } }));
  });

  it('@ET-055 Gegenbeispiel: 3:4 für Petting dreht die Reihenfolge – der Sieger ist, wer mehr Treffer hat', async () => {
    const tie = fakeTie();
    await open(nikolaus(), '', tie);
    await userEvent.click(screen.getByTestId('tie-pick-shootout'));
    await userEvent.type(screen.getByLabelText(/TSV Petting/), '5');
    await userEvent.type(screen.getByLabelText(/DJK Otting/), '4');
    await userEvent.click(screen.getByTestId('tie-decision-save'));
    await waitFor(() => expect(tie.decide).toHaveBeenCalled());
    expect(tie.decide.mock.calls[0][1]).toMatchObject({ order: [id('P'), id('D')], shootout: { winner: 5, loser: 4 } });
  });

  it('@W2A-061 4:4: die Meldung steht am Feld, der Dienst wird nicht gerufen; Gegenbeispiel: nach dem Korrigieren verschwindet sie und 5:4 geht', async () => {
    const tie = fakeTie();
    await open(nikolaus(), '', tie);
    await userEvent.click(screen.getByTestId('tie-pick-shootout'));
    await userEvent.type(screen.getByLabelText(/DJK Otting/), '4');
    await userEvent.type(screen.getByLabelText(/TSV Petting/), '4');
    await userEvent.click(screen.getByTestId('tie-decision-save'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Das Strafstoßschießen braucht einen Sieger. 4:4 geht nicht – trage das Endergebnis ein.');
    expect(screen.getByLabelText(/DJK Otting/)).toHaveAttribute('aria-invalid', 'true');
    expect(tie.decide).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/DJK Otting/), '5');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('@W2A-064 Pflicht wegen der Einstellung: öffnet gleich das Strafstoßschießen, nennt den Grund und bietet „Turnierregeln ansehen“; keine Wahl', async () => {
    const tie = fakeTie();
    const { onClose } = await open(nikolaus([1, 2, 3]), '', tie);
    expect(within(dialog()).getByRole('heading', { name: 'Strafstoßschießen eintragen' })).toBeInTheDocument();
    expect(screen.queryByTestId('tie-accept-result')).toBeNull();
    const why = screen.getByTestId('tie-why');
    expect(why).toHaveTextContent('Warum nur das Strafstoßschießen?');
    expect(why).toHaveTextContent('Platz 3 muss laut Turnierregeln ausgespielt werden.');
    await userEvent.click(within(why).getByTestId('tie-open-rules'));
    expect(onClose).toHaveBeenCalled();
    expect(tie.openRules).toHaveBeenCalled();
  });

  it('@W2A-064 Pflicht wegen eines weiteren Spiels: der Grund nennt das Halbfinale, aber keinen Sprung in die Turnierregeln (G2)', async () => {
    await open(lage048(), 'A', fakeTie());
    const why = screen.getByTestId('tie-why');
    expect(why).toHaveTextContent('Platz 2 der Gruppe spielt in einem weiteren Spiel weiter – ein gleicher Platz ginge dort nicht.');
    expect(screen.queryByTestId('tie-open-rules')).toBeNull();
    expect(screen.queryByTestId('tie-accept-result')).toBeNull();
  });
});

describe('Reihenfolge von drei Teams mit Grund (@W2A-044)', () => {
  it('Speichern bleibt ohne Grund gesperrt; mit Grund geht die Reihenfolge samt Grund an den Dienst; Pfeile ordnen um', async () => {
    const tie = fakeTie();
    const t = jgj('WOUMNB', DATA.W2A_044, [1, 2]);
    await open(t, '', tie);
    expect(within(dialog()).getByRole('heading', { name: 'Reihenfolge festlegen' })).toBeInTheDocument();
    const rows = () => within(screen.getByTestId('tie-order')).getAllByRole('listitem').map((li) => li.textContent);
    const before = rows();
    expect(before[0]).toMatch(/^2\./); // Platz 2 ist der erste Platz des Blocks
    expect(screen.getByTestId('tie-decision-save')).toBeDisabled();
    await userEvent.click(screen.getByTestId(`tie-order-down-${id('W')}`));
    expect(rows()).not.toEqual(before);
    await userEvent.type(screen.getByTestId('tie-reason'), 'Strafstoßschießen');
    expect(screen.getByTestId('tie-decision-save')).toBeEnabled();
    await userEvent.click(screen.getByTestId('tie-decision-save'));
    await waitFor(() => expect(tie.decide).toHaveBeenCalled());
    const draft = tie.decide.mock.calls[0][1] as { kind: string; reason: string; order: string[]; teamIds: string[] };
    expect(draft).toMatchObject({ kind: 'order', reason: 'Strafstoßschießen' });
    expect([...draft.order].sort()).toEqual([...draft.teamIds].sort());
    expect(draft.order[0]).not.toBe(draft.teamIds[0]); // die Reihenfolge wurde tatsächlich umgestellt
  });

  it('der Hinweis am Grundfeld verspricht keine Sichtbarkeit: der Grund wird bis GA4 A-13b verworfen, „nur für die Turnierleitung sichtbar“ steht nicht da', async () => {
    await open(jgj('WOUMNB', DATA.W2A_044, [1, 2]), '', fakeTie());
    expect(screen.getByText('Bitte keine Spielernamen eintragen.')).toBeInTheDocument();
    expect(dialog().textContent).not.toMatch(/sichtbar/);
  });

  it('Gegenbeispiel: ein Grund nur aus Leerzeichen zählt nicht', async () => {
    await open(jgj('WOUMNB', DATA.W2A_044, [1, 2]), '', fakeTie());
    await userEvent.type(screen.getByTestId('tie-reason'), '   ');
    expect(screen.getByTestId('tie-decision-save')).toBeDisabled();
  });
});

describe('Konflikte und Fehler (@W2A-060)', () => {
  it('@W2A-060 „schon entschieden“: der Eintrag wird nicht gespeichert, die Tabelle lädt neu, der Dialog erklärt es (Verstanden schließt)', async () => {
    const tie = fakeTie();
    tie.decide.mockResolvedValue({ ok: false, code: 'ALREADY_DECIDED' });
    const { onClose } = await open(nikolaus(), '', tie);
    await userEvent.click(screen.getByTestId('tie-accept-result'));
    expect(await screen.findByTestId('tie-seen')).toHaveTextContent('Schon entschieden');
    expect(screen.getByText('Dein Eintrag wurde nicht gespeichert. Die Tabelle zeigt die geltende Entscheidung.')).toBeInTheDocument();
    expect(tie.onChanged).toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('tie-dialog-understood'));
    expect(onClose).toHaveBeenCalled();
  });

  it('@W2A-060 „von wem schon entschieden wurde“ (Maria): der Dienst nennt die Person aus dem Verlauf (GA4 A-13b-C)', async () => {
    const tie = fakeTie();
    tie.decide.mockResolvedValue({ ok: false, code: 'ALREADY_DECIDED', by: 'Maria' });
    await open(nikolaus(), '', tie);
    await userEvent.click(screen.getByTestId('tie-accept-result'));
    expect(await screen.findByTestId('tie-seen')).toHaveTextContent('Schon entschieden von Maria');
  });

  it.each([
    ['BLOCK_CHANGED', 'Der Gleichstand hat sich inzwischen geändert'],
    ['STALE', 'Speichern hat nicht geklappt, weil sich das Turnier gleichzeitig geändert hat'],
    ['SHARED_PLACE_NOT_ALLOWED', 'Dieser Platz muss ausgespielt werden'],
  ] as const)('Dienst meldet %s: die Meldung steht im Dialog, er bleibt offen', async (code, text) => {
    const tie = fakeTie();
    tie.decide.mockResolvedValue({ ok: false, code });
    const { onClose } = await open(nikolaus(), '', tie);
    await userEvent.click(screen.getByTestId('tie-accept-result'));
    expect(await screen.findByTestId('tie-error')).toHaveTextContent(text);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Ohne Netz und Modus „mit Abschluss“ (@W2A-062, @TM-146)', () => {
  it('@W2A-062 ohne Netz: „Ergebnis so akzeptieren“ und Speichern sind gesperrt, der Hinweis nennt „Gruppe abschließen“; der Dienst wird nicht gerufen', async () => {
    const tie = fakeTie({ online: false });
    await open(nikolaus(), '', tie);
    expect(screen.getByTestId('tie-offline-hint')).toHaveTextContent('Entscheiden geht nur mit Netz – oder über „Gruppe abschließen“.');
    expect(screen.getByTestId('tie-accept-result')).toBeDisabled();
    await userEvent.click(screen.getByTestId('tie-pick-shootout'));
    await userEvent.type(screen.getByLabelText(/DJK Otting/), '4');
    await userEvent.type(screen.getByLabelText(/TSV Petting/), '3');
    expect(screen.getByTestId('tie-decision-save')).toBeDisabled();
    expect(tie.decide).not.toHaveBeenCalled();
  });

  it('@TM-146 Modus „mit Abschluss“ geht auch ohne Netz: prüft mit validateDraft und gibt den Entwurf zurück, ohne den Dienst zu rufen', async () => {
    const tie = fakeTie({ online: false });
    const onDraft = vi.fn();
    const t = nikolaus();
    const { onClose } = await open(t, '', tie, { mode: 'withClose', onDraft });
    expect(screen.queryByTestId('tie-offline-hint')).toBeNull();
    await userEvent.click(screen.getByTestId('tie-pick-shootout'));
    await userEvent.type(screen.getByLabelText(/DJK Otting/), '4');
    await userEvent.type(screen.getByLabelText(/TSV Petting/), '3');
    await userEvent.click(screen.getByTestId('tie-decision-save'));
    await waitFor(() => expect(onDraft).toHaveBeenCalled());
    expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({ kind: 'shootout', shootout: { winner: 4, loser: 3 } }));
    expect(onClose).toHaveBeenCalled();
    expect(tie.decide).not.toHaveBeenCalled();
  });

  it('@TM-146 Modus „mit Abschluss“ lehnt dieselben Fehler ab wie der Dienst: 4:4 ohne Sieger gibt keinen Entwurf zurück', async () => {
    const onDraft = vi.fn();
    await open(nikolaus(), '', fakeTie(), { mode: 'withClose', onDraft });
    await userEvent.click(screen.getByTestId('tie-pick-shootout'));
    await userEvent.type(screen.getByLabelText(/DJK Otting/), '4');
    await userEvent.type(screen.getByLabelText(/TSV Petting/), '4');
    await userEvent.click(screen.getByTestId('tie-decision-save'));
    expect(await screen.findByRole('alert')).toHaveTextContent('braucht einen Sieger');
    expect(onDraft).not.toHaveBeenCalled();
  });
});

describe('Englisch (Sprachparität)', () => {
  it('der Wahl-Dialog zeigt die englischen Texte, keine rohen Schlüssel', async () => {
    await open(nikolaus(), '', fakeTie(), { lng: 'en' });
    expect(screen.getByTestId('tie-pick-shootout')).toHaveTextContent('Enter penalty shootout');
    expect(screen.getByTestId('tie-accept-result')).toHaveTextContent('Accept result as it is');
    expect(dialog().textContent).not.toMatch(/standingsTie\./);
  });
});
