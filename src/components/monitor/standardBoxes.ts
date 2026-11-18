/**
 * Kästen ohne Ansicht (z. B. Vorschau): keine Seite trägt eine Farbe, also Standardfarben Heim/Gast (@ZM-159 Fall A).
 * Eine Quelle für die Live-Folie (`LiveMatchDisplay`) und das Profil „Halle (sehr fern)“ (`HallMatchDisplay`).
 */
import { DEFAULT_SPECTATOR_DISPLAY } from '../../core/models/spectatorDisplay';
import { resolveBoxColors } from '../../core/models/scoreBoxColors';
import type { MatchView } from '../../core/view';

export function standardBoxes(): NonNullable<MatchView['boxes']> {
  const { a, b } = resolveBoxColors({ worn: {}, settings: DEFAULT_SPECTATOR_DISPLAY });
  return { home: a, away: b };
}
