/**
 * Echte deutsche i18n-Instanz für Tests, die echte Texte prüfen (B-41).
 *
 * Der globale Passthrough-Mock aus src/test/setup.ts liefert nur Schlüssel. Testdateien, die
 * Anzeigetexte prüfen, heben den Mock auf (`vi.unmock('i18next')`, `vi.unmock('react-i18next')`)
 * und rufen `initRealDeI18n()` per Top-Level-await auf. Muster: TabellenTab.placementLogic.test.tsx.
 *
 * Bewusst ohne src/i18n/index.ts: dessen Modul-Init liest document/navigator und liefe in der
 * node-Testumgebung nicht.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import deCommon from '../i18n/locales/de/common.json';
import deAuth from '../i18n/locales/de/auth.json';
import deDashboard from '../i18n/locales/de/dashboard.json';
import deWizard from '../i18n/locales/de/wizard.json';
import deTournament from '../i18n/locales/de/tournament.json';
import deCockpit from '../i18n/locales/de/cockpit.json';
import deMonitor from '../i18n/locales/de/monitor.json';
import deSettings from '../i18n/locales/de/settings.json';
import deAdmin from '../i18n/locales/de/admin.json';
import deSport from '../i18n/locales/de/sport.json';
import dePublicView from '../i18n/locales/de/publicView.json';

export async function initRealDeI18n(): Promise<void> {
  if (i18n.isInitialized && i18n.language === 'de') {return;}
  await i18n.use(initReactI18next).init({
    lng: 'de',
    fallbackLng: 'de',
    defaultNS: 'common',
    ns: ['common', 'auth', 'dashboard', 'wizard', 'tournament', 'cockpit', 'monitor', 'settings', 'admin', 'sport', 'publicView'],
    resources: {
      de: {
        common: deCommon,
        auth: deAuth,
        dashboard: deDashboard,
        wizard: deWizard,
        tournament: deTournament,
        cockpit: deCockpit,
        monitor: deMonitor,
        settings: deSettings,
        admin: deAdmin,
        sport: deSport,
        publicView: dePublicView,
      },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}
