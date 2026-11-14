/**
 * Was dieses Gerät ist (H4-9): Handy? (@HT-021, Hinweis ohne Sperre), eigenständige App? (@HT-043, Schritt „App installieren“), zuletzt
 * benutzter Gerätename (vorbelegt, damit am Handy kein Name getippt werden muss). Alles lesend, nichts wirft.
 */
import { isStandaloneDisplay } from '../../helpers/homeHint';
import { browserKanalSpeicher } from '../runtime/lautsprecherKanal';
import { lies, schreib } from '../runtime/tonEinstellungen';

export const GERAETENAME_SCHLUESSEL = 'hallenton:geraetename';

/** Ein Handy: das Gerät meldet „mobil“ (Chromium) oder die Kennung nennt ein Handy. Tablets und Rechner gelten nicht als Handy. */
export function istHandy(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const mobil = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;
  return mobil ?? /iPhone|iPod|Android.+Mobile|Mobile.+Android|Windows Phone/i.test(navigator.userAgent);
}

export function laeuftAlsApp(): boolean {
  return isStandaloneDisplay();
}

export function gespeicherterGeraetename(): string | null {
  const name = lies(browserKanalSpeicher(), GERAETENAME_SCHLUESSEL)?.trim();
  return name === undefined || name === '' ? null : name;
}

export function speichereGeraetename(name: string): void {
  schreib(browserKanalSpeicher(), GERAETENAME_SCHLUESSEL, name);
}
