/**
 * B-50: Anzeigetexte der Klärungsliste (rein bis auf das übergebene `t`). Schlüssel unter `tournament:klaerung.*`, Eintragsart
 * aus `common:outbox.eventType.*` (dieselben Wörter wie in der Liste „nicht übernommen“).
 */
import type { MatchReview } from '../../core/match/review/matchReviewTypes';
import type { ReviewCase, ReviewNotice } from '../../core/match/review/reviewCases';
import { eventTypeKey, minuteFromClock } from '../collaboration/outbox/rejectionText';
import type { DecisionOutcome } from './sendReviewDecisions';

export type TeamNameOf = (teamId: string | null) => string | null;

/** Übersetzer mit Namensraum im Schlüssel (`tournament:…`, `common:…`); jedes `t` aus `useTranslation` passt. */
export type TFunction = (key: string, options?: Record<string, unknown>) => string;

const authorOf = (t: TFunction, author: string | null): string => author ?? t('tournament:klaerung.unbekannt');

/** „3 Einträge von Tom nach Übernahme“ (@FU-038, @FU-095), „1 Eintrag von Tom, Recht entzogen“ (@FU-017, @HE-056). */
export function caseTitle(t: TFunction, reviewCase: ReviewCase): string {
  return t(`tournament:klaerung.fall.${reviewCase.reasonKey}`, { count: reviewCase.count, author: authorOf(t, reviewCase.author) });
}

/** „Spiel 9 · Feld 2“. */
export function matchLine(t: TFunction, matchNumber: number | null, field: number | null): string | null {
  if (matchNumber === null) {
    return null;
  }
  return field === null
    ? t('tournament:klaerung.spielOhneFeld', { number: matchNumber })
    : t('tournament:klaerung.spiel', { number: matchNumber, field });
}

/** „Gelbe Karte SV Süd, Nr. 5 · Abschnitt 1, 7. Minute“. */
export function entryLine(t: TFunction, review: MatchReview, teamName: TeamNameOf): string {
  const what = t(`common:${eventTypeKey(review.entry.type)}`);
  const team = teamName(review.entry.teamId);
  const nr = review.entry.payload.playerNumber;
  const line = team === null
    ? t('tournament:klaerung.zeile.ohneTeam', { what })
    : typeof nr === 'number'
      ? t('tournament:klaerung.zeile.mitNummer', { what, team, nr })
      : t('tournament:klaerung.zeile.team', { what, team });
  const minute = minuteFromClock(review.entry.clockMs);
  return minute === null || review.entry.section === null
    ? line
    : t('tournament:klaerung.zeile.minute', { line, section: review.entry.section, minute });
}

/** „Gerät 12:04“ (Gerätezeit des Eintrags), `null` ohne Zeit. */
export function deviceTime(t: TFunction, review: MatchReview): string | null {
  if (review.entry.deviceAt === null) {
    return null;
  }
  const time = new Date(review.entry.deviceAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return t('tournament:klaerung.zeile.geraet', { time });
}

/** „1 Tor von Tom (Feld 2) nachträglich eingefügt“ (@FU-037). */
export function noticeText(t: TFunction, notice: ReviewNotice): string {
  const key = notice.onlyGoals ? 'tor' : 'eintrag';
  return t(`tournament:klaerung.hinweis.${key}`, { count: notice.count, author: authorOf(t, notice.author), field: notice.field ?? '–' });
}

/** Rückmeldung nach dem Senden; `null` = gespeichert ohne Zusatz. */
export function outcomeText(t: TFunction, outcome: DecisionOutcome | { status: 'unknownMatch' }, matchNumber: number | null): string | null {
  switch (outcome.status) {
    case 'saved':
      return outcome.accepted > 0 && outcome.matchFinished
        ? t('tournament:klaerung.ergebnis.gruppeVeraltet', { number: matchNumber ?? '–' })
        : null;
    case 'offline':
      return t('tournament:klaerung.fehler.offline');
    case 'notSent':
      return t('tournament:klaerung.fehler.nichtGesendet');
    case 'outdated':
      return t('tournament:klaerung.fehler.veraltet');
    case 'unknownMatch':
      return t('tournament:klaerung.fehler.spielFehlt', { number: matchNumber ?? '–' });
    case 'rejected':
      if (outcome.reason === 'ALREADY_DECIDED') {
        return t('tournament:klaerung.fehler.schonEntschieden');
      }
      if (outcome.reason === 'KNOCKOUT_FINISHED') {
        return t('tournament:klaerung.vorschau.koBeendet');
      }
      return t('tournament:klaerung.fehler.sonst', { reason: outcome.reason ?? outcome.code });
  }
}
