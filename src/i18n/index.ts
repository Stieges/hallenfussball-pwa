import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Static imports for offline-first PWA (all locales bundled)
import deCommon from './locales/de/common.json';
import deAuth from './locales/de/auth.json';
import deDashboard from './locales/de/dashboard.json';
import deWizard from './locales/de/wizard.json';
import deTournament from './locales/de/tournament.json';
import deCockpit from './locales/de/cockpit.json';
import deMonitor from './locales/de/monitor.json';
import deSettings from './locales/de/settings.json';
import deAdmin from './locales/de/admin.json';
import deSport from './locales/de/sport.json';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enWizard from './locales/en/wizard.json';
import enTournament from './locales/en/tournament.json';
import enCockpit from './locales/en/cockpit.json';
import enMonitor from './locales/en/monitor.json';
import enSettings from './locales/en/settings.json';
import enAdmin from './locales/en/admin.json';
import enSport from './locales/en/sport.json';

// Import types for module augmentation side-effect
import './types';

// =============================================================================
// LANGUAGE DETECTION
// =============================================================================

const SUPPORTED_LANGUAGES = ['de', 'en'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Detect initial language from settings (localStorage) or browser.
 *
 * Priority:
 * 1. User setting from localStorage (if 'de' or 'en')
 * 2. Browser language (navigator.language)
 * 3. Fallback: 'de'
 */
function detectLanguage(): SupportedLanguage {
  try {
    const raw = localStorage.getItem('hallenfussball-settings');
    if (raw) {
      const settings = JSON.parse(raw) as { language?: string };
      if (settings.language && settings.language !== 'system') {
        if (SUPPORTED_LANGUAGES.includes(settings.language as SupportedLanguage)) {
          return settings.language as SupportedLanguage;
        }
      }
    }
  } catch {
    // localStorage not available or corrupted — fall through
  }

  // Browser language detection
  const browserLang = navigator.language.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(browserLang as SupportedLanguage)) {
    return browserLang as SupportedLanguage;
  }

  return 'de';
}

// =============================================================================
// NAMESPACES
// =============================================================================

export const NAMESPACES = [
  'common',
  'auth',
  'dashboard',
  'wizard',
  'tournament',
  'cockpit',
  'monitor',
  'settings',
  'admin',
  'sport',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

// =============================================================================
// INIT
// =============================================================================

void i18n.use(initReactI18next).init({
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
    },
    en: {
      common: enCommon,
      auth: enAuth,
      dashboard: enDashboard,
      wizard: enWizard,
      tournament: enTournament,
      cockpit: enCockpit,
      monitor: enMonitor,
      settings: enSettings,
      admin: enAdmin,
      sport: enSport,
    },
  },

  lng: detectLanguage(),
  fallbackLng: 'de',
  defaultNS: 'common',
  ns: NAMESPACES as unknown as string[],

  interpolation: {
    escapeValue: false, // React already escapes
  },

  // Return key as fallback during migration (shows German text from keys)
  returnNull: false,
});

// Sync <html lang="..."> with current language
document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
