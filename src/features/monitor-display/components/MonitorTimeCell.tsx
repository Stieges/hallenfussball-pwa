import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayList } from '../../../design-tokens';
import type { MatchView } from '../../../core/view';

interface MonitorTimeCellProps {
  match: MatchView;
  /** Schriftfarbe der Uhrzeit (Monitor-Thema) */
  color: string;
  /** Farbe der kleinen Hinweiszeile (Sekundärtext: Kontrast über dem gedämpften Text, Monitor-Ziel 4,6:1) */
  noteColor: string;
  /** Eine Zeile der Seite trägt einen Hinweis: alle Uhrzeit-Spalten sind gleich breit (B-27) */
  wide: boolean;
  style: CSSProperties;
}

/**
 * Uhrzeit einer Spielzeile: groß die gültige Uhrzeit, klein darunter „ursprünglich hh:mm“ (@ZP-004, @ZP-046) und bei
 * K.-o.-Spielen „voraussichtlich“ (@ZM-105). Die kleine Zeile steht unter der Uhrzeit wie „Feld · SR“ im Stil der Spiellisten.
 */
export function MonitorTimeCell({ match, color, noteColor, wide, style }: MonitorTimeCellProps) {
  const { t } = useTranslation('tournament');
  const note: CSSProperties = { fontSize: displayList.fontSizes.timeNote, fontWeight: cssVars.fontWeights.normal, color: noteColor, whiteSpace: 'nowrap' };
  return (
    <div
      data-testid="monitor-match-time"
      style={{ ...style, color, flex: `0 0 ${wide ? displayList.timeNoteWidth : displayList.timeWidth}` }}
    >
      <div>{match.kickoff?.time ?? '–'}</div>
      {match.kickoffTentative && <div data-testid="monitor-match-tentative" style={note}>{t('timeShift.tentative')}</div>}
      {match.originalKickoff && (
        <div data-testid="monitor-match-original" style={note}>{t('timeShift.original', { time: match.originalKickoff.time })}</div>
      )}
    </div>
  );
}
