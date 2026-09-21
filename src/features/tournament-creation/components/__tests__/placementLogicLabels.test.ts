import { describe, it, expect, beforeAll, vi } from 'vitest';
import deWizard from '../../../../i18n/locales/de/wizard.json';

// Siehe useSportTerms.test.tsx / useSportConfig.terms.test.tsx: der globale
// Passthrough-Mock aus src/test/setup.ts würde jede Assertion hier unabhängig
// von der tatsächlichen Implementierung grün machen (er ignoriert
// `defaultValue`). Deshalb eine echte i18next-Instanz statt Mock.
vi.unmock('i18next');
vi.unmock('react-i18next');

const { createInstance } = await import('i18next');
const { resolvePlacementCriterionLabel } = await import('../placementLogicLabels');

type I18nInstance = ReturnType<typeof createInstance>;

describe('resolvePlacementCriterionLabel: Rückfall auf gespeicherte label bei fehlendem i18n-Schlüssel', () => {
  let instance: I18nInstance;

  beforeAll(async () => {
    instance = createInstance();
    await instance.init({
      lng: 'de',
      fallbackLng: 'de',
      defaultNS: 'wizard',
      ns: ['wizard'],
      resources: {
        de: { wizard: deWizard },
      },
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  });

  it('löst eine bekannte id (z.B. "goalDifference") über den i18n-Schlüssel auf — auch wenn ein altes label gespeichert ist', () => {
    const t = instance.getFixedT('de', 'wizard');
    const label = resolvePlacementCriterionLabel(t, {
      id: 'goalDifference',
      label: 'Ein irgendwann anders persistierter Text',
      enabled: true,
    });
    expect(label).toBe('Tordifferenz');
  });

  it('löst eine bekannte id auch ohne gespeichertes label über i18n auf', () => {
    const t = instance.getFixedT('de', 'wizard');
    const label = resolvePlacementCriterionLabel(t, { id: 'points', enabled: true });
    expect(label).toBe('Punkte');
  });

  it('fällt bei unbekannter id auf das gespeicherte label zurück (Bestandsturniere/Importe bleiben lesbar)', () => {
    const t = instance.getFixedT('de', 'wizard');
    const label = resolvePlacementCriterionLabel(t, {
      id: 'headToHead', // keine passende Übersetzung in placementLogic.criteria
      label: 'Direkter Vergleich',
      enabled: true,
    });
    expect(label).toBe('Direkter Vergleich');
  });

  it('fällt bei unbekannter id und fehlendem label auf die id selbst zurück (nie leer)', () => {
    const t = instance.getFixedT('de', 'wizard');
    const label = resolvePlacementCriterionLabel(t, { id: 'someUnknownId', enabled: true });
    expect(label).toBe('someUnknownId');
  });
});
