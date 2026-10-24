/**
 * B-50 Q4 (Daniel 23.10.): Hinweise „nachträglich eingefügt“ (@FU-037) gelten je Gerät als gesehen, sobald die Liste
 * geöffnet war; danach zählen sie im Kopf nicht mehr. Nur lokal (`safeLocalStorage`), je Turnier eine Liste der Event-IDs.
 * Fehlt der Speicher (privates Fenster), zählen die Hinweise einfach weiter – nichts geht verloren.
 */
import { safeLocalStorage } from '../../core/utils/safeStorage';

const PREFIX = 'klaerung-gesehen:';
/** Obergrenze, damit der Eintrag über einen langen Turniertag nicht unbegrenzt wächst. */
const MAX_IDS = 500;

export function readSeenNotices(tournamentId: string): Set<string> {
  try {
    const raw = safeLocalStorage.getItem(`${PREFIX}${tournamentId}`);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function markNoticesSeen(tournamentId: string, eventIds: readonly string[]): void {
  const seen = readSeenNotices(tournamentId);
  for (const id of eventIds) {
    seen.add(id);
  }
  try {
    safeLocalStorage.setItem(`${PREFIX}${tournamentId}`, JSON.stringify([...seen].slice(-MAX_IDS)));
  } catch {
    // ohne Speicher bleibt der Hinweis gezählt
  }
}
