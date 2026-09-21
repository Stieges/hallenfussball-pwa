import { describe, it, expect, beforeAll, vi } from 'vitest';
import deSport from '../locales/de/sport.json';

// src/test/setup.ts mockt 'i18next' global als Passthrough (gibt den Key
// zurück statt zu übersetzen), damit UI-Komponententests keine echte
// Initialisierung brauchen. Für diesen Test ist genau die echte i18next-
// Pluralisierungs-/Kontext-Engine der Untersuchungsgegenstand, deshalb wird
// der globale Mock hier gezielt aufgehoben.
vi.unmock('i18next');
const { createInstance } = await import('i18next');
type I18nInstance = ReturnType<typeof createInstance>;

/**
 * Belegt die eine offene technische Frage aus Task 2: bildet i18next
 * (^26.4.2) aus context + count wirklich `key_context_one` /
 * `key_context_other`, und fällt es sauber auf `key_one` / `key_other`
 * zurück, wenn eine Sportart keine eigene Variante definiert?
 *
 * Beide Richtungen werden geprüft — Erfolgsfall (Variante vorhanden,
 * football-outdoor) UND Rückfall (keine Variante vorhanden, handball ist
 * im sport.json bewusst nicht eingetragen). Ein Test, der nur den
 * Erfolgsfall prüft, hätte einen kaputten Rückfall nicht bemerkt.
 *
 * Hinweis zur Typisierung: das global augmentierte i18next-t() leitet aus
 * den vorhandenen `_context`-Suffixen in sport.json ein striktes Literal-
 * Union für `context` ab (z.B. nur 'football-outdoor' | 'basketball' für
 * `terminology.field`). Genau das ist hier Testgegenstand — ein context
 * OHNE eigene Übersetzung (z.B. 'handball') ist auf Typ-Ebene bewusst kein
 * gültiges Literal mehr. Für den Rückfall-Testfall wird deshalb bewusst
 * über eine locker typisierte Referenz auf t() zugegriffen, statt den
 * Rückfall aus dem Test wegzutypisieren.
 */
describe('sport.json: i18next context + Plural (i18next ^26.4.2)', () => {
  let instance: I18nInstance;
  let translate: (key: string, options?: Record<string, unknown>) => string;

  beforeAll(async () => {
    instance = createInstance();
    await instance.init({
      lng: 'de',
      fallbackLng: 'de',
      defaultNS: 'sport',
      ns: ['sport'],
      resources: {
        de: { sport: deSport },
      },
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    translate = instance.t.bind(instance) as typeof translate;
  });

  it('nutzt die sportartabhängige Variante, wenn eine existiert (football-outdoor)', () => {
    expect(
      instance.t('sport:terminology.field', { context: 'football-outdoor', count: 1 })
    ).toBe('Platz');
    expect(
      instance.t('sport:terminology.field', { context: 'football-outdoor', count: 3 })
    ).toBe('Plätze');
  });

  it('fällt auf die Basis-Terminologie zurück, wenn keine Variante existiert (handball)', () => {
    // handball ist eine gültige SportId (src/config/sports/types.ts), hat aber
    // in sport.json bewusst KEINEN eigenen terminology-Eintrag.
    expect(translate('sport:terminology.field', { context: 'handball', count: 1 })).toBe(
      'Feld'
    );
    expect(translate('sport:terminology.field', { context: 'handball', count: 3 })).toBe(
      'Felder'
    );
  });

  it('Kontext-Variante mit Plural nutzt die richtige Form (basketball)', () => {
    expect(
      instance.t('sport:terminology.goal', { context: 'basketball', count: 1 })
    ).toBe('Korb');
    expect(
      instance.t('sport:terminology.goal', { context: 'basketball', count: 5 })
    ).toBe('Körbe');
  });

  it('Kontext ohne eigene Übersetzung UND ohne Plural-Suffix fällt auf den reinen Basisschlüssel zurück', () => {
    // scoreLabel hat weder Plural- noch Kontext-Varianten definiert.
    expect(translate('sport:terminology.scoreLabel', { context: 'basketball' })).toBe(
      'Ergebnis'
    );
  });
});
