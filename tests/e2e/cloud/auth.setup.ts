/**
 * tests/e2e/cloud/auth.setup.ts — Setup-Projekt `cloud-setup` (Task T3, Brief Abschnitt 2).
 *
 * Meldet jede Rolle mit echtem Konto aus `testData.ts` ÜBER DIE OBERFLÄCHE an
 * (`login-email-input`/`login-password-input`/`login-submit-button`, siehe
 * `tests/e2e/cloud/helpers.ts#loginAsRole`) und speichert den storageState nach
 * `playwright/.auth/<rolle>.json` (gitignored, siehe .gitignore).
 *
 * ABWEICHUNG vom Brief-Wortlaut (Abschnitt 2 nennt "owner, coadmin, helper, trainer, viewer,
 * revoked, invitee, stranger", 8 Namen): `invitee` (`E2E_INVITEE_EMAIL`) hat laut `testData.ts`/
 * `scripts/e2e-seed.ts` BEWUSST kein eigenes Konto — nur eine `invite_email`-Zieladresse für eine
 * offene Einladung ohne Login (T2-Architekturentscheidung, testet den "noch kein Konto"-Fall).
 * Eine UI-Anmeldung ist für diese Adresse strukturell nicht möglich. `google` hat ebenfalls
 * bewusst kein Passwort (reiner OAuth-Provider-Marker für den "Passwort vergessen"-Hinweis) und
 * scheidet aus demselben Grund aus. Von den 8 im Brief genannten Namen haben genau 7 ein
 * Passwort-Konto: owner, coadmin, helper, trainer, viewer, revoked, stranger — genau diese
 * meldet dieses Setup an. Nachweis 4 verlangt "8 storageStates"; mit den Testdaten aus T2 sind
 * strukturell nur 7 per UI erreichbar. Siehe Report, Abschnitt "Bedenken" — nicht eigenmächtig
 * "gefixt" (z. B. durch Erfinden eines Passworts für `google`), sondern hier dokumentiert.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as setup } from './fixtures';
import { loginAsRole } from './helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '..', '..', '..', 'playwright', '.auth');

/** Alle Rollen aus `E2E_USERS`, die ein Passwort-Konto haben (siehe Kommentar oben). */
const PASSWORD_ROLES = ['owner', 'coadmin', 'helper', 'trainer', 'viewer', 'revoked', 'stranger'] as const;

for (const role of PASSWORD_ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    await loginAsRole(page, role);
    await page.context().storageState({ path: path.join(AUTH_DIR, `${role}.json`) });
  });
}
