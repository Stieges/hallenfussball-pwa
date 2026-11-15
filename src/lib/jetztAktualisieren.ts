/**
 * Taste „Jetzt aktualisieren“ am Hinweis „App aktualisieren“ (@OB-087): nur die vorhandenen Funktionen des Neulade-Wegs
 * (`getReloadGate`, `requestUrgentReload`), kein neuer Mechanismus am Service Worker.
 *
 * - `'laedt'`: der Eilpfad ist angestoßen. Liegt die neue Fassung schon bereit, lädt die App sofort neu; sonst wird sie
 *   gesucht (2-Minuten-Fenster) und lädt, sobald sie da ist. Bis dahin zeigt der Hinweis die Arbeitsanzeige.
 * - `'blockiert'`: ein Halter des Tors (Gerät ist bereiter Hallen-Lautsprecher) sagt nein, ein Neuladen nähme den Ton.
 *   Es wird nichts angestoßen; der Hinweis sagt, warum.
 *
 * Frist (`AKTUALISIEREN_FRIST_MS`): findet die App keine neue Fassung, bleibt der Tipp nicht ewig auf „Lade …“. Gewählt sind 60 s, genau die Drossel
 * der Suche auf dem Eilpfad (`URGENT_CHECK_MS` in `swRegistration`): die Suche selbst (Abruf von sw.js, Installation) dauert Sekunden; erst nach
 * 60 s stößt ein neuer Tipp überhaupt wieder eine neue Suche an. Eine kürzere Frist bäte um einen zweiten Tipp, der noch nichts bewirkt; die 2 Minuten
 * des Eilfensters wären unnötig lang für ein Gerät in der Halle. Der Service Worker bleibt unberührt (Frist und Satz liegen in der Taste).
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

/** Wie lange die Taste „Lade …“ zeigt, bevor sie wieder frei wird (siehe Kopf: so lang wie die Drossel der Suche). */
export const AKTUALISIEREN_FRIST_MS = 60_000;

/** Erfüllt sich nach der Frist (nie abgelehnt); lädt die App vorher neu, wird das Ergebnis nie mehr gesehen. */
export function aktualisierenFrist(ms: number = AKTUALISIEREN_FRIST_MS): Promise<void> {
  return new Promise((erfuellt) => { setTimeout(erfuellt, ms); });
}
