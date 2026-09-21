import { describe, it, expect, beforeAll, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import deSport from '../../i18n/locales/de/sport.json';

// src/test/setup.ts mockt 'i18next' und 'react-i18next' global als
// Passthrough (gibt den Key zurück statt zu übersetzen), damit UI-Komponenten-
// tests keine echte i18next-Initialisierung brauchen. Der Passthrough-Mock
// würde jede Kontext-/Plural-Assertion hier automatisch grün machen — er
// ignoriert `context` komplett und ersetzt nur `{{platzhalter}}`. Für diesen
// Test ist genau der Kontext-/Plural-Mechanismus der Untersuchungsgegenstand,
// deshalb wird der globale Mock hier gezielt aufgehoben (siehe auch
// src/i18n/__tests__/sport-context-plural.test.ts für dasselbe Muster).
vi.unmock('i18next');
vi.unmock('react-i18next');

const { createInstance } = await import('i18next');
const { initReactI18next, I18nextProvider } = await import('react-i18next');
const { useSportTerms } = await import('../useSportTerms');

type I18nInstance = ReturnType<typeof createInstance>;

describe('useSportTerms', () => {
  let instance: I18nInstance;
  let wrapper: ({ children }: { children: ReactNode }) => ReactNode;

  beforeAll(async () => {
    instance = createInstance();
    await instance.use(initReactI18next).init({
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
    wrapper = ({ children }: { children: ReactNode }) => (
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    );
  });

  it('nutzt die sportartabhängige Variante, wenn eine existiert (football-outdoor)', () => {
    const { result } = renderHook(() => useSportTerms('football-outdoor'), { wrapper });
    expect(result.current.term('terminology.field', { count: 1 })).toBe('Platz');
    expect(result.current.term('terminology.field', { count: 3 })).toBe('Plätze');
  });

  it('fällt auf die Basis-Terminologie zurück, wenn keine Variante existiert (handball)', () => {
    // handball ist eine gültige SportId (src/config/sports/types.ts), hat aber
    // in sport.json bewusst KEINEN eigenen terminology-Eintrag.
    const { result } = renderHook(() => useSportTerms('handball'), { wrapper });
    expect(result.current.term('terminology.field', { count: 1 })).toBe('Feld');
    expect(result.current.term('terminology.field', { count: 3 })).toBe('Felder');
  });

  it('setzt den Kontext auch für andere Keys als terminology (events.*)', () => {
    const { result: basketball } = renderHook(() => useSportTerms('basketball'), { wrapper });
    expect(basketball.current.term('events.penaltyShootout')).toBe('Strafstoßschießen');
  });

  it('erlaubt sportId=undefined (Rückfall auf Basis-Terminologie ohne Kontext)', () => {
    const { result } = renderHook(() => useSportTerms(undefined), { wrapper });
    expect(result.current.term('terminology.field', { count: 1 })).toBe('Feld');
  });
});
