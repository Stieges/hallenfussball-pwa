/**
 * E2E @RT-009: Die ausgelieferte Sicherheitsrichtlinie sperrt keinen Ton der App.
 * Weder der Entwicklungsserver noch `vite preview` liefern die Kopfzeilen aus `vercel.json` aus. Der Test hängt deshalb die
 * Content-Security-Policy AUS `vercel.json` per `page.route` an jede Dokument-Antwort. Das geht nur gegen den gebauten Stand
 * (CI: Vorschau-Server): der Entwicklungsserver braucht Inline-Skripte, die `script-src 'self'` sperrt.
 * Szenario: Cockpit öffnen und einmal bedienen -> keine gesperrte Tonquelle gemeldet, „Ton aus – antippen“ nicht zu sehen.
 * Dasselbe für den Assistenten (Schritt „Modus“, Bereich Cockpit, „Anhören“): derselbe Ton-Hook `useMatchSound`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { t } from '../helpers/i18n';
import { cup, ID } from '../helpers/laptopCup';

interface HeaderBlock { source: string; headers: Array<{ key: string; value: string }> }

function richtlinieAusVercelJson(): string {
  const roh = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as { headers: HeaderBlock[] };
  const wert = roh.headers.find((b) => b.source === '/(.*)')?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
  if (!wert) { throw new Error('Content-Security-Policy fehlt in vercel.json'); }
  return wert;
}

interface Verletzung { directive: string; blocked: string }
interface Mitschnitt { konsole: string[]; verletzungen: () => Promise<Verletzung[]> }

/** Setzt die Richtlinie auf jedes Dokument und sammelt Konsole und `securitypolicyviolation`-Ereignisse. */
async function richtlinieAnhaengen(page: Page): Promise<Mitschnitt> {
  const csp = richtlinieAusVercelJson();
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') { await route.continue(); return; }
    const antwort = await route.fetch();
    await route.fulfill({ response: antwort, headers: { ...antwort.headers(), 'content-security-policy': csp } });
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: Array<{ directive: string; blocked: string }> };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => { w.__csp.push({ directive: e.effectiveDirective, blocked: e.blockedURI }); });
  });
  const konsole: string[] = [];
  page.on('console', (m) => { konsole.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => { konsole.push(`pageerror: ${e.message}`); });
  return { konsole, verletzungen: () => page.evaluate(() => (window as unknown as { __csp?: Verletzung[] }).__csp ?? []) };
}

/** Nur Ton: Richtlinien-Verletzungen der Medien (media-src, oder default-src bei data:audio / blob:). */
const istTonVerletzung = (v: Verletzung): boolean => v.directive === 'media-src' || (v.directive === 'default-src' && /^(data:audio|blob:)/.test(v.blocked));

function pruefeKeinGesperrterTon(m: Mitschnitt, verletzungen: Verletzung[]): void {
  const ton = verletzungen.filter(istTonVerletzung);
  expect.soft(ton, `gesperrte Tonquelle laut Browser: ${JSON.stringify(ton)}`).toEqual([]);
  const meldungen = m.konsole.filter((z) => /violates.*Content Security Policy/i.test(z) && /media|audio/i.test(z));
  expect.soft(meldungen, 'Konsole meldet eine von der Richtlinie gesperrte Tonquelle').toEqual([]);
  expect.soft(m.konsole.filter((z) => z.includes('[useMatchSound] Audio activation failed'))).toEqual([]);
}

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'desktop', 'ein Projekt genügt: die Richtlinie ist vom Gerät unabhängig');
});

test.describe('@RT-009 Die ausgelieferte Sicherheitsrichtlinie sperrt keinen Ton der App', () => {
  test('@RT-009 Cockpit: Anpfiff und ein Tor, keine gesperrte Tonquelle, „Ton aus – antippen“ nicht zu sehen', async ({ page, seedIndexedDB }) => {
    const m = await richtlinieAnhaengen(page);
    await seedIndexedDB({ tournaments: [cup()] });
    await page.goto(`/#/tournament/${ID}/live`);
    await page.getByTestId('match-start-button').click({ timeout: 15000 });
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await page.getByTestId('goal-button-home').click();
    await expect(page.getByTestId('scoreboard-box-links')).toHaveText('1');
    // Der Hinweis steht im angepfiffenen Spiel, solange der Ton nicht freigegeben ist (Anzeigetafel-Abzeichen)
    await expect.soft(page.getByText(t('cockpit:tafel.tonAusAntippen'))).toHaveCount(0);
    await expect.soft(page.getByText(t('cockpit:tafel.tonAus'), { exact: true })).toHaveCount(0);
    await expect.soft(page.getByLabel(t('cockpit:tafel.tonAusAntippen'))).toHaveCount(0);
    pruefeKeinGesperrterTon(m, await m.verletzungen());
  });

  test('@RT-009 Assistent, Schritt „Modus“, Bereich Cockpit: „Anhören“ ohne gesperrte Tonquelle und ohne Fehlermeldung', async ({ page }) => {
    const m = await richtlinieAnhaengen(page);
    await page.goto('/#/tournament/new?step=3');
    await page.getByRole('button', { name: /Cockpit/i }).first().click();
    const anhoeren = page.getByRole('button', { name: 'Anhören' });
    await expect(anhoeren).toHaveCount(1);
    await anhoeren.first().click();
    await expect.soft(page.getByText(/Sound konnte nicht/)).toHaveCount(0);
    expect.soft(m.konsole.filter((z) => z.includes('[useMatchSound]'))).toEqual([]);
    pruefeKeinGesperrterTon(m, await m.verletzungen());
  });
});
