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
 * Teilen-Links (`<Ursprung>/#/live/<Code>`; ohne `baseUrl` der Ursprung der App), nie `/join`, `/display/` oder `/tv`.
 */
export function viewerUrl(tournament: Pick<Tournament, 'isPublic' | 'shareCode'>, baseUrl?: string): string | null {
  const code = tournament.shareCode;
  if (tournament.isPublic !== true || code === undefined || code === '') {
    return null;
  }
  return generateLiveUrl(code, baseUrl);
}

/** Module des QR-Codes als Zeilen von Wahrheitswerten (`true` = dunkles Modul). */
export function qrModules(url: string): boolean[][] {
  const { modules } = QRCode.create(url, {});
  return Array.from({ length: modules.size }, (_, row) => Array.from({ length: modules.size }, (_, col) => Boolean(modules.get(row, col))));
}

/**
 * Kurzadresse zum Abtippen (B-28 C7, @DR-010, F-N4): die Zuschauer-Adresse ohne `https://`, mit dem `#` des Links. Sie
 * führt zur selben Adresse wie der QR (`https://` + Kurzadresse = QR-Inhalt); ein Pfad ohne `#` ist nicht geroutet.
 */
export function shortViewerAddress(url: string): string {
  return url.replace(/^https?:\/\//, '');
}
