import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayList } from '../../../design-tokens';
import type { MatchView } from '../../../core/view';

interface MonitorTimeNotesProps {
  match: Pick<MatchView, 'kickoffTentative' | 'originalKickoff'>;
  /** Kontrast am Monitor mindestens 7:1: die volle Textfarbe des Themas, nicht der gedämpfte Ton */
  color: string;
  /** Vorsilbe der Test-Kennungen: `${prefix}-tentative`, `${prefix}-original` */
  testIdPrefix: string;
}

/** Kleine Zeilen unter einer Uhrzeit (Live-Folie, nächstes Spiel): „voraussichtlich“ (@ZM-105) und „(war hh:mm)“ (@ZP-004, @ZP-046). */
export function MonitorTimeNotes({ match, color, testIdPrefix }: MonitorTimeNotesProps) {
  const { t } = useTranslation('tournament');
  const note: CSSProperties = { fontSize: displayList.fontSizes.timeNote, fontWeight: cssVars.fontWeights.normal, color };
  return (
    <>
      {match.kickoffTentative && <div data-testid={`${testIdPrefix}-tentative`} style={note}>{t('timeShift.tentative')}</div>}
      {match.originalKickoff && (
        <div data-testid={`${testIdPrefix}-original`} style={note}>{t('timeShift.original', { time: match.originalKickoff.time })}</div>
      )}
    </>
  );
}

interface MonitorTimeCellProps {
  match: MatchView;
  fieldName: string;
  color: string;
  fieldColor: string;
  noteColor: string;
  style: CSSProperties;
}

/**
 * Uhrzeit einer Spielzeile im Stil der Spiellisten (Mockup Schiedsrichter): in einer Zeile groß die gültige Uhrzeit und klein
 * „(war hh:mm)“ (@ZM-188, @ZP-046), darunter klein das Feld (später „Feld · SR“, R5), darunter „voraussichtlich“. Feste Breite;
 * Uhrzeit und „(war …)“ brechen nie um, die Namensspalten ändern sich nie durch einen Hinweis (@ZM-087, @ZM-187).
 */
export function MonitorTimeCell({ match, fieldName, color, fieldColor, noteColor, style }: MonitorTimeCellProps) {
  const { t } = useTranslation('tournament');
  const note: CSSProperties = { fontSize: displayList.fontSizes.timeNote, fontWeight: cssVars.fontWeights.normal, color: noteColor };
  return (
    <div data-testid="monitor-match-time" style={{ ...style, color, flex: `0 0 ${displayList.timeFieldWidth}`, minWidth: 0 }}>
      <div data-testid="monitor-match-clockline" style={{ display: 'flex', alignItems: 'baseline', gap: displayList.timeNoteGap, whiteSpace: 'nowrap' }}>
        <span data-testid="monitor-match-clock" style={{ fontSize: displayList.fontSizes.time }}>{match.kickoff?.time ?? '–'}</span>
        {match.originalKickoff && (
          <span data-testid="monitor-match-original" style={note}>{t('timeShift.original', { time: match.originalKickoff.time })}</span>
        )}
      </div>
      <div data-testid="monitor-match-field" style={{ fontWeight: cssVars.fontWeights.normal, color: fieldColor }}>{fieldName}</div>
      {match.kickoffTentative && <div data-testid="monitor-match-tentative" style={note}>{t('timeShift.tentative')}</div>}
    </div>
  );
}
