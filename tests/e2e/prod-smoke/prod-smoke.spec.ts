/**
 * Rauchtest nach dem Deploy gegen die PRODUKTION (Paket „Testwelle 1 vorbereiten“).
 *
 * Läuft nur mit Testkonto (PROD_SMOKE_EMAIL / PROD_SMOKE_PASSWORD) und legt EIN eigenes, eindeutig benanntes
 * Wegwerf-Turnier an („ZZ-Rauchtest-<Zeit>“). Es fasst kein anderes Turnier an. Ohne Zugangsdaten wird der Test
 * mit klarer Meldung übersprungen (der Workflow prüft das schon vorher).
 *
 * Ablauf: Seite lädt (optional: in der erwarteten Version) -> Anmelden -> Turnier anlegen und festlegen -> Spiel anpfeifen,
 * Tor, abpfeifen -> Zuschauer-Link (frischer Kontext, ohne Anmeldung) zeigt den Stand -> Aufräumen (immer, auch bei Fehlschlag).
 *
 * Aufräumen: „Turnier löschen“ ist ein Weich-Löschen (deletedAt) und nach dem ersten Anpfiff gar nicht mehr angeboten (@LZ-003).
 * Das Wegwerf-Turnier bleibt deshalb als Zeile stehen; entfernt wird es mit scripts/prod-smoke-cleanup.sql (siehe docs/PROD-RAUCHTEST.md).
 * Der Test schreibt die Turnier-Kennung immer in die Ausgabe, damit nichts unbemerkt liegen bleibt.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { t } from '../helpers/i18n';
import { tippeTor } from '../helpers/cockpitNeu';
import { abpfiffHalten } from '../helpers/abpfiff';

const EMAIL = process.env.PROD_SMOKE_EMAIL ?? '';
const PASSWORD = process.env.PROD_SMOKE_PASSWORD ?? '';
const EXPECTED_SHA = (process.env.PROD_SMOKE_EXPECTED_SHA ?? '').slice(0, 8);

const CONSENT = { errorTracking: false, sessionReplay: false, timestamp: Date.now(), version: 1 };
const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

async function setzeEinwilligung(context: BrowserContext): Promise<void> {
  await context.addInitScript((consent) => {
    window.localStorage.setItem('app:consent', JSON.stringify(consent));
  }, CONSENT);
}

/** Eines der Bündel, die index.html einbindet oder vorlädt, trägt die Version (Sentry-Release `hallenfussball-pwa@<8 Zeichen>`). */
async function ausgelieferteVersion(page: Page): Promise<string | null> {
  const html = await (await page.request.get('/')).text();
  const skripte = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  for (const pfad of skripte) {
    const js = await (await page.request.get(pfad)).text();
    const treffer = /hallenfussball-pwa@([0-9a-f]{8})/.exec(js);
    if (treffer) { return treffer[1]; }
  }
  return null;
}

async function anmelden(page: Page): Promise<void> {
  await page.goto('/#/');
  await page.waitForLoadState('networkidle');
  const email = page.locator('[data-testid="login-email-input"]');
  if (!(await email.isVisible({ timeout: 1000 }).catch(() => false))) {
    const handy = page.locator('[data-testid="auth-mobile-button"]');
    if (await handy.isVisible({ timeout: 2000 }).catch(() => false)) {
      await handy.click({ force: true });
      await page.locator('[data-testid="bottomsheet-login"]').click();
    } else {
      await page.locator('[data-testid="auth-login-button"]').click({ force: true });
    }
  }
  await expect(email).toBeVisible({ timeout: 10_000 });
  await email.fill(EMAIL);
  await page.locator('[data-testid="login-password-input"]').fill(PASSWORD);
  await page.locator('[data-testid="login-submit-button"]').click();
  await expect(page.locator('[data-testid="auth-avatar-button"]')).toBeVisible({ timeout: 30_000 });
}

async function turnierAnlegen(page: Page, titel: string): Promise<string> {
  await page.goto('/#/tournament/new');
  await page.waitForLoadState('networkidle');
  await page.locator(`input[placeholder*="${t('wizard:step3.tournamentNamePlaceholder')}"]`).first().fill(titel);
  const halle = page.locator('input[placeholder*="Sporthalle"]');
  if (await halle.count() > 0) { await halle.first().fill('Rauchtest-Halle'); }
  await page.locator('input[type="date"]').first().fill(FUTURE_DATE);
  await page.locator('input[type="time"]').first().fill('09:00');
  const weiter = page.getByRole('button', { name: 'Weiter', exact: true });
  await expect(weiter).toBeEnabled({ timeout: 5000 });
  await weiter.click();
  await expect(page).toHaveURL(/\/tournament\/new\?step=2/, { timeout: 10_000 });
  await page.locator('[data-testid="wizard-type-classic"]').click();
  await weiter.click();
  await expect(page).toHaveURL(/\/tournament\/new\?step=3/, { timeout: 10_000 });
  await weiter.click();
  await expect(page).toHaveURL(/\/tournament\/new\?step=4/, { timeout: 10_000 });
  await weiter.click();
  await expect(page).toHaveURL(/\/tournament\/new\?step=5/, { timeout: 10_000 });
  const erzeugen = page.locator('[data-testid="wizard-generate-teams"]');
  if (await erzeugen.count() > 0 && await erzeugen.isVisible()) {
    await erzeugen.click();
  } else {
    for (let i = 1; i <= 4; i++) {
      await page.locator('[data-testid="wizard-add-team"]').click();
      await page.locator(`input[placeholder="${t('wizard:step4.teamNamePlaceholder')}"]`).last().fill(`Team ${i}`);
    }
  }
  await weiter.click();
  await expect(page).toHaveURL(/\/tournament\/new\?step=6/, { timeout: 10_000 });
  await page.locator('[data-testid="wizard-show-preview"]').click();
  await expect(page.getByTestId('publish-explanation')).toContainText(t('wizard:publish.explanationPublic'), { timeout: 20_000 });
  await page.locator('[data-testid="preview-publish"]').click();
  await expect(page).not.toHaveURL(/\/tournament\/new/, { timeout: 45_000 });
  const treffer = /\/tournament\/([0-9a-f-]{36})/.exec(page.url());
  if (!treffer) { throw new Error(`Turnier-Kennung nicht in der Adresse: ${page.url()}`); }
  return treffer[1];
}

/** Löscht (weich), solange das Turnier noch nicht angepfiffen ist. Danach bietet die App es nicht mehr an (@LZ-003). */
async function loeschenWennMoeglich(page: Page, id: string): Promise<boolean> {
  await page.goto(`/#/tournament/${id}/admin/danger-zone`);
  await page.waitForLoadState('networkidle');
  const knopf = page.locator('[data-testid="danger-zone-delete"]');
  if (!(await knopf.isVisible({ timeout: 10_000 }).catch(() => false))) { return false; }
  await knopf.click();
  const eingabe = page.getByRole('dialog').locator('input[type="text"]');
  const wort = await eingabe.getAttribute('placeholder');
  if (!wort) { return false; }
  await eingabe.fill(wort);
  await page.getByRole('dialog').getByRole('button').last().click();
  return true;
}

test.describe('Rauchtest Produktion', () => {
  test.skip(EMAIL === '' || PASSWORD === '', 'PROD_SMOKE_EMAIL / PROD_SMOKE_PASSWORD fehlen -- Rauchtest übersprungen.');

  test('Seite, Anmelden, Turnier, Spiel, Zuschauer', async ({ browser, baseURL }) => {
    const titel = `ZZ-Rauchtest-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`;
    const context = await browser.newContext();
    await setzeEinwilligung(context);
    const page = await context.newPage();
    let turnierId: string | null = null;

    try {
      await test.step('Seite lädt in der erwarteten Version', async () => {
        const antwort = await page.goto('/#/');
        expect(antwort?.ok()).toBe(true);
        await expect(page.locator('#root')).not.toBeEmpty({ timeout: 30_000 });
        // Direkt nach dem Deploy kann der Produktions-Alias einen Moment brauchen: mit erwarteter Version bis zu 2 Minuten warten.
        let version = await ausgelieferteVersion(page);
        if (EXPECTED_SHA !== '') {
          await expect.poll(async () => { version = await ausgelieferteVersion(page); return version; }, {
            message: 'ausgelieferte Version = erwartete Version', timeout: 120_000, intervals: [5000, 10_000],
          }).toBe(EXPECTED_SHA);
        }
        console.log(`[Rauchtest] ${baseURL ?? ''} liefert Version ${version ?? 'unbekannt'}`);
        expect(version, 'Version im ausgelieferten Bündel gefunden').not.toBeNull();
      });

      await test.step('Anmelden mit dem Testkonto', async () => { await anmelden(page); });

      await test.step('Wegwerf-Turnier anlegen und festlegen', async () => {
        turnierId = await turnierAnlegen(page, titel);
        console.log(`[Rauchtest] Wegwerf-Turnier ${titel} (${turnierId})`);
      });

      let zuschauerCode = '';
      await test.step('Zuschauer-Link lesen (Verwaltung, Sichtbarkeit)', async () => {
        await page.goto(`/#/tournament/${turnierId ?? ''}/admin/visibility`);
        await page.getByRole('button', { name: /Turnier-Sichtbarkeit/ }).click();
        const feld = page.locator('input[readonly]').first();
        await expect(feld).toHaveValue(/\/live\/[A-Za-z0-9]+/, { timeout: 20_000 });
        zuschauerCode = /\/live\/([A-Za-z0-9]+)/.exec(await feld.inputValue())?.[1] ?? '';
        expect(zuschauerCode).not.toBe('');
      });

      await test.step('Im Cockpit: anpfeifen, Tor, abpfeifen', async () => {
        await page.goto(`/#/tournament/${turnierId ?? ''}/live`);
        await page.getByTestId('match-start-button').click({ timeout: 30_000 });
        await expect(page.getByTestId('match-pause-button')).toBeVisible({ timeout: 20_000 });
        await tippeTor(page, 'home');
        await abpfiffHalten(page);
        await expect(page.getByTestId('match-start-button').or(page.getByTestId('scoreboard-state')).first()).toBeVisible({ timeout: 20_000 });
      });

      await test.step('Zuschauer-Link (ohne Anmeldung) zeigt das Turnier und den Stand', async () => {
        const zuschauer = await browser.newContext();
        await setzeEinwilligung(zuschauer);
        try {
          const seite = await zuschauer.newPage();
          await seite.goto(`/#/live/${zuschauerCode}`);
          await expect(seite.getByText(titel).first()).toBeVisible({ timeout: 30_000 });
          await expect(seite.getByText(/1\s*[:\-–]\s*0/).first()).toBeVisible({ timeout: 30_000 });
        } finally {
          await zuschauer.close();
        }
      });
    } finally {
      if (turnierId !== null) {
        const id = turnierId;
        try {
          const geloescht = await loeschenWennMoeglich(page, id);
          console.log(geloescht
            ? `[Rauchtest] AUFGERAEUMT: ${titel} (${id}) weich gelöscht.`
            : `[Rauchtest] RESTBESTAND: ${titel} (${id}) ist angepfiffen und kann in der App nicht gelöscht werden -- scripts/prod-smoke-cleanup.sql entfernt ihn.`);
        } catch (fehler) {
          console.error(`[Rauchtest] RESTBESTAND: Aufräumen fehlgeschlagen für ${titel} (${id}):`, fehler);
        }
      }
      await context.close();
    }
  });
});
