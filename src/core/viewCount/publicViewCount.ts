/**
 * Zuschauer-Seite zählen (intern, Stufe 1; @RZ-024 bis @RZ-030, docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md).
 * Reine Logik ohne React und ohne Netz: Kanal aus dem Adresszusatz, Geräteart aus der kürzeren Bildschirmseite und dem Zeiger, „installiert“ aus der
 * Anzeigeart und das Versenden einer Zählmeldung, das nie stört (Fehler und Zeitüberschreitung werden verschluckt, kein Wiederholen).
 * Gesendet werden nur diese fünf Felder (die Server-Funktion `count_public_view`); nichts davon liegt auf dem Gerät.
 */
import { breakpointValues } from '../../design-tokens/breakpoints';

export type ViewChannel = 'qr' | 'link' | 'direkt';
export type DeviceClass = 'handy' | 'tablet' | 'gross';
export type ViewCountKind = 'aufruf' | 'lebenszeichen';

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

/**
 * Geräteart aus der KÜRZEREN Bildschirmseite und der Hauptbedienung (nicht aus der Fensterbreite: ein Handy im Querformat bleibt
 * ein Handy, ein iPad quer ein Tablet). Handy = kürzere Seite unter dem Breakpoint `sheet` (600 px; iPhone 390×844, großes
 * Android 412×915). Darüber: Tablet, wenn ein grober Zeiger (Finger) die Hauptbedienung ist (iPad 768×1024 und 820×1180);
 * sonst groß (Laptop 1280×720 oder 1366×768 mit Maus/Touchpad, auch wenn die kürzere Seite über 600 liegt).
 */
export function deviceClassFromScreen(shortSidePx: number, coarsePointer: boolean): DeviceClass {
  if (shortSidePx < breakpointValues.sheet) {
    return 'handy';
  }
  return coarsePointer ? 'tablet' : 'gross';
}

export interface DeviceEnvironment {
  /** `screen.width` / `screen.height` (oder Ersatz: Fenstermaße); nicht lesbar = weglassen */
  screenWidth?: number;
  screenHeight?: number;
  matchMedia?: (query: string) => { matches: boolean };
}

function hasCoarsePointer(matchMedia: DeviceEnvironment['matchMedia']): boolean {
  try {
    return matchMedia?.('(pointer: coarse)').matches === true;
  } catch {
    return false;
  }
}

/** Liest nur die kürzere Bildschirmseite und „Finger als Hauptbedienung“; sonst nichts vom Gerät (@RZ-027). Unlesbar → groß. */
export function deviceClassFromEnvironment(env: DeviceEnvironment): DeviceClass {
  const sides = [env.screenWidth, env.screenHeight].filter((v): v is number => typeof v === 'number' && v > 0);
  if (sides.length === 0) {
    return 'gross';
  }
  return deviceClassFromScreen(Math.min(...sides), hasCoarsePointer(env.matchMedia));
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
