/**
 * Echte Verdrahtung für den Start auf einem Helfer-Gerät (A-17c): Sitzung lesen (legt nie eine an) und Zugangsstatus holen.
 * Dazu der Merker „Entscheidung schon getroffen“, damit ein bewusster Weg zur Startseite („Meine Turniere auf diesem Handy“,
 * „Zur Startseite“ der Auswahl und der Endkarten) nicht von der Weiche zurückgeleitet wird (@HE-096, @HE-110).
 * Wer ihn geht, ruft vorher `markHelperStartHandled`.
 */
import { readSessionInfo } from '../../core/auth/deviceSession';
import { callHelperAccessStatus } from '../../core/repositories/helperAccessRpc';
import { supabase } from '../../lib/supabase';
import type { HelperStartContextDeps } from './helperStartContext';

let startHandled = false;

export function isHelperStartHandled(): boolean {
  return startHandled;
}

export function markHelperStartHandled(): void {
  startHandled = true;
}

/**
 * Die Start-Weiche entscheidet nur, wenn die Startseite `/` die ERSTE Adresse des Seitenaufrufs ist (@HE-096). Öffnet der
 * Seitenaufruf zuerst etwas anderes (Feld per QR/Link, `/join/…`, `/helfer`, Spielplan), ist die Entscheidung damit getroffen:
 * Jeder spätere Weg zur Startseite (Kopf-Pfeil, Fehlerseite, Browser-Zurück, Logo) ist bewusst und wird nicht zurückgeleitet (@HE-110).
 * `hash` ist `window.location.hash` beim Start (die App routet über den Hash).
 */
export function noteHelperStartEntry(hash: string): void {
  const route = hash.replace(/^#/, '').split('?')[0];
  if (route !== '' && route !== '/') {
    startHandled = true;
  }
}

/** Nur für Tests: die Entscheidung gilt wieder als offen. */
export function resetHelperStart(): void {
  startHandled = false;
}

export function defaultHelperStartDeps(): HelperStartContextDeps {
  return {
    readSession: () => readSessionInfo(supabase?.auth ?? null),
    fetchStatus: (tournamentId) => callHelperAccessStatus(supabase, tournamentId),
  };
}
