/**
 * Task C2b, Aufgabe 2: Glossar-Eintraege fuer die Ausgangs-Anzeige.
 * „nicht uebernommen" und „wartet auf Turnierleitung" sind normative Begriffe
 * (TERMINOLOGY.md: glossary.json ist die Quelle, i18nKey zeigt nach sport.json).
 */
import { describe, expect, it } from 'vitest';
import glossary from '../../../../i18n/glossary.json';
import deSport from '../../../../i18n/locales/de/sport.json';
import enSport from '../../../../i18n/locales/en/sport.json';

interface GlossaryTerm {
  de: string;
  en: string;
  forbidden_de: string[];
  reason: string;
  i18nKey: string;
}

type JsonObject = Record<string, unknown>;

function resolve(root: JsonObject, dottedKey: string): unknown {
  let node: unknown = root;
  for (const part of dottedKey.split('.')) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      return undefined;
    }
    node = (node as JsonObject)[part];
  }
  return node;
}

const EXPECTED: Record<string, string> = {
  rejectedEntry: 'nicht übernommen',
  awaitingReview: 'wartet auf Turnierleitung',
};

describe('Glossar Ausgang (C2b)', () => {
  it.each(Object.keys(EXPECTED))('hat den Eintrag %s im Format des Glossars', (termId) => {
    const term = (glossary.terms as Record<string, GlossaryTerm>)[termId];
    expect(term).toBeDefined();
    expect(typeof term.de).toBe('string');
    expect(typeof term.en).toBe('string');
    expect(Array.isArray(term.forbidden_de)).toBe(true);
    expect(typeof term.reason).toBe('string');
    expect(typeof term.i18nKey).toBe('string');
    expect(term.de).toBe(EXPECTED[termId]);
  });

  it.each(Object.keys(EXPECTED))('zeigt %s mit i18nKey auf den Wert in de/sport.json', (termId) => {
    const term = (glossary.terms as Record<string, GlossaryTerm>)[termId];
    expect(resolve(deSport, term.i18nKey)).toBe(term.de);
    expect(resolve(enSport, term.i18nKey)).toBe(term.en);
  });
});
