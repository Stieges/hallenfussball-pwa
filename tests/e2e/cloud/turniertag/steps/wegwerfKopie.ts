/**
 * Wegwerf-Kopie des Turniertag-Cups für Durchstich-Schritte, die am Turnier etwas verändern, was sich nicht zurückholen lässt
 * (Ergebnis-Einträge, K.-o.-Auflösung). Die Turnierleitung kopiert den Cup über die Startseite (derselbe Weg wie die Kopie
 * fürs Proben, @W5-024/@W5-025: Teams und Spielplan, alle Spiele geplant, ohne Ergebnis). Der Rückbau löscht die Turnierzeile als
 * Ganzes (Kaskade auf Spiele, Teams und Ereignisse): der einzige Weg, Engine-Ereignisse zu entfernen. Der Turniertag-Cup selbst
 * wird nur gelesen; `momentaufnahme` belegt, dass er danach unverändert ist.
 */
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { newRoleContext } from '../../engineHelpers';
import { serviceRest } from '../../restAsRole';
import { getRows, TURNIERTAG_ID } from './shared';

export interface WegwerfKopie {
  id: string;
  /** Löscht die Kopie als Ganzes und prüft, dass sie weg ist. */
  entfernen: () => Promise<void>;
}

interface KopfZeile {
  id: string;
}

/** Alles, was ein Durchstich-Schritt am Turniertag-Cup nicht verändern darf: Turnierzeile, Monitore, Spiele, Teams und die Ereignisse der Spiele. */
export async function momentaufnahme(): Promise<string> {
  const turnier = await getRows<Record<string, unknown>>(`tournaments?id=eq.${TURNIERTAG_ID}&select=*`, 'Momentaufnahme Turnierzeile');
  const monitore = await getRows<Record<string, unknown>>(`monitors?tournament_id=eq.${TURNIERTAG_ID}&select=*&order=id.asc`, 'Momentaufnahme Monitore');
  const spiele = await getRows<Record<string, unknown>>(`matches?tournament_id=eq.${TURNIERTAG_ID}&select=*&order=id.asc`, 'Momentaufnahme Spiele');
  const teams = await getRows<Record<string, unknown>>(`teams?tournament_id=eq.${TURNIERTAG_ID}&select=*&order=id.asc`, 'Momentaufnahme Teams');
  const ereignisse = await getRows<{ id: string; match_id: string }>(
    `match_events?match_id=in.(${spiele.map((s) => String(s.id)).join(',')})&select=id,match_id&order=id.asc`,
    'Momentaufnahme Ereignisse'
  );
  return JSON.stringify({ turnier, monitore, spiele, teams, ereignisse });
}

/** Das kopierende Gerät der Turnierleitung bleibt offen (ohne Neuladen), bis `entfernen` es schließt: für Schritte, die „auch auf dem Gerät, auf dem er kopiert hat“ prüfen (@W5-029). */
export interface KopieAufOffenemGeraet extends WegwerfKopie {
  /** Die Seite des kopierenden Geräts, unverändert seit dem Kopieren (Single-Page-App ohne Neuladen). */
  page: Page;
}

interface Kopiervorgang {
  kopieId: string;
  context: BrowserContext;
  page: Page;
}

/** Löscht die Kopie als Ganzes (Kaskade) und prüft, dass sie weg ist. */
async function loescheKopie(id: string): Promise<void> {
  const res = await serviceRest('DELETE', `tournaments?id=eq.${id}`);
  expect(res.status, `Wegwerf-Kopie löschen: ${res.text}`).toBeLessThan(300);
  const rest = await getRows<{ id: string }>(`tournaments?id=eq.${id}&select=id`, 'Kopie nach dem Löschen');
  expect(rest, 'Wegwerf-Kopie ist gelöscht').toEqual([]);
}

/** Kopiert den Turniertag-Cup über die Startseite (Name, optional Datum der Kopie) und wartet, bis Spiele und Teams in der Cloud stehen. Der Kontext bleibt offen. */
async function kopiere(browser: Browser, zweck: string, datum?: string): Promise<Kopiervorgang> {
  const titel = `Durchstich-Wegwerf ${zweck} ${Date.now()}`;
  const spieleOriginal = await getRows<{ id: string }>(`matches?tournament_id=eq.${TURNIERTAG_ID}&select=id`, 'Spiele des Originals');
  const teamsOriginal = await getRows<{ id: string }>(`teams?tournament_id=eq.${TURNIERTAG_ID}&select=id`, 'Teams des Originals');
  const { context, page } = await newRoleContext(browser, 'owner');
  let kopieId = '';
  try {
    await page.goto('/#/');
    const ausloeser = page.getByTestId(`tournament-${TURNIERTAG_ID}-actions-trigger`);
    await expect(ausloeser, 'Turniertag-Cup auf der Startseite').toBeVisible({ timeout: 30000 });
    await ausloeser.scrollIntoViewIfNeeded();
    await ausloeser.click();
    await page.getByTestId('action-menu-item-copy').click();
    await page.getByTestId('copy-dialog-name').fill(titel);
    if (datum !== undefined) {
      await page.getByTestId('copy-dialog-date').fill(datum);
    }
    await page.getByTestId('copy-dialog-confirm').click();
    await expect(page.getByTestId('copy-dialog-name')).toBeHidden();
    const kopfAbfrage = `tournaments?title=eq.${encodeURIComponent(titel)}&select=id`;
    await expect.poll(async () => (await getRows<KopfZeile>(kopfAbfrage, 'Kopf der Kopie')).length, { timeout: 30000, message: 'Kopie in der Datenbank' }).toBe(1);
    kopieId = (await getRows<KopfZeile>(kopfAbfrage, 'Kopf der Kopie'))[0].id;
    await expect.poll(async () => (await getRows<{ id: string }>(`matches?tournament_id=eq.${kopieId}&select=id`, 'Spiele der Kopie')).length, { timeout: 30000, message: 'Spiele der Kopie' }).toBe(spieleOriginal.length);
    await expect.poll(async () => (await getRows<{ id: string }>(`teams?tournament_id=eq.${kopieId}&select=id`, 'Teams der Kopie')).length, { timeout: 30000, message: 'Teams der Kopie' }).toBe(teamsOriginal.length);
  } catch (error) {
    // Halb angelegte Kopie nicht stehen lassen.
    await serviceRest('DELETE', `tournaments?title=eq.${encodeURIComponent(titel)}`);
    await context.close();
    throw error;
  }
  return { kopieId, context, page };
}

/** Kopiert den Turniertag-Cup als Turnierleitung über die Startseite und wartet, bis Spiele und Teams in der Cloud stehen. */
export async function legeWegwerfKopieAn(browser: Browser, zweck: string): Promise<WegwerfKopie> {
  const { kopieId, context } = await kopiere(browser, zweck);
  await context.close();
  return { id: kopieId, entfernen: () => loescheKopie(kopieId) };
}

/** Wie `legeWegwerfKopieAn`, mit dem Datum der Kopie im Dialog; das kopierende Gerät bleibt offen (`entfernen` schließt es und löscht die Kopie). */
export async function legeKopieMitDatumAn(browser: Browser, zweck: string, datum: string): Promise<KopieAufOffenemGeraet> {
  const { kopieId, context, page } = await kopiere(browser, zweck, datum);
  return {
    id: kopieId,
    page,
    entfernen: async () => {
      await context.close();
      await loescheKopie(kopieId);
    },
  };
}
