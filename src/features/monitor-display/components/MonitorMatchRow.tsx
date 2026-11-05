import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayList, displayMonitor, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MatchView } from '../../../core/view';
import type { MonitorTheme } from '../../../types/monitor';
import { getFieldDisplayName } from '../../../utils/displayNames';
import { resultFigures, tableResultExtra, tableResultExtraTerms } from '../../../components/schedule/matchResult';
import { resolveTheme } from '../monitorDisplayHelpers';
import { monitorSideLabel } from '../matchSides';
import { monitorBadgeTone } from '../../../components/ui/molecules/matchStatusBadgeStyle';
import { DEFAULT_FRAME, LABEL_TOP, hyphenWordStaysTogether, nameCharsPerLine, rowHeight, type ListColumns, type ListFrame } from '../listRows';
import { MonitorTimeCell } from './MonitorTimeCell';

interface MonitorMatchRowProps {
  /** Das Spiel der Ansicht: Status, Seitentexte, Anstoß und Endstand kommen von dort (A-36c). */
  match: MatchView;
  tournament: Tournament;
  theme: MonitorTheme;
  /** Ergebnis anzeigen (Spielplan, f3); die Folie „Nächste Spiele“ zeigt nie ein Ergebnis. */
  showScore?: boolean;
  /**
   * Zusatzzeilen der ganzen Folie (@ZM-187, @ZM-189): Zustand (Spielplan) und Feld (Nächste Spiele bei mehreren Feldern) stehen unter der
   * Uhrzeit, in jeder Zeile der Folie oder in keiner; es gibt keine eigenen Spalten dafür.
   */
  columns: ListColumns;
  /** Rahmen der Folie (Bildrand, Hinweis): bestimmt, wie viele Zeichen eine Namenszeile fasst (@ZM-188). */
  frame?: ListFrame;
  /** Zeile unter dem Stand für „(4:3 i. E.)“ in jeder Zeile der Folie freihalten; Vorgabe: im Spielplan (`columns.state`). */
  reserveExtra?: boolean;
}

/**
 * Teamname mit Bindestrich-Wörtern, die zusammenbleiben, solange sie in eine Zeile passen (@ZM-188): nur die Darstellung (`nowrap`),
 * der Text bleibt unverändert, Suche und Vorlesen sehen den echten Bindestrich.
 */
function NameText({ name, perLine }: { name: string; perLine: number }) {
  return (
    <>
      {name.split(/(\s+)/).map((teil, i) => (hyphenWordStaysTogether(teil, perLine)
        ? <span key={i} style={{ whiteSpace: 'nowrap' }}>{teil}</span>
        : teil))}
    </>
  );
}

/** Eine Zeile einer Spielliste: Uhrzeit, Feld, Paarung, Stand und Zusätze an festen Stellen (@ZM-187). */
export function MonitorMatchRow({ match, tournament, theme, showScore = false, columns, frame = DEFAULT_FRAME, reserveExtra = columns.state }: MonitorMatchRowProps) {
  const { t } = useTranslation(['tournament', 'sport']);
  const colors = monitorThemes[resolveTheme(theme)];
  const perLine = nameCharsPerLine(frame);
  // B-44b (@ZM-125, @ZM-087): Schrift relativ zur Bildhöhe, Namen umbrechen statt zu kürzen
  const cell: CSSProperties = {
    fontSize: displayList.fontSizes.team,
    color: colors.text,
    minWidth: 0,
    overflowWrap: 'break-word',
  };
  // Endstand inkl. Strafstoß aus der Ansicht (@ZM-147): „2:2 (4:3 i. E.)“; ohne Stand „-:-“
  const figures = resultFigures(match.score, match.isLive ? 'running' : 'finished');
  const score = figures === null ? '-:-' : `${figures.goalsA}:${figures.goalsB}`;
  const scoreExtra = figures === null ? undefined : tableResultExtra(figures, t);
  // Kurzform („i. E.“, „n. V.“) immer mit ausgeschriebenem Begriff für Darüberfahren und Screenreader (@OB-075)
  const extraTerms = figures === null ? undefined : tableResultExtraTerms(figures, t);

  const extraStyle: CSSProperties = { fontSize: displayList.fontSizes.note, fontWeight: cssVars.fontWeights.normal, color: colors.text, whiteSpace: 'nowrap', position: 'absolute', top: '100%', left: 0, right: 0, lineHeight: 1.2 };

  return (
    <div
      data-testid="monitor-match-row"
      data-match-id={match.id}
      data-status={match.status}
      style={{
        display: 'flex',
        // Uhrzeit, Teamnamen und Stand stehen senkrecht mittig (gemeinsame Mittelachse); Zusatzzeilen hängen darunter, außerhalb des Flusses
        alignItems: 'center',
        minHeight: `${String(rowHeight(match, columns, frame, reserveExtra))}vh`,
        position: 'relative',
        gap: displayList.cellGap,
        width: '100%',
        padding: `${displayList.rowPaddingY} ${displayList.rowPaddingX}`,
        boxSizing: 'border-box',
        background: colors.surface,
        borderRadius: displayMonitor.radius.card,
        border: `${cssVars.borderWidth.thin} solid ${colors.border}`,
      }}
    >
      {/* Spielbezeichnung („Halbfinale 1“) als Überschrift der Zeile: oben mittig in der Zeilenkarte, außerhalb des Flusses (Platz rechnet rowHeight ein) */}
      {match.labelText && (
        <div data-testid="monitor-match-label" style={{ position: 'absolute', top: `${String(LABEL_TOP)}vh`, left: 0, right: 0, textAlign: 'center', fontSize: displayList.fontSizes.timeNote, fontWeight: cssVars.fontWeights.bold, color: colors.text, lineHeight: 1.2 }}>{match.labelText}</div>
      )}
      <MonitorTimeCell
        match={match}
        fieldName={columns.field ? getFieldDisplayName(match.field, tournament) : undefined}
        reserveState={columns.state}
        color={colors.text}
        tone={monitorBadgeTone(colors)}
        style={{ ...cell, fontWeight: cssVars.fontWeights.semibold }}
      />
      <div data-teamname style={{ ...cell, flex: '1 1 0', textAlign: 'right' }}><NameText name={monitorSideLabel(match.home)} perLine={perLine} /></div>
      <div
        data-testid="monitor-match-separator"
        style={{
          ...cell,
          // Breite in em der Namensschrift (nicht der Standschrift): fest in jeder Zeile (@ZM-151, @ZM-187), listRows.ts rechnet auf derselben Basis
          flex: `0 0 ${displayList.separatorWidth}`,
          textAlign: 'center',
          // nur so hoch wie der Stand: mittig in der Zeile, „(4:3 i. E.)“ hängt darunter (außerhalb des Flusses)
          position: 'relative',
          height: `calc(${displayList.fontSizes.score} * 1.2)`,
        }}
      >
        <div
          data-testid="monitor-match-score"
          style={{
            // Stand: 1,5 × Namensschrift, so fett wie die Uhrzeit (VISUAL-DESIGN § 8)
            fontSize: displayList.fontSizes.score,
            lineHeight: 1.2,
            fontWeight: showScore ? cssVars.fontWeights.bold : cssVars.fontWeights.normal,
            color: showScore ? colors.text : colors.textMuted,
          }}
        >
          {showScore ? score : '–'}
        </div>
        {/* „gewertet“ steht klein unter dem Stand, Stelle und Stil wie „(4:3 i. E.)“ (wie im PDF); eine Wertung hat kein Strafstoßschießen */}
        {showScore && !scoreExtra && match.status === 'awarded' && (
          <div data-testid="monitor-match-note" style={extraStyle}>{t('view.status.awarded')}</div>
        )}
        {showScore && scoreExtra && (
          <div data-testid="monitor-match-extra" title={extraTerms?.long} aria-label={extraTerms?.spoken} role="note" style={extraStyle}>
            {scoreExtra}
          </div>
        )}
      </div>
      <div data-teamname style={{ ...cell, flex: '1 1 0' }}><NameText name={monitorSideLabel(match.away)} perLine={perLine} /></div>
    </div>
  );
}
