/**
 * @FU-101 „Ein zweistelliges Ergebnis lässt sich im Spielplan eintragen“ (Befund C-SCHNELLEINGABE-TASTENDRUCK).
 * Gegeben Spiel 9 ist geplant und das Feld für SV Süd zeigt schon 2 → Olli tippt im Feld für FC Nord „1“ und dann „0“
 * → die App speichert erst, wenn Olli bestätigt (Enter) oder das Feld verlässt → Spiel 9 steht 10:2, nicht 1:2.
 * Gegenbeispiele: nach der ersten Ziffer nichts; Escape verwirft; unveränderter Wert wird nicht erneut gespeichert.
 * Nachbar @FU-080 (einstellig 3:1 beim Verlassen gespeichert). Die Tests folgen dem Gherkin, nicht dem Code.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
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

  describe('rechtes Feld (SV Süd, Gast): gleiche Regeln wie links', () => {
    it('@FU-101 Gast zweistellig 2:10: „1“ und „0“ im rechten Feld, Verlassen speichert genau einmal 2:10', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldSvSued } = renderCell({ scoreA: 2, scoreB: undefined });

      await user.click(fieldSvSued);
      await user.keyboard('1');
      expect(onScoreChange).not.toHaveBeenCalled();
      await user.keyboard('0');
      expect(onScoreChange).not.toHaveBeenCalled();

      await user.tab();
      expect(onScoreChange).toHaveBeenCalledTimes(1);
      expect(onScoreChange).toHaveBeenCalledWith(2, 10);
    });

    it('@FU-101 Enter im rechten Feld bestätigt 2:10, genau einmal (auch beim späteren Verlassen)', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldSvSued } = renderCell({ scoreA: 2, scoreB: undefined });

      await user.click(fieldSvSued);
      await user.keyboard('10{Enter}');
      expect(onScoreChange).toHaveBeenCalledTimes(1);
      expect(onScoreChange).toHaveBeenCalledWith(2, 10);

      await user.tab();
      expect(onScoreChange).toHaveBeenCalledTimes(1);
    });

    it('@FU-101 Escape im rechten Feld verwirft die Eingabe: nichts gespeichert, Feld zeigt wieder den Stand', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldSvSued } = renderCell({ scoreA: 2, scoreB: 1 });

      await user.click(fieldSvSued);
      await user.keyboard('{Backspace}5{Escape}');
      expect(fieldSvSued.value).toBe('1');

      await user.tab();
      expect(onScoreChange).not.toHaveBeenCalled();
    });

    it('@FU-101 Gegenbeispiel: Tab ins noch leere Gegenfeld speichert kein halbes Ergebnis', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldFcNord, fieldSvSued } = renderCell({ scoreA: undefined, scoreB: undefined });

      await user.click(fieldFcNord);
      await user.keyboard('10');
      await user.tab();
      expect(onScoreChange).not.toHaveBeenCalled();

      await user.keyboard('2');
      await user.tab();
      expect(fieldSvSued.value).toBe('2');
      expect(onScoreChange).toHaveBeenCalledTimes(1);
      expect(onScoreChange).toHaveBeenCalledWith(10, 2);
    });
  });

  describe('nur ganze Zahlen ab 0 (kein Senden, kurzer Hinweis)', () => {
    it.each([['-3'], ['2.5'], ['1e1']])('@FU-101 Eingabe „%s“ wird nicht gesendet, das Feld zeigt einen Hinweis', async (text) => {
      const user = userEvent.setup();
      const { onScoreChange, fieldFcNord, queryByRole } = renderCell();

      await user.click(fieldFcNord);
      fireEvent.change(fieldFcNord, { target: { value: text } });
      await user.tab();

      expect(onScoreChange).not.toHaveBeenCalled();
      expect(queryByRole('alert')?.textContent).toBeTruthy();
      expect(fieldFcNord.getAttribute('aria-invalid')).toBe('true');
    });

    it('@FU-101 Enter mit „-3“ sendet ebenfalls nichts', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldFcNord } = renderCell();
      await user.click(fieldFcNord);
      fireEvent.change(fieldFcNord, { target: { value: '-3' } });
      await user.keyboard('{Enter}');
      expect(onScoreChange).not.toHaveBeenCalled();
    });

    it('@FU-101 Hinweis verschwindet, sobald wieder eine ganze Zahl getippt wird, und 3:2 geht durch', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldFcNord, queryByRole } = renderCell();
      await user.click(fieldFcNord);
      fireEvent.change(fieldFcNord, { target: { value: '-3' } });
      await user.tab();
      expect(queryByRole('alert')).not.toBeNull();

      await user.click(fieldFcNord);
      await user.clear(fieldFcNord);
      await user.keyboard('3');
      expect(queryByRole('alert')).toBeNull();
      await user.tab();
      expect(onScoreChange).toHaveBeenCalledWith(3, 2);
    });
  });

  describe('Nachbar @FU-093 / @FU-097: nach „Nein“ / „Abbrechen“ oder Ablehnung', () => {
    it('@FU-093 nach „Nein“ (nichts gespeichert) zeigt die Zelle wieder den gespeicherten Stand, hier leer', async () => {
      const user = userEvent.setup();
      const onScoreChange = vi.fn().mockResolvedValue(false);
      const { fieldFcNord, fieldSvSued } = renderCell({ scoreA: undefined, scoreB: undefined, onScoreChange });

      await user.click(fieldFcNord);
      await user.keyboard('3');
      await user.click(fieldSvSued);
      await user.keyboard('1');
      await user.tab();

      expect(onScoreChange).toHaveBeenCalledTimes(1);
      await waitFor(() => expect([fieldFcNord.value, fieldSvSued.value]).toEqual(['', '']));
    });

    it('@FU-097 nach „Abbrechen“ lässt sich derselbe Stand mit Enter erneut senden (Doppelschutz blockiert nicht)', async () => {
      const user = userEvent.setup();
      const onScoreChange = vi.fn().mockResolvedValue(false);
      const { fieldFcNord, fieldSvSued } = renderCell({ scoreA: undefined, scoreB: undefined, onScoreChange });

      await user.click(fieldFcNord);
      await user.keyboard('2');
      await user.click(fieldSvSued);
      await user.keyboard('2');
      await user.tab();
      await waitFor(() => expect(fieldFcNord.value).toBe(''));

      await user.click(fieldFcNord);
      await user.keyboard('2');
      await user.click(fieldSvSued);
      await user.keyboard('2{Enter}');
      expect(onScoreChange).toHaveBeenCalledTimes(2);
      expect(onScoreChange).toHaveBeenLastCalledWith(2, 2);
    });

    it('Ablehnung durch eine abgewiesene Zusage setzt die Zelle ebenfalls zurück', async () => {
      const user = userEvent.setup();
      const onScoreChange = vi.fn().mockRejectedValue(new Error('abgelehnt'));
      const { fieldFcNord } = renderCell({ scoreA: 1, scoreB: 2, onScoreChange });

      await user.click(fieldFcNord);
      await user.keyboard('{Backspace}4');
      await user.tab();
      await waitFor(() => expect(fieldFcNord.value).toBe('1'));
    });

    it('Gegenbeispiel: nach erfolgreichem Speichern (true) bleibt die Eingabe stehen', async () => {
      const user = userEvent.setup();
      const onScoreChange = vi.fn().mockResolvedValue(true);
      const { fieldFcNord } = renderCell({ scoreA: undefined, scoreB: 2, onScoreChange });

      await user.click(fieldFcNord);
      await user.keyboard('10{Enter}');
      await Promise.resolve();
      expect(fieldFcNord.value).toBe('10');
    });
  });
});
