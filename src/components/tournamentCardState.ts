/**
 * Zustand der Turnierkarte (@OB-079, @LZ-001): Das Zustandswort steht nur, wenn es vom Normalfall „Bereit“ abweicht
 * („Läuft“, „Abgeschlossen“, „Abgebrochen“), mit Symbol und Wort (`StateMark`, Farbe nie allein). Ein Entwurf steht im eigenen
 * Abschnitt „Gespeicherte Entwürfe“ und braucht auf der Karte kein Wort. Rein, ohne React.
 */
import { lifecycleOf } from '../core/services/lifecycle';
import type { Tournament } from '../types/tournament';
import type { StateMarkSymbol, StateMarkTone } from './ui/molecules/StateMark';

export type CardState = 'ready' | 'running' | 'finished' | 'cancelled' | 'draft';

/** Zustand aus dem Turnier und dem Abschnitt, in dem die Karte steht (`archived` = abgeschlossen oder abgebrochen). */
export function cardStateOf(tournament: Tournament, categoryLabel?: string): CardState {
  if (tournament.status === 'draft') { return 'draft'; }
  if (categoryLabel === 'running') { return 'running'; }
  if (categoryLabel === 'archived') { return lifecycleOf(tournament) === 'cancelled' ? 'cancelled' : 'finished'; }
  if (categoryLabel === 'finished') { return 'finished'; }
  return 'ready';
}

/** Schlüssel (Namensraum dashboard) des Zustandswortes; nur Zustände mit sichtbarer Marke haben eins. */
export const STATE_WORD_KEY = {
  running: 'status.running',
  finished: 'status.finished',
  cancelled: 'status.cancelled',
  draft: 'status.draft',
} as const;

/** Marke je sichtbarem Zustand: Läuft = Spielsymbol (kein Fehler-Rot), Abgeschlossen = Haken, Abgebrochen = Warnzeichen. */
export const STATE_MARK: Record<'running' | 'finished' | 'cancelled', { tone: StateMarkTone; symbol: StateMarkSymbol }> = {
  running: { tone: 'neutral', symbol: 'play' },
  finished: { tone: 'done', symbol: 'check' },
  cancelled: { tone: 'warn', symbol: 'warn' },
};

/** Zustände, deren Wort auf der Karte sichtbar steht (nicht „Bereit“, nicht der Entwurf im eigenen Abschnitt). */
export function hasVisibleStateMark(state: CardState): state is keyof typeof STATE_MARK {
  return state === 'running' || state === 'finished' || state === 'cancelled';
}
