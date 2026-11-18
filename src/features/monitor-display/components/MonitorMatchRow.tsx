import { useId, type CSSProperties } from 'react';
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
import { DEFAULT_FRAME, hyphenWordStaysTogether, nameCharsPerLine, rowHeight, type ListColumns, type ListFrame } from '../listRows';
import { compactRowHeight, compactTokens, namenBreiteEm, textBreiteEm } from '../listCompact';
import { MonitorTimeCell } from './MonitorTimeCell';
import { SlashBreaks } from '../../../components/ui/atoms/TeamName';

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
function NameText({ name, keep }: { name: string; keep: (teil: string) => boolean }) {
  // Umbruchstelle nach „/“ (@ZM-207): „SG Taching/Tengling“ bricht nie als „Ten-gling“
  return <SlashBreaks text={name} keep={keep} />;
}

/** Eine Zeile einer Spielliste: Uhrzeit, Feld, Paarung, Stand und Zusätze an festen Stellen (@ZM-187). */
export function MonitorMatchRow({ match, tournament, theme, showScore = false, columns, frame = DEFAULT_FRAME, reserveExtra = columns.state }: MonitorMatchRowProps) {
  const { t } = useTranslation(['tournament', 'sport']);
  const colors = monitorThemes[resolveTheme(theme)];
  // @ZM-211: schmale Zeitspalte, „(war …)“ unter der Uhrzeit, Schrift im Maßstab der Folie; sonst die Aufteilung von bisher
  const compact = frame.compact === true;
  const scale = frame.scale ?? 1;
  const list = compact ? compactTokens(scale, columns) : displayList;
  const perLine = nameCharsPerLine(frame);
  const keep = compact
    ? (teil: string) => teil.includes('-') && textBreiteEm(teil) <= namenBreiteEm(frame, columns, scale)
    : (teil: string) => hyphenWordStaysTogether(teil, perLine);
  const hoehe = (m: typeof match) => (compact ? compactRowHeight(m, columns, frame, scale, reserveExtra) : rowHeight(m, columns, frame, reserveExtra));
  // B-44b (@ZM-125, @ZM-087): Schrift relativ zur Bildhöhe, Namen umbrechen statt zu kürzen
  const cell: CSSProperties = {
    fontSize: list.fontSizes.team,
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

  const extraStyle: CSSProperties = { fontSize: list.fontSizes.note, fontWeight: cssVars.fontWeights.normal, color: colors.text, whiteSpace: 'nowrap', position: 'absolute', top: '100%', left: 0, right: 0, lineHeight: 1.2 };

  const labelId = useId();
  const cardHeight = hoehe({ ...match, labelText: undefined });
  return (
    <div
      data-testid="monitor-match-block"
      data-height-vh={String(hoehe(match))}
      role={match.labelText ? 'group' : undefined}
      aria-labelledby={match.labelText ? labelId : undefined}
      style={{ width: '100%' }}
    >
      {/* Spielbezeichnung („Halbfinale 1“) als Zwischenzeile über der Karte, waagrecht mittig über der Standspalte (Spalten wie in der Karte, listRows rechnet die Höhe ein) */}
      {match.labelText && (
        <div
          data-testid="monitor-match-labelline"
          style={{
            display: 'flex', gap: list.cellGap, width: '100%', boxSizing: 'border-box', fontSize: list.fontSizes.team,
            // Rand nur links und rechts (wie die Karte): oben und unten würde die Zeile höher als in listRows gerechnet
            padding: `0 ${list.rowPaddingX}`, borderStyle: 'solid', borderColor: 'transparent', borderWidth: `0 ${cssVars.borderWidth.thin}`, marginBottom: list.labelGap,
          }}
        >
          <div style={{ flex: `0 0 ${list.timeFieldWidth}` }} />
          <div style={{ flex: '1 1 0' }} />
          <div style={{ flex: `0 0 ${list.separatorWidth}`, display: 'flex', justifyContent: 'center' }}>
            <div id={labelId} data-testid="monitor-match-label" style={{ whiteSpace: 'nowrap', fontSize: list.fontSizes.timeNote, fontWeight: cssVars.fontWeights.bold, color: colors.text, lineHeight: 1.2 }}>{match.labelText}</div>
          </div>
          <div style={{ flex: '1 1 0' }} />
        </div>
      )}
      <div
        data-testid="monitor-match-row"
        data-match-id={match.id}
        data-status={match.status}
        style={{
          display: 'flex',
          // Uhrzeit, Teamnamen und Stand stehen senkrecht mittig (gemeinsame Mittelachse); Zusatzzeilen hängen darunter, außerhalb des Flusses
          alignItems: 'center',
          minHeight: `${String(cardHeight)}vh`,
          position: 'relative',
          gap: list.cellGap,
          width: '100%',
          padding: `${list.rowPaddingY} ${list.rowPaddingX}`,
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
          list={list}
          compact={compact}
        />
        <div data-teamname style={{ ...cell, flex: '1 1 0', textAlign: 'right' }}><NameText name={monitorSideLabel(match.home)} keep={keep} /></div>
        <div
          data-testid="monitor-match-separator"
          style={{
            ...cell,
            // Breite in em der Namensschrift (nicht der Standschrift): fest in jeder Zeile (@ZM-151, @ZM-187), listRows.ts rechnet auf derselben Basis
            flex: `0 0 ${list.separatorWidth}`,
            textAlign: 'center',
            // nur so hoch wie der Stand: mittig in der Zeile, „(4:3 i. E.)“ hängt darunter (außerhalb des Flusses)
            position: 'relative',
            height: `calc(${list.fontSizes.score} * 1.2)`,
          }}
        >
          <div
            data-testid="monitor-match-score"
            style={{
              // Stand: 1,5 × Namensschrift, so fett wie die Uhrzeit (VISUAL-DESIGN § 8)
              fontSize: list.fontSizes.score,
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
        <div data-teamname style={{ ...cell, flex: '1 1 0' }}><NameText name={monitorSideLabel(match.away)} keep={keep} /></div>
      </div>
    </div>
  );
}
