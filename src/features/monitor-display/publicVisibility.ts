/**
 * Öffentliche Sichtbarkeit am Monitor (B-16e2, @W2A-031, @ZM-090, @ZM-118).
 *
 * Ist „Ergebnisse ausblenden“ (Kindermodus) oder „Gruppentabellen aus“ gesetzt, zeigt der Monitor keine wertenden
 * Inhalte: keine Tabellen-Folien (A-36c: Regeln aus `viewRules`, eine Quelle). Rein, ohne React.
 * Muster: src/features/public-view/publicScheduleFilters.ts (B-13e).
 */
import type { Tournament } from '../../types/tournament';
import type { ViewRules } from '../../core/view';
import type { MonitorSlide } from '../../types/monitor';
import { generateLiveUrl } from '../../utils/shareUtils';

type SichtbarkeitsTurnier = Pick<Tournament, 'hideScoresForPublic' | 'isPublic' | 'shareCode'>;

/** Folien-Typen, die Ergebnisse oder Tabellen zeigen; bei ausgeblendeten Ergebnissen nie zeigbar. */
const WERTENDE_FOLIEN: ReadonlySet<string> = new Set(['standings', 'all-standings']);

/**
 * Darf die Folie am Monitor erscheinen? Tabellen- und Finalrunden-Folien nur, wenn die Regeln der Ansicht Tabellen
 * zeigen (`rules.tables`): im Kindermodus UND bei ausgeschalteten Gruppentabellen nie (@ZM-005, W10).
 */
export function isSlideShowable(slide: Pick<MonitorSlide, 'type'>, rules: Pick<ViewRules, 'tables'>): boolean {
  return !WERTENDE_FOLIEN.has(slide.type) || rules.tables;
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
