/**
 * Echte Verdrahtung für den Start auf einem Helfer-Gerät (A-17c): Sitzung lesen (legt nie eine an) und Zugangsstatus holen.
 * Dazu der Merker „Entscheidung schon getroffen“, damit „Zur Startseite“ nicht wieder ans Feld zurückführt (@HE-096).
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
