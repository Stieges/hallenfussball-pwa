import { describe, it, expect } from 'vitest';
// scripts/check-terminology.cjs ist ein CommonJS-Skript (npm-Script + Husky-Hook +
// CI-Schritt). Dieser Test bindet dieselbe Implementierung ein, damit
// `npm test` denselben Prüfer läuft wie die anderen drei Verankerungen —
// keine zweite, potenziell abweichende Implementierung.
import checkTerminology from '../../../scripts/check-terminology.cjs';

const { runAllChecks, wordBoundaryRegex } = checkTerminology;

describe('Terminologie-Prüfer (scripts/check-terminology.cjs)', () => {
  it('findet mindestens die Sprachen de und en', () => {
    const { locales } = runAllChecks();
    expect(locales).toEqual(expect.arrayContaining(['de', 'en']));
  });

  it('findet den Namespace sport', () => {
    const { namespaces } = runAllChecks();
    expect(namespaces).toContain('sport');
  });

  it('Schlüssel-Parität: keine Verstöße im aktuellen Zustand', () => {
    const { results } = runAllChecks();
    const parity = results.find((r) => r.check === 'Schlüssel-Parität');
    expect(parity?.errors).toEqual([]);
  });

  it('Verbotene Synonyme: keine Verstöße im aktuellen Zustand', () => {
    const { results } = runAllChecks();
    const forbidden = results.find((r) => r.check === 'Verbotene Synonyme');
    expect(forbidden?.errors).toEqual([]);
  });

  it('Glossar-Schlüssel: keine Verstöße im aktuellen Zustand', () => {
    const { results } = runAllChecks();
    const glossaryKeys = results.find((r) => r.check === 'Glossar-Schlüssel');
    expect(glossaryKeys?.errors).toEqual([]);
  });

  describe('wordBoundaryRegex (Umlaut/ß-Falle)', () => {
    // JS' \b behandelt ß, ä, ö, ü NICHT als Wortzeichen. Ein naives
    // \bStrafstoß\b würde deshalb mitten in "Strafstoßschießen" matchen
    // (die Lücke zwischen "ß" und "s" sieht für \b wie eine Wortgrenze aus).
    // Das ist exakt die Falle, in die die ESLint-Regel zuerst gelaufen ist
    // (siehe eslint-rules/no-hardcoded-sport-terms.cjs).
    it('"Strafstoß" matcht NICHT innerhalb von "Strafstoßschießen"', () => {
      const regex = wordBoundaryRegex('Strafstoß');
      expect(regex.test('Strafstoßschießen')).toBe(false);
    });

    it('"Strafstoß" matcht sehr wohl als eigenständiges Wort', () => {
      const regex = wordBoundaryRegex('Strafstoß');
      expect(regex.test('Der Strafstoß wird ausgeführt.')).toBe(true);
    });

    it('ein verbotenes Synonym wie "Elfmeter" matcht als eigenständiges Wort', () => {
      const regex = wordBoundaryRegex('Elfmeter');
      expect(regex.test('Das Elfmeter wird verhängt.')).toBe(true);
    });

    it('"Elfmeter" matcht NICHT innerhalb von "Elfmeterschießen"-artigen Komposita', () => {
      // Analog zur Strafstoß/Strafstoßschießen-Falle: ein isoliertes
      // "Elfmeter" darf nicht in einem längeren zusammengesetzten Wort greifen.
      const regex = wordBoundaryRegex('Elfmeter');
      expect(regex.test('Elfmetermarke')).toBe(false);
    });
  });
});
