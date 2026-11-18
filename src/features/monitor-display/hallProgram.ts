/**
 * Folienprogramm des Profils „Halle (sehr fern)“ (@ZM-212): der Monitor zeigt nur die Live-Folie. Aus dieser Entfernung (rund 22 m) sind
 * Tabellen, Spielpläne und Listen nicht lesbar; sie bleiben in der gespeicherten Folienliste des Monitors (ein Zurückstellen des Profils
 * verliert nichts), werden aber nicht gezeigt. Die Live-Folie bleibt auch zwischen den Spielen stehen und zeigt das nächste Spiel bzw.
 * den Satz „Auf Feld 1 folgt heute kein Spiel mehr“ (`LiveSlide`, nie überspringen, nie Rückfall auf den Spielplan oder den QR-Code).
 */
import type { MonitorSlide } from '../../types/monitor';

/** Id der Live-Folie, die das Profil ergänzt, wenn die gespeicherte Folienliste keine enthält. */
export const HALL_LIVE_SLIDE_ID = 'hall-live-slide';

/**
 * Das Programm des Profils: die erste Live-Folie der Liste (mit ihrem Feld), sonst eine Live-Folie für Feld 1 (@ZM-074: ohne Feld gilt Feld 1).
 * Zwischen den Spielen gilt immer „nächstes Spiel“ (`whenIdle`), das Überspringen der Live-Folie (@ZM-122) entfällt, denn es gibt keine andere Folie.
 */
export function hallProgramSlides(slides: readonly MonitorSlide[]): MonitorSlide[] {
  const live = slides.find((slide) => slide.type === 'live');
  const basis: MonitorSlide = live ?? { id: HALL_LIVE_SLIDE_ID, type: 'live', config: {}, duration: null, order: 0 };
  return [{ ...basis, config: { ...basis.config, whenIdle: { type: 'next-match' } } }];
}
