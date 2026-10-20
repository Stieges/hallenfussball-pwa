/**
 * Paket TB-B, Task TB-6b/TB-6b' (Oberfläche): Hinweis zur Gruppentabelle bei Gleichstand – beide Hinweisformen, Helfer
 * ohne Tasten, ohne Netz gesperrt, entschieden mit „zurücknehmen“ (G6, ohne Rückfrage), nach Gruppenabschluss mit Schloss.
 * Aus dem Gherkin (nicht am Code abgelesen): @ET-025, @W2A-047, @W2A-050, @W2A-062, @W2A-063, @W2A-064, @W2A-067, @W2A-070,
 * @W2A-071. Mockup v3 (Daniel G1, G2, G5, G6). „Wer/wann“ steht bis GA4 A-13b nirgends: it.fails mit Befund
 * C-ENTSCHEIDUNG-PERSON-OEFFENTLICH (@W2A-063 letzte Zeile, @W2A-071 Zeile 3, @ET-029 letzte Zeile).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { TieGroupHint } from '../TieGroupHint';
import { DATA, id } from '../../../../core/standings/__tests__/fixtures';
import { jgj, lage048, MemoryRepo, nikolaus, shared, shootout } from '../../../../core/standings/__tests__/decisionTestKit';
import { teamSlot } from '../../../../core/models/matchSlot';
import type { DecisionDraft } from '../../../../core/standings/decisions';
import type { Tournament } from '../../../../types/tournament';
import { fakeTie, i18nWrapper, withTie, type FakeTie } from './tieTestKit';

vi.unmock('i18next');
vi.unmock('react-i18next');

async function zeige(tournament: Tournament, groupId: string, tie: FakeTie | null): Promise<void> {
  const Wrapper = await i18nWrapper('de');
  const hint: ReactNode = <TieGroupHint tournament={tournament} groupId={groupId} />;
  render(<Wrapper>{tie === null ? hint : withTie(tie, hint)}</Wrapper>);
}

const mitEntscheidung = async (t: Tournament, draft: DecisionDraft): Promise<Tournament> => {
  const repo = new MemoryRepo(t);
  expect((await repo.service(['e-1']).decide(repo.tournament.id, draft)).ok).toBe(true);
  return repo.tournament;
};

describe('Hinweis bei offenem Gleichstand (@ET-025, @W2A-067, @W2A-064)', () => {
  it('@W2A-067 Nikolaus mit Voreinstellung: „Gleichstand – Entscheidung nötig“ mit beiden Wegen und der Taste „Gleichstand entscheiden“ (Turnierleitung)', async () => {
    await zeige(nikolaus(), '', fakeTie());
    const hint = screen.getByTestId('tie-hint-choice');
    expect(within(hint).getByText('Gleichstand – Entscheidung nötig')).toBeInTheDocument();
    expect(hint).toHaveTextContent('TSV Petting und DJK Otting sind nach allen Kriterien gleich (Platz 3 und 4).');
    expect(hint).toHaveTextContent('Strafstoßschießen eintragen oder Ergebnis so akzeptieren.');
    expect(screen.getByTestId('tie-decide-entry')).toHaveTextContent('Gleichstand entscheiden');
    // Gegenbeispiel: die Pflicht-Form ist nicht da
    expect(screen.queryByTestId('tie-hint-mandatory')).toBeNull();
    expect(screen.queryByTestId('tie-shootout-entry')).toBeNull();
  });

  it('@W2A-064 Platz 3 ist eingestellt: „Strafstoßschießen nötig“ mit Grund und nur der Taste „Strafstoßschießen eintragen“', async () => {
    await zeige(nikolaus([1, 2, 3]), '', fakeTie());
    const hint = screen.getByTestId('tie-hint-mandatory');
    expect(within(hint).getByText('Strafstoßschießen nötig')).toBeInTheDocument();
    expect(hint).toHaveTextContent('Platz 3 muss laut Turnierregeln ausgespielt werden.');
    expect(screen.getByTestId('tie-shootout-entry')).toHaveTextContent('Strafstoßschießen eintragen');
    expect(screen.queryByTestId('tie-decide-entry')).toBeNull(); // Gegenbeispiel: keine Wahl
    expect(screen.queryByTestId('tie-hint-choice')).toBeNull();
  });

  it('@W2A-044 drei Teams mit Pflicht: Taste „Reihenfolge festlegen“ (Daniel G1), nicht „Strafstoßschießen eintragen“', async () => {
    await zeige(jgj('WOUMNB', DATA.W2A_044, [1, 2]), '', fakeTie());
    expect(screen.getByTestId('tie-hint-mandatory')).toHaveTextContent('Platz 2 muss laut Turnierregeln ausgespielt werden.');
    expect(screen.getByTestId('tie-order-entry')).toHaveTextContent('Reihenfolge festlegen');
    expect(screen.queryByTestId('tie-shootout-entry')).toBeNull();
  });

  it('@W2A-064 Platz führt in ein weiteres Spiel (Halbfinale 2): der Grund nennt das weitere Spiel', async () => {
    await zeige(lage048(), 'A', fakeTie());
    const hint = screen.getByTestId('tie-hint-mandatory');
    expect(hint).toHaveTextContent('SV Süd und TSV West sind nach allen Kriterien gleich (Platz 2 und 3).');
    expect(hint).toHaveTextContent('Platz 2 der Gruppe spielt in einem weiteren Spiel weiter – ein gleicher Platz ginge dort nicht.');
    expect(hint).not.toHaveTextContent('Turnierregeln');
  });

  it('@W2A-047 mitten in der Gruppe: kein Hinweis, keine Taste (Gegenbeispiel: nach allen Spielen ist er da)', async () => {
    const mitten = { ...jgj('RKMUNO', DATA.ET_055), matches: jgj('RKMUNO', DATA.ET_055).matches.map((m, i) => (i >= 12 ? { ...m, matchStatus: 'scheduled' as const, scoreA: undefined, scoreB: undefined } : m)) };
    await zeige(mitten, '', fakeTie());
    expect(screen.queryByTestId('tie-hint-choice')).toBeNull();
    expect(screen.queryByTestId('tie-hint-mandatory')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Wer sieht welche Tasten (@W2A-050, @W2A-071, @W2A-062)', () => {
  it('@W2A-050 Helfer: Hinweis sichtbar, aber weder „Gleichstand entscheiden“ noch andere Tasten; der Text nennt, wer entscheidet', async () => {
    await zeige(nikolaus([1, 2, 3]), '', fakeTie({ canDecide: false }));
    expect(screen.getByTestId('tie-hint-mandatory')).toHaveTextContent('Die Turnierleitung trägt das Ergebnis des Strafstoßschießens ein.');
    expect(screen.queryByRole('button')).toBeNull();
    // Gegenbeispiel: Wahl-Fall, Helfer kann weder eintragen noch akzeptieren
    expect(screen.queryByTestId('tie-decide-entry')).toBeNull();
  });

  it('@W2A-050 Helfer, Wahl-Fall: der Text nennt beide Wege, keine Taste', async () => {
    await zeige(nikolaus(), '', fakeTie({ canDecide: false }));
    expect(screen.getByTestId('tie-hint-choice')).toHaveTextContent('Die Turnierleitung entscheidet: Strafstoßschießen oder Ergebnis so akzeptieren.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('@W2A-062 ohne Netz: die Taste ist sichtbar, aber gesperrt, der Hinweis nennt „Gruppe abschließen“; ein Klick öffnet nichts', async () => {
    await zeige(nikolaus(), '', fakeTie({ online: false }));
    const entry = screen.getByTestId('tie-decide-entry');
    expect(entry).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('tie-offline-hint')).toHaveTextContent('Entscheiden geht nur mit Netz – oder über „Gruppe abschließen“.');
    await userEvent.click(entry);
    expect(screen.queryByTestId('tie-decision-dialog')).toBeNull();
  });

  it('ohne Anbieter (Zuschauer-Vorschau ohne Kontext): Hinweis ohne Tasten', async () => {
    await zeige(nikolaus(), '', null);
    expect(screen.getByTestId('tie-hint-choice')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Entschieden: Ergebnis sichtbar, zurücknehmen bis zum Gruppenabschluss (@W2A-063, @W2A-070, @W2A-071, G6)', () => {
  it('@W2A-063 nach „Ergebnis so akzeptieren“: Hinweis „Ergebnis akzeptiert“, Platz 3 geteilt, nächstes Team Platz 5, ohne Name und Zeit', async () => {
    const t = await mitEntscheidung(nikolaus(), shared(['P', 'D']));
    await zeige(t, '', fakeTie());
    const info = screen.getByTestId('tie-decided-info');
    expect(info).toHaveTextContent('Ergebnis akzeptiert');
    expect(info).toHaveTextContent('TSV Petting und DJK Otting teilen Platz 3. Das nächste Team steht auf Platz 5.');
    expect(info.textContent).not.toMatch(/\d{1,2}:\d{2}\s*$/); // keine Uhrzeit (Name/Zeit erst mit GA4 A-13b)
    expect(screen.queryByTestId('tie-hint-choice')).toBeNull();
  });

  it('@W2A-070 „Annahme zurücknehmen“ geht ohne Rückfrage in einem Tipp (Daniel G6)', async () => {
    const t = await mitEntscheidung(nikolaus(), shared(['P', 'D']));
    const tie = fakeTie();
    await zeige(t, '', tie);
    expect(screen.getByText('Möglich bis zum Abschluss der Gruppe.')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('tie-accept-withdraw'));
    expect(tie.withdraw).toHaveBeenCalledWith(t.id, 'e-1'); // keine Rückfrage dazwischen
    await waitFor(() => expect(tie.onChanged).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('@W2A-071 Helfer sieht „Gleicher Platz“ und das Ergebnis, aber keine Taste zum Zurücknehmen', async () => {
    const t = await mitEntscheidung(nikolaus(), shared(['P', 'D']));
    await zeige(t, '', fakeTie({ canDecide: false }));
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent('Gleicher Platz');
    expect(screen.queryByTestId('tie-accept-withdraw')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('@ET-055 Strafstoßschießen 4:3 für Otting: Titel mit Ergebnis, „Strafstoßschießen zurücknehmen“ für die Turnierleitung', async () => {
    const t = await mitEntscheidung(nikolaus(), shootout('D', 'P', 4, 3));
    const tie = fakeTie();
    await zeige(t, '', tie);
    const info = screen.getByTestId('tie-decided-info');
    expect(info).toHaveTextContent('Strafstoßschießen 4:3 für DJK Otting');
    expect(info).toHaveTextContent('DJK Otting steht in der Tabelle vor TSV Petting.');
    await userEvent.click(screen.getByTestId('tie-accept-withdraw'));
    expect(screen.getByTestId('tie-accept-withdraw')).toHaveTextContent('Strafstoßschießen zurücknehmen');
    expect(tie.withdraw).toHaveBeenCalledWith(t.id, 'e-1');
  });

  it('@W2A-070 nach dem Gruppenabschluss: Schloss-Hinweis, keine Taste mehr; Gegenbeispiel: Helfer sieht den Schloss-Hinweis nicht', async () => {
    const repo = new MemoryRepo(lage048());
    expect((await repo.service(['e-w']).decide(repo.tournament.id, shootout('W', 'S', 4, 3, 'A'))).ok).toBe(true);
    const geschlossen: Tournament = {
      ...repo.tournament,
      matches: repo.tournament.matches.map((m) => (m.id === 'hf-1' ? { ...m, slotA: teamSlot(id('N')), originA: { kind: 'groupRank' as const, group: 'A', rank: 1 } } : m)),
    };
    const tie = fakeTie();
    await zeige(geschlossen, 'A', tie);
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent('Strafstoßschießen 4:3 für TSV West');
    expect(screen.getByTestId('tie-closed-note')).toHaveTextContent('Die Gruppe ist abgeschlossen.');
    expect(screen.queryByTestId('tie-accept-withdraw')).toBeNull();
  });

  it('@W2A-070 nach dem Gruppenabschluss sieht der Helfer das Ergebnis, aber keinen Schloss-Hinweis', async () => {
    const repo = new MemoryRepo(lage048());
    expect((await repo.service(['e-w']).decide(repo.tournament.id, shootout('W', 'S', 4, 3, 'A'))).ok).toBe(true);
    const geschlossen: Tournament = {
      ...repo.tournament,
      matches: repo.tournament.matches.map((m) => (m.id === 'hf-1' ? { ...m, slotA: teamSlot(id('N')), originA: { kind: 'groupRank' as const, group: 'A', rank: 1 } } : m)),
    };
    await zeige(geschlossen, 'A', fakeTie({ canDecide: false }));
    expect(screen.getByTestId('tie-decided-info')).toBeInTheDocument();
    expect(screen.queryByTestId('tie-closed-note')).toBeNull();
  });

  it('@W2A-070 Zurücknehmen scheitert (WITHDRAW_NOT_ALLOWED): Meldung statt stiller Erfolg', async () => {
    const t = await mitEntscheidung(nikolaus(), shared(['P', 'D']));
    const tie = fakeTie();
    tie.withdraw.mockResolvedValue({ ok: false, code: 'WITHDRAW_NOT_ALLOWED' });
    await zeige(t, '', tie);
    await userEvent.click(screen.getByTestId('tie-accept-withdraw'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Zurücknehmen hat nicht geklappt');
  });

  it('@W2A-070 Zurücknehmen wirft einen Netzfehler (abgelehntes Versprechen): sichtbare Meldung, die Taste bleibt bedienbar; Gegenbeispiel: Erfolg ohne Meldung', async () => {
    const t = await mitEntscheidung(nikolaus(), shared(['P', 'D']));
    const tie = fakeTie();
    tie.withdraw.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce({ ok: true });
    await zeige(t, '', tie);
    await userEvent.click(screen.getByTestId('tie-accept-withdraw'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Zurücknehmen hat nicht geklappt');
    expect(screen.getByTestId('tie-accept-withdraw')).toBeEnabled();
    await userEvent.click(screen.getByTestId('tie-accept-withdraw'));
    await waitFor(() => expect(tie.onChanged).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // Befund C-ENTSCHEIDUNG-PERSON-OEFFENTLICH: „wer wann“ kommt mit dem Verlaufsprotokoll (GA4 A-13b)
  it.fails('@W2A-063 letzte Zeile: die Turnierleitung sieht, wer wann akzeptiert hat (Besitzer GA4 A-13b) – Befund C-ENTSCHEIDUNG-PERSON-OEFFENTLICH', async () => {
    const t = await mitEntscheidung(nikolaus(), shared(['P', 'D']));
    await zeige(t, '', fakeTie());
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent(/Olli · \d{2}:\d{2}/);
  });

  it.fails('@W2A-071 Zeile 3: Maria sieht, wer wann entschieden hat (Besitzer GA4 A-13b) – Befund C-ENTSCHEIDUNG-PERSON-OEFFENTLICH', async () => {
    const t = await mitEntscheidung(nikolaus(), shootout('D', 'P', 4, 3));
    await zeige(t, '', fakeTie());
    expect(screen.getByTestId('tie-decided-info')).toHaveTextContent(/Olli/);
  });
});
