import { describe, it, expect } from 'vitest';
import deSport from '../locales/de/sport.json';
import enSport from '../locales/en/sport.json';

/**
 * Erzwingt Schlüssel-Parität zwischen den beiden sport.json-Sprachdateien.
 *
 * Zweck: sport.json ist der einzige Namespace, der sportartabhängige
 * i18next-context-Varianten und Plural-Suffixe (_one/_other) enthält.
 * Ein Schlüssel, der nur in einer Sprache existiert, fällt in der anderen
 * Sprache unbemerkt auf den Fallback (fallbackLng: 'de') zurück — das ist
 * für Kontext-/Plural-Suffixe besonders leicht zu übersehen, weil ein
 * fehlender `_other`-Schlüssel nicht aussieht wie ein fehlender Schlüssel,
 * sondern wie ein grammatikalisch falsches Ergebnis.
 */

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue };

function flattenKeys(obj: JsonValue, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') {
    return [prefix];
  }
  return Object.entries(obj).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe('sport.json Sprachparität (DE <-> EN)', () => {
  const deKeys = new Set(flattenKeys(deSport));
  const enKeys = new Set(flattenKeys(enSport));

  it('jeder DE-Schlüssel hat eine EN-Entsprechung', () => {
    const missingInEn = [...deKeys].filter((key) => !enKeys.has(key));
    expect(missingInEn).toEqual([]);
  });

  it('jeder EN-Schlüssel hat eine DE-Entsprechung', () => {
    const missingInDe = [...enKeys].filter((key) => !deKeys.has(key));
    expect(missingInDe).toEqual([]);
  });

  it('beide Dateien enthalten mindestens die erwarteten Top-Level-Sektionen', () => {
    // Regressionsschutz: falls jemand versehentlich eine ganze Sektion
    // aus einer Datei löscht, bleiben die beiden Sets oben trotzdem leer
    // Differenzen, wenn BEIDE Dateien identisch (fehlerhaft) verkürzt wurden.
    for (const section of ['terminology', 'ageClasses', 'events', 'phases']) {
      expect(deSport).toHaveProperty(section);
      expect(enSport).toHaveProperty(section);
    }
  });
});
