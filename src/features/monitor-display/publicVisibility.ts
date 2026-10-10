/**
 * Öffentliche Sichtbarkeit am Monitor (B-16e2, @W2A-031, @ZM-090, @ZM-118).
 *
 * Ist „Ergebnisse ausblenden“ gesetzt (Kindermodus), zeigt der Monitor keine wertenden Inhalte:
 * keine Tabellen-Folien, keine Tor- und Karten-Einblendung, keine Stände. Rein, ohne React.
 * Muster: src/features/public-view/publicScheduleFilters.ts (B-13e).
 */
import type { Tournament } from '../../types/tournament';
import type { MonitorSlide } from '../../types/monitor';
import { generateLiveUrl } from '../../utils/shareUtils';

type SichtbarkeitsTurnier = Pick<Tournament, 'hideScoresForPublic' | 'isPublic' | 'shareCode'>;

/** Folien-Typen, die Ergebnisse oder Tabellen zeigen; bei ausgeblendeten Ergebnissen nie zeigbar. */
const WERTENDE_FOLIEN: ReadonlySet<string> = new Set(['standings']);

/** Stände und Ergebnisse sind öffentlich, wenn die Turnierleitung sie nicht ausgeblendet hat. */
export function scoresPublic(turnier: Pick<SichtbarkeitsTurnier, 'hideScoresForPublic'> | null | undefined): boolean {
  return turnier?.hideScoresForPublic !== true;
}

/** Darf die Folie am Monitor erscheinen? Wertende Folien nur bei öffentlichen Ergebnissen. */
export function isSlideShowable(
  slide: Pick<MonitorSlide, 'type'>,
  turnier: Pick<SichtbarkeitsTurnier, 'hideScoresForPublic'> | null | undefined,
): boolean {
  return !WERTENDE_FOLIEN.has(slide.type) || scoresPublic(turnier);
}

/**
 * Zuschauer-Adresse für QR-Codes (F-03): nur bei öffentlichem Turnier mit Share-Code, sonst null.
 * Nie die Verwaltungs-Adresse.
 */
export function zuschauerUrl(turnier: Pick<SichtbarkeitsTurnier, 'isPublic' | 'shareCode'> | null | undefined): string | null {
  const shareCode = turnier?.shareCode;
  return turnier?.isPublic === true && typeof shareCode === 'string' && shareCode.length > 0
    ? generateLiveUrl(shareCode)
    : null;
}
