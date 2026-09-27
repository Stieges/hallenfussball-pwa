/**
 * Task C2b, Fixrunde 1 (Review m2): D-C2-Text bei genau einem wartenden Eintrag
 * ("Es warten noch 1 Einträge...") ist grammatisch falsch. `_one`/`_other` wie
 * beim Ablehnungs-Header (D-C1) verwenden.
 *
 * Braucht eine ECHTE i18next-Instanz mit Pluralisierung -- das globale Test-Setup
 * (src/test/setup.ts) mockt i18next/react-i18next als Passthrough (gibt den
 * Schluessel zurueck), das kann keine `_one`/`_other`-Aufloesung zeigen.
 */
import { describe, expect, it, vi } from 'vitest';
import deCommon from '../../../../i18n/locales/de/common.json';
import enCommon from '../../../../i18n/locales/en/common.json';

vi.unmock('i18next');

describe('outbox.logoutWarning.message — Ein-/Mehrzahl (Review m2)', () => {
  it('DE: Einzahl bei count=1, Mehrzahl sonst', async () => {
    const i18nextModule = await vi.importActual<typeof import('i18next')>('i18next');
    const i18n = (i18nextModule as { default?: typeof import('i18next') }).default ?? i18nextModule;
    await i18n.init({ lng: 'de', resources: { de: { common: deCommon } } });

    expect(i18n.t('common:outbox.logoutWarning.message', { count: 1 })).toBe(
      'Es wartet noch 1 Eintrag auf Übertragung. Er bleibt auf diesem Gerät gespeichert und wird nach der nächsten Anmeldung mit diesem Konto gesendet.',
    );
    expect(i18n.t('common:outbox.logoutWarning.message', { count: 3 })).toBe(
      'Es warten noch 3 Einträge auf Übertragung. Sie bleiben auf diesem Gerät gespeichert und werden nach der nächsten Anmeldung mit diesem Konto gesendet.',
    );
  });

  it('EN: Einzahl bei count=1, Mehrzahl sonst', async () => {
    const i18nextModule = await vi.importActual<typeof import('i18next')>('i18next');
    const i18n = (i18nextModule as { default?: typeof import('i18next') }).default ?? i18nextModule;
    await i18n.init({ lng: 'en', resources: { en: { common: enCommon } } });

    expect(i18n.t('common:outbox.logoutWarning.message', { count: 1 })).toBe(
      '1 entry is still waiting to be sent. It stays on this device and will be sent with this account after your next sign-in.',
    );
    expect(i18n.t('common:outbox.logoutWarning.message', { count: 3 })).toBe(
      '3 entries are still waiting to be sent. They stay on this device and will be sent with this account after your next sign-in.',
    );
  });
});
