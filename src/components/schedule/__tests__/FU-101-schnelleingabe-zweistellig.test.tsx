/**
 * @FU-101 „Ein zweistelliges Ergebnis lässt sich im Spielplan eintragen“ (Befund C-SCHNELLEINGABE-TASTENDRUCK).
 * Gegeben Spiel 9 ist geplant und das Feld für SV Süd zeigt schon 2 → Olli tippt im Feld für FC Nord „1“ und dann „0“
 * → die App speichert erst, wenn Olli bestätigt (Enter) oder das Feld verlässt → Spiel 9 steht 10:2, nicht 1:2.
 * Gegenbeispiele: nach der ersten Ziffer nichts; Escape verwirft; unveränderter Wert wird nicht erneut gespeichert.
 * Nachbar @FU-080 (einstellig 3:1 beim Verlassen gespeichert). Die Tests folgen dem Gherkin, nicht dem Code.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchScoreCell } from '../MatchScoreCell';

const renderCell = (props: Partial<ComponentProps<typeof MatchScoreCell>> = {}) => {
  const onScoreChange = vi.fn();
  const utils = render(
    <MatchScoreCell
      matchId="spiel-9"
      scoreA={undefined}
      scoreB={2}
      editable
      isFinished={false}
      inCorrectionMode={false}
      onScoreChange={onScoreChange}
      {...props}
    />,
  );
  // Linkes Feld = FC Nord (Team A), rechtes Feld = SV Süd (Team B), wie im Spielplan
  const [fieldFcNord, fieldSvSued] = utils.getAllByRole('spinbutton') as HTMLInputElement[];
  return { ...utils, onScoreChange, fieldFcNord, fieldSvSued };
};

describe('@FU-101 Ein zweistelliges Ergebnis lässt sich im Spielplan eintragen', () => {
  it('@FU-101 „1“ und „0“ im Feld für FC Nord, dann Feld verlassen → genau ein Speichern mit 10:2', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord } = renderCell();

    await user.click(fieldFcNord);
    await user.keyboard('1');
    expect(onScoreChange).not.toHaveBeenCalled();

    await user.keyboard('0');
    expect(onScoreChange).not.toHaveBeenCalled();

    await user.tab(); // Feld verlassen
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(10, 2);
  });

  it('@FU-101 Enter bestätigt die zweistellige Eingabe, genau einmal (auch wenn danach das Feld verlassen wird)', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord } = renderCell();

    await user.click(fieldFcNord);
    await user.keyboard('10{Enter}');
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(10, 2);

    await user.tab();
    expect(onScoreChange).toHaveBeenCalledTimes(1);
  });

  it('@FU-101 Escape verwirft die Eingabe: nichts wird gespeichert, das Feld ist wieder leer', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord } = renderCell();

    await user.click(fieldFcNord);
    await user.keyboard('1{Escape}');
    expect(fieldFcNord.value).toBe('');

    await user.tab();
    expect(onScoreChange).not.toHaveBeenCalled();
  });

  it('@FU-101 Gegenbeispiel: ohne Verlassen und ohne Enter wird die erste Ziffer nicht gespeichert', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord } = renderCell();

    await user.click(fieldFcNord);
    await user.keyboard('1');
    expect(onScoreChange).not.toHaveBeenCalled();
    expect(fieldFcNord.value).toBe('1');
  });

  it('@FU-080 einstelliges Ergebnis 3:1 wird beim Verlassen des Feldes gespeichert', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord } = renderCell({ scoreB: 1 });

    await user.click(fieldFcNord);
    await user.keyboard('3');
    await user.tab();
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(3, 1);
  });

  it('@FU-101 unverändertes Ergebnis wird beim Verlassen nicht erneut gespeichert', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord } = renderCell({ scoreA: 3, scoreB: 1 });

    await user.click(fieldFcNord);
    await user.tab();
    expect(onScoreChange).not.toHaveBeenCalled();
  });
});
