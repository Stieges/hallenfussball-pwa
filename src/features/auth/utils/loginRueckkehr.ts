/**
 * Rücksprung nach der Anmeldung (H4-9, @HT-026): Wer auf einem zweiten Rechner die Adresse des Unterpunkts „Hallenton“ öffnet und noch nicht
 * angemeldet ist, meldet sich an und landet danach im selben Unterpunkt statt auf der Startseite. Die Adresse wird nur für die Dauer der
 * Anmeldung im Tab gemerkt (`sessionStorage`) und beim Lesen gelöscht. Angenommen werden nur Adressen des Admin-Centers (kein offener
 * Weiterleiter: nichts von außen, kein anderer Ursprung); sonst bleibt es bei der Startseite. Nichts wirft.
 */
import { matchRoute } from '../../../core/routing';

export const RUECKKEHR_SCHLUESSEL = 'loginRueckkehr';

type KurzSpeicher = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function speicher(): KurzSpeicher | null {
  try {
    return window.sessionStorage;
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
    speicher()?.setItem(RUECKKEHR_SCHLUESSEL, pfad);
  } catch {
    // gesperrt: nach der Anmeldung geht es zur Startseite
  }
}

/** Die gemerkte Adresse (und löscht sie); `null`, wenn keine oder eine unzulässige gemerkt ist. */
export function holeRueckkehr(): string | null {
  const s = speicher();
  try {
    const pfad = s?.getItem(RUECKKEHR_SCHLUESSEL) ?? null;
    s?.removeItem(RUECKKEHR_SCHLUESSEL);
    return pfad !== null && istRueckkehrZiel(pfad) ? pfad : null;
  } catch {
    return null;
  }
}
