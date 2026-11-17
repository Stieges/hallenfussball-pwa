/**
 * Zuschauer-Seite zählen (intern, Stufe 1 und 1b; @RZ-024 bis @RZ-032, docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md).
 * Reine Logik ohne React und ohne Netz: Kanal aus dem Adresszusatz, Geräteart aus Bedienart und kürzerer Bildschirmseite, „installiert“ aus der
 * Anzeigeart und das Versenden einer Zählmeldung, das nie stört (Fehler und Zeitüberschreitung werden verschluckt, kein Wiederholen).
 * Gesendet werden nur diese fünf Felder (die Server-Funktion `count_public_view`); nichts davon liegt auf dem Gerät.
 * Betriebssystem- und Browser-Familie (@RZ-031) leitet der Server aus der Kennung ab, die der Browser bei jedem Aufruf ohnehin mitschickt;
 * die Seite liest dafür nichts am Gerät aus und sendet dafür nichts Eigenes.
 */
import { breakpointValues } from '../../design-tokens/breakpoints';
import type { OutageKind } from './publicOutage';

export type ViewChannel = 'qr' | 'link' | 'direkt';
export type DeviceClass = 'handy' | 'tablet' | 'gross';
/** Aufruf, Lebenszeichen, oder eine überstandene Netzstörung (kurz/lang, @RZ-033) – alle über denselben Weg und dieselben fünf Felder. */
export type ViewCountKind = 'aufruf' | 'lebenszeichen' | OutageKind;

/** Die Felder der Server-Funktion `count_public_view` – nichts sonst verlässt das Gerät. */
export interface ViewCountArgs {
  p_share_code: string;
  p_art: ViewCountKind;
  p_kanal: ViewChannel;
  p_geraet: DeviceClass;
  p_installiert: boolean;
}

/** Eine Zählmeldung absetzen; bricht ab, sobald `signal` abbricht. Ergebnis und Fehler interessieren nicht. */
export type ViewCountTransport = (args: ViewCountArgs, signal: AbortSignal) => Promise<unknown>;

/** So lange wartet eine Zählmeldung höchstens (@RZ-026: „antwortet erst nach 10 Sekunden“). */
export const VIEW_COUNT_TIMEOUT_MS = 10_000;
/** Abstand der Lebenszeichen, solange die Seite sichtbar ist (@RZ-025). */
export const HEARTBEAT_INTERVAL_MS = 60_000;

/** Adresszusatz `k=q` (QR-Code) und `k=l` (Link); alles andere und fehlend heißt „direkt“ (@RZ-024). */
export function channelFromParam(value: string | null | undefined): ViewChannel {
  if (value === 'q') {
    return 'qr';
  }
  return value === 'l' ? 'link' : 'direkt';
}

/** Hauptbedienung des Geräts: Maus/Touchpad (fein), Finger (grob) oder keines von beiden / nicht lesbar. */
export type PointerKind = 'fine' | 'coarse' | 'unknown';

/**
 * Geräteart aus der Hauptbedienung und der KÜRZEREN Bildschirmseite (nicht aus der Fensterbreite: ein Handy im Querformat bleibt
 * ein Handy, ein iPad quer ein Tablet). Reihenfolge: 1. Feiner Zeiger (Maus/Touchpad) → groß – auch wenn ein Windows-Laptop bei
 * 150–200 % Skalierung nur 853×533 oder 960×540 meldet. 2. Sonst kürzere Seite unter dem Breakpoint `sheet` (600 px) → Handy
 * (iPhone 390×844, großes Android 412×915). 3. Sonst Finger als Hauptbedienung → Tablet (iPad 768×1024, 820×1180).
 * 4. Sonst (weder fein noch grob, z. B. Fernseher oder Kiosk) → groß, denn ein Gerät ohne Touch ist kein Tablet.
 */
export function deviceClassFromScreen(shortSidePx: number, pointer: PointerKind): DeviceClass {
  if (pointer === 'fine') {
    return 'gross';
  }
  if (shortSidePx < breakpointValues.sheet) {
    return 'handy';
  }
  return pointer === 'coarse' ? 'tablet' : 'gross';
}

export interface DeviceEnvironment {
  /** `screen.width` / `screen.height` (oder Ersatz: Fenstermaße); nicht lesbar = weglassen */
  screenWidth?: number;
  screenHeight?: number;
  matchMedia?: (query: string) => { matches: boolean };
}

function pointerKind(matchMedia: DeviceEnvironment['matchMedia']): PointerKind {
  try {
    if (matchMedia?.('(pointer: fine)').matches === true) {
      return 'fine';
    }
    return matchMedia?.('(pointer: coarse)').matches === true ? 'coarse' : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Liest nur die Bedienart (fein/grob) und die kürzere Bildschirmseite; sonst nichts vom Gerät (@RZ-027). Unlesbar → groß. */
export function deviceClassFromEnvironment(env: DeviceEnvironment): DeviceClass {
  const sides = [env.screenWidth, env.screenHeight].filter((v): v is number => typeof v === 'number' && v > 0);
  if (sides.length === 0) {
    return 'gross';
  }
  return deviceClassFromScreen(Math.min(...sides), pointerKind(env.matchMedia));
}

export interface DisplayModeEnvironment {
  matchMedia?: (query: string) => { matches: boolean };
  /** iOS: `navigator.standalone` */
  navigatorStandalone?: boolean;
}

/** „Vom Startbildschirm geöffnet“: Anzeigeart standalone oder iOS `navigator.standalone`. */
export function isInstalledApp(env: DisplayModeEnvironment): boolean {
  if (env.navigatorStandalone === true) {
    return true;
  }
  try {
    return env.matchMedia?.('(display-mode: standalone)').matches === true;
  } catch {
    return false;
  }
}

/**
 * Sendet eine Zählmeldung. Wirft nie, gibt nie einen Fehler zurück, wiederholt nie und meldet nichts (@RZ-026): ein Fehler,
 * eine Absage des Servers oder fehlende Antwort nach `timeoutMs` ändern nichts an der Seite.
 */
export async function sendViewCount(
  transport: ViewCountTransport,
  args: ViewCountArgs,
  timeoutMs: number = VIEW_COUNT_TIMEOUT_MS,
): Promise<void> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve();
    }, timeoutMs);
  });
  try {
    await Promise.race([transport(args, controller.signal).then(() => undefined), timeout]);
  } catch {
    // verschluckt: die Zählung darf die Seite nie stören
  } finally {
    clearTimeout(timer);
  }
}
