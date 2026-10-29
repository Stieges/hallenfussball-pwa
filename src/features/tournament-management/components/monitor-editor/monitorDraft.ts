/**
 * Entwurf des Monitor-Editors (@ME-071): reine Funktionen, ohne React. Jede Funktion liefert einen neuen
 * Entwurf; der gespeicherte Monitor wird nie verändert.
 */

import type { MonitorSlide, SlideConfig, SlideType, TournamentMonitor } from '../../../../types/monitor';
import { DEFAULT_SLIDE_CONFIG } from '../../../../types/monitor';
import { generateSlideId } from '../../../../hooks/useMonitors';

export type MonitorSettingsUpdate = Partial<
  Pick<
    TournamentMonitor,
    'name' | 'defaultSlideDuration' | 'transition' | 'transitionDuration' | 'performanceMode' | 'theme' | 'overscanPercent'
  >
>;

export type SlideUpdate = { config?: Partial<SlideConfig>; duration?: number | null };

const renumber = (slides: MonitorSlide[]): MonitorSlide[] => slides.map((s, idx) => ({ ...s, order: idx }));

export function addSlideToDraft(
  draft: TournamentMonitor,
  type: SlideType,
  config?: Partial<SlideConfig>
): { draft: TournamentMonitor; slide: MonitorSlide } {
  const slide: MonitorSlide = {
    id: generateSlideId(),
    type,
    config: { ...DEFAULT_SLIDE_CONFIG, ...config },
    duration: null,
    order: draft.slides.length,
  };
  return { draft: { ...draft, slides: [...draft.slides, slide] }, slide };
}

export function updateSlideInDraft(draft: TournamentMonitor, slideId: string, updates: SlideUpdate): TournamentMonitor {
  return {
    ...draft,
    slides: draft.slides.map(s =>
      s.id !== slideId
        ? s
        : {
            ...s,
            config: updates.config !== undefined ? { ...s.config, ...updates.config } : s.config,
            duration: updates.duration !== undefined ? updates.duration : s.duration,
          }
    ),
  };
}

export function removeSlideFromDraft(draft: TournamentMonitor, slideId: string): TournamentMonitor {
  return { ...draft, slides: renumber(draft.slides.filter(s => s.id !== slideId)) };
}

export function moveSlideInDraft(draft: TournamentMonitor, slideId: string, direction: 'up' | 'down'): TournamentMonitor {
  const from = draft.slides.findIndex(s => s.id === slideId);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= draft.slides.length) {
    return draft;
  }
  const slides = [...draft.slides];
  [slides[from], slides[to]] = [slides[to], slides[from]];
  return { ...draft, slides: renumber(slides) };
}

/** Einstellungen übernehmen; der Name bleibt ungetrimmt (getrimmt wird erst beim Speichern). */
export function updateSettingsInDraft(draft: TournamentMonitor, updates: MonitorSettingsUpdate): TournamentMonitor {
  return { ...draft, ...updates };
}

/** Unterscheidet sich der Entwurf vom gespeicherten Monitor (ohne `updatedAt`, ohne `order`-Nummerierung)? */
export function isDraftDirty(original: TournamentMonitor, draft: TournamentMonitor): boolean {
  const normalize = (m: TournamentMonitor): string =>
    JSON.stringify({ ...m, updatedAt: '', slides: renumber(m.slides) });
  return normalize(original) !== normalize(draft);
}
