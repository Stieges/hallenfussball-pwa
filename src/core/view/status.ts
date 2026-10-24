/**
 * Fachlicher Spielstatus der Ansicht (A-36b, Teilplan A-36 § 2.4, R-A36b-2). Die Engine hat Vorrang vor dem
 * Cache (M4). Die Regel „hat Stand ⇒ beendet“ gibt es nicht (C-ZUSCHAUER-LIVE-ALS-BEENDET, @ZM-039/@ZM-040).
 */
import i18next from 'i18next';
import { MATCH_BADGE_WORD_KEY } from './badge';
import { isForfeitMatch } from '../models/forfeit';
import type { EngineStatus, ViewLocale, ViewMatchStatus, ViewStatusSource } from './types';

const FROM_ENGINE: Record<EngineStatus, ViewMatchStatus> = {
  scheduled: 'scheduled',
  running: 'running',
  shootout: 'running',
  paused: 'paused',
  section_break: 'paused',
  decision_pending: 'paused',
  finished: 'finished',
  skipped: 'cancelled',
};

function fromCache(status: ViewStatusSource['matchStatus']): ViewMatchStatus {
  switch (status) {
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'finished':
      return 'finished';
    case 'skipped':
      return 'cancelled';
    default:
      return 'scheduled'; // scheduled, waiting, fehlt
  }
}

export function viewStatus(match: ViewStatusSource, engine?: EngineStatus): ViewMatchStatus {
  const status = engine === undefined ? fromCache(match.matchStatus) : FROM_ENGINE[engine];
  return status === 'finished' && isForfeitMatch(match) ? 'awarded' : status; // Kennzeichen „Wertung“ (A-25c)
}

/** Live = läuft oder ist unterbrochen (Halbzeit, Entscheidung, Strafstoßschießen, angehaltene Uhr), @ZM-039/@ZM-040. */
export function isLive(status: ViewMatchStatus): boolean {
  return status === 'running' || status === 'paused';
}

/**
 * Angepfiffen = läuft oder ist unterbrochen (Halbzeit), auf dem rohen Spielstatus der Turnierkopie bzw. des Servers.
 * Der Spielstatus der Kopie kennt `'paused'` nicht im Typ, andere Geräte liefern ihn aber (C-HALBZEIT-NICHT-LAUFEND, @ZP-093).
 */
export function isMatchInProgress(status: string | undefined): boolean {
  return status === 'running' || status === 'paused';
}

/** Kommend = nur geplant; ausgefallen/unterbrochen ist nie „nächstes Spiel“ (@ZM-041, @ZM-104). */
export function isUpcoming(status: ViewMatchStatus): boolean {
  return status === 'scheduled';
}

/**
 * Wortlaut nach Record: Live, Pause, Ende, ausgefallen (@OB-066, @ZM-039) kommen aus `matchBadge.*` (eine Wortquelle mit
 * dem Abzeichen); „geplant“ und „gewertet“ bleiben unter `tournament:view.status.*`.
 */
export function viewStatusText(status: ViewMatchStatus, locale: ViewLocale): string {
  switch (status) {
    case 'running':
      return i18next.t(`tournament:${MATCH_BADGE_WORD_KEY.live}`, { lng: locale });
    case 'paused':
      return i18next.t(`tournament:${MATCH_BADGE_WORD_KEY.pause}`, { lng: locale });
    case 'finished':
      return i18next.t(`tournament:${MATCH_BADGE_WORD_KEY.ended}`, { lng: locale });
    case 'cancelled':
      return i18next.t(`tournament:${MATCH_BADGE_WORD_KEY.cancelled}`, { lng: locale });
    default:
      return i18next.t(`tournament:view.status.${status}`, { lng: locale });
  }
}
