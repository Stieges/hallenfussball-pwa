/**
 * Rücksprung nach der Anmeldung (H4-9, @HT-026): Wer auf einem zweiten Rechner die Adresse des Unterpunkts „Hallenton“ öffnet und noch nicht
 * angemeldet ist, meldet sich an und landet danach im selben Unterpunkt statt auf der Startseite – bei Passwort, Google und Magic-Link
 * (Magic-Link öffnet meist einen neuen Tab, darum liegt der Merker im `localStorage` und gilt `RUECKKEHR_FRIST_MS` = 15 Minuten).
 * Angenommen werden nur Adressen des Admin-Centers und – seit @OB-087 („Anmelden“ im Cockpit) – das Cockpit eines Turniers
 * (`/tournament/:id/live`, dazu höchstens `?f=<Feld>` und `?matchId=<Spiel>`, sonst nichts); kein offener Weiterleiter: nichts von außen, kein
 * anderer Ursprung; sonst bleibt es bei der Startseite. Der Merker wird beim Lesen gelöscht. Nichts wirft.
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

const FELD_ZIFFERN = /^\d{1,3}$/;
const KENNUNG = /^[A-Za-z0-9_-]{1,64}$/;

/** Die Suche des Cockpits: nur `f` (Feldnummer) und `matchId`, je höchstens einmal, mit engem Wert. */
function cockpitSucheErlaubt(suche: string): boolean {
  if (suche === '') {
    return true;
  }
  const gesehen = new Set<string>();
  for (const teil of suche.split('&')) {
    const [name, wert, ...rest] = teil.split('=');
    const pruefung = name === 'f' ? FELD_ZIFFERN : name === 'matchId' ? KENNUNG : null;
    if (rest.length > 0 || pruefung === null || gesehen.has(name) || wert === undefined || !pruefung.test(wert)) {
      return false;
    }
    gesehen.add(name);
  }
  return true;
}

/**
 * Eine eigene Adresse des Admin-Centers (`/tournament/:id/admin[/:kategorie]`) oder das Cockpit eines Turniers
 * (`/tournament/:id/live[?f=N][&matchId=…]`), nichts anderes.
 */
export function istRueckkehrZiel(pfad: string): boolean {
  if (!pfad.startsWith('/') || pfad.startsWith('//') || pfad.includes('\\') || pfad.includes('#')) {
    return false;
  }
  const [basis, suche, ...rest] = pfad.split('?');
  if (rest.length > 0) {
    return false;
  }
  const route = matchRoute(basis);
  if (route?.name === 'admin') {
    return suche === undefined;
  }
  return route?.name === 'tournament' && route.params.tab === 'live' && cockpitSucheErlaubt(suche ?? '');
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

/**
 * Vergisst den gemerkten Rückweg: beim Abmelden und beim Wechsel auf ein anderes Konto (@OB-087). Er gehört zum Konto, das ihn gemerkt hat – ein
 * anderes Konto soll nicht in dessen Cockpit landen. Nichts wirft.
 */
export function loescheRueckkehr(): void {
  try {
    speicher()?.removeItem(RUECKKEHR_SCHLUESSEL);
  } catch {
    // gesperrt: nichts zu löschen
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
