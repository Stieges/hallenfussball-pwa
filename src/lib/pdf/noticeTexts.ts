/**
 * Texte des Aushangs (B-28 C7, @DR-010, @DR-022): Aufruf und Anleitung aus `tournament:pdf.notice.*`. Der Aufruf nennt
 * „Ergebnisse“ nur, wenn die Zuschauer sie sehen (nicht im Kindermodus, nicht bei ausgeblendeten Ergebnissen).
 */
import type { Tournament } from '../../types/tournament';
import type { PdfTranslator } from './translations';

export interface NoticeTexts {
  call: string;
  steps: string[];
  addressLabel: string;
}

/** Zuschauer sehen im Kindermodus oder bei ausgeblendeten Ergebnissen nur den Spielplan. */
export function noticeShowsResults(tournament: Pick<Tournament, 'hideScoresForPublic'> & Partial<Pick<Tournament, 'isKidsTournament'>>): boolean {
  return tournament.isKidsTournament !== true && !tournament.hideScoresForPublic;
}

export function buildNoticeTexts(translate: PdfTranslator, showsResults: boolean): NoticeTexts {
  const s = (key: string): string => translate(`pdf.notice.${key}`);
  return {
    call: s(showsResults ? 'callResults' : 'callPlan'),
    steps: [s('step1'), s('step2'), s('step3')],
    addressLabel: s('addressLabel'),
  };
}
