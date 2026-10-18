/**
 * A-25a T2-UI (a): Abfrage des Strafstoßergebnisses in der Schnelleingabe, echte DE-Texte.
 * Gherkin @FU-094: „Wenn Olli im Spielplan 2:2 für das Halbfinale 1 einträgt, dann fragt die App zusätzlich nach dem
 * Ergebnis des Strafstoßschießens … nach der Eingabe ‚4:3 für das Heimteam‘ … Aber ohne Angabe des Strafstoßergebnisses
 * speichert die App das Unentschieden nicht.“
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { ScheduleResultEntryPrompt } from '../ScheduleResultEntryPrompt';
import { cssVars } from '../../../../design-tokens';

await initRealDeI18n();

const shootoutPrompt = { kind: 'shootout' as const, matchNumber: 11, score: '2:2', homeName: 'Heimteam', awayName: 'Auswärtsteam' };

function open(answer = vi.fn()) {
  const view = render(<ScheduleResultEntryPrompt prompt={shootoutPrompt} answerPrompt={answer} />);
  const save = view.getByTestId('result-entry-shootout-save') as HTMLButtonElement;
  const type = (home: string, away: string) => {
    fireEvent.change(view.getByTestId('result-entry-shootout-home'), { target: { value: home } });
    fireEvent.change(view.getByTestId('result-entry-shootout-away'), { target: { value: away } });
  };
  return { view, save, type, answer };
}

describe('ScheduleResultEntryPrompt – Strafstoßschießen (@FU-094)', () => {
  it('@FU-094 fragt zusätzlich nach dem Ergebnis des Strafstoßschießens, mit Stand und beiden Teams', () => {
    const { view } = open();
    expect(view.getByText('Ergebnis des Strafstoßschießens')).toBeTruthy();
    expect(view.getByText('Spiel 11 endete 2:2 – wer hat das Strafstoßschießen gewonnen?')).toBeTruthy();
    expect(view.getByText('Heimteam')).toBeTruthy();
    expect(view.getByText('Auswärtsteam')).toBeTruthy();
  });

  it('@FU-094 ohne Angabe speichert die App das Unentschieden nicht: „Ergebnis speichern“ gesperrt, Hinweis nennt den Grund', () => {
    const { view, save, answer } = open();
    expect(save.disabled).toBe(true);
    expect(view.getByTestId('result-entry-shootout-hint').textContent).toBe('Bitte das Ergebnis des Strafstoßschießens eintragen.');
    fireEvent.click(save);
    expect(answer).not.toHaveBeenCalled();
  });

  it('@FU-094 Gegenbeispiel: gleicher Strafstoß-Stand 3:3 → gesperrt, Hinweis „braucht einen Sieger“', () => {
    const { view, save, type, answer } = open();
    type('3', '3');
    expect(save.disabled).toBe(true);
    expect(view.getByTestId('result-entry-shootout-hint').textContent).toBe('Das Strafstoßschießen braucht einen Sieger – bitte ungleiches Ergebnis eintragen.');
    fireEvent.click(save);
    expect(answer).not.toHaveBeenCalled();
  });

  it('@FU-094 nach „4:3 für das Heimteam“ wird gespeichert (Antwort 4:3)', () => {
    const { view, save, type, answer } = open();
    type('4', '3');
    expect(save.disabled).toBe(false);
    expect(view.queryByTestId('result-entry-shootout-hint')).toBeNull();
    fireEvent.click(save);
    expect(answer).toHaveBeenCalledWith('4:3');
  });

  it('@FU-094 Gegenbeispiel: Eingabe nur für ein Team bleibt gesperrt', () => {
    const { view, save } = open();
    fireEvent.change(view.getByTestId('result-entry-shootout-home'), { target: { value: '4' } });
    expect(save.disabled).toBe(true);
  });

  it('Abbrechen → nichts gespeichert (null)', () => {
    const { view, answer } = open();
    fireEvent.click(view.getByTestId('result-entry-shootout-cancel'));
    expect(answer).toHaveBeenCalledWith(null);
  });

  it('Haupttaste „Ergebnis speichern“ mindestens touchTargets.primary hoch, Eingaben mit Schrift fontSizes.lg (≥ 16 px)', () => {
    const { view, save } = open();
    expect(save.textContent).toBe('Ergebnis speichern');
    expect(save.style.minHeight).toBe(cssVars.touchTargets.primary);
    expect((view.getByTestId('result-entry-shootout-home') as HTMLInputElement).style.fontSize).toBe(cssVars.fontSizes.lg);
    expect((view.getByTestId('result-entry-shootout-away') as HTMLInputElement).style.fontSize).toBe(cssVars.fontSizes.lg);
  });
});
