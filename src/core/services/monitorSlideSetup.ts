/**
 * Ist eine Folie eingerichtet? Eine Quelle für Editor (Liste, Rückfrage) und Monitor (Folien überspringen), @ME-076, @ME-077.
 * Ohne React und ohne Übersetzung: Texte wählt der Aufrufer.
 */

import type { MonitorSlide } from '../../types/monitor';

/** Was an einer Folie noch fehlt, damit der Monitor sie zeigen kann */
export type SlideSetupProblem = 'sponsor' | 'headline';

type SlideSetupInput = { type: string; config?: Pick<Partial<MonitorSlide['config']>, 'sponsorId' | 'headline'> };

/**
 * Ist die Folie eingerichtet? `null` = ja. Eine Sponsor-Folie braucht einen vorhandenen Sponsor, „Eigener Text“ eine
 * Überschrift (@ME-076). Ein fehlendes Feld ist kein Problem: der Monitor nimmt dann Feld 1 (@ZM-074); Gruppe ist immer
 * optional („Alle Gruppen“). Ist die Sponsorenliste unbekannt (`undefined`), gilt nur, dass ein Sponsor gewählt ist.
 */
export function slideSetupProblem(slide: SlideSetupInput, sponsors?: readonly { id: string }[]): SlideSetupProblem | null {
  const config = slide.config ?? {};
  switch (slide.type) {
    case 'sponsor':
      return config.sponsorId && (sponsors === undefined || sponsors.some(s => s.id === config.sponsorId)) ? null : 'sponsor';
    case 'custom-text':
      return config.headline?.trim() ? null : 'headline';
    default:
      return null;
  }
}
