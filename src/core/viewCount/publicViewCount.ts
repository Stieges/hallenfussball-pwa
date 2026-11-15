/**
 * Zuschauer-Seite zählen (intern, Stufe 1; @RZ-024 bis @RZ-030, docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md).
 * Reine Logik ohne React und ohne Netz: Kanal aus dem Adresszusatz, Geräteart aus der Fensterbreite, „installiert“ aus der
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

/** Geräteart nach den Breakpoints der Oberfläche: unter Tablet = Handy, unter Desktop = Tablet, sonst groß. */
export function deviceClassFromWidth(widthPx: number): DeviceClass {
  if (widthPx < breakpointValues.tablet) {
    return 'handy';
  }
  return widthPx < breakpointValues.desktop ? 'tablet' : 'gross';
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
