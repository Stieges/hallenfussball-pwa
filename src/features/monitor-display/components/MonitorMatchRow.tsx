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
import { DEFAULT_FRAME, hyphenWordStaysTogether, nameCharsPerLine, type ListColumns, type ListFrame } from '../listRows';
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
export function MonitorMatchRow({ match, tournament, theme, showScore = false, columns, frame = DEFAULT_FRAME }: MonitorMatchRowProps) {
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

  const extraStyle: CSSProperties = { fontSize: displayList.fontSizes.note, fontWeight: cssVars.fontWeights.normal, color: colors.textMuted, whiteSpace: 'nowrap', minHeight: '1.2em', lineHeight: 1.2 };

  return (
    <div
      data-testid="monitor-match-row"
      data-match-id={match.id}
      data-status={match.status}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: displayList.cellGap,
        width: '100%',
        padding: `${displayList.rowPaddingY} ${displayList.rowPaddingX}`,
        boxSizing: 'border-box',
        background: colors.surface,
        borderRadius: displayMonitor.radius.card,
        border: `${cssVars.borderWidth.thin} solid ${colors.border}`,
      }}
    >
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
          flex: `0 0 ${displayList.separatorWidth}`,
          textAlign: 'center',
          // Stand: 1,5 × Namensschrift, so fett wie die Uhrzeit (VISUAL-DESIGN § 8); feste Breite, damit nichts springt (@ZM-151, @ZM-187)
          fontSize: displayList.fontSizes.score,
          lineHeight: 1.2,
          fontWeight: showScore ? cssVars.fontWeights.bold : cssVars.fontWeights.normal,
          color: showScore ? colors.text : colors.textMuted,
        }}
      >
        {showScore ? score : '–'}
        {showScore && scoreExtra && (
          <div data-testid="monitor-match-extra" title={extraTerms?.long} aria-label={extraTerms?.spoken} role="note" style={extraStyle}>
            {scoreExtra}
          </div>
        )}
        {/* Zeile für „(4:3 i. E.)“ ist im Spielplan in jeder Zeile reserviert: die Zeilenhöhe ändert sich nie durch einen Strafstoß (@ZM-187) */}
        {showScore && !scoreExtra && <div data-testid="monitor-match-extra-platz" aria-hidden="true" style={extraStyle} />}
      </div>
      <div data-teamname style={{ ...cell, flex: '1 1 0' }}><NameText name={monitorSideLabel(match.away)} perLine={perLine} /></div>
    </div>
  );
}
