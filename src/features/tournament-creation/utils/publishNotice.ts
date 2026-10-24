/**
 * @W1-037: Welcher Satz zur Sichtbarkeit steht über „Festlegen“.
 * Nur wer angemeldet und online ist, legt ein Turnier in der Cloud fest; sonst bleibt es
 * auf diesem Gerät. Der Satz „jeder mit dem Link“ darf nur im ersten Fall stehen (@OB-002).
 */
import type { visibilityAfterPublish } from '../../../core/services/TournamentCreationService';

export type PublishNoticeKey =
  | 'publish.explanationPublic'
  | 'publish.explanationPrivate'
  | 'publish.explanationLocal';

export interface PublishNoticeInput {
  visibility: ReturnType<typeof visibilityAfterPublish>;
  signedIn: boolean;
  isOnline: boolean;
}

export function publishNoticeKey({ visibility, signedIn, isOnline }: PublishNoticeInput): PublishNoticeKey {
  if (!signedIn || !isOnline) {
    return 'publish.explanationLocal';
  }
  return visibility === 'shareable' ? 'publish.explanationPublic' : 'publish.explanationPrivate';
}
