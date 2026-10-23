/**
 * B-50 Klärungsliste der Turnierleitung – Verhaltenstest mit echten DE-Texten, aus dem Gherkin (Fundament F1b, Helfer):
 * @FU-038, @FU-095, @FU-096, @FU-017, @HE-056, @HE-080, @FU-130, @FU-037. Gegenbeispiele je Szenario.
 * Engine und Senden sind ersetzt (`useReviewDecision`): geprüft wird, was Olli sieht und welche Entscheidungen gehen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('@FU-037 Eindeutiger Offline-Eintrag wird automatisch einsortiert – Hinweis', () => {
  it('Olli sieht „1 Tor von Tom (Feld 2) nachträglich eingefügt“, ohne Knöpfe', () => {
    show([review({ kind: 'notice', detail: { timing: 'before' } })]);
    const hinweise = screen.getByTestId('klaerungsliste-hinweise');
    expect(hinweise).toHaveTextContent('1 Tor von Tom (Feld 2) nachträglich eingefügt');
    expect(within(hinweise).queryByRole('button')).toBeNull();
  });
});

describe('Rückmeldungen (A-35 Übergabe)', () => {
  it('schon entschieden: „Bereits entschieden – die Liste wird neu geladen“', async () => {
    decide.mockResolvedValue({ status: 'rejected', code: 'UNKNOWN_TARGET', reason: 'ALREADY_DECIDED' });
    show([review({ eventId: 'x' })]);
    fireEvent.click(screen.getByTestId('klaerung-fall-x-verwerfen'));
    expect(await screen.findByTestId('klaerung-fall-x-meldung')).toHaveTextContent('Bereits entschieden');
  });

  it('Übernehmen in ein beendetes Gruppenspiel: Hinweis, die Gruppe neu abzuschließen', async () => {
    decide.mockResolvedValue({ status: 'saved', accepted: 1, matchFinished: true });
    show([review({ eventId: 'x', reason: 'AFTER_END', detail: {} })]);
    fireEvent.click(screen.getByTestId('klaerung-fall-x-uebernehmen'));
    fireEvent.click(screen.getByTestId('klaerung-fall-x-speichern'));
    expect(await screen.findByTestId('klaerung-fall-x-meldung')).toHaveTextContent('Spiel 9 war schon beendet – ist die Gruppe abgeschlossen, bitte neu abschließen.');
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
  });
});
