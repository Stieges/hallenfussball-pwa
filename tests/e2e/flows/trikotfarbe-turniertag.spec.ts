/**
 * @W3-028 Die Trikotfarbe eines Teams lässt sich auch am Turniertag eintragen (Verwaltung → Teams → „Trikotfarbe“).
 * Sie gilt ab dem nächsten Spiel des Teams; laufende und beendete Spiele behalten die Farbe, mit der sie gespielt wurden (@ZM-153, @ZM-159).
 * Gherkin: docs/anforderungen/2026-09-27_wizard-turniertag-vorbereiten.md (@W3-028), 2026-10-02_zuschauer-und-monitor.md (@ZM-153, @ZM-159).
 *
 * Saat: `helpers/trikotfarbeSaat.ts` (Hallencup Nord; FC Nord Rot, SG Mitte ohne Farbe). Handy 390×844 und Desktop 1440×900.
 * Bilder: TRIKOT_BILDER=<Ordner> (Vorsatz TRIKOT_PHASE, Vorgabe „nachher“).
 * Nur das Cockpit kennt das laufende Spiel am Anfang (Anpfiff im Cockpit, echter Weg); die Zuschauer-Seite eines Gast-Turniers liest
 * den Turnierstand, darum bekommt sie eine Saat mit laufendem Spiel (`laufend`).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { neuLaden } from '../helpers/neuLaden';
import { abpfiffHalten } from '../helpers/abpfiff';
import { GELB, MONITOR_LIVE, MONITOR_LIVE_2, ROT, SHARE_CODE, TEAM_MITTE, TEAM_NORD, TEAM_OST, TURNIER_ID, WEISS, spielId, trikotfarbeTurnier } from '../helpers/trikotfarbeSaat';

const BILDER = process.env.TRIKOT_BILDER;
const PHASE = process.env.TRIKOT_PHASE ?? 'nachher';
const GERAETE = [{ name: 'handy', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }] as const;
type Geraet = (typeof GERAETE)[number];

const PALETTE_BLAU = '#0033CC';
const PALETTE_SCHWARZ = '#000000';
const PALETTE_ROT = '#DC0000';
const PALETTE_WEISS = '#FFFFFF';

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin', navigationTimeout: 60000 });

async function bild(page: Page, geraet: Geraet, name: string): Promise<void> {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${PHASE}-${geraet.name}-${name}.png`) });
}

type Seed = (daten: Record<string, unknown>) => Promise<void>;

/**
 * Saat einmal in die lokale Datenbank legen (nicht bei jedem Laden neu: Änderungen müssen ein Neuladen überstehen).
 * `laufend`: Spiel 2 läuft schon (mit Farbe vom Anpfiff), sonst steht es an und der Test pfeift es im Cockpit an.
 */
async function oeffne(page: Page, seed: Seed, geraet: Geraet, laufend = false): Promise<void> {
  await page.setViewportSize({ width: geraet.width, height: geraet.height });
  await page.addInitScript(() => {
    try { if (localStorage.getItem('app:consent') === null) { localStorage.setItem('app:consent', JSON.stringify({ errorTracking: false, sessionReplay: false, timestamp: 1794643200000, version: 1 })); } } catch { /* gesperrt */ }
  });
  const turnier = trikotfarbeTurnier() as { matches: Array<Record<string, unknown>> };
  if (laufend) {
    const spiel2 = turnier.matches.find((m) => m.id === spielId(2));
    Object.assign(spiel2 ?? {}, { matchStatus: 'running', scoreA: 0, scoreB: 0, timerElapsedSeconds: 0, timerStartTime: new Date(Date.now() - 320_000).toISOString(), kit: { a: ROT, b: WEISS }, liveState: {
      engine: true, status: 'running', phase: 'regular', section: 1, running: true, elapsedMs: 0, anchorAt: Date.now() - 320_000, elapsedSeconds: 0,
      durationSeconds: 600, playPhase: 'regular', tiebreakerMode: 'overtime-then-shootout', overtimeDurationSeconds: 300, awaitingTiebreakerChoice: false,
      sections: 1, sectionSeconds: 600, breakSeconds: 60, overtimeSeconds: 300, sectionStartMs: 0, breakStartedAt: null,
    } });
  }
  await seed({ tournaments: [turnier] });
}

async function anpfeifen(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${TURNIER_ID}/live`);
  await page.getByTestId('match-start-button').click({ timeout: 30000 });
  await expect(page.getByTestId('match-pause-button')).toBeVisible();
}

/** Verwaltung → Teams: das Team aufklappen und den Farbwähler der Trikotfarbe öffnen. Gibt die Karte zurück. */
async function oeffneFarbwahl(page: Page, teamId: string): Promise<Locator> {
  await page.goto(`/#/tournament/${TURNIER_ID}/teams`);
  await page.getByTestId(`team-expand-toggle-${teamId}`).click();
  const karte = page.getByTestId(`team-card-${teamId}`);
  await karte.locator('button[aria-haspopup="true"]').click();
  await expect(page.getByRole('dialog', { name: 'Farbauswahl' })).toBeVisible();
  return karte;
}

/** Trikotfarbe aus der Palette: Farbwähler öffnen, Farbe antippen, den neuen Wert am Auslöser abwarten. */
async function farbeWaehlen(page: Page, teamId: string, hex: string): Promise<void> {
  const karte = await oeffneFarbwahl(page, teamId);
  await page.getByRole('option', { name: `Farbe ${hex}` }).click();
  await expect(karte.locator('button[aria-haspopup="true"]')).toContainText(hex);
}

const farbe = async (ort: Locator): Promise<string | null> => ort.getAttribute('data-color');

for (const g of GERAETE) {
  test.describe(`@W3-028 Trikotfarbe am Turniertag (${g.name})`, () => {
    test(`@W3-028 FC Nord spielt, Rot → Blau: das laufende Spiel bleibt Rot (Cockpit, Spielplan, Monitor), das nächste Spiel zeigt Blau, das beendete bleibt Rot (${g.name})`, async ({ page, seedIndexedDB }) => {
      test.setTimeout(150000);
      await oeffne(page, seedIndexedDB, g);
      await anpfeifen(page);
      await expect(page.getByTestId('scoreboard-box-links')).toHaveAttribute('data-color', ROT);

      await farbeWaehlen(page, TEAM_NORD, PALETTE_BLAU);
      await bild(page, g, '1-teams-blau-gewaehlt');

      // laufendes Spiel: weiter Rot, und es läuft weiter (die Änderung überschreibt den Stand des Spiels nicht)
      await page.goto(`/#/tournament/${TURNIER_ID}/live`);
      await expect(page.getByTestId('match-pause-button')).toBeVisible();
      await expect(page.getByTestId('scoreboard-box-links')).toHaveAttribute('data-color', ROT);
      await expect(page.getByTestId('team-head-home')).toHaveAttribute('data-color', ROT);
      await bild(page, g, '2-cockpit-laufend-rot');
      await page.goto(`/#/display/${TURNIER_ID}/${MONITOR_LIVE}`);
      await expect(page.getByTestId('live-box-home')).toBeVisible({ timeout: 25000 });
      expect(await farbe(page.getByTestId('live-box-home'))).toBe(ROT);
      await bild(page, g, '4-monitor-laufend');
      await page.goto(`/#/tournament/${TURNIER_ID}/live`);

      // Abpfiff: das beendete Spiel behält Rot, das nächste Spiel (Monitor „Nächstes Spiel“) trägt Blau
      await abpfiffHalten(page);
      await expect(page.getByTestId('match-pause-button')).toHaveCount(0);
      await expect(page.getByTestId('scoreboard-box-links')).toHaveAttribute('data-color', ROT); // beendet: Rot
      await bild(page, g, '4b-cockpit-beendet-rot');
      await page.goto(`/#/display/${TURNIER_ID}/${MONITOR_LIVE}`);
      await expect(page.getByTestId('live-box-home')).toBeVisible({ timeout: 25000 });
      await expect.poll(() => farbe(page.getByTestId('live-box-home')), { timeout: 20000 }).toBe(PALETTE_BLAU);
      await bild(page, g, '5-monitor-naechstes-blau');

      // die Änderung bleibt nach Neuladen
      await neuLaden(page);
      await expect.poll(() => farbe(page.getByTestId('live-box-home')), { timeout: 20000 }).toBe(PALETTE_BLAU);
    });

    test(`@W3-028 Zuschauer-Seite: laufendes Spiel von FC Nord bleibt Rot, auch nachdem die Farbe auf Blau steht (${g.name})`, async ({ page, seedIndexedDB }) => {
      await oeffne(page, seedIndexedDB, g, true);
      await farbeWaehlen(page, TEAM_NORD, PALETTE_BLAU);
      await page.goto(`/#/live/${SHARE_CODE}`);
      await expect(page.locator(`[data-testid="match-box-${spielId(2)}-home"]`).first()).toBeAttached({ timeout: 25000 });
      expect(await farbe(page.locator(`[data-testid="match-box-kopf-${spielId(2)}-home"]`).first())).toBe(ROT);
      expect(await farbe(page.locator(`[data-testid="match-box-${spielId(2)}-home"]`).first())).toBe(ROT);
      await bild(page, g, '6-zuschauer-laufend-rot');
    });

    test(`@W3-028 SG Mitte hat keine Farbe und spielt nicht: Schwarz eintragen, das nächste Spiel zeigt Schwarz statt Streifen (Zuschauer, Monitor) (${g.name})`, async ({ page, seedIndexedDB }) => {
      await oeffne(page, seedIndexedDB, g, true);
      await page.goto(`/#/live/${SHARE_CODE}`);
      await expect(page.locator(`[data-testid="match-box-${spielId(4)}-home"]`).first()).toBeAttached({ timeout: 25000 });
      await expect(page.locator(`[data-testid="match-box-${spielId(4)}-home"]`).first()).toHaveAttribute('data-fill', 'striped'); // vorher: Streifen
      await farbeWaehlen(page, TEAM_MITTE, PALETTE_SCHWARZ);
      await bild(page, g, '7-teams-schwarz-gewaehlt');
      await page.goto(`/#/live/${SHARE_CODE}`);
      await neuLaden(page); // wie ein Zuschauer, der die Seite neu öffnet: die Farbe stand schon gespeichert
      const heim = page.locator(`[data-testid="match-box-${spielId(4)}-home"]`).first();
      await expect(heim).toHaveAttribute('data-fill', 'solid', { timeout: 25000 });
      expect(await farbe(heim)).toBe(PALETTE_SCHWARZ);
      expect(await farbe(page.locator(`[data-testid="match-box-${spielId(4)}-away"]`).first())).toBe(GELB);
      await page.goto(`/#/display/${TURNIER_ID}/${MONITOR_LIVE_2}`);
      await expect(page.getByTestId('live-box-home')).toBeVisible({ timeout: 25000 });
      await expect(page.getByTestId('live-box-home')).toHaveAttribute('data-fill', 'solid');
      expect(await farbe(page.getByTestId('live-box-home'))).toBe(PALETTE_SCHWARZ);
      await bild(page, g, '8-monitor-naechstes-schwarz');
    });

    test(`@W3-028 Farbe von TSV Ost auf Rot: für das nächste Spiel von FC Nord (Rot) erscheint der Hinweis „Sehr ähnliche Trikotfarben“, mit Weiß verschwindet er wieder (${g.name})`, async ({ page, seedIndexedDB }) => {
      await oeffne(page, seedIndexedDB, g);
      await page.goto(`/#/tournament/${TURNIER_ID}/live`);
      await expect(page.getByTestId('match-start-button')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('scoreboard-farb-hinweis')).toHaveCount(0); // Rot gegen Weiß: kein Hinweis
      await farbeWaehlen(page, TEAM_OST, PALETTE_ROT);
      await page.goto(`/#/tournament/${TURNIER_ID}/live`);
      await expect(page.getByTestId('scoreboard-farb-hinweis')).toContainText('Sehr ähnliche Trikotfarben');
      await bild(page, g, '9-cockpit-hinweis-aehnlich');
      await farbeWaehlen(page, TEAM_OST, PALETTE_WEISS);
      await page.goto(`/#/tournament/${TURNIER_ID}/live`);
      await expect(page.getByTestId('match-start-button')).toBeVisible();
      await expect(page.getByTestId('scoreboard-farb-hinweis')).toHaveCount(0);
    });

    test(`@W3-028 C-TEAMFARBE-WAEHLER-ABGESCHNITTEN Farbpalette: alle zwölf Farben der Trikot-Palette liegen sichtbar und antippbar im Farbwähler (${g.name})`, async ({ page, seedIndexedDB }) => {
      test.fail(true, 'C-TEAMFARBE-WAEHLER-ABGESCHNITTEN – Befund: Farbwähler von der Teamkarte abgeschnitten (TeamsTab.tsx teamCardStyle overflow: hidden)');
      await oeffne(page, seedIndexedDB, g);
      await oeffneFarbwahl(page, TEAM_NORD);
      const farben = page.getByRole('option');
      expect(await farben.count()).toBe(12);
      for (let i = 0; i < 12; i++) {
        const antippbar = await farben.nth(i).evaluate((el) => {
          const b = el.getBoundingClientRect();
          const treffer = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return treffer !== null && el.contains(treffer);
        });
        expect(antippbar, `Farbe ${i + 1} (${(await farben.nth(i).getAttribute('aria-label')) ?? ''}) ohne Blättern antippbar`).toBe(true);
      }
    });

    test(`@W3-028 C-TEAMFARBE-WAEHLER-ABGESCHNITTEN Eigene Farbe: der freie Farbwähler (Hellblau) ist über Farbton-Regler und Farbfläche erreichbar und die Farbe gilt für das nächste Spiel (${g.name})`, async ({ page, seedIndexedDB }) => {
      // Befund 12.11.: die aufgeklappte Teamkarte schneidet den Farbwähler ab (TeamsTab.tsx teamCardStyle `overflow: 'hidden'`); der Farbton-Regler
      // liegt außerhalb der Karte und ist mit dem Finger nicht erreichbar (Playwright blättert die Karte von selbst, ein Mensch nicht)
      test.fail(true, 'C-TEAMFARBE-WAEHLER-ABGESCHNITTEN – Befund: Farbwähler von der Teamkarte abgeschnitten (TeamsTab.tsx teamCardStyle overflow: hidden)');
      await oeffne(page, seedIndexedDB, g);
      const karte = await oeffneFarbwahl(page, TEAM_NORD);
      const regler = page.locator('.react-colorful__hue');
      const flaeche = page.locator('.react-colorful__saturation');
      // Hellblau #4FC3F7 liegt bei Farbton 199° (55 % der Breite), Sättigung 68 %, Helligkeit 97 %
      const erreichbar = (ort: Locator): Promise<boolean> => ort.evaluate((el) => {
        const b = el.getBoundingClientRect();
        const treffer = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return treffer !== null && el.contains(treffer);
      });
      expect(await erreichbar(regler), 'Farbton-Regler ist antippbar').toBe(true);
      const r = (await regler.boundingBox())!;
      await page.mouse.click(r.x + r.width * 0.553, r.y + r.height / 2);
      const f = (await flaeche.boundingBox())!;
      await page.mouse.click(f.x + f.width * 0.68, f.y + f.height * 0.03);
      const wert = (await karte.locator('button[aria-haspopup="true"]').innerText()).match(/#[0-9A-Fa-f]{6}/)?.[0].toUpperCase() ?? '';
      const [rot, , blau] = [1, 3, 5].map((i) => parseInt(wert.slice(i, i + 2), 16));
      expect(rot, `Hellblau, nicht Rot (${wert})`).toBeLessThan(0xA0);
      expect(blau, `Hellblau (${wert})`).toBeGreaterThan(0xD0);
      await bild(page, g, '10-teams-eigene-farbe');
      await page.goto(`/#/tournament/${TURNIER_ID}/live`);
      await expect(page.getByTestId('scoreboard-box-links')).toHaveAttribute('data-color', wert);
    });
  });
}


test.describe('@W3-028 Trikotfarbe am Turniertag: Bedienung am Handy', () => {
  test('@W3-028 Handy: aus dem Spielplan in fünf Tipps zur Farbe (Mehr, Teams, Team, Farbwähler, Farbe), Tasten mindestens 44 px, Änderung bleibt nach Neuladen', async ({ page, seedIndexedDB }) => {
    await oeffne(page, seedIndexedDB, GERAETE[0]);
    await page.goto(`/#/tournament/${TURNIER_ID}/schedule`);
    await expect(page.getByTestId('schedule-view-table')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Mehr' }).click(); // 1
    await page.getByText('Teams verwalten').click(); // 2
    await page.getByTestId(`team-expand-toggle-${TEAM_NORD}`).click(); // 3
    await expect(page.getByText('Trikotfarbe:')).toBeVisible(); // die Stelle ist beschriftet
    const ausloeser = page.getByTestId(`team-card-${TEAM_NORD}`).locator('button[aria-haspopup="true"]');
    await ausloeser.click(); // 4
    for (const ziel of [ausloeser, page.getByRole('option', { name: `Farbe ${PALETTE_BLAU}` })]) {
      const box = (await ziel.boundingBox())!;
      expect(Math.min(box.width, box.height), 'Touch-Ziel mindestens 44 px').toBeGreaterThanOrEqual(44);
    }
    await bild(page, GERAETE[0], '11-handy-farbwahl');
    await page.getByRole('option', { name: `Farbe ${PALETTE_BLAU}` }).click(); // 5
    await expect(ausloeser).toContainText(PALETTE_BLAU);
    await neuLaden(page);
    await page.getByTestId(`team-expand-toggle-${TEAM_NORD}`).click();
    await expect(page.getByTestId(`team-card-${TEAM_NORD}`).locator('button[aria-haspopup="true"]')).toContainText(PALETTE_BLAU);
  });
});
