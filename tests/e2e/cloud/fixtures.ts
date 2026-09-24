/**
 * tests/e2e/cloud/fixtures.ts — `asRole()`-Fixture für die cloud-Projekte (Task T3, Brief
 * Abschnitt 2: "Ein Fixture `asRole('helper')` liefert eine Seite mit dieser Anmeldung.
 * `browser.newContext({ storageState })` für Tests mit mehreren Rollen.").
 *
 * Setzt voraus, dass `cloud-setup` (siehe auth.setup.ts) bereits gelaufen ist und
 * `playwright/.auth/<rolle>.json` existiert — in playwright.config.ts über
 * `dependencies: ['cloud-setup']` an den cloud-Projekten erzwungen.
 */

import { test as base, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Exportiert (Fixrunde 1, M3): `offline.cloud.spec.ts` braucht denselben Pfad für einen
 *  eigenen `browser.newContext({ storageState })`-Aufruf (offline-Test, `asRole()` gibt keinen
 *  Zugriff auf den Context selbst) -- EINE Quelle statt einer zweiten, literal duplizierten
 *  Pfad-Konstruktion. */
export const AUTH_DIR = path.join(__dirname, '..', '..', '..', 'playwright', '.auth');

/**
 * Consent-Status (identisch zu tests/e2e/helpers/test-fixtures.ts, dort für die offline-Suite).
 * Ohne das blockiert der ConsentDialog beim ersten Laden jede Interaktion mit dem
 * "Anmelden"-Button (empirisch beim ersten cloud-setup-Lauf beobachtet: der Klick "traf" den
 * Button, aber der Login-Screen öffnete sich nicht, solange der Dialog sichtbar blieb).
 */
const TEST_CONSENT_STATUS = {
  errorTracking: true,
  sessionReplay: false,
  timestamp: Date.now(),
  version: 1,
};

/** Rollen, für die `cloud-setup` einen storageState erzeugt (siehe auth.setup.ts). */
export type LoggedInRole = 'owner' | 'coadmin' | 'helper' | 'trainer' | 'viewer' | 'revoked' | 'stranger';

export interface CloudFixtures {
  /**
   * Liefert eine neue, bereits angemeldete Seite für `role` (eigener Browser-Context mit dem
   * gespeicherten `storageState`). Für Tests, die mehrere Rollen gleichzeitig brauchen (z. B.
   * Owner UND stranger im selben Test) — jeder Aufruf öffnet einen eigenen Context, damit sich
   * Sessions nicht überschreiben.
   */
  asRole: (role: LoggedInRole) => Promise<Page>;
}

export const test = base.extend<CloudFixtures>({
  // Setzt Consent VOR jedem Seitenaufbau (Init-Script, läuft vor App-JS) -- betrifft auch die
  // "anonyme" page-Fixture (unangemeldeter Zugriff auf /#/live/:shareCode).
  page: async ({ page }, use) => {
    await page.addInitScript((consent) => {
      localStorage.setItem('app:consent', JSON.stringify(consent));
    }, TEST_CONSENT_STATUS);
    await use(page);
  },

  asRole: async ({ browser }, use) => {
    const openContexts: Array<Awaited<ReturnType<typeof browser.newContext>>> = [];

    const asRoleFn = async (role: LoggedInRole): Promise<Page> => {
      const storageState = path.join(AUTH_DIR, `${role}.json`);
      const context = await browser.newContext({ storageState });
      openContexts.push(context);
      return context.newPage();
    };

    await use(asRoleFn);

    await Promise.all(openContexts.map((context) => context.close()));
  },
});

export { expect } from '@playwright/test';
