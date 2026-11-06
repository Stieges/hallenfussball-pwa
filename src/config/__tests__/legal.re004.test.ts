/**
 * @RE-004 Betreiberangaben an genau einer Stelle (src/config/legal.ts); ein leeres Pflichtfeld oder ein Platzhalter wird erkannt.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getUnfilledPlaceholders, isPlaceholder, type LegalConfig } from '../legal';

const voll: LegalConfig = {
  name: 'Erika Mustermann', careOf: '', street: 'Hauptstraße 1', city: '12345 Musterstadt', email: 'erika@example.org',
  supervisoryAuthority: { name: 'Behörde', address: 'Straße 1', url: 'https://example.org' }, lastUpdated: 'November 2026',
};

describe('@RE-004 Platzhalter-Erkennung', () => {
  it.each([['[VORNAME NACHNAME]'], [''], ['   '], ['Hauptstr. [NR]']])('%j gilt als Platzhalter', (wert) => {
    expect(isPlaceholder(wert)).toBe(true);
  });

  it.each([['Erika Mustermann'], ['12345 Musterstadt'], ['a@b.de']])('%j gilt nicht als Platzhalter (Gegenbeispiel)', (wert) => {
    expect(isPlaceholder(wert)).toBe(false);
  });
});

describe('@RE-004 Vollständigkeit der Betreiberangaben', () => {
  it('alle Pflichtfelder ausgefüllt: nichts fehlt, die c/o-Zeile darf leer bleiben', () => {
    expect(getUnfilledPlaceholders(voll)).toEqual([]);
  });

  it.each(['name', 'street', 'city', 'email'] as const)('Pflichtfeld %s leer: wird gemeldet', (feld) => {
    expect(getUnfilledPlaceholders({ ...voll, [feld]: '' })).toEqual([feld]);
  });

  it.each(['name', 'street', 'city', 'email'] as const)('Pflichtfeld %s noch in eckigen Klammern: wird gemeldet', (feld) => {
    expect(getUnfilledPlaceholders({ ...voll, [feld]: '[PLATZHALTER]' })).toEqual([feld]);
  });

  it.each(['erika.example.org', 'erika@example', 'erika@.org', 'erika @example.org', '@example.org'])('E-Mail %j hat keine gültige Form: wird gemeldet', (adresse) => {
    expect(getUnfilledPlaceholders({ ...voll, email: adresse })).toEqual(['email']);
  });

  it('E-Mail mit „@“ und Punkt im Domain-Teil ist gültig (Gegenbeispiel)', () => {
    expect(getUnfilledPlaceholders({ ...voll, email: 'a.b@mein-verein.example.de' })).toEqual([]);
  });

  it('c/o-Zeile mit offener Klammer wird gemeldet, ausgefüllte c/o-Zeile nicht', () => {
    expect(getUnfilledPlaceholders({ ...voll, careOf: '[c/o NAME]' })).toEqual(['careOf']);
    expect(getUnfilledPlaceholders({ ...voll, careOf: 'c/o Verein' })).toEqual([]);
  });
});

describe('@RE-004 eine einzige Stelle', () => {
  function dateien(ordner: string): string[] {
    return readdirSync(ordner).flatMap((eintrag) => {
      const pfad = join(ordner, eintrag);
      if (statSync(pfad).isDirectory()) { return eintrag === '__tests__' ? [] : dateien(pfad); }
      return /\.(ts|tsx)$/.test(eintrag) ? [pfad] : [];
    });
  }

  it('die Platzhalter-Texte der Betreiberangaben stehen außer in legal.ts nirgends im Produktcode', () => {
    const wurzel = join(__dirname, '..', '..');
    const treffer = dateien(wurzel)
      .filter((pfad) => relative(wurzel, pfad) !== join('config', 'legal.ts'))
      .filter((pfad) => /\[(VORNAME NACHNAME|STRASSE NR|PLZ ORT|E-MAIL|c\/o NAME)\]/.test(readFileSync(pfad, 'utf8')));
    expect(treffer.map((pfad) => relative(wurzel, pfad))).toEqual([]);
  }, 60_000); // liest den ganzen Produktcode: bei Last (parallele Läufe) länger als die üblichen 5 s
});
