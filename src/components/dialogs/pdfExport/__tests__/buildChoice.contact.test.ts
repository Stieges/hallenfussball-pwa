/** B-14 (@W1-031, @W1-032): Spielplan-PDF druckt den Ansprechpartner nur mit Häkchen „Ansprechpartner öffentlich zeigen“. */
import { describe, expect, it } from 'vitest';
import { publicContactOption } from '../buildChoice';

const kontakt = { name: 'Olga Orga', email: 'olga@orga.test', phone: '0171 1112223', website: 'https://orga.test' };

describe('publicContactOption (B-14)', () => {
  it('@W1-031 mit Häkchen: Name, Telefon, E-Mail und Website in einer Zeile', () => {
    expect(publicContactOption({ contactInfo: { ...kontakt, showPublic: true } }))
      .toEqual({ contact: 'Olga Orga · 0171 1112223 · olga@orga.test · https://orga.test' });
  });

  it('@W1-032 ohne Häkchen: kein Ansprechpartner im PDF', () => {
    expect(publicContactOption({ contactInfo: kontakt })).toEqual({});
    expect(publicContactOption({ contactInfo: { ...kontakt, showPublic: false } })).toEqual({});
  });

  it('@W1-031 Gegenbeispiel: Häkchen ohne Angaben (nur Leerzeichen) → keine Zeile', () => {
    expect(publicContactOption({ contactInfo: { name: '  ', showPublic: true } })).toEqual({});
    expect(publicContactOption({})).toEqual({});
  });
});
