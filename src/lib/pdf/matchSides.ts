/**
 * Ein-Stellen-Regel für die Anzeige einer Spielseite im PDF (B-28a1).
 *
 * Nur diese Datei liest `homeTeam`/`awayTeam`/`originalTeam` aus dem Spiel. Rohschlüssel der Herkunft (`group-a-2nd`,
 * `semi1-winner`) werden hier zu Klartext (B-28 C4, `origin.ts`); B-35 kann diese eine Stelle auf `slotLabel` umstellen,
 * die Render-Dateien bleiben unverändert.
 */
import type { ScheduledMatch } from '../../core/generators';
import { originLabel } from './origin';
import type { PdfTexts } from './translations';

/** Kontext der Spielseiten. `hidePendingOrigin` ist für B-35 vorbereitet und heute ohne Wirkung. */
export interface PdfSideContext {
  hidePendingOrigin?: boolean;
  /** Texte des Dokuments: ohne sie bleibt die Herkunft, wie der Generator sie liefert. */
  t?: PdfTexts;
}

/** Anzeige der Seite `A` (Heim) oder `B` (Gast) eines Spiels. */
export function sideLabel(match: ScheduledMatch, side: 'A' | 'B', ctx: PdfSideContext = {}): string {
  const raw = side === 'A' ? match.homeTeam : match.awayTeam;
  return ctx.t ? originLabel(raw, ctx.t) : raw;
}
