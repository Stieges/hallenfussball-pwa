/**
 * @DR-032 Teamnamen: ausgeschrieben, Umbruch nur an Leerzeichen, Bindestrich und nach „/“, höchstens zwei Zeilen, Ausnahme
 * dritte Zeile ohne kleinere Schrift, nie gekürzt. Fake-Messfunktion: 2,0 mm je Zeichen (Breite 40 mm = 20 Zeichen).
 */
import { describe, expect, it } from 'vitest';
import { FAKE_MEASURE } from '../../__tests__/fixtures/fakeMeasure';
import { wrapName } from '../nameLines';

const wrap = (name: string, width: number): string[] => wrapName(name, width, 12, FAKE_MEASURE);

describe('@DR-032 Umbruch von Teamnamen', () => {
  it('@DR-032 voller Name, kein Kürzel: passt er, steht er in einer Zeile', () => {
    expect(wrap('SG Grabenstätt/Chieming', 56)).toEqual(['SG Grabenstätt/Chieming']);
  });

  it('@DR-032 Umbruch nach „/“, der Schrägstrich bleibt am Zeilenende', () => {
    expect(wrap('SG Grabenstätt/Chieming', 30)).toEqual(['SG Grabenstätt/', 'Chieming']);
  });

  it('@DR-032 Umbruch nach Bindestrich und an Leerzeichen', () => {
    expect(wrap('TSV 1860 Rosenheim-Westerndorf', 40)).toEqual(['TSV 1860 Rosenheim-', 'Westerndorf']);
  });

  it('@DR-032 höchstens zwei Zeilen, wenn der Name auf zwei Zeilen passt', () => {
    expect(wrap('SG Grabenstätt/Chieming/Übersee', 40)).toEqual(['SG Grabenstätt/', 'Chieming/Übersee']);
  });

  it('@DR-032 Ausnahme dritte Zeile: passt er auf zwei nicht, nimmt er eine dritte, ohne Kürzung', () => {
    const lines = wrap('Alpha Beta Gamma Delta Epsilon', 24);

    expect(lines).toEqual(['Alpha Beta', 'Gamma Delta', 'Epsilon']);
    expect(lines.join(' ')).toBe('Alpha Beta Gamma Delta Epsilon');
    expect(lines.join('')).not.toContain('…');
  });

  it('Gegenbeispiel @DR-032 nie mitten im Wort: ein zu langes Wort steht ungekürzt in einer eigenen Zeile', () => {
    expect(wrap('Supercalifragilistic', 10)).toEqual(['Supercalifragilistic']);
  });

  it('Gegenbeispiel @DR-032 ein Name genau an der Breitengrenze (22 mm = 11 Zeichen) bricht nicht um', () => {
    expect(wrap('ABCDE FGHIJ', 22)).toEqual(['ABCDE FGHIJ']);
    expect(wrap('ABCDE FGHIJK', 22)).toEqual(['ABCDE', 'FGHIJK']);
  });

  it('Gegenbeispiel @DR-033 „Spiel um Platz 3“ mit geschütztem Leerzeichen: die „3“ steht nie allein', () => {
    expect(wrap('Spiel um Platz 3', 30)).toEqual(['Spiel um', 'Platz 3']);
  });
});
