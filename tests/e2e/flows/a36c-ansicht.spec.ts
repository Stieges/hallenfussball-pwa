/**
 * Paket A-36c – Zuschauer-Seite, Verwaltungs-Spielplan und Monitor lesen die gemeinsame Ansicht (T2-UI (b)).
 *
 * Saat `hallencup-messlauf` (scripts/visual-metrics/saat): Halbfinale 1 nach Verlängerung (reguläre Zeit 1:1, Verlängerung 1:0),
 * Halbfinale 2 nach Strafstoßschießen (0:0, 4:3), Finale läuft (2:1, Anpfiff vor 320 s), Spiel um Platz 3 offen.
 * Werte und Wortlaut stammen aus dem Gherkin: @OB-064 (laufendes Spiel zeigt Status UND Spielzeit in der Kopfzeile, auch in der
 * Finalrunden-Karte), @ZM-039/@ZM-041 (läuft = nicht beendet, nie „nächstes Spiel“), @ZM-147 (nur Ergebnis → Endstand).
 * Zuschauer-Seite 360×640, Monitor 1280×720, Verwaltung 360×640. Bilder: Ordner aus A36C_BILDER, Vorsatz aus A36C_PHASE.
 * Läuft nur im Projekt `desktop` (setzt das Fenster selbst). F-ZEIT (Gerätezeitzone) steht im Cloud-Spec `a36c-zeit.cloud.spec.ts`:
 * lokal gespeicherte Spiele tragen ihre Uhrzeit als Zeitpunkt, nur die Cloud-Zeile als Wanduhr.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const BILDER = process.env.A36C_BILDER;
const PHASE = process.env.A36C_PHASE ?? 'nachher';
const HANDY = { width: 360, height: 640 };
const MONITOR = { width: 1280, height: 720 };

const FINALE = '00000003-0000-4000-8000-000000000015';
const HALBFINALE_1 = '00000003-0000-4000-8000-000000000013';
const HALBFINALE_2 = '00000003-0000-4000-8000-000000000014';
const PLATZ_3 = '00000003-0000-4000-8000-000000000016';

async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${PHASE}-${name}.png`), fullPage: false });
}

async function oeffne(page: Page, groesse: { width: number; height: number }, route: string, erwarte: string) {
  await page.setViewportSize(groesse);
  await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
  await page.goto(route);
  await expect(page.locator(erwarte).first()).toBeAttached({ timeout: 25000 });
}

const karte = (page: Page, id: string) => page.locator(`[data-testid="final-card-${id}"]`);

test.describe('A-36c Zuschauer-Seite 360×640 (/live/MESS26)', () => {
  test.beforeEach(async ({ page }) => {
    await oeffne(page, HANDY, '/#/live/MESS26', '[data-testid^="final-card-"]');
  });

  test('@OB-064 @ZM-039 Finale läuft: „läuft 05:2x“ in der Kopfzeile der Finalrunden-Karte (Status UND Spielzeit), Stand 2:1, noch kein Sieger fett', async ({ page }) => {
    const finale = karte(page, FINALE);
    await finale.scrollIntoViewIfNeeded();
    await expect(finale.locator(`[data-testid="final-live-${FINALE}"]`)).toHaveText(/^läuft 0[5-6]:\d\d$/);
    await expect(finale.locator('[data-testid^="final-goals-"]').nth(0)).toHaveText('2');
    await expect(finale.locator('[data-testid^="final-goals-"]').nth(1)).toHaveText('1');
    await expect(finale.locator('[data-winner="true"]')).toHaveCount(0);
    await expect(finale.locator('[data-testid^="final-decision-"]')).toHaveCount(0);
    await bild(page, 'zuschauer-360-finale-laeuft');
  });

  test('Gegenbeispiel: nur das Finale läuft, die beendeten Halbfinals tragen kein Live-Kennzeichen', async ({ page }) => {
    await expect(page.locator('[data-testid^="final-live-"]')).toHaveCount(1);
    await expect(karte(page, HALBFINALE_1).locator('[data-testid^="final-live-"]')).toHaveCount(0);
    await expect(karte(page, HALBFINALE_2).locator('[data-testid^="final-live-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="match-card-live"]')).toHaveCount(0);
  });

  test('@OB-064 Endstände bleiben: Halbfinale 1 „n. V.“ (2:1), Halbfinale 2 „beendet i. E.“ mit (4)/(3)', async ({ page }) => {
    await expect(karte(page, HALBFINALE_1).locator('[data-testid^="final-decision-"]')).toHaveText('n. V.');
    await expect(karte(page, HALBFINALE_1).locator('[data-testid^="final-goals-"]').nth(0)).toHaveText('2');
    await expect(karte(page, HALBFINALE_2).locator('[data-testid^="final-decision-"]')).toHaveText('beendet i. E.');
    await expect(karte(page, HALBFINALE_2).locator('[data-testid^="final-penalty-"]').nth(0)).toHaveText('(4)');
    await expect(karte(page, HALBFINALE_2).locator('[data-testid^="final-penalty-"]').nth(1)).toHaveText('(3)');
  });

  test('@ZM-039 Filter „Live“: nur das Finale; „Beendet“ enthält das Finale nicht', async ({ page }) => {
    await page.goto('/#/live/MESS26?s=live');
    await page.reload();
    await expect(karte(page, FINALE)).toBeAttached();
    await expect(page.locator('[data-testid^="final-card-"]')).toHaveCount(1);
    await expect(page.locator('[data-match-card]')).toHaveCount(0);
    await page.goto('/#/live/MESS26?s=finished');
    await page.reload();
    await expect(karte(page, HALBFINALE_1)).toBeAttached();
    await expect(karte(page, FINALE)).toHaveCount(0);
  });

  test('@ZM-041 Spiel um Platz 3 (geplant): ohne Live-Kennzeichen, ohne Stand, kein Rohschlüssel', async ({ page }) => {
    const platz3 = karte(page, PLATZ_3);
    await expect(platz3.locator('[data-testid^="final-live-"]')).toHaveCount(0);
    await expect(platz3.locator('[data-testid^="final-goals-"]').nth(0)).toHaveText('–');
    expect(await platz3.innerText()).not.toMatch(/group-|TBD|tournament:/);
  });
});

test.describe('A-36c Verwaltung 360×640 (Spielplan)', () => {
  test('@OB-064 Finale läuft: auch im Spielplan der Verwaltung „läuft 05:2x“ statt „beendet“ (C-SPIELPLAN-LAUFEND-ENGINE-QUELLE)', async ({ page }) => {
    await oeffne(page, HANDY, '/#/tournament/hallencup-messlauf/schedule', '[data-testid^="final-card-"]');
    const finale = karte(page, FINALE);
    await finale.scrollIntoViewIfNeeded();
    await expect(finale.locator(`[data-testid="final-live-${FINALE}"]`)).toHaveText(/^läuft 0[5-6]:\d\d$/);
    // Gegenbeispiel: ein laufendes Spiel mit Stand 2:1 ist kein beendetes Spiel (kein Sieger fett, kein Korrigieren-Knopf)
    await expect(finale.locator('[data-winner="true"]')).toHaveCount(0);
    await expect(finale.locator('.correction-btn-mobile')).toHaveCount(0);
    await bild(page, 'verwaltung-360-finale-laeuft');
  });
});

/** Das Finale wird beendet, ohne einzelne Tore oder Schüsse: nur das Ergebnis steht im Turnier (wie nach Papier-Leitung). */
/** `gruppe`: das Spiel wird zum Gruppenspiel (kein Finalrunden-Spiel), um Ring ohne Pokal zu zeigen (@ZM-049). */
async function beendeFinale(page: Page, ergebnis: { scoreA: number; scoreB: number; overtimeScoreA?: number; overtimeScoreB?: number; penaltyScoreA?: number; penaltyScoreB?: number; decidedBy: string; isFinal?: boolean; group?: string }) {
  await page.evaluate(({ id, werte }) => new Promise<void>((fertig, fehler) => {
    const auf = indexedDB.open('hallenfussball', 1);
    auf.onerror = () => fehler(new Error('IndexedDB'));
    auf.onsuccess = () => {
      const tx = auf.result.transaction('cache', 'readwrite');
      const speicher = tx.objectStore('cache');
      const lesen = speicher.get('tournaments');
      lesen.onsuccess = () => {
        const eintrag = lesen.result as { key: string; value: Array<{ id: string; matches: Array<Record<string, unknown>> }> };
        const spiel = eintrag.value.find((t) => t.id === 'hallencup-messlauf')?.matches.find((m) => m.id === id);
        if (!spiel) { fehler(new Error('Finale fehlt')); return; }
        Object.assign(spiel, { matchStatus: 'finished', timerStartTime: undefined, timerElapsedSeconds: 600, ...werte });
        speicher.put(eintrag);
      };
      tx.oncomplete = () => fertig();
      tx.onerror = () => fehler(new Error('Schreiben'));
    };
  }), { id: FINALE, werte: ergebnis });
}

/** Ende nach Strafstoßschießen (Mockup K5g): nichts überlappt, Strafstoß mittig unter dem Doppelpunkt, Ring und Pokal nur am Sieger. */
async function pruefeEnde(page: Page, siegerSeite: 'home' | 'away', pokal = true) {
  const kasten = (seite: string) => page.locator(`[data-testid="live-block-${seite}"] [data-position]`);
  const verlierer = siegerSeite === 'home' ? 'away' : 'home';
  await expect(kasten(siegerSeite)).toHaveAttribute('data-outcome', 'winner');
  await expect(kasten(verlierer)).toHaveAttribute('data-outcome', 'loser');
  await expect(page.getByTestId(`live-cup-${siegerSeite}`)).toHaveCount(pokal ? 1 : 0);
  await expect(page.getByTestId(`live-cup-${verlierer}`)).toHaveCount(0);
  const boxen = await page.evaluate(() => {
    const r = (sel: string) => { const b = document.querySelector(sel)?.getBoundingClientRect(); return b ? { l: b.left, r: b.right, t: b.top, b: b.bottom } : null; };
    return { px: r('[data-testid="live-penalty-block"]'), sep: r('[data-testid="live-separator"]'), home: r('[data-testid="live-name-home"] [data-teamname]'), away: r('[data-testid="live-name-away"] [data-teamname]'), winner: r('[data-testid="live-winner"]'), grid: r('[data-testid="live-grid"]'), kHome: r('[data-testid="live-block-home"]'), kAway: r('[data-testid="live-block-away"]') };
  });
  const schneiden = (a: { l: number; r: number; t: number; b: number } | null, b: { l: number; r: number; t: number; b: number } | null) =>
    a !== null && b !== null && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  expect(boxen.px).not.toBeNull();
  expect(schneiden(boxen.px, boxen.home), 'Strafstoß überlappt den linken Namen').toBe(false);
  expect(schneiden(boxen.px, boxen.away), 'Strafstoß überlappt den rechten Namen').toBe(false);
  expect(schneiden(boxen.px, boxen.kHome) || schneiden(boxen.px, boxen.kAway), 'Strafstoß überlappt einen Kasten (Beschriftung abgeschnitten)').toBe(false);
  expect(schneiden(boxen.winner, boxen.home) || schneiden(boxen.winner, boxen.away), 'Siegerzeile überlappt einen Namen ' + JSON.stringify(boxen)).toBe(false);
  const mitteBild = ((boxen.grid?.l ?? 0) + (boxen.grid?.r ?? 0)) / 2;
  const mitteStrafstoss = ((boxen.px?.l ?? 0) + (boxen.px?.r ?? 0)) / 2;
  expect(Math.abs(mitteStrafstoss - mitteBild), 'Strafstoß mittig unter dem Doppelpunkt').toBeLessThan(2);
  expect((boxen.px?.t ?? 0)).toBeGreaterThan(boxen.sep?.b ?? 0);
}

test.describe('A-36c Monitor 1280×720', () => {
  test('@ZM-039 Spielplan Feld 1: das Finale trägt Statuspunkt „live“, die Halbfinals ihre Endstände', async ({ page }) => {
    await oeffne(page, MONITOR, '/#/display/hallencup-messlauf/mon-plan-feld', '[data-testid="monitor-match-row"]');
    const finale = page.locator(`[data-testid="monitor-match-row"][data-match-id="${FINALE}"]`);
    // Finale ist das letzte Spiel auf Feld 1 vor Platz 3: eventuell auf Seite 2 (6 Zeilen je Seite)
    for (let versuch = 0; versuch < 4 && (await finale.count()) === 0; versuch += 1) {
      await page.waitForTimeout(16000);
    }
    await expect(finale).toHaveAttribute('data-status', 'running');
    await bild(page, 'monitor-1280-spielplan-feld');
  });

  test('@ZM-041 „Nächste Spiele“: nur das Spiel um Platz 3, das laufende Finale steht nicht darin', async ({ page }) => {
    await oeffne(page, MONITOR, '/#/display/hallencup-messlauf/mon-naechste', '[data-testid="monitor-match-row"]');
    const ids = await page.locator('[data-testid="monitor-match-row"]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-match-id')));
    expect(ids).toEqual([PLATZ_3]);
    await bild(page, 'monitor-1280-naechste-spiele');
  });

  test('@ZM-039 Live-Folie Feld 1: das laufende Finale steht als Live-Anzeige da (Stand 2:1)', async ({ page }) => {
    await oeffne(page, MONITOR, '/#/display/hallencup-messlauf/mon-live', '[data-testid="live-slide-area"]');
    await expect(page.getByLabel('Heim: 2')).toBeVisible();
    await expect(page.getByLabel('Gast: 1')).toBeVisible();
    await bild(page, 'monitor-1280-live-laeuft');
  });

  test('@ZM-147 nur Ergebnis: nach Abpfiff mit 2:2 und Strafstoßschießen 4:3 zeigt die Live-Folie „Strafstoßschießen 4 : 3“ und den Sieger', async ({ page }) => {
    await oeffne(page, MONITOR, '/#/display/hallencup-messlauf/mon-live', '[data-testid="live-slide-area"]');
    await beendeFinale(page, { scoreA: 2, scoreB: 2, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' });
    // Abruf-Takt des Monitors (Vorbelegung 5 s): die Live-Folie hält das Endergebnis 30 s (@ZM-077)
    await expect(page.getByTestId('live-penalty')).toHaveText('Strafstoßschießen 4 : 3', { timeout: 20000 });
    await expect(page.getByTestId('live-winner')).toContainText('gewinnt');
    await expect(page.getByLabel('Heim: 2')).toBeVisible();
    await expect(page.getByLabel('Gast: 2')).toBeVisible();
    await expect(page.locator('[data-testid*="shootout"], [data-testid*="dots"]')).toHaveCount(0);
    await pruefeEnde(page, 'home');
    await bild(page, 'monitor-1280-live-ende-strafstoss');
  });

  test('@ZM-049 @ZM-087 K5g3: 50-Zeichen-Verlierer – Umbruch, nichts überlappt, Sieger rechts mit Ring und Pokal', async ({ page }) => {
    await oeffne(page, MONITOR, '/#/display/hallencup-messlauf/mon-live', '[data-testid="live-slide-area"]');
    await beendeFinale(page, { scoreA: 2, scoreB: 2, penaltyScoreA: 3, penaltyScoreB: 4, decidedBy: 'penalty' });
    await expect(page.getByTestId('live-penalty')).toHaveText('Strafstoßschießen 3 : 4', { timeout: 20000 });
    await pruefeEnde(page, 'away');
    await bild(page, 'monitor-1280-live-ende-strafstoss-langer-verlierer');
  });

  test('@ZM-156 Gegenbeispiel: Sieg in regulärer Zeit – Ring und Pokal am Sieger, keine Strafstoß-Zeile', async ({ page }) => {
    await oeffne(page, MONITOR, '/#/display/hallencup-messlauf/mon-live', '[data-testid="live-slide-area"]');
    await beendeFinale(page, { scoreA: 3, scoreB: 1, decidedBy: 'regular' });
    await expect(page.getByTestId('live-cup-home')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('live-penalty-block')).toHaveCount(0);
    await expect(page.getByTestId('live-endstand')).toHaveText('Endstand');
    await bild(page, 'monitor-1280-live-ende-regulaer');
  });

  test('@ZM-156 Gruppenspiel: Ring um den Sieger, Name fett, Verlierer zurückgenommen, aber kein Pokal', async ({ page }) => {
    await oeffne(page, MONITOR, '/#/display/hallencup-messlauf/mon-live', '[data-testid="live-slide-area"]');
    await beendeFinale(page, { scoreA: 3, scoreB: 1, decidedBy: 'regular', isFinal: false, group: 'A' });
    await expect(page.getByTestId('live-endstand')).toHaveText('Endstand', { timeout: 20000 });
    await expect(page.locator('[data-testid="live-block-home"] [data-position]')).toHaveAttribute('data-outcome', 'winner');
    await expect(page.locator('[data-testid="live-block-away"] [data-position]')).toHaveAttribute('data-outcome', 'loser');
    await expect(page.getByTestId('live-cup-home')).toHaveCount(0);
    await expect(page.getByTestId('live-cup-away')).toHaveCount(0);
    await bild(page, 'monitor-1280-live-ende-gruppe');
  });

  test('@ZM-156 @ZM-157 Spiel um Platz 3 nach Verlängerung: Ring, Pokal, „nach Verlängerung“ unter dem Namen des Siegers (nicht unter „Endstand“), Kästen unverändert', async ({ page }) => {
    await oeffne(page, MONITOR, '/#/display/hallencup-messlauf/mon-live', '[data-testid="live-slide-area"]');
    const vorher = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="live-block-"] [data-position]')].map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }));
    await beendeFinale(page, { scoreA: 1, scoreB: 1, overtimeScoreA: 1, overtimeScoreB: 0, decidedBy: 'overtime' });
    const zusatz = page.getByTestId('live-after-overtime');
    await expect(zusatz).toHaveText('nach Verlängerung', { timeout: 20000 });
    await expect(page.getByTestId('live-cup-home')).toBeVisible();
    await expect(page.getByTestId('live-penalty-block')).toHaveCount(0);
    const boxen = await page.evaluate(() => {
      const r = (sel: string) => { const b = document.querySelector(sel)?.getBoundingClientRect(); return b ? { l: b.left, r: b.right, t: b.top, b: b.bottom } : null; };
      return { zusatz: r('[data-testid="live-after-overtime"]'), name: r('[data-testid="live-name-home"] [data-teamname]'), endstand: r('[data-testid="live-endstand"]'), kasten: [...document.querySelectorAll('[data-testid^="live-block-"] [data-position]')].map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }) };
    });
    expect(boxen.zusatz!.t, 'Zusatz unter dem Namen des Siegers').toBeGreaterThanOrEqual(boxen.name!.b - 1);
    expect(boxen.zusatz!.b, 'Zusatz überlappt „Endstand“ nicht').toBeLessThanOrEqual(boxen.endstand!.t);
    expect(boxen.zusatz!.l).toBeGreaterThanOrEqual(boxen.kasten[0][0] - 1);
    expect(boxen.zusatz!.r).toBeLessThanOrEqual(boxen.kasten[0][0] + boxen.kasten[0][2] + 1);
    for (let i = 0; i < vorher.length; i += 1) { for (let k = 0; k < 4; k += 1) { expect(Math.abs(boxen.kasten[i][k] - vorher[i][k])).toBeLessThanOrEqual(1); } }
    await bild(page, 'monitor-1280-live-ende-verlaengerung');
  });
});

/**
 * Fixrunde 2 (C-SPIELPLAN-SCHWEBETASTEN, öffentliche Variante), @OB-021/@OB-022: auf `/public/:id` verdeckt der Teilen-Knopf
 * keine Spielkarte. Gemessen mit `elementFromPoint` (Mitte jeder sichtbaren Torzahl, Name und Kopfzeile je Karte) beim
 * Durchscrollen der ganzen Seite; Treffer im Teilen-Knopf = verdeckt.
 */
for (const groesse of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`@OB-021 Teilen-Knopf überlappt keine Spielkarte (/public, ${groesse.width}×${groesse.height})`, async ({ page }) => {
    await oeffne(page, groesse, '/#/public/hallencup-messlauf', '[data-match-card]');
    const knopf = page.locator('.schedule-action-buttons');
    await expect(knopf).toBeAttached();
    const verdeckt: string[] = [];
    const hoehe = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= hoehe; y += Math.floor(groesse.height / 2)) {
      await page.evaluate((ziel) => window.scrollTo(0, ziel), y);
      const treffer = await page.evaluate(() => {
        const leiste = document.querySelector('.schedule-action-buttons');
        const liste: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('[data-match-card] [data-testid^="match-goals-"], [data-match-card] [data-testid^="match-name-"], [data-match-card] button')) {
          const r = el.getBoundingClientRect();
          if (el.offsetParent === null || r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) { continue; }
          const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (oben && leiste?.contains(oben)) { liste.push(el.dataset.testid ?? el.textContent ?? 'button'); }
        }
        return liste;
      });
      verdeckt.push(...treffer);
    }
    expect(verdeckt, 'vom Teilen-Knopf verdeckte Bedienelemente und Stände').toEqual([]);
    // Gegenbeispiel: der Knopf ist erreichbar und sichtbar, er steht unter dem Spielplan
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(knopf.getByRole('button', { name: /Teilen/ })).toBeVisible();
    await bild(page, `public-${groesse.width}-teilen-im-fluss`);
  });
}
