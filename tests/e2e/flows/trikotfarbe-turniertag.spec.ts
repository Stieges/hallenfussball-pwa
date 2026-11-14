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
import { MONITOR_LIVE, MONITOR_LIVE_2, ROT, SHARE_CODE, TEAM_MITTE, TEAM_NORD, TEAM_OST, TEAM_UFER, TURNIER_ID, WEISS, spielId, trikotfarbeTurnier } from '../helpers/trikotfarbeSaat';

const BILDER = process.env.TRIKOT_BILDER;
const PHASE = process.env.TRIKOT_PHASE ?? 'nachher';
const GERAETE = [{ name: 'handy', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }] as const;
interface Geraet { name: string; width: number; height: number }

const PALETTE_BLAU = '#0033CC';
const PALETTE_SCHWARZ = '#000000';
const PALETTE_ROT = '#DC0000';
const PALETTE_WEISS = '#FFFFFF';
/** Vorgelesener Name der Palettenfarben (de) */
const NAME: Record<string, string> = { [PALETTE_BLAU]: 'Blau', [PALETTE_SCHWARZ]: 'Schwarz', [PALETTE_ROT]: 'Rot', [PALETTE_WEISS]: 'Weiß' };

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
  await page.getByRole('option', { name: NAME[hex], exact: true }).click();
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

    test(`@W3-028 SG Mitte hat keine Farbe und spielt nicht: Schwarz eintragen, das nächste Spiel zeigt am Monitor Schwarz statt Streifen, die Zuschauer-Seite zeigt vor dem Anpfiff keinen Kasten (@ZM-209) (${g.name})`, async ({ page, seedIndexedDB }) => {
      await oeffne(page, seedIndexedDB, g, true);
      await page.goto(`/#/live/${SHARE_CODE}`);
      await expect(page.locator(`[data-testid="match-goals-${spielId(4)}-home"]`).first()).toHaveText('–', { timeout: 25000 }); // @ZM-209: vor dem Anpfiff kein Kasten
      await expect(page.locator(`[data-testid="match-box-${spielId(4)}-home"]`)).toHaveCount(0);
      await farbeWaehlen(page, TEAM_MITTE, PALETTE_SCHWARZ);
      await bild(page, g, '7-teams-schwarz-gewaehlt');
      await page.goto(`/#/live/${SHARE_CODE}`);
      await neuLaden(page);
      await expect(page.locator(`[data-testid="match-goals-${spielId(4)}-home"]`).first()).toHaveText('–', { timeout: 25000 });
      await expect(page.locator(`[data-testid="match-box-${spielId(4)}-home"]`)).toHaveCount(0);
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
    for (const ziel of [ausloeser, page.getByRole('option', { name: NAME[PALETTE_BLAU], exact: true })]) {
      const box = (await ziel.boundingBox())!;
      expect(Math.min(box.width, box.height), 'Touch-Ziel mindestens 44 px').toBeGreaterThanOrEqual(44);
    }
    await bild(page, GERAETE[0], '11-handy-farbwahl');
    await page.getByRole('option', { name: NAME[PALETTE_BLAU], exact: true }).click(); // 5
    await expect(ausloeser).toContainText(PALETTE_BLAU);
    await neuLaden(page);
    await page.getByTestId(`team-expand-toggle-${TEAM_NORD}`).click();
    await expect(page.getByTestId(`team-card-${TEAM_NORD}`).locator('button[aria-haspopup="true"]')).toContainText(PALETTE_BLAU);
  });
});

/** Ganz im Fenster und nicht verdeckt: Mitte und vier Ecken (3 px innen) treffen das Element selbst (kein Blättern, kein Scrollen). */
async function sichtbarImFenster(ort: Locator): Promise<boolean> {
  return ort.evaluate((el) => {
    const b = el.getBoundingClientRect();
    if (b.left < 0 || b.top < 0 || b.right > window.innerWidth || b.bottom > window.innerHeight) { return false; }
    const punkte: Array<[number, number]> = [[b.left + b.width / 2, b.top + b.height / 2], [b.left + 3, b.top + 3], [b.right - 3, b.top + 3], [b.left + 3, b.bottom - 3], [b.right - 3, b.bottom - 3]];
    return punkte.every(([x, y]) => { const t = document.elementFromPoint(x, y); return t !== null && el.contains(t); });
  });
}

/**
 * Kein Vorfahr des Wählers ist in sich gerollt (`scrollTop > 0` bei `overflow: hidden`; das Rollen der Seite selbst ist erlaubt): sonst hätte nur das Blättern der Karte die Felder
 * ins Fenster geholt und Kopf, Name und Auslöser wären aus der Karte geschoben (der ursprüngliche Fehler, nur versteckt).
 */
async function unverschoben(ort: Locator): Promise<string[]> {
  return ort.evaluate((el) => {
    const treffer: string[] = [];
    for (let a = el.parentElement; a !== null; a = a.parentElement) {
      const o = getComputedStyle(a);
      if (a.scrollTop > 0 && (o.overflowY === 'hidden' || o.overflowY === 'clip')) { treffer.push(`${a.tagName} overflow=${o.overflowY} scrollTop=${String(Math.round(a.scrollTop))}`); }
    }
    return treffer;
  });
}

/** Der Kopf einer Karte liegt nicht über der Oberkante seiner Karte (nicht herausgeschoben). */
async function kopfInKarte(kopf: Locator, karte: Locator): Promise<boolean> {
  const k = (await kopf.boundingBox())!;
  const c = (await karte.boundingBox())!;
  return k.y >= c.y - 1 && k.y + k.height <= c.y + c.height + 1;
}

const PICKER_GERAETE = [
  { name: 'handy390', width: 390, height: 844, dunkel: false }, { name: 'handy360', width: 360, height: 640, dunkel: false },
  { name: 'desktop1440', width: 1440, height: 900, dunkel: false }, { name: 'handy390-dunkel', width: 390, height: 844, dunkel: true },
] as const;

// Der Farbwähler im Reiter Teams liegt ganz im Fenster, auch beim letzten Team der Liste (C-TEAMFARBE-WAEHLER-ABGESCHNITTEN, behoben).
// Die Aufgaben prüfen die Lage jedes Feldes im Fenster, ohne dass der Test die Karte blättert.
for (const a of PICKER_GERAETE) {
  test.describe(`@W3-028 Farbwähler im Reiter Teams (${a.name})`, () => {
    const start = async (page: Page, seed: Seed): Promise<void> => {
      await page.emulateMedia({ colorScheme: a.dunkel ? 'dark' : 'light' });
      await oeffne(page, seed, { name: 'handy', width: a.width, height: a.height });
    };

    for (const [teamId, ort] of [[TEAM_NORD, 'erstes Team'], [TEAM_UFER, 'letztes Team']] as const) {
      test(`@W3-028 ${ort}: alle zwölf Farbfelder liegen ganz im Fenster, nicht verdeckt, mindestens 44 px, mit vorgelesenem Namen (${a.name})`, async ({ page, seedIndexedDB }) => {
        await start(page, seedIndexedDB);
        const karte0 = await oeffneFarbwahl(page, teamId);
        expect(await unverschoben(page.getByRole('dialog', { name: 'Farbauswahl' })), 'keine Karte in sich gerollt').toEqual([]);
        expect(await kopfInKarte(page.getByTestId(`team-expand-toggle-${teamId}`), karte0), 'Kopf der Karte bleibt in der Karte').toBe(true);
        const felder = page.getByRole('option');
        expect(await felder.count()).toBe(12);
        for (let i = 0; i < 12; i++) {
          const feld = felder.nth(i);
          const name = (await feld.getAttribute('aria-label')) ?? '';
          expect(name, 'Name statt Hex-Wert').toMatch(/^[A-ZÄÖÜ][a-zäöüß]+$/);
          expect(await sichtbarImFenster(feld), `Farbfeld ${name} ganz im Fenster`).toBe(true);
          const box = (await feld.boundingBox())!;
          expect(Math.min(box.width, box.height), `Farbfeld ${name} mindestens 44 px`).toBeGreaterThanOrEqual(44);
        }
      });

      test(`@W3-028 ${ort}: freier Farbwähler (Fläche und Farbton-Regler) liegt ganz im Fenster, Hellblau lässt sich wählen und gilt für das nächste Spiel (${a.name})`, async ({ page, seedIndexedDB }) => {
        await start(page, seedIndexedDB);
        const karte = await oeffneFarbwahl(page, teamId);
        const regler = page.locator('.react-colorful__hue');
        const flaeche = page.locator('.react-colorful__saturation');
        expect(await unverschoben(regler), 'keine Karte in sich gerollt').toEqual([]);
        expect(await sichtbarImFenster(regler), 'Farbton-Regler ganz im Fenster').toBe(true);
        expect(await sichtbarImFenster(flaeche), 'Farbfläche ganz im Fenster').toBe(true);
        // Hellblau #4FC3F7 liegt bei Farbton 199° (55 % der Breite), Sättigung 68 %, Helligkeit 97 %
        const r = (await regler.boundingBox())!;
        await page.mouse.click(r.x + r.width * 0.553, r.y + r.height / 2);
        const f = (await flaeche.boundingBox())!;
        await page.mouse.click(f.x + f.width * 0.68, f.y + f.height * 0.03);
        const lies = async (): Promise<string> => (await karte.locator('button[aria-haspopup="true"]').innerText()).match(/#[0-9A-Fa-f]{6}/)?.[0].toUpperCase() ?? '';
        const istHellblau = (hex: string): boolean => hex !== '' && parseInt(hex.slice(1, 3), 16) < 0xA0 && parseInt(hex.slice(5, 7), 16) > 0xD0;
        await expect.poll(async () => istHellblau(await lies()), { message: 'Hellblau, nicht Rot oder Gelb' }).toBe(true);
        const wert = await lies();
        if (teamId === TEAM_NORD) {
          await page.keyboard.press('Escape'); // gespeichert wird beim Loslassen, nicht erst beim Schließen
          await page.goto(`/#/tournament/${TURNIER_ID}/live`);
          await expect(page.getByTestId('scoreboard-box-links')).toHaveAttribute('data-color', wert);
        }
      });
    }

    test(`@W3-028 Escape und Tipp daneben schließen den Farbwähler, Tastatur erreicht die Farbfelder mit sichtbarem Fokus (${a.name})`, async ({ page, seedIndexedDB }) => {
      await start(page, seedIndexedDB);
      const karte = await oeffneFarbwahl(page, TEAM_NORD);
      const dialog = page.getByRole('dialog', { name: 'Farbauswahl' });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await karte.locator('button[aria-haspopup="true"]').click();
      await expect(dialog).toBeVisible();
      await page.getByRole('heading', { name: /Aktive Teams/ }).click({ position: { x: 2, y: 2 } }); // daneben
      await expect(dialog).toHaveCount(0);
      await karte.locator('button[aria-haspopup="true"]').click();
      await page.keyboard.press('Tab');
      const fokus = page.getByRole('option', { name: 'Weiß', exact: true });
      await expect(fokus).toBeFocused();
      expect(await fokus.evaluate((el) => getComputedStyle(el).outlineStyle), 'sichtbarer Fokusring').not.toBe('none');
    });
  });
}

// Zweite Stelle desselben Fehlers: Verwaltung → Sichtbarkeit → „Anzeige für Zuschauer“ (C-SICHTBARKEIT-FARBWAEHLER-ABGESCHNITTEN, behoben)
for (const a of PICKER_GERAETE.filter((g) => !g.dunkel)) {
  for (const seite of ['home', 'away'] as const) {
    test(`@W3-028 @ZM-152 Sichtbarkeit, Standardfarbe ${seite === 'home' ? 'Heim' : 'Gast'}: alle Farbfelder und der freie Farbwähler liegen ganz im Fenster, nichts in sich gerollt (${a.name})`, async ({ page, seedIndexedDB }) => {
      await oeffne(page, seedIndexedDB, a);
      await page.goto(`/#/tournament/${TURNIER_ID}/admin/visibility`);
      const gruppe = page.getByTestId(`spectator-display-${seite}-color`);
      await gruppe.locator('button[aria-haspopup="true"]').click({ timeout: 30000 });
      const dialog = page.getByRole('dialog', { name: 'Farbauswahl' });
      await expect(dialog).toBeVisible();
      await bild(page, a, `sichtbarkeit-${seite}`);
      expect(await unverschoben(dialog), 'kein Abschnitt in sich gerollt').toEqual([]);
      const kopf = page.getByTestId('spectator-display-section').getByRole('button', { name: /Anzeige für Zuschauer/ });
      expect(await kopfInKarte(kopf, page.getByTestId('spectator-display-section')), 'Kopf des Abschnitts bleibt im Abschnitt').toBe(true);
      const felder = page.getByRole('option');
      const n = await felder.count();
      expect(n).toBeGreaterThanOrEqual(6);
      for (let i = 0; i < n; i++) {
        expect(await sichtbarImFenster(felder.nth(i)), `Farbfeld ${String(i + 1)} ganz im Fenster`).toBe(true);
      }
      for (const teil of ['.react-colorful__saturation', '.react-colorful__hue']) {
        expect(await sichtbarImFenster(page.locator(teil)), `${teil} ganz im Fenster`).toBe(true);
      }
    });
  }
}

// Bilder vorher/nachher (gleiche Daten): TRIKOT_BILDER=<Ordner> TRIKOT_PHASE=vorher|nachher, nur mit Ordner
const FIX_ANSICHTEN = [
  { name: 'handy390', width: 390, height: 844, dunkel: false }, { name: 'handy360', width: 360, height: 640, dunkel: false },
  { name: 'desktop1440', width: 1440, height: 900, dunkel: false }, { name: 'handy390-dunkel', width: 390, height: 844, dunkel: true },
] as const;
test.describe('@W3-028 Bilder: Farbwähler im Reiter Teams', () => {
  for (const a of FIX_ANSICHTEN) {
    test(`Bilder ${a.name}`, async ({ page, seedIndexedDB }) => {
      test.skip(!BILDER, 'nur mit TRIKOT_BILDER');
      test.setTimeout(90000);
      await page.emulateMedia({ colorScheme: a.dunkel ? 'dark' : 'light' });
      await oeffne(page, seedIndexedDB, { name: a.name, width: a.width, height: a.height });
      for (const [teamId, ort] of [[TEAM_NORD, 'erstes-team'], [TEAM_UFER, 'letztes-team']] as const) {
        await oeffneFarbwahl(page, teamId);
        await page.screenshot({ path: join(BILDER ?? '', `${PHASE}-${a.name}-${ort}.png`) });
      }
    });
  }
});
