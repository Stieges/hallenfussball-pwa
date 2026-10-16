/**
 * Echte i18next-Instanz mit den DE/EN-Texten aus tournament.json (statt des Schlüssel-Mocks aus src/test/setup.ts),
 * damit die Ansicht-Tests den gerenderten Record-Wortlaut prüfen. Nutzung:
 * `vi.mock('i18next', async () => (await import('./realI18n')).realI18nModule());`
 */
export async function realI18nModule(): Promise<{ default: unknown }> {
  const { vi } = await import('vitest');
  const actual = await vi.importActual<typeof import('i18next')>('i18next');
  const de = (await import('../../../i18n/locales/de/tournament.json')).default;
  const en = (await import('../../../i18n/locales/en/tournament.json')).default;
  const instance = actual.default.createInstance();
  await instance.init({
    lng: 'de',
    fallbackLng: false,
    resources: { de: { tournament: de }, en: { tournament: en } },
    interpolation: { escapeValue: false },
  });
  return { default: instance };
}
