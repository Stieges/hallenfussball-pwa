/**
 * Paket TB-B, Task TB-6d' (Einstellungen): die Einstellung „Diese Plätze müssen bei Gleichstand ausgespielt werden“ nach dem
 * Anlegen ändern, mit Rückfrage vor dem Speichern, wenn eine Annahme dadurch aufgehoben wird. Aus dem Gherkin: @W2A-068
 * (Zeile 3: Annahme wird aufgehoben, Zeile 6: Strafstoßschießen bleibt, Zeile 7: Rückfrage vor dem Speichern), @W2A-066,
 * @W2A-050 (nur Turnierleitung und Co-Admin), Sprung „Turnierregeln ansehen“ (Daniel G2). Mockup v3 Zustand 3.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayOutPlacesSettings } from '../PlayOutPlacesSettings';
import { MemoryRepo, nikolaus, shared, shootout } from '../../../../core/standings/__tests__/decisionTestKit';
import type { Tournament } from '../../../../types/tournament';
import { i18nWrapper } from './tieTestKit';

vi.unmock('i18next');
vi.unmock('react-i18next');

const can = vi.hoisted(() => ({ value: true }));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => can.value }));

beforeEach(() => { can.value = true; });

async function zeige(tournament: Tournament, jumpHere = false) {
  const Wrapper = await i18nWrapper('de');
  const onUpdate = vi.fn().mockResolvedValue({ ok: true });
  render(<Wrapper><PlayOutPlacesSettings tournament={tournament} onSave={onUpdate} jumpHere={jumpHere} /></Wrapper>);
  return onUpdate;
}

async function mitAnnahme(): Promise<Tournament> {
  const repo = new MemoryRepo(nikolaus());
  expect((await repo.service(['e-annahme']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
  return repo.tournament;
}

describe('Einstellung ändern (@W2A-066, @W2A-068)', () => {
  it('@W2A-066 zeigt die gespeicherte Einstellung (nur Platz 1), Speichern ist ohne Änderung gesperrt', async () => {
    await zeige(nikolaus());
    expect(screen.getByTestId('playout-place-1')).toBeChecked();
    expect(screen.getByTestId('playout-place-3')).not.toBeChecked();
    expect(screen.getByTestId('playout-save')).toBeDisabled();
  });

  it('@W2A-068 Zeile 3: Platz 3 anhaken hebt die Annahme für Petting und Otting auf – die App fragt VOR dem Speichern und nennt die Teams', async () => {
    const onUpdate = await zeige(await mitAnnahme());
    await userEvent.click(screen.getByTestId('playout-place-3'));
    await userEvent.click(screen.getByTestId('playout-save'));
    const dialog = screen.getByTestId('tie-places-confirm');
    expect(within(dialog).getByRole('heading', { name: 'Annahme wird aufgehoben' })).toBeInTheDocument();
    expect(within(dialog).getByTestId('playout-confirm-effect')).toHaveTextContent('Für TSV Petting und DJK Otting liegt die Annahme „Ergebnis so akzeptieren“ vor.');
    expect(dialog).toHaveTextContent('Ein eingetragenes Strafstoßschießen oder eine festgelegte Reihenfolge bleibt bei jeder Änderung bestehen.');
    expect(onUpdate).not.toHaveBeenCalled(); // noch nichts gespeichert
    await userEvent.click(within(dialog).getByTestId('playout-confirm-ok'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0]).toEqual([1, 3]); // nur die Einstellung, nicht das ganze Turnier
  });

  it('@W2A-068 Abbrechen in der Rückfrage speichert nichts und lässt die Auswahl stehen', async () => {
    const onUpdate = await zeige(await mitAnnahme());
    await userEvent.click(screen.getByTestId('playout-place-3'));
    await userEvent.click(screen.getByTestId('playout-save'));
    await userEvent.click(screen.getByTestId('playout-confirm-cancel'));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('tie-places-confirm')).toBeNull();
    expect(screen.getByTestId('playout-place-3')).toBeChecked();
  });

  it('@W2A-068 Gegenbeispiel: Platz 5 berührt den Gleichstand auf 3 und 4 nicht – gespeichert ohne Rückfrage', async () => {
    const onUpdate = await zeige(await mitAnnahme());
    await userEvent.click(screen.getByTestId('playout-place-5'));
    await userEvent.click(screen.getByTestId('playout-save'));
    expect(screen.queryByTestId('tie-places-confirm')).toBeNull();
    expect(onUpdate.mock.calls[0][0]).toEqual([1, 5]);
  });

  it('@W2A-068 Zeile 6: ein eingetragenes Strafstoßschießen bleibt bei Platz 3 bestehen – keine Rückfrage', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service(['e-sso']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    const onUpdate = await zeige(repo.tournament);
    await userEvent.click(screen.getByTestId('playout-place-3'));
    await userEvent.click(screen.getByTestId('playout-save'));
    expect(screen.queryByTestId('tie-places-confirm')).toBeNull();
    expect(onUpdate.mock.calls[0][0]).toEqual([1, 3]);
  });

  it('Zurücksetzen verwirft die Änderung, Speichern ist danach wieder gesperrt', async () => {
    await zeige(nikolaus());
    await userEvent.click(screen.getByTestId('playout-place-2'));
    expect(screen.getByTestId('playout-save')).toBeEnabled();
    await userEvent.click(screen.getByTestId('playout-reset'));
    expect(screen.getByTestId('playout-place-2')).not.toBeChecked();
    expect(screen.getByTestId('playout-save')).toBeDisabled();
  });
});

describe('Konflikt und Netz: sichtbar, nie still (Fixrunde TB-6)', () => {
  it('Versionskonflikt (STALE): die Meldung steht neben der Auswahl; Gegenbeispiel: bei Erfolg keine Meldung', async () => {
    const Wrapper = await i18nWrapper('de');
    const onSave = vi.fn().mockResolvedValueOnce({ ok: false, code: 'STALE' }).mockResolvedValueOnce({ ok: true });
    render(<Wrapper><PlayOutPlacesSettings tournament={nikolaus()} onSave={onSave} /></Wrapper>);
    await userEvent.click(screen.getByTestId('playout-place-5'));
    await userEvent.click(screen.getByTestId('playout-save'));
    expect(await screen.findByTestId('playout-error')).toHaveTextContent('gleichzeitig geändert und wurde nicht gespeichert');
    await userEvent.click(screen.getByTestId('playout-save'));
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('playout-error')).toBeNull();
  });

  it('ohne Netz (OFFLINE): „Speichern geht nur mit Netz.“', async () => {
    const Wrapper = await i18nWrapper('de');
    render(<Wrapper><PlayOutPlacesSettings tournament={nikolaus()} onSave={vi.fn().mockResolvedValue({ ok: false, code: 'OFFLINE' })} /></Wrapper>);
    await userEvent.click(screen.getByTestId('playout-place-5'));
    await userEvent.click(screen.getByTestId('playout-save'));
    expect(await screen.findByTestId('playout-error')).toHaveTextContent('Speichern geht nur mit Netz.');
  });
});

describe('Fehler nie still (Review TB-6 A4)', () => {
  it('abgelehntes Versprechen (Netzfehler trotz „online“): sichtbare Meldung, keine ungefangene Ablehnung; Gegenbeispiel: Erfolg ohne Meldung', async () => {
    const Wrapper = await i18nWrapper('de');
    const onSave = vi.fn().mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce({ ok: true });
    render(<Wrapper><PlayOutPlacesSettings tournament={nikolaus()} onSave={onSave} /></Wrapper>);
    await userEvent.click(screen.getByTestId('playout-place-5'));
    await userEvent.click(screen.getByTestId('playout-save'));
    expect(await screen.findByTestId('playout-error')).toHaveTextContent('Das Speichern hat nicht geklappt');
    expect(screen.getByTestId('playout-save')).toBeEnabled(); // erneut versuchen geht
    await userEvent.click(screen.getByTestId('playout-save'));
    expect(screen.queryByTestId('playout-error')).toBeNull();
  });
});

describe('Wer ändern darf und der Sprung aus dem Dialog (@W2A-050, G2)', () => {
  it('@W2A-050 ohne das Recht (Helfer): Auswahl gesperrt, keine Speichern-Taste, der Text nennt die Turnierleitung', async () => {
    can.value = false;
    await zeige(nikolaus());
    expect(screen.getByTestId('playout-place-1')).toBeDisabled();
    expect(screen.queryByTestId('playout-save')).toBeNull();
    expect(screen.getByTestId('playout-readonly')).toHaveTextContent('Nur die Turnierleitung ändert diese Einstellung.');
  });

  it('G2: Aufruf mit ?abschnitt=gleichstand (jumpHere) holt den Abschnitt ins Bild; Gegenbeispiel: ohne den Parameter nicht', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    await zeige(nikolaus(), false);
    expect(scroll).not.toHaveBeenCalled();
    document.body.innerHTML = '';
    await zeige(nikolaus(), true);
    expect(scroll).toHaveBeenCalled();
  });
});

describe('Englisch', () => {
  it('die Rückfrage hat englische Texte', async () => {
    const Wrapper = await i18nWrapper('en');
    const onUpdate = vi.fn().mockResolvedValue({ ok: true });
    render(<Wrapper><PlayOutPlacesSettings tournament={await mitAnnahme()} onSave={onUpdate} /></Wrapper>);
    fireEvent.click(screen.getByTestId('playout-place-3'));
    fireEvent.click(screen.getByTestId('playout-save'));
    expect(within(screen.getByTestId('tie-places-confirm')).getByRole('heading', { name: 'Acceptance will be withdrawn' })).toBeInTheDocument();
  });
});
