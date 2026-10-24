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
  /** Anonyme Gerätesitzung: kann kein Turnier in der Cloud anlegen (tournaments_insert_v4 / is_real_account()). */
  isAnonymous?: boolean;
}

export function publishNoticeKey({ visibility, toCloud, isOnline, isAnonymous = false }: PublishNoticeInput): PublishNoticeKey {
  if (!toCloud) {
    return 'publish.explanationLocal';
  }
  if (!isOnline) {
    return 'publish.explanationOffline';
  }
  if (isAnonymous) {
    return 'publish.explanationLocal';
  }
  return visibility === 'shareable' ? 'publish.explanationPublic' : 'publish.explanationPrivate';
}

/**
 * C-FESTLEGEN-TEILT-NICHT: Teilt „Festlegen“ das Turnier per Link? Genau dann, wenn die Vorschau den Satz
 * „jeder mit dem Link“ ankuendigt -- angemeldet, online, kein anonymes Konto, und das Turnier wird beim Festlegen teilbar
 * (ein bereits festgelegtes, privat gestelltes Turnier bleibt privat).
 */
export function publishSharesByLink(input: PublishNoticeInput): boolean {
  return publishNoticeKey(input) === 'publish.explanationPublic';
}
