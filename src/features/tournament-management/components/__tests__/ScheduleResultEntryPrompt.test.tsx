/**
 * A-08f3e2 T2-UI (a): Verhaltenstests der Rückfragen der Schnelleingabe, echte DE-Texte.
 * @FU-093 (abgesetzt: Ja/Nein), @EK-004 (ohne Grund aus der Auswahl kein Speichern), @EK-037 („Sonstiges“ nur mit Freitext).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { ScheduleResultEntryPrompt } from '../ScheduleResultEntryPrompt';

await initRealDeI18n();

const reasonPrompt = { kind: 'reason' as const, matchNumber: 7, before: '2:1', after: '2:2' };

describe('ScheduleResultEntryPrompt', () => {
  it('ohne Rückfrage wird nichts angezeigt', () => {
    const { container } = render(<ScheduleResultEntryPrompt prompt={null} answerPrompt={vi.fn()} />);
    expect(container.textContent).toBe('');
  });

  it('@FU-093 abgesetzt: Frage wörtlich, „Ja“ → yes, „Nein“ → Abbruch', () => {
    const answer = vi.fn();
    const view = render(<ScheduleResultEntryPrompt prompt={{ kind: 'unskip', matchNumber: 9 }} answerPrompt={answer} />);
    expect(view.getByText('Spiel war abgesetzt – trotzdem Ergebnis eintragen?')).toBeTruthy();

    fireEvent.click(view.getByText('Ja'));
    fireEvent.click(view.getByText('Nein'));
    expect(answer.mock.calls).toEqual([['yes'], [null]]);
  });

  it('Grund-Auswahl zeigt bisher und neu', () => {
    const view = render(<ScheduleResultEntryPrompt prompt={reasonPrompt} answerPrompt={vi.fn()} />);
    expect(view.getByText('Ergebnis von Spiel 7 ändern')).toBeTruthy();
    expect(view.getByText('bisher 2:1 – neu 2:2')).toBeTruthy();
  });

  it('@EK-004 ohne Grund aus der Auswahl: App verlangt einen Grund, nichts gespeichert', () => {
    const answer = vi.fn();
    const view = render(<ScheduleResultEntryPrompt prompt={reasonPrompt} answerPrompt={answer} />);
    fireEvent.click(view.getByText('Speichern'));

    expect(view.getByTestId('result-entry-reason-error').textContent).toBe('Bitte einen Grund aus der Auswahl wählen');
    expect(answer).not.toHaveBeenCalled();
  });

  it('@EK-004 Gegenbeispiel: Grund „Schiedsrichter-Entscheidung“ gewählt → gespeichert mit referee_decision', () => {
    const answer = vi.fn();
    const view = render(<ScheduleResultEntryPrompt prompt={reasonPrompt} answerPrompt={answer} />);
    fireEvent.change(view.getByTestId('result-entry-reason'), { target: { value: 'referee_decision' } });
    fireEvent.click(view.getByText('Speichern'));

    expect(answer).toHaveBeenCalledWith('referee_decision');
  });

  it('@EK-037 „Sonstiges“ ohne Freitext: App verlangt einen Freitext; mit Freitext gespeichert', () => {
    const answer = vi.fn();
    const view = render(<ScheduleResultEntryPrompt prompt={reasonPrompt} answerPrompt={answer} />);
    fireEvent.change(view.getByTestId('result-entry-reason'), { target: { value: 'other' } });
    fireEvent.click(view.getByText('Speichern'));
    expect(view.getByTestId('result-entry-reason-error').textContent).toBe('Bitte den Grund beschreiben');
    expect(answer).not.toHaveBeenCalled();

    fireEvent.change(view.getByTestId('result-entry-note'), { target: { value: 'Spielbericht nachgereicht' } });
    fireEvent.click(view.getByText('Speichern'));
    expect(answer).toHaveBeenCalledWith('other: Spielbericht nachgereicht');
  });

  it('Abbrechen → Abbruch (null)', () => {
    const answer = vi.fn();
    const view = render(<ScheduleResultEntryPrompt prompt={reasonPrompt} answerPrompt={answer} />);
    fireEvent.click(view.getByText('Abbrechen'));
    expect(answer).toHaveBeenCalledWith(null);
  });
});
