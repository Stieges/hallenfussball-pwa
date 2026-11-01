/**
 * Echte i18n-Instanzen in beiden Sprachen für Tests der Begriffsregeln (@OB-075/@OB-076).
 *
 * Eigene Instanz je Aufruf (die globale bleibt unberührt), alle Namespaces in Deutsch und Englisch, damit
 * Verschachtelungen wie `$t(sport:zeit.minuteCount, …)` und `$t(short:…)` wie in der App auflösen.
 * Testdateien heben den Passthrough-Mock auf: `vi.unmock('i18next'); vi.unmock('react-i18next');`.
 */
import i18nGlobal, { createInstance, type i18n as I18nInstance } from 'i18next';
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
import deShort from '../i18n/locales/de/short.json';
import dePublicView from '../i18n/locales/de/publicView.json';
import deHelpers from '../i18n/locales/de/helpers.json';
import enCommon from '../i18n/locales/en/common.json';
import enAuth from '../i18n/locales/en/auth.json';
import enDashboard from '../i18n/locales/en/dashboard.json';
import enWizard from '../i18n/locales/en/wizard.json';
import enTournament from '../i18n/locales/en/tournament.json';
import enCockpit from '../i18n/locales/en/cockpit.json';
import enMonitor from '../i18n/locales/en/monitor.json';
import enSettings from '../i18n/locales/en/settings.json';
import enAdmin from '../i18n/locales/en/admin.json';
import enSport from '../i18n/locales/en/sport.json';
import enShort from '../i18n/locales/en/short.json';
import enPublicView from '../i18n/locales/en/publicView.json';
import enHelpers from '../i18n/locales/en/helpers.json';

export type RealLanguage = 'de' | 'en';

const NAMESPACES = ['common', 'auth', 'dashboard', 'wizard', 'tournament', 'cockpit', 'monitor', 'settings', 'admin', 'sport', 'short', 'publicView', 'helpers'];

const RESOURCES = {
  de: { common: deCommon, auth: deAuth, dashboard: deDashboard, wizard: deWizard, tournament: deTournament, cockpit: deCockpit, monitor: deMonitor, settings: deSettings, admin: deAdmin, sport: deSport, short: deShort, publicView: dePublicView, helpers: deHelpers },
  en: { common: enCommon, auth: enAuth, dashboard: enDashboard, wizard: enWizard, tournament: enTournament, cockpit: enCockpit, monitor: enMonitor, settings: enSettings, admin: enAdmin, sport: enSport, short: enShort, publicView: enPublicView, helpers: enHelpers },
};

function options(lng: RealLanguage) {
  return {
    lng,
    fallbackLng: 'de',
    defaultNS: 'common',
    ns: NAMESPACES,
    resources: RESOURCES,
    interpolation: { escapeValue: false },
    returnNull: false as const,
  };
}

/** Eigene Instanz (für `I18nextProvider`); die globale bleibt unberührt. */
export async function createRealI18n(lng: RealLanguage): Promise<I18nInstance> {
  const instance = createInstance();
  await instance.use(initReactI18next).init(options(lng));
  return instance;
}

/**
 * Die globale Instanz (`import i18next from 'i18next'`) mit beiden Sprachen, für Code außerhalb von React
 * (`formatReferee`, `matchLabelText` …). Wechselt danach die Sprache, wenn sie schon läuft.
 */
export async function initRealGlobalI18n(lng: RealLanguage): Promise<void> {
  if (i18nGlobal.isInitialized) {
    await i18nGlobal.changeLanguage(lng);
    return;
  }
  await i18nGlobal.use(initReactI18next).init(options(lng));
}
