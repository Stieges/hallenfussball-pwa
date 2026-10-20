/**
 * Texte einer entschiedenen Gleichstands-Entscheidung (Paket TB-B): Überschrift und Satz zur Wirkung, gleich im Hinweis der
 * Tabelle (`DecidedInfo`) und in der Meldung „Schon entschieden“ des Dialogs. Ohne Person und Zeit (GA4 A-13b).
 */
import type { TFunction } from 'i18next';
import type { StandingDecision } from '../../../types/tournament';
import { listText } from './tieFormat';

export interface DecidedTexts {
  heading: string;
  body: string;
}

export function decidedTexts(
  t: TFunction<'tournament'>,
  language: string,
  decision: StandingDecision,
  block: { place: number; size: number },
  nameOf: (teamId: string) => string,
  forLeadership: boolean,
): DecidedTexts {
  const names = listText(decision.teamIds.map(nameOf), language);
  if (decision.kind === 'shared') {
    return {
      heading: forLeadership ? t('standingsTie.decided.sharedTitle') : t('standingsTie.decided.sharedTitleHelper'),
      body: t('standingsTie.decided.sharedBody', { names, places: t('standingsTie.places.one', { from: block.place }), next: block.place + block.size }),
    };
  }
  const win = decision.shootout;
  if (decision.kind === 'shootout' && win !== undefined) {
    return {
      heading: t('standingsTie.decided.shootoutTitle', { winner: win.winner, loser: win.loser, team: nameOf(decision.order[0]) }),
      body: t('standingsTie.decided.shootoutBody', { team: nameOf(decision.order[0]), other: nameOf(decision.order[1]) }),
    };
  }
  return { heading: t('standingsTie.decided.orderTitle'), body: t('standingsTie.decided.orderBody', { names }) };
}
