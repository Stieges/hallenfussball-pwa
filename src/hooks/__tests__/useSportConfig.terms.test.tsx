import { describe, it, expect, beforeAll, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import deSport from '../../i18n/locales/de/sport.json';

// Siehe useSportTerms.test.tsx: der globale Passthrough-Mock aus
// src/test/setup.ts ignoriert `context`/Plural-Optionen und würde jede
// Assertion hier unabhängig von der tatsächlichen Implementierung grün
// machen. Deshalb echte i18next-Instanz statt Mock.
vi.unmock('i18next');
vi.unmock('react-i18next');

const { createInstance } = await import('i18next');
const { initReactI18next, I18nextProvider } = await import('react-i18next');
const { useSportConfig } = await import('../useSportConfig');

type I18nInstance = ReturnType<typeof createInstance>;

describe('useSportConfig: getFieldName/getGoalName/… leiten an useSportTerms weiter', () => {
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

  it('football-outdoor: getFieldName nutzt die sportartabhängige Variante ("Platz"/"Plätze")', () => {
    const { result } = renderHook(() => useSportConfig('football-outdoor'), { wrapper });
    expect(result.current.getFieldName(1)).toBe('Platz');
    expect(result.current.getFieldName(3)).toBe('Plätze');
    expect(result.current.getFieldName()).toBe('Plätze'); // kein count → Plural, wie zuvor
  });

  it('football-indoor: getFieldName fällt auf die Basis-Terminologie zurück ("Feld"/"Felder")', () => {
    const { result } = renderHook(() => useSportConfig('football-indoor'), { wrapper });
    expect(result.current.getFieldName(1)).toBe('Feld');
    expect(result.current.getFieldName(3)).toBe('Felder');
  });

  it('basketball: getGoalName nutzt die sportartabhängige Variante ("Korb"/"Körbe")', () => {
    const { result } = renderHook(() => useSportConfig('basketball'), { wrapper });
    expect(result.current.getGoalName(1)).toBe('Korb');
    expect(result.current.getGoalName(3)).toBe('Körbe');
  });

  it('getPeriodName/getMatchName/getTeamName liefern die Basis-Terminologie', () => {
    const { result } = renderHook(() => useSportConfig('football-indoor'), { wrapper });
    expect(result.current.getPeriodName(1)).toBe('Halbzeit');
    expect(result.current.getPeriodName(3)).toBe('Halbzeiten');
    expect(result.current.getMatchName(1)).toBe('Spiel');
    expect(result.current.getMatchName(3)).toBe('Spiele');
    expect(result.current.getTeamName(1)).toBe('Mannschaft');
    expect(result.current.getTeamName(3)).toBe('Mannschaften');
  });

  it('config.terminology bleibt unverändert erreichbar (bestehende Aufrufstellen lesen direkt daraus)', () => {
    const { result } = renderHook(() => useSportConfig('football-indoor'), { wrapper });
    expect(result.current.terminology.periodPlural).toBeDefined();
    expect(result.current.terminology.goal).toBeDefined();
  });
});
