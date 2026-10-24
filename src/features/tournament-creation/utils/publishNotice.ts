/**
 * @W1-037: Welcher Satz zur Sichtbarkeit steht über „Festlegen“.
 * Drei Lagen: angemeldet und online (Link / privat), nicht angemeldet (nur dieses Gerät),
 * angemeldet ohne Netz (vorerst dieses Gerät, das Speichern wird nachgereicht). Der Satz „jeder mit dem Link“ darf nur im ersten Fall stehen (@OB-002).
 */
import type { visibilityAfterPublish } from '../../../core/services/TournamentCreationService';

export type PublishNoticeKey =
  | 'publish.explanationPublic'
  | 'publish.explanationPrivate'
  | 'publish.explanationLocal'
  | 'publish.explanationOffline';

export interface PublishNoticeInput {
  visibility: ReturnType<typeof visibilityAfterPublish>;
  /** Turnier geht ueber das Konto in die Cloud (usesCloudRepository). */
  toCloud: boolean;
  isOnline: boolean;
}

export function publishNoticeKey({ visibility, toCloud, isOnline }: PublishNoticeInput): PublishNoticeKey {
  if (!toCloud) {
    return 'publish.explanationLocal';
  }
  if (!isOnline) {
    return 'publish.explanationOffline';
  }
  return visibility === 'shareable' ? 'publish.explanationPublic' : 'publish.explanationPrivate';
}
