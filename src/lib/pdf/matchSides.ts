/**
 * Ein-Stellen-Regel für die Anzeige einer Spielseite im PDF (B-28a1).
 *
 * Nur diese Datei liest `homeTeam`/`awayTeam`/`originalTeam` aus dem Spiel. B-35 stellt diese eine Stelle auf
 * `slotLabel` um, die Render-Dateien bleiben unverändert.
 */
import type { ScheduledMatch } from '../../core/generators';

/** Kontext der Spielseiten. `hidePendingOrigin` ist für B-35 vorbereitet und heute ohne Wirkung. */
export interface PdfSideContext {
  hidePendingOrigin?: boolean;
}

/** Anzeige der Seite `A` (Heim) oder `B` (Gast) eines Spiels. */
export function sideLabel(match: ScheduledMatch, side: 'A' | 'B', _ctx: PdfSideContext = {}): string {
  return side === 'A' ? match.homeTeam : match.awayTeam;
}
