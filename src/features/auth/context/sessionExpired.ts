/**
 * Abgelaufene Anmeldung (Anmelden Ü1.2 „Nie still abmelden“, Wortlaut @AN-021).
 *
 * Sagt der Server, dass der Erneuerungsschlüssel nicht mehr gilt, meldet die App lokal ab und sagt
 * das klar: „Deine Anmeldung ist abgelaufen – bitte melde dich neu an“. Der Merker liegt in
 * sessionStorage (wie der Hinweis „von einem anderen Gerät abgemeldet“) und wird mit der nächsten
 * Anmeldung gelöscht. Gesetzt wird er nur bei einer Serverantwort, nie bei Zeitüberschreitung,
 * Netzfehler oder Abmelden durch den Nutzer.
 */

import { safeSessionStorage } from '../../../core/utils/safeStorage';
import { clearSignedOutElsewhere } from './remoteSignOut';

export const SESSION_EXPIRED_KEY = 'auth:sessionExpired';
/** window-Ereignis, sobald sich der Hinweis ändert (die Meldung im App-Baum liest ihn neu). */
export const SESSION_EXPIRED_CHANGED = 'auth:sessionExpiredChanged';

function notifyChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_CHANGED));
  }
}

export function hasSessionExpired(): boolean {
  return safeSessionStorage.getItem(SESSION_EXPIRED_KEY) === '1';
}

export function setSessionExpired(): void {
  // Das lokale Abmelden danach ist kein „anderes Gerät“: ein schon gesetzter Hinweis dazu weicht.
  clearSignedOutElsewhere();
  safeSessionStorage.setItem(SESSION_EXPIRED_KEY, '1');
  notifyChanged();
}

export function clearSessionExpired(): void {
  safeSessionStorage.removeItem(SESSION_EXPIRED_KEY);
  notifyChanged();
}
