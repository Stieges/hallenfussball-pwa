/**
 * Spiel beenden (20261110_009) T2-UI (a): Verhaltenstest der Rückfrage, echte DE-Texte. @FU-112 („Spiel 9 läuft noch –
 * Uhr zeigt 2:00 Restzeit. Jetzt mit 3:1 beenden?“, Tasten „Beenden“/„Abbrechen“, Daniel 12.11.), @FU-114 („Spielzeit abgelaufen – jetzt mit 2:2 beenden?“),
 * @FU-115/@FU-081 (Hinweis „Feld 2 wird gerade von Tom gesteuert“ vor der Frage; B-49: Taste „Spielleitung übernehmen“).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { ScheduleResultEntryPrompt } from '../ScheduleResultEntryPrompt';

await initRealDeI18n();

const ende = { kind: 'end' as const, matchNumber: 9, score: '3:1', rest: '2:00', controlledBy: null };

describe('ScheduleEndPrompt (über ScheduleResultEntryPrompt)', () => {
  it('@FU-112 @SL-195 Titel und Frage wörtlich, „Beenden“ → yes (gefüllte Taste), „Abbrechen“ → Abbruch, kein „Ja“/„Nein“', () => {
    const answer = vi.fn();
    const view = render(<ScheduleResultEntryPrompt prompt={ende} answerPrompt={answer} />);
    expect(view.getByText('Spiel beenden und Ergebnis eintragen')).toBeTruthy();
    expect(view.getByTestId('result-entry-end-message').textContent).toBe('Spiel 9 läuft noch – Uhr zeigt 2:00 Restzeit. Jetzt mit 3:1 beenden?');
    expect(view.queryByTestId('result-entry-end-controlled')).toBeNull();

    expect(view.queryByText('Ja')).toBeNull();
    expect(view.queryByText('Nein')).toBeNull();
    expect(view.getByTestId('confirm-dialog-confirm').textContent).toBe('Beenden');
    expect(view.getByTestId('confirm-dialog-cancel').textContent).toBe('Abbrechen');
    fireEvent.click(view.getByText('Beenden'));
    fireEvent.click(view.getByText('Abbrechen'));
    expect(answer.mock.calls).toEqual([['yes'], [null]]);
  });

  it('@FU-112 @SL-195 Gegenbeispiel: „Abbrechen“ meldet nur Abbruch, nie yes (Spiel bleibt unverändert)', () => {
    const answer = vi.fn();
    const view = render(<ScheduleResultEntryPrompt prompt={ende} answerPrompt={answer} />);
    fireEvent.click(view.getByText('Abbrechen'));
    expect(answer.mock.calls).toEqual([[null]]);
  });

  it('@FU-114 Spielzeit abgelaufen: „Spielzeit abgelaufen – jetzt mit 2:2 beenden?“', () => {
    const view = render(<ScheduleResultEntryPrompt prompt={{ ...ende, score: '2:2', rest: null }} answerPrompt={vi.fn()} />);
    expect(view.getByTestId('result-entry-end-message').textContent).toBe('Spielzeit abgelaufen – jetzt mit 2:2 beenden?');
    expect(view.getByTestId('confirm-dialog-confirm').textContent).toBe('Ja'); // nur die Rückfrage beim laufenden Spiel hat „Beenden“/„Abbrechen“
    expect(view.getByTestId('confirm-dialog-cancel').textContent).toBe('Nein');
  });

  it('@FU-115 @FU-081 ein anderes Gerät steuert: „Feld 2 wird gerade von Tom gesteuert“ steht vor der Frage', () => {
    const view = render(<ScheduleResultEntryPrompt prompt={{ ...ende, controlledBy: { field: 2, holder: 'Tom' } }} answerPrompt={vi.fn()} />);
    expect(view.getByTestId('result-entry-end-controlled').textContent).toBe('Feld 2 wird gerade von Tom gesteuert');
    expect(view.getByTestId('result-entry-end-message').textContent).toBe(
      'Feld 2 wird gerade von Tom gesteuertSpiel 9 läuft noch – Uhr zeigt 2:00 Restzeit. Jetzt mit 3:1 beenden?',
    );
  });

  it('Gegenbeispiel: Halter ohne Namen und Gerät → „Feld 2 wird gerade von einem anderen Gerät gesteuert“', () => {
    const view = render(<ScheduleResultEntryPrompt prompt={{ ...ende, controlledBy: { field: 2, holder: null } }} answerPrompt={vi.fn()} />);
    expect(view.getByTestId('result-entry-end-controlled').textContent).toBe('Feld 2 wird gerade von einem anderen Gerät gesteuert');
  });

  it('@FU-081 (B-49) fremd gesteuert mit Übernahme: zusätzlich „Spielleitung übernehmen“ → Antwort takeover', () => {
    const answer = vi.fn();
    const view = render(<ScheduleResultEntryPrompt prompt={{ ...ende, controlledBy: { field: 2, holder: 'Tom' }, takeOver: true }} answerPrompt={answer} />);
    fireEvent.click(view.getByText('Spielleitung übernehmen'));
    expect(answer.mock.calls[0]).toEqual(['takeover']); // danach schließt der Dialog (Abbruch zählt nicht mehr, die Antwort steht)
  });

  it('@FU-081 Gegenbeispiel: ohne Übernahme-Angebot keine Taste „Spielleitung übernehmen“', () => {
    const view = render(<ScheduleResultEntryPrompt prompt={{ ...ende, controlledBy: { field: 2, holder: 'Tom' } }} answerPrompt={vi.fn()} />);
    expect(view.queryByText('Spielleitung übernehmen')).toBeNull();
    expect(view.queryByTestId('confirm-dialog-secondary')).toBeNull();
  });
});
