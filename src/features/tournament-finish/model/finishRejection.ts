/**
 * Was der Dialog „Turnier abschließen“ zu einer Ablehnung sagt (Plan R3-4; @LZ-010, @LZ-019, @LZ-021, @LZ-024, Review #393 H-5).
 * Ein Text je Grund, in Klartext und mit dem nächsten Schritt – nie der technische Code. Rein bis auf das übergebene `t`.
 * `OPEN_ITEMS` (Zustand A) und `OFFLINE` (Hinweis „Kein Netz“) zeichnet der Dialog selbst.
 */
import type { FinishRejection } from '../../../hooks/useFinishTournament';
import type { FinishT } from './finishItems';
import { formatClock, formatDay } from './finishFormat';

/** Die Haupttaste unter dem Text. */
export type RejectionAction = 'retry' | 'reloadState' | 'close';

export interface RejectionView {
  /** Fettzeile; ohne Titel steht nur der Text. */
  title: string | null;
  text: string;
  tone: 'warn' | 'error' | 'info';
  action: RejectionAction;
}

const tkey = (key: string) => `tournament:finish.error.${key}`;

export function rejectionView(reason: FinishRejection, t: FinishT, language = 'de'): RejectionView {
  const fail = (text: string, action: RejectionAction = 'retry', tone: RejectionView['tone'] = 'warn'): RejectionView => ({ title: null, text, tone, action });
  switch (reason.code) {
    case 'FORBIDDEN':
      return fail(t(tkey('forbidden')), 'close');
    case 'LOCAL':
      return fail(t(tkey('local')), 'close');
    case 'CHECK_FAILED':
      return fail(t(tkey('checkFailed')));
    case 'OWN_OUTBOX':
      return fail(t(tkey('ownOutbox'), { count: reason.pending }));
    case 'STALE_STATE':
      return fail(t(tkey('stale')), 'reloadState');
    case 'PROVISIONAL':
      return fail(t(tkey('provisional')), 'close');
    case 'NOT_RUNNING':
      return fail(t(tkey(reason.lifecycle === 'cancelled' ? 'cancelled' : 'notRunning')), 'close');
    case 'ALREADY_FINISHED': {
      const date = formatDay(reason.at, language);
      const time = formatClock(reason.at, language);
      const named = reason.by !== undefined && reason.by !== null && reason.by.trim() !== '';
      // H-5: nur mit Namen vom Server „hat … abgeschlossen“; ohne Namen wird nie behauptet, wer es war
      const withTime = date !== null && time !== null;
      const finalKey = named ? (withTime ? 'alreadyFinishedByAt' : 'alreadyFinishedBy') : (withTime ? 'alreadyFinishedAt' : 'alreadyFinished');
      return { title: null, text: t(tkey(finalKey), { name: reason.by ?? '', date: date ?? '', time: time ?? '' }), tone: 'info', action: 'close' };
    }
    case 'OFFLINE':
    case 'OPEN_ITEMS':
    case 'INVALID_STANDINGS':
    case 'REQUEST_ID_CONFLICT':
    case 'INVALID_INPUT':
    case 'UNEXPECTED':
      return { title: t(tkey('title')), text: t(tkey('text')), tone: 'warn', action: 'retry' };
  }
}
