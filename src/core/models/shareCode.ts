/**
 * Freigabe-Code (Share-Code): 6 Zeichen aus der Zeichenmenge des Servers (Funktion `generate_share_code`,
 * Migration 20260128_003), ohne 0, O, 1, I -- vorlesbar und eintippbar (@BM-071).
 * Reine Logik ohne Browser-Bezug; die Zufallsquelle wird übergeben (Tests, window.crypto in utils/shareCode.ts).
 */

/** Wörtlich die Zeichenmenge aus `generate_share_code` (Parität per Test geprüft). */
export const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const SHARE_CODE_LENGTH = 6;

/** Erzeugt einen Code. `random` liefert Zahlen in [0, 1) wie `Math.random`. */
export function generateShareCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    code += SHARE_CODE_ALPHABET.charAt(Math.floor(random() * SHARE_CODE_ALPHABET.length));
  }
  return code;
}
