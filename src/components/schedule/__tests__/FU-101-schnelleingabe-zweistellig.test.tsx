/**
 * @FU-101 „Ein zweistelliges Ergebnis lässt sich im Spielplan eintragen“ (Befund C-SCHNELLEINGABE-TASTENDRUCK; Fassung
 * 2026-11-01: Speichern nur noch über „Ergebnis speichern“).
 * Gegeben Spiel 9 ist geplant und das Feld für SV Süd zeigt schon 2 → Olli tippt im Feld für FC Nord „1“ und dann „0“
 * → die App speichert erst, wenn beide Felder gefüllt sind UND Olli „Ergebnis speichern“ wählt; das Verlassen eines Feldes
 * (und Enter) speichert nichts → Spiel 9 steht 10:2, nicht 1:2.
 * Gegenbeispiele: nach der ersten Ziffer nichts; Escape verwirft; unverändert nicht erneut. @FU-112: laufendes Spiel 0:0 →
 * leere Felder, „Spiel beenden und Ergebnis eintragen“. Die Tests folgen dem Gherkin, nicht dem Code.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchScoreCell } from '../MatchScoreCell';
import { cssVars } from '../../../design-tokens';

const renderCell = (props: Partial<ComponentProps<typeof MatchScoreCell>> = {}) => {
  const onScoreChange = vi.fn();
  const utils = render(
    <MatchScoreCell
      matchId="spiel-9"
      scoreA={undefined}
      scoreB={2}
      editable
      isFinished={false}
      onScoreChange={onScoreChange}
      {...props}
    />,
  );
  // Linkes Feld = FC Nord (Team A), rechtes Feld = SV Süd (Team B), wie im Spielplan
  const [fieldFcNord, fieldSvSued] = utils.getAllByRole('textbox') as HTMLInputElement[];
  const saveButton = utils.getByTestId('match-score-save-spiel-9') as HTMLButtonElement;
  return { ...utils, onScoreChange, fieldFcNord, fieldSvSued, saveButton };
};

describe('@FU-101 Ein zweistelliges Ergebnis lässt sich im Spielplan eintragen', () => {
  it('@FU-101 „1“ und „0“ im Feld für FC Nord: Tippen und Verlassen speichern nichts, „Ergebnis speichern“ sendet genau einmal 10:2', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord, saveButton } = renderCell();

    await user.click(fieldFcNord);
    await user.keyboard('1');
    expect(onScoreChange).not.toHaveBeenCalled();
    await user.keyboard('0');
    expect(onScoreChange).not.toHaveBeenCalled();

    await user.tab(); // Feld verlassen
    expect(onScoreChange).not.toHaveBeenCalled();

    await user.click(saveButton);
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(10, 2);
  });

  it('@FU-101 Enter im ersten Feld springt ins zweite Feld und speichert nichts', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord, fieldSvSued } = renderCell();

    await user.click(fieldFcNord);
    await user.keyboard('10{Enter}');
    expect(document.activeElement).toBe(fieldSvSued);
    expect(onScoreChange).not.toHaveBeenCalled();
    await user.tab();
    expect(onScoreChange).not.toHaveBeenCalled();
  });

  it('@FU-101 Enter im zweiten Feld wirkt bei gefüllten Feldern wie „Ergebnis speichern“, genau einmal 10:2', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord, fieldSvSued } = renderCell({ scoreB: undefined });

    await user.click(fieldFcNord);
    await user.keyboard('10{Enter}'); // springt ins zweite Feld
    await user.keyboard('2');
    expect(onScoreChange).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(10, 2);
    await user.keyboard('{Enter}'); // nochmal Enter: derselbe Stand wird nicht erneut gesendet
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(fieldSvSued);
  });

  it('@FU-101 Enter im zweiten Feld bei leerem ersten Feld speichert nichts', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldSvSued } = renderCell({ scoreA: undefined, scoreB: undefined });

    await user.click(fieldSvSued);
    await user.keyboard('2{Enter}');
    expect(onScoreChange).not.toHaveBeenCalled();
  });

  it('@FU-101 Enter im zweiten Feld, in dem nur ein Minuszeichen getippt wurde (das Feld bleibt leer), speichert nichts', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord, fieldSvSued } = renderCell({ scoreA: 1, scoreB: undefined });
    await user.click(fieldSvSued);
    await user.keyboard('-{Enter}');
    expect(fieldSvSued.value).toBe('');
    expect(onScoreChange).not.toHaveBeenCalled();
    expect(fieldFcNord.value).toBe('1');
  });

  it('@FU-101 Tab-Reihenfolge Feld 1, Feld 2, „Ergebnis speichern“; Ziffernblock-Taste „weiter“ im ersten, „fertig“ im zweiten Feld', async () => {
    const user = userEvent.setup();
    const { fieldFcNord, fieldSvSued, saveButton } = renderCell({ scoreA: 1, scoreB: 1 });
    expect(fieldFcNord.getAttribute('enterkeyhint')).toBe('next');
    expect(fieldSvSued.getAttribute('enterkeyhint')).toBe('done');
    await user.click(fieldFcNord);
    await user.keyboard('2');
    await user.tab();
    expect(document.activeElement).toBe(fieldSvSued);
    await user.tab();
    expect(document.activeElement).toBe(saveButton);
  });

  it('@FU-101 „Ergebnis speichern“ ist erst wählbar, wenn beide Felder gefüllt sind', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord, fieldSvSued, saveButton } = renderCell({ scoreA: undefined, scoreB: undefined });
    expect(saveButton.disabled).toBe(true);

    await user.click(fieldFcNord);
    await user.keyboard('10');
    expect(saveButton.disabled).toBe(true);
    await user.click(saveButton); // gesperrt: kein Senden
    expect(onScoreChange).not.toHaveBeenCalled();

    await user.click(fieldSvSued);
    await user.keyboard('2');
    expect(saveButton.disabled).toBe(false);
  });

  it('@FU-101 Escape verwirft die Eingabe: nichts wird gespeichert, das Feld ist wieder leer', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord, saveButton } = renderCell();

    await user.click(fieldFcNord);
    await user.keyboard('1{Escape}');
    expect(fieldFcNord.value).toBe('');
    expect(saveButton.disabled).toBe(true);
    expect(onScoreChange).not.toHaveBeenCalled();
  });

  it('@FU-101 Gegenbeispiel: ohne „Ergebnis speichern“ wird die erste Ziffer nicht gespeichert', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord } = renderCell();

    await user.click(fieldFcNord);
    await user.keyboard('1');
    expect(onScoreChange).not.toHaveBeenCalled();
    expect(fieldFcNord.value).toBe('1');
  });

  it('@FU-080 einstelliges Ergebnis 3:1 wird mit „Ergebnis speichern“ gespeichert, nicht beim Verlassen', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord, saveButton } = renderCell({ scoreB: 1 });

    await user.click(fieldFcNord);
    await user.keyboard('3');
    await user.tab();
    expect(onScoreChange).not.toHaveBeenCalled();
    await user.click(saveButton);
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(3, 1);
  });

  it('@FU-101 unverändertes Ergebnis lässt sich nicht erneut speichern', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord, saveButton } = renderCell({ scoreA: 3, scoreB: 1 });

    await user.click(fieldFcNord);
    await user.tab();
    expect(saveButton.disabled).toBe(true);
    expect(onScoreChange).not.toHaveBeenCalled();
  });

  it('@FU-101 „Ergebnis speichern“ ist eine Zweittaste (gerahmt, nicht Primärfläche; eine Haupttaste je Ansicht), mindestens 44 px hoch', () => {
    const { saveButton } = renderCell({ scoreA: 1, scoreB: 1 });
    expect(saveButton.style.background).toBe(cssVars.colors.surface);
    expect(saveButton.style.background).not.toBe(cssVars.colors.primary);
    expect(saveButton.style.border).toContain('1px solid');
    expect(saveButton.hasAttribute('data-primary')).toBe(false);
    expect(parseInt(saveButton.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  it('@FU-101 doppeltes Antippen von „Ergebnis speichern“ sendet genau einmal', async () => {
    const user = userEvent.setup();
    const { onScoreChange, fieldFcNord, saveButton } = renderCell();
    await user.click(fieldFcNord);
    await user.keyboard('10');
    await user.dblClick(saveButton);
    expect(onScoreChange).toHaveBeenCalledTimes(1);
  });

  describe('rechtes Feld (SV Süd, Gast): gleiche Regeln wie links', () => {
    it('@FU-101 Gast zweistellig 2:10: „1“ und „0“ im rechten Feld, Verlassen speichert nichts, die Taste genau einmal 2:10', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldSvSued, saveButton } = renderCell({ scoreA: 2, scoreB: undefined });

      await user.click(fieldSvSued);
      await user.keyboard('1');
      expect(onScoreChange).not.toHaveBeenCalled();
      await user.keyboard('0');
      await user.tab();
      expect(onScoreChange).not.toHaveBeenCalled();

      await user.click(saveButton);
      expect(onScoreChange).toHaveBeenCalledTimes(1);
      expect(onScoreChange).toHaveBeenCalledWith(2, 10);
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

    it('@FU-101 Gegenbeispiel: Tab ins noch leere Gegenfeld speichert kein halbes Ergebnis, erst die Taste 10:2', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldFcNord, fieldSvSued, saveButton } = renderCell({ scoreA: undefined, scoreB: undefined });

      await user.click(fieldFcNord);
      await user.keyboard('10');
      await user.tab();
      expect(onScoreChange).not.toHaveBeenCalled();

      await user.keyboard('2');
      await user.tab();
      expect(fieldSvSued.value).toBe('2');
      expect(onScoreChange).not.toHaveBeenCalled();

      await user.click(saveButton);
      expect(onScoreChange).toHaveBeenCalledTimes(1);
      expect(onScoreChange).toHaveBeenCalledWith(10, 2);
    });
  });

  describe('nur Ziffern, höchstens zwei Stellen (Textfeld mit Ziffernblock, keine Pfeile)', () => {
    it.each([['-3', '3'], ['2.5', '25'], ['1e1', '11'], ['abc', ''], ['123', '12']])('@FU-101 Eingabe „%s“ lässt nur „%s“ im Feld stehen, es gibt keinen Hinweis', async (text, bleibt) => {
      const user = userEvent.setup();
      const { onScoreChange, fieldFcNord, queryByRole } = renderCell();

      await user.click(fieldFcNord);
      await user.type(fieldFcNord, text);
      await user.tab();

      expect(fieldFcNord.value).toBe(bleibt);
      expect(fieldFcNord.type).toBe('text');
      expect(fieldFcNord.getAttribute('aria-invalid')).toBeNull();
      expect(queryByRole('alert')).toBeNull();
      expect(onScoreChange).not.toHaveBeenCalled();
    });

    it.each([['007', '7'], ['00', '0'], ['07', '7'], ['a12', ''], ['1e2', ''], ['2,5', ''], ['-3', ''], ['100', ''], ['42', '42']])(
      '@FU-101 Einfügen von „%s“: Ziffern ohne führende Nullen bis 99 gelten, alles andere lässt den alten Wert stehen (nichts wird umgedeutet), Ergebnis „%s“',
      async (text, bleibt) => {
        const user = userEvent.setup();
        const { onScoreChange, fieldFcNord } = renderCell();
        await user.click(fieldFcNord);
        await user.paste(text);
        expect(fieldFcNord.value).toBe(bleibt);
        expect(onScoreChange).not.toHaveBeenCalled();
      },
    );

    it('@FU-101 Einfügen von Text mit Nicht-Ziffern behält einen schon getippten Wert („7“ bleibt bei „2,5“)', async () => {
      const user = userEvent.setup();
      const { fieldFcNord } = renderCell();
      await user.click(fieldFcNord);
      await user.keyboard('7');
      await user.paste('2,5');
      expect(fieldFcNord.value).toBe('7');
    });

    it('@FU-101 Buchstaben allein lassen das Feld leer; danach geht 3:2 mit der Taste durch', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldFcNord, saveButton } = renderCell();
      await user.click(fieldFcNord);
      await user.keyboard('abc');
      expect(fieldFcNord.value).toBe('');
      await user.keyboard('3');
      await user.click(saveButton);
      expect(onScoreChange).toHaveBeenCalledWith(3, 2);
    });
  });

  describe('Nachbar @FU-093 / @FU-097: nach „Nein“ / „Abbrechen“ oder Ablehnung', () => {
    it('@FU-093 nach „Nein“ (nichts gespeichert) zeigt die Zelle wieder den gespeicherten Stand, hier leer', async () => {
      const user = userEvent.setup();
      const onScoreChange = vi.fn().mockResolvedValue(false);
      const { fieldFcNord, fieldSvSued, saveButton } = renderCell({ scoreA: undefined, scoreB: undefined, onScoreChange });

      await user.click(fieldFcNord);
      await user.keyboard('3');
      await user.click(fieldSvSued);
      await user.keyboard('1');
      await user.click(saveButton);

      expect(onScoreChange).toHaveBeenCalledTimes(1);
      await waitFor(() => expect([fieldFcNord.value, fieldSvSued.value]).toEqual(['', '']));
    });

    it('@FU-097 nach „Abbrechen“ lässt sich derselbe Stand mit der Taste erneut senden (Doppelschutz blockiert nicht)', async () => {
      const user = userEvent.setup();
      const onScoreChange = vi.fn().mockResolvedValue(false);
      const { fieldFcNord, fieldSvSued, saveButton } = renderCell({ scoreA: undefined, scoreB: undefined, onScoreChange });

      await user.click(fieldFcNord);
      await user.keyboard('2');
      await user.click(fieldSvSued);
      await user.keyboard('2');
      await user.click(saveButton);
      await waitFor(() => expect(fieldFcNord.value).toBe(''));

      await user.click(fieldFcNord);
      await user.keyboard('2');
      await user.click(fieldSvSued);
      await user.keyboard('2');
      await user.click(saveButton);
      expect(onScoreChange).toHaveBeenCalledTimes(2);
      expect(onScoreChange).toHaveBeenLastCalledWith(2, 2);
    });

    it('Ablehnung durch eine abgewiesene Zusage setzt die Zelle ebenfalls zurück', async () => {
      const user = userEvent.setup();
      const onScoreChange = vi.fn().mockRejectedValue(new Error('abgelehnt'));
      const { fieldFcNord, saveButton } = renderCell({ scoreA: 1, scoreB: 2, onScoreChange });

      await user.click(fieldFcNord);
      await user.keyboard('{Backspace}4');
      await user.click(saveButton);
      await waitFor(() => expect(fieldFcNord.value).toBe('1'));
    });

    it('Gegenbeispiel: nach erfolgreichem Speichern (true) bleibt die Eingabe stehen', async () => {
      const user = userEvent.setup();
      const onScoreChange = vi.fn().mockResolvedValue(true);
      const { fieldFcNord, saveButton } = renderCell({ scoreA: undefined, scoreB: 2, onScoreChange });

      await user.click(fieldFcNord);
      await user.keyboard('10');
      await user.click(saveButton);
      await Promise.resolve();
      expect(fieldFcNord.value).toBe('10');
    });

    it('Wettlauf: neue Eingabe, bevor ein spätes „nicht gespeichert“ kommt – die neue Eingabe bleibt stehen', async () => {
      const user = userEvent.setup();
      let answer: (saved: boolean) => void = () => undefined;
      const onScoreChange = vi.fn().mockImplementation(() => new Promise<boolean>((resolve) => { answer = resolve; }));
      const { fieldFcNord, fieldSvSued, saveButton } = renderCell({ scoreA: undefined, scoreB: undefined, onScoreChange });

      await user.click(fieldFcNord);
      await user.keyboard('3');
      await user.click(fieldSvSued);
      await user.keyboard('1');
      await user.click(saveButton); // gesendet, Rückfrage offen
      expect(onScoreChange).toHaveBeenCalledTimes(1);

      await user.click(fieldFcNord);
      await user.keyboard('{Backspace}7'); // Olli tippt weiter, bevor die Antwort kommt
      await act(async () => { answer(false); await Promise.resolve(); });

      expect(fieldFcNord.value).toBe('7');
      expect(fieldSvSued.value).toBe('1');
    });
  });

  describe('@FU-112 laufendes Spiel: leere Felder statt vorbelegter 0, „Spiel beenden und Ergebnis eintragen“', () => {
    it('@FU-112 laufendes Spiel mit Stand 0:0 zeigt leere Felder, „2“ tippen beendet nichts und füllt die Null nicht still auf', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldFcNord, fieldSvSued, saveButton } = renderCell({ scoreA: 0, scoreB: 0, isRunning: true });
      expect([fieldFcNord.value, fieldSvSued.value]).toEqual(['', '']);

      await user.click(fieldFcNord);
      await user.keyboard('2');
      await user.tab();
      expect(saveButton.disabled).toBe(true); // das Gegenfeld ist noch leer
      expect(onScoreChange).not.toHaveBeenCalled();
    });

    it('@FU-112 die Taste heißt „Spiel beenden und Ergebnis eintragen“ und sendet 3:1 erst auf Antippen', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldFcNord, fieldSvSued, saveButton } = renderCell({ scoreA: 0, scoreB: 0, isRunning: true });
      expect(saveButton.textContent).toMatch(/Spiel beenden und Ergebnis eintragen|endAndEnter/);

      await user.click(fieldFcNord);
      await user.keyboard('3');
      await user.click(fieldSvSued);
      await user.keyboard('1');
      expect(onScoreChange).not.toHaveBeenCalled();
      await user.click(saveButton);
      expect(onScoreChange).toHaveBeenCalledWith(3, 1);
    });

    it('@FU-112 laufendes Spiel 0:0: getippte „0“ und „0“ lassen sich bewusst als 0:0 beenden (mit Rückfrage über onScoreChange)', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldFcNord, fieldSvSued, saveButton } = renderCell({ scoreA: 0, scoreB: 0, isRunning: true });
      expect(saveButton.disabled).toBe(true);
      await user.click(fieldFcNord);
      await user.keyboard('0');
      await user.click(fieldSvSued);
      await user.keyboard('0');
      expect(saveButton.disabled).toBe(false);
      expect(onScoreChange).not.toHaveBeenCalled();
      await user.click(saveButton);
      expect(onScoreChange).toHaveBeenCalledTimes(1);
      expect(onScoreChange).toHaveBeenCalledWith(0, 0);
    });

    it('@FU-112 Gegenbeispiel: ein geplantes Spiel heißt „Ergebnis speichern“', () => {
      const { saveButton } = renderCell({ isRunning: false });
      expect(saveButton.textContent).not.toMatch(/beenden/);
    });

    it('@FU-112 laufendes Spiel mit echtem Stand 2:1 zeigt 2:1 und lässt sich unverändert beenden', async () => {
      const user = userEvent.setup();
      const { onScoreChange, fieldFcNord, fieldSvSued, saveButton } = renderCell({ scoreA: 2, scoreB: 1, isRunning: true });
      expect([fieldFcNord.value, fieldSvSued.value]).toEqual(['2', '1']);
      await user.click(saveButton);
      expect(onScoreChange).toHaveBeenCalledWith(2, 1);
    });
  });

  describe('Beschriftung', () => {
    it('beide Felder tragen ihre Beschriftung „Tore <Team>“; Eingabe von Unsinn macht kein Feld ungültig (sie bleibt gar nicht stehen)', async () => {
      const user = userEvent.setup();
      const { fieldFcNord, fieldSvSued } = renderCell({ scoreA: undefined, scoreB: 2 });

      await user.click(fieldFcNord);
      await user.keyboard('-x');
      await user.tab();

      expect(fieldFcNord.getAttribute('aria-label')).toMatch(/goalsOf/); // Beschriftung „Tore <Team>“ (Schlüssel, die Datei prüft ohne echte Texte)
      expect(fieldFcNord.value).toBe('');
      expect(fieldFcNord.getAttribute('aria-invalid')).toBeNull();
      expect(fieldSvSued.getAttribute('aria-invalid')).toBeNull();
    });
  });
});
