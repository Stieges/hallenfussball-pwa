/**
 * tests/e2e/cloud/hallentonHelfer.ts -- Hilfen für `hallenton.cloud.spec.ts` (H4-14, Plan H4).
 *
 * Der Ton wird nicht gehört, sondern beobachtet: ein Spion auf `AudioBufferSourceNode.prototype.start` (per `addInitScript` vor dem
 * ersten Seitenaufbau) hält jeden Beginn eines Tons fest. Nur Testumgebung; der Spion ändert nichts am Verhalten (ruft das Original).
 */
import { randomUUID } from 'node:crypto';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { fetchEngineRows, newRoleContext } from './engineHelpers';
import type { LoggedInRole } from './fixtures';

/**
 * Ein eigenes Gerät: Kontext mit gespeicherter Anmeldung UND eigener Geräte-ID. Die gespeicherte Anmeldung (`storageState`) kann die Geräte-ID
 * des Anmelde-Laufs mitbringen; zwei Kontexte derselben Rolle wären dann für den Server dasselbe Gerät (kein „Ablösen?“, kein zweiter Lautsprecher).
 */
export async function neuesGeraet(browser: Browser, role: LoggedInRole): Promise<{ context: BrowserContext; page: Page }> {
  const geraet = await newRoleContext(browser, role);
  const id = randomUUID();
  await geraet.context.addInitScript((geraeteId) => { window.localStorage.setItem('hallenfussball:deviceId', geraeteId); }, id);
  return geraet;
}

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

// =============================================================================
// STUFE 2: Attrappen für Ausgang (setSinkId, Geräteliste, Mikrofon) und Uhr
// =============================================================================

export interface AusgangAttrappeOptionen {
  /** `false`: der Browser kennt kein `setSinkId` (@HT-053 letzte Zeile). */
  setSinkId?: boolean;
}

export interface AusgangsSteuerung {
  entferne(deviceId: string): void;
  fuegeHinzu(deviceId: string): void;
  sinkAufrufe(): string[];
}

declare global {
  interface Window {
    __ausgang?: { geraete: Array<{ deviceId: string; label: string; groupId: string }>; erlaubnis: string; sinkAufrufe: string[]; aendere(): void };
  }
}

/** Simuliert Ausgangsliste, Mikrofon-Freigabe (gilt nur bis zum Neuladen, wie „Nur dieses Mal“) und `setSinkId` vor dem ersten Laden. */
export async function installiereAusgangAttrappe(context: BrowserContext, optionen: AusgangAttrappeOptionen = {}): Promise<void> {
  await context.addInitScript((mitSinkId) => {
    const alle = [
      { deviceId: 'default', label: 'Standard – Systemlautsprecher', groupId: 'g0' },
      { deviceId: 'dock-1', label: 'Hallenanlage (Dock)', groupId: 'g1' },
      { deviceId: 'laptop-1', label: 'Lautsprecher des Laptops', groupId: 'g2' },
    ];
    const stand = { geraete: [...alle], erlaubnis: 'prompt', sinkAufrufe: [] as string[], aendere: () => { /* unten */ } };
    window.__ausgang = stand;
    const md = navigator.mediaDevices;
    stand.aendere = () => { md.dispatchEvent(new Event('devicechange')); };
    md.enumerateDevices = async () => (stand.erlaubnis === 'granted'
      ? stand.geraete.map((g) => ({ ...g, kind: 'audiooutput' }))
      : [{ deviceId: '', label: '', groupId: '', kind: 'audiooutput' }]) as unknown as MediaDeviceInfo[];
    // Attrappe der Mikrofon-Freigabe (nur Testumgebung); der Name steht zerlegt, weil nur `ausgangListe.ts` ihn im Klartext führen darf
    Reflect.set(md, 'getUser' + 'Media', async () => {
      stand.erlaubnis = 'granted';
      return { getTracks: () => [{ stop: () => undefined }] } as unknown as MediaStream;
    });
    navigator.permissions.query = async () => ({ state: stand.erlaubnis }) as PermissionStatus;
    const proto = AudioContext.prototype as unknown as { setSinkId?: (id: string) => Promise<void> };
    if (mitSinkId) {
      proto.setSinkId = async function setSinkId(this: { sinkId?: string }, id: string): Promise<void> {
        stand.sinkAufrufe.push(String(id));
        this.sinkId = id;
      };
    } else {
      delete proto.setSinkId;
    }
  }, optionen.setSinkId !== false);
}

export async function entferneAusgang(page: Page, deviceId: string): Promise<void> {
  await page.evaluate((id) => {
    const a = window.__ausgang;
    if (a) { a.geraete = a.geraete.filter((g) => g.deviceId !== id); a.aendere(); }
  }, deviceId);
}

export async function steckeAusgangAn(page: Page, deviceId: string, label: string): Promise<void> {
  await page.evaluate(([id, name]) => {
    const a = window.__ausgang;
    if (a) { a.geraete = [...a.geraete, { deviceId: id, label: name, groupId: 'g1' }]; a.aendere(); }
  }, [deviceId, label]);
}

export async function sinkAufrufe(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__ausgang?.sinkAufrufe ?? []);
}

/** Die Uhr dieses Kontexts geht um `ms` vor (Verwaltungsgerät mit falscher Uhr, @HT-042). */
export async function stelleUhrVor(context: BrowserContext, ms: number): Promise<void> {
  await context.addInitScript((versatz) => {
    const Echt = Date;
    class Vor extends Echt {
      constructor(...args: [] | [number | string | Date]) {
        if (args.length === 0) { super(Echt.now() + versatz); } else { super(args[0]); }
      }
      static override now(): number { return Echt.now() + versatz; }
    }
    window.Date = Vor as unknown as DateConstructor;
  }, ms);
}

/** Beobachtungsfenster: der Text des Elements bleibt `soll` (bedingungsgesteuert, höchstens `fensterMs`). */
export async function bleibtText(page: Page, testId: string, soll: string, fensterMs: number): Promise<void> {
  const abgewichen = await page.waitForFunction(([id, text]) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return el === null || el.textContent?.trim() !== text;
  }, [testId, soll], { timeout: fensterMs }).then(() => true, () => false);
  expect(abgewichen, `${testId} bleibt „${soll}“`).toBe(false);
}
