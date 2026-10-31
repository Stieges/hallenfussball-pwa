/**
 * B-50 Klärungsliste der Turnierleitung – Verhaltenstest mit echten DE-Texten, aus dem Gherkin (Fundament F1b, Helfer):
 * @FU-038, @FU-095, @FU-096, @FU-017, @HE-056, @HE-080, @FU-130, @FU-037. Gegenbeispiele je Szenario.
 * Engine und Senden sind ersetzt (`useReviewDecision`): geprüft wird, was Olli sieht und welche Entscheidungen gehen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { cssVars } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { ReviewDecisionApi } from '../useReviewDecision';
import { NORD, SUED, ctx, review, runningState } from '../../../core/match/review/__tests__/reviewFixtures';
import type { MatchReview } from '../../../core/match/review/matchReviewTypes';

await initRealDeI18n();

const decide = vi.fn<ReviewDecisionApi['decide']>();
const api: ReviewDecisionApi = {
  entryFor: () => ({ matchId: 'match-9', ctx, meta: { homeTeam: { name: 'FC Nord' }, awayTeam: { name: 'SV Süd' } } } as never),
  stateFor: () => runningState(),
  serverNow: () => 5000,
  penaltySeconds: 120,
  decide,
  prepare: () => Promise.resolve(),
};
vi.mock('../useReviewDecision', () => ({ useReviewDecision: () => api }));

const { KlaerungslisteDialog } = await import('../KlaerungslisteDialog');

const tournament = { id: 'live-cup', teams: [{ id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }] } as unknown as Tournament;

function show(reviews: MatchReview[]) {
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(<KlaerungslisteDialog isOpen onClose={vi.fn()} tournament={tournament} reviews={reviews} refresh={refresh} />);
  return { refresh, liste: screen.getByTestId('klaerungsliste') };
}

beforeEach(() => {
  decide.mockReset();
  decide.mockResolvedValue({ status: 'saved', accepted: 0, matchFinished: false });
});

describe('@FU-038 Unklarer Offline-Eintrag landet in der Klärungsliste', () => {
  it('Olli sieht „1 Eintrag von Tom nach Übernahme“ mit „Übernehmen“ und „Verwerfen“', () => {
    const tor = review({ eventId: 'tor-1208' });
    const { liste } = show([tor]);
    expect(liste).toHaveTextContent('1 Eintrag von Tom nach Übernahme');
    expect(liste).toHaveTextContent('Spiel 9 · Feld 2');
    expect(screen.getByTestId('klaerung-fall-tor-1208-uebernehmen')).toHaveTextContent('Übernehmen');
    expect(screen.getByTestId('klaerung-fall-tor-1208-verwerfen')).toHaveTextContent('Verwerfen');
  });

  it('„Verwerfen“ entscheidet mit einem Tipp und lädt die Liste neu', async () => {
    const tor = review({ eventId: 'tor-1208' });
    const { refresh } = show([tor]);
    fireEvent.click(screen.getByTestId('klaerung-fall-tor-1208-verwerfen'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(decide).toHaveBeenCalledWith('match-9', [{ targetId: 'tor-1208', type: 'REVIEW_DISCARD' }]);
  });

  it('Gegenbeispiel: ohne offenen Eintrag „Nichts zu klären.“', () => {
    show([review({ decision: { type: 'REVIEW_ACCEPT', eventId: 'd', at: 1, by: 'Olli' } })]);
    expect(screen.getByTestId('klaerungsliste-leer')).toHaveTextContent('Nichts zu klären.');
  });
});

describe('@FU-095 Aus einem Fall übernimmt die Turnierleitung einzelne Einträge', () => {
  const fall = () => [
    review({ eventId: 'tor-nord', entry: { type: 'GOAL', teamId: NORD, clockMs: 60_000 } }),
    review({ eventId: 'tor-sued', entry: { type: 'GOAL', teamId: SUED, clockMs: 70_000 } }),
    review({ eventId: 'gelb-5', entry: { type: 'YELLOW_CARD', teamId: SUED, clockMs: 80_000, payload: { playerNumber: 5 } } }),
  ];

  it('aufklappen, beide Tore abwählen, „Übernehmen“: Vorschau ohne die Tore und mit der Gelben Karte, dann gespeichert', async () => {
    const { liste } = show(fall());
    expect(liste).toHaveTextContent('3 Einträge von Tom nach Übernahme');
    fireEvent.click(screen.getByTestId('klaerung-fall-tor-nord-aufklappen'));
    fireEvent.click(screen.getByTestId('klaerung-haken-tor-nord'));
    fireEvent.click(screen.getByTestId('klaerung-haken-tor-sued'));
    fireEvent.click(screen.getByTestId('klaerung-fall-tor-nord-uebernehmen'));
    const vorschau = screen.getByTestId('klaerung-fall-tor-nord-vorschau');
    expect(vorschau).toHaveTextContent('Neuer Stand: FC Nord 0:0 SV Süd');
    expect(vorschau).toHaveTextContent('Übernommen: Gelbe Karte SV Süd, Nr. 5');
    expect(vorschau).not.toHaveTextContent('Tor');
    expect(decide).not.toHaveBeenCalled(); // erst „Speichern“ speichert
    fireEvent.click(screen.getByTestId('klaerung-fall-tor-nord-speichern'));
    await waitFor(() => expect(decide).toHaveBeenCalledWith('match-9', [
      { targetId: 'gelb-5', type: 'REVIEW_ACCEPT' },
      { targetId: 'tor-nord', type: 'REVIEW_DISCARD' },
      { targetId: 'tor-sued', type: 'REVIEW_DISCARD' },
    ]));
  });

  it('„Alle übernehmen“ und „Alle verwerfen“ entscheiden den ganzen Fall mit einem Tipp', async () => {
    show(fall());
    fireEvent.click(screen.getByTestId('klaerung-fall-tor-nord-alle-uebernehmen'));
    await waitFor(() => expect(decide).toHaveBeenCalledTimes(1));
    expect(decide.mock.calls[0][1].map((d) => d.type)).toEqual(['REVIEW_ACCEPT', 'REVIEW_ACCEPT', 'REVIEW_ACCEPT']);
    fireEvent.click(screen.getByTestId('klaerung-fall-tor-nord-alle-verwerfen'));
    await waitFor(() => expect(decide).toHaveBeenCalledTimes(2));
    expect(decide.mock.calls[1][1].map((d) => d.type)).toEqual(['REVIEW_DISCARD', 'REVIEW_DISCARD', 'REVIEW_DISCARD']);
  });

  it('alle abgewählt: die Vorschau sagt vorher „nichts wird übernommen“, Speichern verwirft alles', async () => {
    show(fall());
    fireEvent.click(screen.getByTestId('klaerung-fall-tor-nord-aufklappen'));
    for (const id of ['tor-nord', 'tor-sued', 'gelb-5']) {
      fireEvent.click(screen.getByTestId(`klaerung-haken-${id}`));
    }
    fireEvent.click(screen.getByTestId('klaerung-fall-tor-nord-uebernehmen'));
    expect(screen.getByTestId('klaerung-fall-tor-nord-vorschau')).toHaveTextContent('nichts wird übernommen');
    fireEvent.click(screen.getByTestId('klaerung-fall-tor-nord-speichern'));
    await waitFor(() => expect(decide).toHaveBeenCalled());
    expect(decide.mock.calls[0][1].every((d) => d.type === 'REVIEW_DISCARD')).toBe(true);
  });
});

describe('@FU-096 Zusammengehörige Einträge eines Falls lassen sich nur gemeinsam übernehmen', () => {
  it('Gelbe Karte und Gelb-Rote Karte für SV Süd, Nr. 5 stehen als ein Eintrag mit einem gemeinsamen Häkchen', () => {
    show([
      review({ eventId: 'gelb', entry: { type: 'YELLOW_CARD', teamId: SUED, clockMs: 60_000, payload: { playerNumber: 5 } } }),
      review({ eventId: 'gelb-rot', entry: { type: 'YELLOW_RED_CARD', teamId: SUED, clockMs: 90_000, payload: { playerNumber: 5 } } }),
    ]);
    fireEvent.click(screen.getByTestId('klaerung-fall-gelb-aufklappen'));
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByTestId('klaerung-einheit-gelb')).toHaveTextContent('Gelbe Karte SV Süd, Nr. 5');
    expect(screen.getByTestId('klaerung-einheit-gelb')).toHaveTextContent('Gelb-Rote Karte SV Süd, Nr. 5');
  });

  it('Gegenbeispiel: zwei Tore verschiedener Teams haben je ein Häkchen', () => {
    show([review({ eventId: 'a', entry: { teamId: NORD } }), review({ eventId: 'b', entry: { teamId: SUED } })]);
    fireEvent.click(screen.getByTestId('klaerung-fall-a-aufklappen'));
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });
});

describe('Grund im Titel (@FU-017, @HE-056, @HE-080, @FU-130, @FU-116 Z. 2)', () => {
  it('@FU-017/@HE-056: „von Tom, Recht entzogen“', () => {
    show([review({ reason: 'RIGHTS_REVOKED', detail: { change: 'revoked' } }), review({ reason: 'RIGHTS_REVOKED', detail: { change: 'revoked' } })]);
    expect(screen.getByTestId('klaerungsliste')).toHaveTextContent('2 Einträge von Tom, Recht entzogen');
  });

  it('@FU-130: Toms Tor steht mit „nach dem Ende angekommen“', () => {
    show([review({ reason: 'AFTER_END', detail: {} })]);
    expect(screen.getByTestId('klaerungsliste')).toHaveTextContent('1 Eintrag von Tom, nach dem Ende angekommen');
  });
});

describe('@SL-147 Z. 2 Fortsetzen ohne Netz, nach 5 Minuten angekommen – die Turnierleitung findet es in der Klärungsliste', () => {
  it('@SL-147 Spiel 11: „Fortsetzen kam zu spät an“ von Tom, nur „Verwerfen“, kein „Übernehmen“', () => {
    const fortsetzen = review({
      eventId: 'fortsetzen-11', matchNumber: 11, reason: 'AFTER_END', detail: { why: 'CONTINUE_LATE', arrivedAfterMs: 300_000 },
      entry: { type: 'REOPEN', teamId: null, clockMs: 560_000 },
    });
    const { liste } = show([fortsetzen]);
    expect(liste).toHaveTextContent('1 Eintrag von Tom, nach dem Ende angekommen');
    expect(liste).toHaveTextContent('Spiel 11');
    expect(liste).toHaveTextContent('Fortsetzen kam zu spät an');
    expect(liste).not.toHaveTextContent('Spiel wieder geöffnet');
    expect(screen.getByTestId('klaerung-fall-fortsetzen-11-verwerfen')).toHaveTextContent('Verwerfen');
    expect(screen.queryByTestId('klaerung-fall-fortsetzen-11-uebernehmen')).toBeNull();
  });

  it('Gegenbeispiel: ein REOPEN ohne CONTINUE_LATE behält den Eintragsnamen', () => {
    const { liste } = show([review({ reason: 'AFTER_END', detail: {}, entry: { type: 'REOPEN', teamId: null } })]);
    expect(liste).not.toHaveTextContent('Fortsetzen kam zu spät an');
  });
});

describe('@FU-037 Eindeutiger Offline-Eintrag wird automatisch einsortiert – Hinweis', () => {
  it('Olli sieht „1 Tor von Tom (Feld 2) nachträglich eingefügt“, ohne Knöpfe', () => {
    show([review({ kind: 'notice', detail: { timing: 'before' } })]);
    const hinweise = screen.getByTestId('klaerungsliste-hinweise');
    expect(hinweise).toHaveTextContent('1 Tor von Tom (Feld 2) nachträglich eingefügt');
    expect(within(hinweise).queryByRole('button')).toBeNull();
  });
});

/** Echter Zustand (Review M1): `refresh` ersetzt die Liste wie der Server danach – der Fall fällt heraus. */
function Live({ initial, after }: { initial: MatchReview[]; after: MatchReview[] }) {
  const [reviews, setReviews] = useState(initial);
  return <KlaerungslisteDialog isOpen onClose={vi.fn()} tournament={tournament} reviews={reviews} refresh={() => { setReviews(after); return Promise.resolve(); }} />;
}
const decidedAs = (r: MatchReview, type: 'REVIEW_ACCEPT' | 'REVIEW_DISCARD', by: string): MatchReview =>
  ({ ...r, decision: { type, eventId: `d-${r.eventId}`, at: Date.UTC(2026, 10, 28, 11, 10), by } });

describe('Review M1: Rückmeldungen bleiben sichtbar, auch wenn der Fall aus der Liste fällt', () => {
  it('Übernehmen in ein beendetes Gruppenspiel: Fall weg, Hinweis „bitte neu abschließen“ bleibt stehen', async () => {
    decide.mockResolvedValue({ status: 'saved', accepted: 1, matchFinished: true });
    const tor = review({ eventId: 'x', reason: 'AFTER_END', detail: {} });
    render(<Live initial={[tor]} after={[decidedAs(tor, 'REVIEW_ACCEPT', 'Olli')]} />);
    fireEvent.click(screen.getByTestId('klaerung-fall-x-uebernehmen'));
    fireEvent.click(screen.getByTestId('klaerung-fall-x-speichern'));
    await waitFor(() => expect(screen.queryByTestId('klaerung-fall-x')).toBeNull());
    expect(screen.getByTestId('klaerungsliste-meldung')).toHaveTextContent('Spiel 9 war schon beendet – ist die Gruppe abgeschlossen, bitte neu abschließen.');
  });

  it('schon entschieden (Maria war schneller): Fall weg, „Bereits entschieden“ bleibt stehen, Verlauf nennt Maria', async () => {
    decide.mockResolvedValue({ status: 'rejected', code: 'UNKNOWN_TARGET', reason: 'ALREADY_DECIDED' });
    const tor = review({ eventId: 'x' });
    render(<Live initial={[tor]} after={[decidedAs(tor, 'REVIEW_DISCARD', 'Maria')]} />);
    fireEvent.click(screen.getByTestId('klaerung-fall-x-verwerfen'));
    await waitFor(() => expect(screen.queryByTestId('klaerung-fall-x')).toBeNull());
    expect(screen.getByTestId('klaerungsliste-meldung')).toHaveTextContent('Bereits entschieden');
    expect(screen.getByTestId('klaerung-verlauf-x')).toHaveTextContent('verworfen von Maria');
  });

  it('Gegenbeispiel: ohne Entscheidung keine Statuszeile', () => {
    show([review()]);
    expect(screen.queryByTestId('klaerungsliste-meldung')).toBeNull();
  });
});

describe('@FU-095 „die beiden Tore stehen als verworfen im Verlauf“ (Review M5)', () => {
  it('nach dem Speichern: Gelbe Karte übernommen, beide Tore verworfen – im Verlauf mit Name', async () => {
    decide.mockResolvedValue({ status: 'saved', accepted: 1, matchFinished: false });
    const nord = review({ eventId: 'tor-nord', entry: { type: 'GOAL', teamId: NORD, clockMs: 60_000 } });
    const sued = review({ eventId: 'tor-sued', entry: { type: 'GOAL', teamId: SUED, clockMs: 70_000 } });
    const gelb = review({ eventId: 'gelb-5', entry: { type: 'YELLOW_CARD', teamId: SUED, clockMs: 80_000, payload: { playerNumber: 5 } } });
    render(<Live initial={[nord, sued, gelb]} after={[decidedAs(nord, 'REVIEW_DISCARD', 'Olli'), decidedAs(sued, 'REVIEW_DISCARD', 'Olli'), decidedAs(gelb, 'REVIEW_ACCEPT', 'Olli')]} />);
    fireEvent.click(screen.getByTestId('klaerung-fall-tor-nord-aufklappen'));
    fireEvent.click(screen.getByTestId('klaerung-haken-tor-nord'));
    fireEvent.click(screen.getByTestId('klaerung-haken-tor-sued'));
    fireEvent.click(screen.getByTestId('klaerung-fall-tor-nord-uebernehmen'));
    fireEvent.click(screen.getByTestId('klaerung-fall-tor-nord-speichern'));
    const verlauf = await screen.findByTestId('klaerungsliste-verlauf');
    expect(screen.getByTestId('klaerung-verlauf-tor-nord')).toHaveTextContent('Tor FC Nord · Abschnitt 1, 2. Minute – verworfen von Olli');
    expect(screen.getByTestId('klaerung-verlauf-tor-sued')).toHaveTextContent('Tor SV Süd · Abschnitt 1, 2. Minute – verworfen von Olli');
    expect(screen.getByTestId('klaerung-verlauf-gelb-5')).toHaveTextContent('Gelbe Karte SV Süd, Nr. 5 · Abschnitt 1, 2. Minute – übernommen von Olli');
    expect(within(verlauf).queryByText(/offen/)).toBeNull();
  });

  it('Gegenbeispiel: offene Einträge stehen nicht im Verlauf', () => {
    show([review({ eventId: 'x' })]);
    expect(screen.queryByTestId('klaerungsliste-verlauf')).toBeNull();
  });
});

describe('Review M4: Negationspfade in der Oberfläche', () => {
  it('„Zurück“ in der Vorschau speichert nichts, die Knöpfe sind wieder da', () => {
    show([review({ eventId: 'x' })]);
    fireEvent.click(screen.getByTestId('klaerung-fall-x-uebernehmen'));
    fireEvent.click(screen.getByTestId('klaerung-fall-x-zurueck'));
    expect(decide).not.toHaveBeenCalled();
    expect(screen.queryByTestId('klaerung-fall-x-speichern')).toBeNull();
    expect(screen.getByTestId('klaerung-fall-x-uebernehmen')).toBeInTheDocument();
  });

  it('ohne Netz: „Geht nur mit Netz“, kein „gespeichert“, der Fall bleibt', async () => {
    decide.mockResolvedValue({ status: 'offline' });
    render(<Live initial={[review({ eventId: 'x' })]} after={[review({ eventId: 'x' })]} />);
    fireEvent.click(screen.getByTestId('klaerung-fall-x-verwerfen'));
    expect(await screen.findByTestId('klaerungsliste-meldung')).toHaveTextContent('Geht nur mit Netz');
    expect(screen.getByTestId('klaerungsliste-meldung')).not.toHaveTextContent('gespeichert');
    expect(screen.getByTestId('klaerung-fall-x')).toBeInTheDocument();
  });

  it('Review M3: Recht inzwischen entzogen → „Du darfst nicht mehr entscheiden“', async () => {
    decide.mockResolvedValue({ status: 'notAllowed' });
    show([review({ eventId: 'x' })]);
    fireEvent.click(screen.getByTestId('klaerung-fall-x-verwerfen'));
    expect(await screen.findByTestId('klaerungsliste-meldung')).toHaveTextContent('Du darfst nicht mehr entscheiden');
  });

  it('Review m1: ein unbekannter Server-Grund zeigt keinen technischen Code', async () => {
    decide.mockResolvedValue({ status: 'rejected', code: 'INVALID_TRANSITION', reason: 'IRGENDWAS_NEUES' });
    show([review({ eventId: 'x' })]);
    fireEvent.click(screen.getByTestId('klaerung-fall-x-verwerfen'));
    const meldung = await screen.findByTestId('klaerungsliste-meldung');
    expect(meldung).toHaveTextContent('Nicht gespeichert – bitte die Liste neu laden');
    expect(meldung.textContent).not.toMatch(/INVALID_TRANSITION|IRGENDWAS_NEUES/);
  });
});

describe('Review m2 / m6', () => {
  it('m2: ein Fall nur aus einer Pause bietet kein „Übernehmen“, nur „Verwerfen“', () => {
    show([review({ eventId: 'p', entry: { type: 'PAUSE', teamId: null } })]);
    expect(screen.queryByTestId('klaerung-fall-p-uebernehmen')).toBeNull();
    expect(screen.getByTestId('klaerung-fall-p-verwerfen')).toBeInTheDocument();
  });

  it('m6: höchstens eine Vorschau und damit eine Haupttaste im Dialog', () => {
    show([review({ eventId: 'a', author: 'Tom' }), review({ eventId: 'b', author: 'Clara' })]);
    fireEvent.click(screen.getByTestId('klaerung-fall-a-uebernehmen'));
    fireEvent.click(screen.getByTestId('klaerung-fall-b-uebernehmen'));
    expect(screen.queryByTestId('klaerung-fall-a-speichern')).toBeNull();
    expect(document.querySelectorAll('[data-primary]')).toHaveLength(1);
  });
});

describe('T2-UI: Bedienbarkeit', () => {
  it('Häkchen-Zeilen sind mindestens 44 px hoch, die Knopfzeile bricht um (360 px ohne Überlauf)', () => {
    show([review({ eventId: 'a', entry: { teamId: NORD } }), review({ eventId: 'b', entry: { teamId: SUED } })]);
    fireEvent.click(screen.getByTestId('klaerung-fall-a-aufklappen'));
    const zeile = screen.getAllByRole('checkbox')[0].closest('label');
    expect(zeile).toHaveStyle({ minHeight: cssVars.touchTargets.minimum });
    const knopfZeile = screen.getByTestId('klaerung-fall-a-uebernehmen').parentElement;
    expect(knopfZeile).toHaveStyle({ flexWrap: 'wrap' });
    expect(screen.getByTestId('klaerung-fall-a')).toHaveStyle({ minWidth: '0' });
    fireEvent.click(screen.getByTestId('klaerung-fall-a-uebernehmen'));
    const speichern = screen.getByTestId('klaerung-fall-a-speichern');
    expect(speichern).toHaveAttribute('data-primary');
    expect(speichern).toHaveStyle({ minHeight: cssVars.touchTargets.primary });
  });
});
