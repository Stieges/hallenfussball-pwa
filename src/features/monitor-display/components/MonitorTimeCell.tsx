import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayList } from '../../../design-tokens';
import type { ListTokens } from '../listCompact';
import type { MatchView } from '../../../core/view';
import { MatchStatusBadge } from '../../../components/ui/molecules/MatchStatusBadge';
import type { MatchStatusBadgeTone } from '../../../components/ui/molecules/matchStatusBadgeStyle';

interface MonitorTimeNotesProps {
  match: Pick<MatchView, 'originalKickoff'>;
  /** Kontrast am Monitor mindestens 7:1: die volle Textfarbe des Themas, nicht der gedämpfte Ton */
  color: string;
  /** Vorsilbe der Test-Kennungen: `${prefix}-original` */
  testIdPrefix: string;
}

/** Kleine Zeile neben einer Uhrzeit (Live-Folie, nächstes Spiel): „(war hh:mm)“ (@ZP-004, @ZP-046). */
export function MonitorTimeNotes({ match, color, testIdPrefix }: MonitorTimeNotesProps) {
  const { t } = useTranslation('tournament');
  const note: CSSProperties = { fontSize: displayList.fontSizes.timeNote, fontWeight: cssVars.fontWeights.normal, color };
  return (
    <>
      {match.originalKickoff && (
        <div data-testid={`${testIdPrefix}-original`} style={note}>{t('timeShift.original', { time: match.originalKickoff.time })}</div>
      )}
    </>
  );
}

interface MonitorTimeCellProps {
  match: MatchView;
  /** Feld unter der Uhrzeit, so groß wie die übrigen Angaben; `undefined` = keine Feldangabe (@ZM-189). */
  fieldName?: string;
  /** Zeile für den Zustand reservieren (Spielplan): sie steht in jeder Zeile, auch wenn das Spiel noch keinen Zustand hat (@ZM-187). */
  reserveState: boolean;
  color: string;
  tone?: MatchStatusBadgeTone;
  style: CSSProperties;
  /** Tokens der Zeile (im Maßstab der schmalen Aufteilung); ohne Angabe die Stufen von bisher. */
  list?: ListTokens;
  /** Schmale Aufteilung (@ZM-211): Uhrzeit, „(war hh:mm)“ und Zustand übereinander, „(war …)“ hat in jeder Zeile seine Zeile. */
  compact?: boolean;
}

/**
 * Uhrzeit einer Spielzeile im Stil der Spiellisten: in einer Zeile groß die gültige Uhrzeit und klein „(war hh:mm)“ (@ZM-188, @ZP-046),
 * darunter nach Bedarf das Feld (nur bei mehreren Feldern), der Zustand („Live“, „Ende“, „ausgefallen“ …). Keine eigenen Spalten (@ZM-189). Uhrzeit und „(war …)“ brechen nie um; die Namensspalten ändern sich nie
 * durch einen Hinweis (@ZM-087, @ZM-187).
 */
export function MonitorTimeCell({ match, fieldName, reserveState, color, tone, style, list = displayList, compact = false }: MonitorTimeCellProps) {
  const { t } = useTranslation('tournament');
  // Eine Stufe für alle Zusatzzeilen unter der Uhrzeit: Feld und Zustand (Token `note`); die Spielbezeichnung steht als Überschrift der Zeile (MonitorMatchRow)
  const small: CSSProperties = { fontSize: list.fontSizes.note, fontWeight: cssVars.fontWeights.normal, color, whiteSpace: 'nowrap' };
  // Das Feld darf umbrechen (lange Texte laufen sonst aus der Spalte); nur Uhrzeit und Zustand nicht
  const note: CSSProperties = { ...small, whiteSpace: 'normal', overflowWrap: 'break-word' };
  // „(war hh:mm)“ steht in der Uhrzeit-Zeile und hat die Stufe `timeNote`
  const war: CSSProperties = { ...small, fontSize: list.fontSizes.timeNote };
  const hasState = match.badge.kind === 'badge';
  if (compact) {
    // @ZM-211: schmale Spalte, die Zeilen übereinander; die Zeile für „(war …)“ steht in jeder Zeile der Folie, auch ohne Verschiebung (nichts springt)
    const stapel = list.fit.stackLineHeight;
    return (
      <div data-testid="monitor-match-time" style={{ ...style, color, flex: `0 0 ${list.timeFieldWidth}`, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div data-testid="monitor-match-clockline" style={{ whiteSpace: 'nowrap', lineHeight: stapel }}>
          <span data-testid="monitor-match-clock" style={{ fontSize: list.fontSizes.time }}>{match.kickoff?.time ?? '–'}</span>
        </div>
        <div data-testid="monitor-match-warline" style={{ ...war, lineHeight: stapel, minHeight: `calc(${list.fontSizes.timeNote} * ${String(stapel)})` }}>
          {match.originalKickoff && (
            <span data-testid="monitor-match-original" style={war}>{t('timeShift.original', { time: match.originalKickoff.time })}</span>
          )}
        </div>
        <div data-testid="monitor-match-zusatz" style={{ lineHeight: 1.2 }}>
          {fieldName !== undefined && <div data-testid="monitor-match-field" style={{ ...note, fontWeight: cssVars.fontWeights.semibold }}>{fieldName}</div>}
          {(reserveState || hasState) && (
            <div data-testid="monitor-match-status" style={{ ...small, display: 'flex', alignItems: 'center', gap: list.timeNoteGap, minHeight: '1.2em' }}>
              {hasState && <MatchStatusBadge model={match.badge} size="zeile" tone={tone} />}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    // Die Zelle ist nur so hoch wie die Uhrzeit-Zeile: sie steht senkrecht mittig in der Zeile, die Zusätze hängen darunter (außerhalb des Flusses)
    <div data-testid="monitor-match-time" style={{ ...style, color, flex: `0 0 ${list.timeFieldWidth}`, minWidth: 0, position: 'relative', height: `calc(${list.fontSizes.time} * 1.2)` }}>
      <div data-testid="monitor-match-clockline" style={{ display: 'flex', alignItems: 'baseline', gap: list.timeNoteGap, whiteSpace: 'nowrap', lineHeight: 1.2 }}>
        <span data-testid="monitor-match-clock" style={{ fontSize: list.fontSizes.time }}>{match.kickoff?.time ?? '–'}</span>
        {match.originalKickoff && (
          <span data-testid="monitor-match-original" style={war}>{t('timeShift.original', { time: match.originalKickoff.time })}</span>
        )}
      </div>
      <div data-testid="monitor-match-zusatz" style={{ position: 'absolute', top: '100%', left: 0, right: 0, lineHeight: 1.2 }}>
      {fieldName !== undefined && <div data-testid="monitor-match-field" style={{ ...note, fontWeight: cssVars.fontWeights.semibold }}>{fieldName}</div>}
      {(reserveState || hasState) && (
        <div data-testid="monitor-match-status" style={{ ...small, display: 'flex', alignItems: 'center', gap: list.timeNoteGap, minHeight: '1.2em' }}>
          {hasState && <MatchStatusBadge model={match.badge} size="zeile" tone={tone} />}
        </div>
      )}
      </div>
    </div>
  );
}
