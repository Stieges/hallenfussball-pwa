/**
 * Rauchtest nach dem Deploy gegen die PRODUKTION (Anforderung plattform/2026-10-25_rauchtest-nach-deploy.md).
 *
 * Zwei Modi (PROD_SMOKE_MODE):
 *  - "kurz" (Vorgabe, bei jedem Deploy, @RT-001/@RT-002): NUR LESEN. Version, Anmelden, das dauerhafte Turnier
 *    "ZZ-Rauchtest-Dauer" des Testkontos im Cockpit öffnen (ohne Anpfiff), Zuschauer-Link ohne Anmeldung.
 *  - "voll" (täglich und von Hand, @RT-003): legt EIN Wegwerf-Turnier "ZZ-Rauchtest-<Zeit>" an, festlegen, anpfeifen, Tor,
 *    abpfeifen, Zuschauer-Link zeigt exakt "1:0". Hinterlässt eine Zeile (Aufräumen: scripts/prod-smoke-cleanup.sql).
 * Ohne Zugangsdaten wird übersprungen (@RT-005). Fristriegel (@RT-007) und Adress-Erlaubnisliste (@RT-008) stehen in
 * playwright.prod-smoke.config.ts / scripts/lib/prodSmokeGuards.ts; keine Spur/kein Video (@RT-006) ebenda.
 *
 * Aufräumen im Volllauf: „Turnier löschen“ ist ein Weich-Löschen und nach dem ersten Anpfiff gar nicht mehr angeboten (@LZ-003).
 * Die Turnier-Kennung steht immer in der Ausgabe (auch bei Fehlschlag).
 */
import { test, expect, type Browser, type Page, type BrowserContext } from '@playwright/test';
import { t } from '../helpers/i18n';
import { tippeTor } from '../helpers/cockpitNeu';
import { abpfiffHalten } from '../helpers/abpfiff';

const EMAIL = process.env.PROD_SMOKE_EMAIL ?? '';
const PASSWORD = process.env.PROD_SMOKE_PASSWORD ?? '';
const MODE = process.env.PROD_SMOKE_MODE === 'voll' ? 'voll' : 'kurz';
const DAUER_TITEL = 'ZZ-Rauchtest-Dauer';
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

async function pruefeVersion(page: Page, baseURL: string | undefined): Promise<void> {
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
}

/** Liest den Zuschauer-Code aus Verwaltung, Sichtbarkeit. */
async function leseZuschauerCode(page: Page, turnierId: string): Promise<string> {
  await page.goto(`/#/tournament/${turnierId}/admin/visibility`);
  await page.getByRole('button', { name: /Turnier-Sichtbarkeit/ }).click();
  const feld = page.locator('input[readonly]').first();
  await expect(feld).toHaveValue(/\/live\/[A-Za-z0-9]+/, { timeout: 20_000 });
  const code = /\/live\/([A-Za-z0-9]+)/.exec(await feld.inputValue())?.[1] ?? '';
  expect(code).not.toBe('');
  return code;
}

/** Zuschauer ohne Anmeldung (frischer Kontext): zeigt das Turnier; optional genau das Ergebnis eines beendeten Spiels. */
async function pruefeZuschauer(browser: Browser, code: string, titel: string, ergebnis?: string): Promise<void> {
  const zuschauer = await browser.newContext();
  await setzeEinwilligung(zuschauer);
  try {
    const seite = await zuschauer.newPage();
    await seite.goto(`/#/live/${code}`);
    await expect(seite.getByText(titel).first()).toBeVisible({ timeout: 30_000 });
    if (ergebnis !== undefined) {
      // Ergebnis-Knopf der Spielkarte (match-circle-<id>), beendet, genau "1:0" -- keine Uhrzeit kann das treffen.
      const kreis = seite.locator('[data-testid^="match-circle-"][data-match-status="finished"]');
      await expect(kreis.first()).toHaveText(new RegExp(`^\\s*${ergebnis.replace(':', '\\s*:\\s*')}\\s*$`), { timeout: 30_000 });
    }
  } finally {
    await zuschauer.close();
  }
}

/** Findet die Karte des dauerhaften Turniers auf der Startseite und liefert seine Kennung. */
async function findeDauerTurnier(page: Page): Promise<string> {
  await page.goto('/#/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-testid="auth-avatar-button"]')).toBeVisible({ timeout: 30_000 });
  const karte = page.locator('[data-testid^="tournament-card-"]', { hasText: DAUER_TITEL }).first();
  if (!(await karte.isVisible({ timeout: 5000 }).catch(() => false))) {
    // eingeklappte Abschnitte öffnen
    const zu = page.locator('[data-testid^="section-"] [aria-expanded="false"]');
    for (let i = 0; i < await zu.count(); i++) { await zu.nth(i).click().catch(() => undefined); }
  }
  if (!(await karte.isVisible({ timeout: 10_000 }).catch(() => false))) {
    throw new Error(`Das Dauer-Turnier "${DAUER_TITEL}" fehlt im Testkonto. Einmal anlegen und festlegen (Checkliste Daniel, Abschnitt Rauchtest).`);
  }
  const kennung = /^tournament-card-(.+)$/.exec(await karte.getAttribute('data-testid') ?? '')?.[1];
  if (!kennung) { throw new Error('Kennung des Dauer-Turniers nicht lesbar'); }
  return kennung;
}

test.describe('Rauchtest Produktion (@RT-005 ohne Zugangsdaten übersprungen)', () => {
  test.skip(EMAIL === '' || PASSWORD === '', '@RT-005 PROD_SMOKE_EMAIL / PROD_SMOKE_PASSWORD fehlen -- Rauchtest übersprungen.');

  test('@RT-001 @RT-002 Kurzlauf: Version, Anmelden, Dauer-Turnier im Cockpit, Zuschauer-Link (nur lesen)', async ({ browser, baseURL }) => {
    test.skip(MODE !== 'kurz', 'Modus voll');
    const context = await browser.newContext();
    await setzeEinwilligung(context);
    const page = await context.newPage();
    try {
      await test.step('Seite lädt in der erwarteten Version', async () => { await pruefeVersion(page, baseURL); });
      await test.step('Anmelden mit dem Testkonto', async () => { await anmelden(page); });
      const id = await test.step('Dauer-Turnier finden', async () => findeDauerTurnier(page));
      await test.step('Cockpit öffnet ohne Anpfiff', async () => {
        await page.goto(`/#/tournament/${id}/live`);
        await expect(page.getByTestId('scoreboard-state').or(page.getByTestId('match-start-button'))
          .or(page.getByTestId('match-pause-button')).or(page.getByTestId('match-resume-button')).first()).toBeVisible({ timeout: 30_000 });
      });
      await test.step('Zuschauer-Link zeigt das Turnier ohne Anmeldung', async () => {
        await pruefeZuschauer(browser, await leseZuschauerCode(page, id), DAUER_TITEL);
      });
    } finally {
      await context.close();
    }
  });

  test('@RT-003 Volllauf: Wegwerf-Turnier anlegen, anpfeifen, Tor, abpfeifen, Zuschauer-Link', async ({ browser, baseURL }) => {
    test.skip(MODE !== 'voll', 'Modus kurz');
    const titel = `ZZ-Rauchtest-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`;
    const context = await browser.newContext();
    await setzeEinwilligung(context);
    const page = await context.newPage();
    let turnierId: string | null = null;

    try {
      await test.step('Seite lädt in der erwarteten Version', async () => { await pruefeVersion(page, baseURL); });
      await test.step('Anmelden mit dem Testkonto', async () => { await anmelden(page); });

      await test.step('Wegwerf-Turnier anlegen und festlegen', async () => {
        turnierId = await turnierAnlegen(page, titel);
        console.log(`[Rauchtest] Wegwerf-Turnier ${titel} (${turnierId})`);
      });

      const zuschauerCode = await test.step('Zuschauer-Link lesen (Verwaltung, Sichtbarkeit)', async () => leseZuschauerCode(page, turnierId ?? ''));

      await test.step('Im Cockpit: anpfeifen, Tor, abpfeifen', async () => {
        await page.goto(`/#/tournament/${turnierId ?? ''}/live`);
        await page.getByTestId('match-start-button').click({ timeout: 30_000 });
        await expect(page.getByTestId('match-pause-button')).toBeVisible({ timeout: 20_000 });
        await tippeTor(page, 'home');
        await abpfiffHalten(page);
        await expect(page.getByTestId('match-start-button').or(page.getByTestId('scoreboard-state')).first()).toBeVisible({ timeout: 20_000 });
      });

      await test.step('Zuschauer-Link (ohne Anmeldung) zeigt das Turnier und genau 1:0', async () => {
        await pruefeZuschauer(browser, zuschauerCode, titel, '1:0');
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
