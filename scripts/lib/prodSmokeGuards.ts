/**
 * Schutzriegel des Produktions-Rauchtests (@RT-007, @RT-008). Reine Funktionen, damit sie ohne Browser prüfbar sind.
 */

/** Letzter Tag, an dem E2E gegen die Produktion erlaubt ist (Freigabe Daniel 2026-10-22). */
export const FREIGABE_BIS_UTC = '2026-11-15';

export const ABGELAUFEN_MELDUNG = 'Rauchtest gegen Produktion abgelaufen (Freigabe bis 15.11.)';

/** Die Produktion und ihre Vercel-Vorschau-Adressen; nur dorthin gehen Zugangsdaten. */
const ERLAUBTE_ADRESSE = /^https:\/\/hallenfussball-pwa(-[a-z0-9-]+)?\.vercel\.app\/?$/;

/** Wirft die Abgelaufen-Meldung, sobald `jetzt` (UTC) nach dem letzten Freigabetag liegt. */
export function pruefeFrist(jetzt: Date = new Date()): void {
  if (jetzt.toISOString().slice(0, 10) > FREIGABE_BIS_UTC) {
    throw new Error(ABGELAUFEN_MELDUNG);
  }
}

/** Wirft, wenn `adresse` nicht die Produktion (oder eine ihrer Vorschauen) ist. */
export function pruefeAdresse(adresse: string): void {
  if (!ERLAUBTE_ADRESSE.test(adresse)) {
    throw new Error(`Adresse nicht erlaubt (nur https://hallenfussball-pwa*.vercel.app): ${adresse}`);
  }
}
