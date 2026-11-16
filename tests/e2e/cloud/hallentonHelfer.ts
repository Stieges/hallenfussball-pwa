/**
 * tests/e2e/cloud/hallentonHelfer.ts -- Hilfen für `hallenton.cloud.spec.ts` (H4-14, Plan H4).
 *
 * Der Ton wird nicht gehört, sondern beobachtet: ein Spion auf `AudioBufferSourceNode.prototype.start` (per `addInitScript` vor dem
 * ersten Seitenaufbau) hält jeden Beginn eines Tons fest. Nur Testumgebung; der Spion ändert nichts am Verhalten (ruft das Original).
 */
import { expect, type BrowserContext, type Page } from '@playwright/test';
import { fetchEngineRows } from './engineHelpers';

export interface TonBeginn {
  /** Wanduhr (ms) beim Aufruf von `start`. */
  wall: number;
  /** Zeitpunkt (Audiozeit), zu dem der Ton beginnen soll. */
  when: number;
  /** Aktuelle Audiozeit des Kontexts beim Aufruf. */
  ctxTime: number;
}

declare global {
  interface Window {
    __tonSpion?: { starts: TonBeginn[] };
  }
}

/** Spion auf jeden Beginn eines Web-Audio-Tons in diesem Kontext (vor dem ersten Laden aufrufen). */
export async function installiereTonSpion(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const spion = { starts: [] as TonBeginn[] };
    window.__tonSpion = spion;
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function start(this: AudioBufferSourceNode, when?: number, ...rest: [number?, number?]): void {
      spion.starts.push({ wall: Date.now(), when: when ?? 0, ctxTime: this.context.currentTime });
      return original.call(this, when, ...rest);
    };
  });
}

export async function tonBeginne(page: Page): Promise<TonBeginn[]> {
  return page.evaluate(() => window.__tonSpion?.starts ?? []);
}

export async function tonAnzahl(page: Page): Promise<number> {
  return (await tonBeginne(page)).length;
}

/** Wanduhr-Zeit, zu der der Ton wirklich klingt (Aufrufzeit plus Vorlauf bis `when`). */
export function klingtUm(b: TonBeginn): number {
  return b.wall + Math.max(0, b.when - b.ctxTime) * 1000;
}

/** Wartet, bis der Spion mindestens `n` Töne zählt. */
export async function warteAufToene(page: Page, n: number, timeout = 30_000): Promise<void> {
  await expect.poll(() => tonAnzahl(page), { timeout, message: `Ton-Spion zählt mindestens ${n}` }).toBeGreaterThanOrEqual(n);
}

/**
 * Beobachtungsfenster für „kein weiterer Ton“: wartet bedingungsgesteuert, bis ein Ton über `soll` hinaus beginnt, höchstens `fensterMs`.
 * Kein fester Schlaf: kommt der Ton, bricht die Bedingung sofort ab und der Test schlägt fehl.
 */
export async function beobachteKeinenWeiterenTon(page: Page, soll: number, fensterMs = 4000): Promise<void> {
  const kamZusaetzlich = await page.waitForFunction((n) => (window.__tonSpion?.starts.length ?? 0) > n, soll, { timeout: fensterMs })
    .then(() => true, () => false);
  expect(kamZusaetzlich, `kein weiterer Ton nach ${soll}`).toBe(false);
  expect(await tonAnzahl(page)).toBe(soll);
}

export function verwaltungUrl(turnierId: string): string {
  return `/#/tournament/${turnierId}/admin/hallenton`;
}

export async function oeffneVerwaltung(page: Page, turnierId: string): Promise<void> {
  await page.goto(verwaltungUrl(turnierId));
  await expect(page.getByTestId('hallenton-seite')).toBeVisible({ timeout: 20_000 });
}

/** „Ton aktivieren“ in der Fußleiste (nur mit Klick am Gerät selbst möglich). */
export async function aktiviereTon(page: Page): Promise<void> {
  const taste = page.getByTestId('ton-aktivieren');
  await expect(taste).toBeVisible({ timeout: 20_000 });
  await taste.click();
}

/**
 * Richtet das Gerät als Hallen-Lautsprecher für `feld` ein (@HT-001): Name, Schalter, Feld wählen, bei Belegung „Ablösen“ bestätigen,
 * „Ton aktivieren“. Danach steht „Lautsprecher bereit“ (Kasten „Dieses Gerät“).
 */
export async function richteLautsprecherEin(page: Page, turnierId: string, name: string, options: { feld?: number; abloesen?: boolean } = {}): Promise<void> {
  const feld = options.feld ?? 1;
  await oeffneVerwaltung(page, turnierId);
  const nameFeld = page.getByTestId('geraet-name');
  await expect(nameFeld).toBeVisible({ timeout: 20_000 });
  await nameFeld.fill(name);
  await page.getByTestId('geraet-schalter-zeile').click();
  await page.getByTestId(`geraet-feld-${feld}`).click();
  if (options.abloesen === true) {
    await expect(page.getByRole('dialog')).toContainText('Ablösen?', { timeout: 15_000 });
    await page.getByTestId('confirm-dialog-confirm').click();
  }
  await aktiviereTon(page);
  await expect(page.getByTestId('geraet-banner-bereit')).toBeVisible({ timeout: 30_000 });
}

/** Spielzeit bis zum Ende am Server (erste `MATCH_END`-Zeile), als Wanduhr des Tests. */
export async function warteAufEndeAmServer(matchId: string, timeout = 30_000): Promise<number> {
  let gesehen = 0;
  await expect.poll(async () => {
    const zeilen = await fetchEngineRows(matchId);
    if (zeilen.some((z) => z.type === 'MATCH_END')) {
      gesehen = Date.now();
      return true;
    }
    return false;
  }, { timeout, intervals: [100, 100, 200], message: 'Ende (MATCH_END) steht am Server' }).toBe(true);
  return gesehen;
}
