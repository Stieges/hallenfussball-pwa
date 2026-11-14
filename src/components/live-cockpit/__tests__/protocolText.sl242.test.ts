/**
 * Text der Protokollzeile im Handy-Blatt (@OB-021, @OB-025, VISUAL-DESIGN § 2): Wörter mit Bindestrich beisammen, Nummer am Namen.
 */
import { describe, expect, it } from 'vitest';
import { bindTrailingNumber, splitProtocolText } from '../components/protocolText';

describe('splitProtocolText', () => {
  it('„Nordheim-Süd“ ist ein untrennbares Wort, der Rest bricht an Leerzeichen', () => {
    const teile = splitProtocolText('Zeitstrafe (2 Minuten) Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921');
    expect(teile.filter((t) => t.keepTogether).map((t) => t.text)).toEqual(['Nordheim-Süd']);
    expect(teile.map((t) => t.text).join('')).toBe('Zeitstrafe (2 Minuten) Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921');
  });

  it('Gegenbeispiel: ein Bindestrich zwischen Leerzeichen und Wörter ohne Bindestrich bleiben umbrechbar', () => {
    expect(splitProtocolText('FC - Süd und TSV West').some((t) => t.keepTogether)).toBe(false);
  });

  it('nach einem Schrägstrich darf umgebrochen werden: „Waging/Petting“ ist kein Bindestrich-Wort', () => {
    expect(splitProtocolText('SG Waging/Petting').some((t) => t.keepTogether)).toBe(false);
  });
});

describe('bindTrailingNumber', () => {
  it('„SV Süd #5“ → geschütztes Leerzeichen vor der Nummer', () => {
    expect(bindTrailingNumber('Zeitstrafe (2 Minuten) SV Süd #5')).toBe('Zeitstrafe (2 Minuten) SV Süd #5');
  });
  it('Gegenbeispiel: ohne Nummer am Ende oder mit „#“ mitten im Text bleibt alles wie es ist', () => {
    expect(bindTrailingNumber('Tor FC Nord, ohne Nummer')).toBe('Tor FC Nord, ohne Nummer');
    expect(bindTrailingNumber('Foul #3 SV Süd')).toBe('Foul #3 SV Süd');
  });
});
