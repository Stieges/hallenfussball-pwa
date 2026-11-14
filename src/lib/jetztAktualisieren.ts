/**
 * Taste „Jetzt aktualisieren“ am Hinweis „App aktualisieren“ (@OB-087): nur die vorhandenen Funktionen des Neulade-Wegs
 * (`getReloadGate`, `requestUrgentReload`), kein neuer Mechanismus am Service Worker.
 *
 * - `'laedt'`: der Eilpfad ist angestoßen. Liegt die neue Fassung schon bereit, lädt die App sofort neu; sonst wird sie
 *   gesucht (2-Minuten-Fenster) und lädt, sobald sie da ist. Bis dahin zeigt der Hinweis die Arbeitsanzeige.
 * - `'blockiert'`: ein Halter des Tors (Gerät ist bereiter Hallen-Lautsprecher) sagt nein, ein Neuladen nähme den Ton.
 *   Es wird nichts angestoßen; der Hinweis sagt, warum.
 */
import { requestUrgentReload } from './swRegistration';
import { getReloadGate } from './swSetupSlots';

export type AktualisierenErgebnis = 'laedt' | 'blockiert';

export function aktualisiereJetzt(): AktualisierenErgebnis {
  if (getReloadGate()?.urgentBlocked?.() === true) {
    return 'blockiert';
  }
  requestUrgentReload();
  return 'laedt';
}
