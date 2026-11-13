/**
 * Rücksprung nach der Anmeldung (H4-9, @HT-026): Wer auf einem zweiten Rechner die Adresse des Unterpunkts „Hallenton“ öffnet und noch nicht
 * angemeldet ist, meldet sich an und landet danach im selben Unterpunkt statt auf der Startseite – bei Passwort, Google und Magic-Link
 * (Magic-Link öffnet meist einen neuen Tab, darum liegt der Merker im `localStorage` und gilt `RUECKKEHR_FRIST_MS` = 15 Minuten).
 * Angenommen werden nur Adressen des Admin-Centers (kein offener Weiterleiter: nichts von außen, kein anderer Ursprung); sonst bleibt es bei
 * der Startseite. Der Merker wird beim Lesen gelöscht. Nichts wirft.
 */
import { matchRoute } from '../../../core/routing';

export const RUECKKEHR_SCHLUESSEL = 'loginRueckkehr';
export const RUECKKEHR_FRIST_MS = 15 * 60 * 1000;

type KurzSpeicher = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function speicher(): KurzSpeicher | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Eine eigene Adresse des Admin-Centers (`/tournament/:id/admin[/:kategorie]`), nichts anderes. */
export function istRueckkehrZiel(pfad: string): boolean {
  return pfad.startsWith('/') && !pfad.startsWith('//') && !pfad.includes('\\') && matchRoute(pfad)?.name === 'admin';
}

/** Merkt die Adresse für den Rückweg nach der Anmeldung; andere Adressen werden nicht gemerkt. */
export function merkeRueckkehr(pfad: string): void {
  if (!istRueckkehrZiel(pfad)) {
    return;
  }
  try {
    speicher()?.setItem(RUECKKEHR_SCHLUESSEL, JSON.stringify({ pfad, bis: Date.now() + RUECKKEHR_FRIST_MS }));
  } catch {
    // gesperrt: nach der Anmeldung geht es zur Startseite
  }
}

/** Die gemerkte Adresse (und löscht sie); `null`, wenn keine, eine abgelaufene oder eine unzulässige gemerkt ist. */
export function holeRueckkehr(): string | null {
  const s = speicher();
  try {
    const roh = s?.getItem(RUECKKEHR_SCHLUESSEL) ?? null;
    s?.removeItem(RUECKKEHR_SCHLUESSEL);
    const eintrag = roh === null ? null : (JSON.parse(roh) as { pfad?: unknown; bis?: unknown } | null);
    if (typeof eintrag?.pfad !== 'string' || typeof eintrag.bis !== 'number' || eintrag.bis < Date.now()) {
      return null;
    }
    return istRueckkehrZiel(eintrag.pfad) ? eintrag.pfad : null;
  } catch {
    return null;
  }
}
