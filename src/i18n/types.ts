import type deCommon from './locales/de/common.json';
import type deAuth from './locales/de/auth.json';
import type deDashboard from './locales/de/dashboard.json';
import type deWizard from './locales/de/wizard.json';
import type deTournament from './locales/de/tournament.json';
import type deCockpit from './locales/de/cockpit.json';
import type deMonitor from './locales/de/monitor.json';
import type deSettings from './locales/de/settings.json';
import type deAdmin from './locales/de/admin.json';
import type deSport from './locales/de/sport.json';

/**
 * Module augmentation for type-safe i18next.
 *
 * This enables autocompletion and type-checking for t() calls.
 * The German locale files are the source of truth for key types.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof deCommon;
      auth: typeof deAuth;
      dashboard: typeof deDashboard;
      wizard: typeof deWizard;
      tournament: typeof deTournament;
      cockpit: typeof deCockpit;
      monitor: typeof deMonitor;
      settings: typeof deSettings;
      admin: typeof deAdmin;
      sport: typeof deSport;
    };
  }
}
