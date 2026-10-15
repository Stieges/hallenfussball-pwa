/**
 * Zuschauer-QR (B-28 C4, @BM-043, @ZM-064): die Adresse und die Modul-Matrix für den Vektor-QR im Spielplan-PDF.
 * Rein, ohne Dokument und ohne DOM; die Zeichnung steht in `lib/pdf/render/qrCode.ts`.
 */
import QRCode from 'qrcode';
import type { Tournament } from '../../types/tournament';
import { generateLiveUrl } from '../../utils/shareUtils';

/**
 * Adresse der Zuschauer-Seite, nur wenn das Turnier online geteilt ist (Schalter an und Share-Code vorhanden).
 * Sonst `null`: dann gibt es keinen QR und keine Platzhalterfläche (@ZM-064). Nie eine andere Adresse als die des
 * Teilen-Links (`/live/<Code>`), nie `/join`, `/display/` oder `/tv`.
 */
export function viewerUrl(tournament: Pick<Tournament, 'isPublic' | 'shareCode'>): string | null {
  const code = tournament.shareCode;
  if (tournament.isPublic !== true || code === undefined || code === '') {
    return null;
  }
  return generateLiveUrl(code);
}

/** Module des QR-Codes als Zeilen von Wahrheitswerten (`true` = dunkles Modul). */
export function qrModules(url: string): boolean[][] {
  const { modules } = QRCode.create(url, {});
  return Array.from({ length: modules.size }, (_, row) => Array.from({ length: modules.size }, (_, col) => Boolean(modules.get(row, col))));
}
