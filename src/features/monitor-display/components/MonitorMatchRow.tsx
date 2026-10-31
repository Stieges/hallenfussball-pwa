import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayList, displayMonitor, monitorThemes } from '../../../design-tokens';
import { MatchStatusBadge } from '../../../components/ui/molecules/MatchStatusBadge';
import { ScoreBox } from '../../../components/ui/molecules/ScoreBox';
import { TeamName } from '../../../components/ui/molecules/TeamName';
import { ROW_BOX_WIDTH_EM, pairFrameStrength } from '../../../components/ui/molecules/scoreBoxStyle';
import { monitorBadgeTone } from '../../../components/ui/molecules/matchStatusBadgeStyle';
import type { Tournament } from '../../../types/tournament';
import type { MatchView } from '../../../core/view';
import type { MonitorTheme } from '../../../types/monitor';
import { getFieldDisplayName } from '../../../utils/displayNames';
import { resultFigures, tableResultExtra } from '../../../components/schedule/matchResult';
import { resolveTheme } from '../monitorDisplayHelpers';
import { monitorSideLabel, sideTeam } from '../matchSides';
import type { SideView } from '../../../core/view';
import { MonitorTimeCell } from './MonitorTimeCell';
import { rowBadgeWidth } from '../rowBadgeWidth';

interface MonitorMatchRowProps {
  /** Das Spiel der Ansicht: Status, Seitentexte, Anstoß und Endstand kommen von dort (A-36c). */
  match: MatchView;
  tournament: Tournament;
  theme: MonitorTheme;
  /** Ergebnis anzeigen (Spielplan, f3); die Folie „Nächste Spiele“ zeigt nie ein Ergebnis. */
  showScore?: boolean;
  /** Abzeichen mit dem Wort des Zustands vorn (Spielplan, @OB-066, @ZM-071); Standard aus. */
  showStatus?: boolean;
  /**
   * Lage von Logo bzw. Initialen: `beside` vor dem Namen (Finalrunde in „Alle Tabellen“) | `above` mittig über dem Namen, in jeder Zeile an
   * derselben Stelle (Spielplan eines Felds, @ZM-185) | `mirrored` Heimlogo hinter dem Heimnamen, Gastlogo vor dem Gastnamen, beide am Strich
   * (Nächste Spiele, @ZM-185).
   */
  logoPlacement?: 'beside' | 'above' | 'mirrored';
}

/** Eine Zeile einer Spielliste: Uhrzeit, Feld, Paarung (optional Ergebnis und Bezeichnung). */
export function MonitorMatchRow({ match, tournament, theme, showScore = false, showStatus = false, logoPlacement = 'beside' }: MonitorMatchRowProps) {
  const { t } = useTranslation('tournament');
  const colors = monitorThemes[resolveTheme(theme)];
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
  // „ausgefallen“ trägt das Abzeichen (ohne Ergebnis), „gewertet“ steht neben dem Ergebnis (@ZM-104)
  const note = match.status === 'awarded' ? t('view.status.awarded') : undefined;
  // @ZM-160: der Stand steht in Kästen in der getragenen Farbe (`match.boxes`); ohne Stand und vor dem Anpfiff gibt es keinen Kasten
  const withBoxes = showScore && figures !== null;
  const frameStrength = pairFrameStrength({ fill: match.boxes.home.fill }, { fill: match.boxes.away.fill }, colors.surface);
  const box = (side: 'home' | 'away', goals: number) => (
    <ScoreBox
      score={goals} fill={match.boxes[side].fill} size="row" background={colors.surface} textColor={colors.text}
      ringColor={colors.progressBar} bib={match.boxes[side].bib} frameStrength={frameStrength}
      ariaLabel={`${monitorSideLabel(match[side])}: ${goals}`} testId={`monitor-match-box-${side}`}
    />
  );
  // @ZM-157: Logo bzw. Initialen vor dem Namen, offene Seite mit neutralem Platzhalter (RF4); der Name bricht um, nie „…“
  const above = logoPlacement === 'above';
  const teamOf = (side: 'home' | 'away', align: 'start' | 'end') => {
    const view: SideView = match[side];
    const known = sideTeam(view, tournament.teams);
    const label = monitorSideLabel(view);
    return (
      <div style={{ ...cell, flex: '1 1 0', ...(above ? { alignSelf: 'flex-start' } : {}) }}>
        <TeamName
          team={{ name: label, logo: known?.logo, colors: known?.colors, pending: view.pending }}
          name={<span data-teamname style={{ ...cell, textAlign: above ? 'center' : align === 'end' ? 'right' : 'left', display: 'block' }}>{label}</span>}
          avatarNeutral={{ background: colors.surfaceHover, color: colors.text, border: colors.border }}
          layout="inline" avatarSize="list" addons={[]} reserveAddonLines={0} justify={above ? 'center' : align}
          avatarPlacement={above ? 'above' : logoPlacement === 'mirrored' && side === 'home' ? 'after' : 'before'}
          testId={`monitor-match-team-${side}`}
        />
      </div>
    );
  };

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
      {showStatus && (
        // Feste Breite: die Spalten springen nicht, auch wenn ein Spiel noch kein Abzeichen trägt (@ZM-151)
        <div data-testid="monitor-match-status" style={{ flex: `0 0 ${rowBadgeWidth(tournament)}`, display: 'flex', fontSize: displayFontSizes.liveBadge }}>
          {match.badge.kind === 'badge' && <MatchStatusBadge model={match.badge} size="display" tone={monitorBadgeTone(colors)} />}
        </div>
      )}
      <MonitorTimeCell
        match={match}
        fieldName={getFieldDisplayName(match.field, tournament)}
        color={colors.text}
        fieldColor={colors.textMuted}
        noteColor={colors.text}
        style={{ ...cell, fontWeight: cssVars.fontWeights.semibold }}
      />
      {teamOf('home', 'end')}
      <div
        data-testid="monitor-match-separator"
        style={{
          ...cell,
          flex: '0 0 auto',
          minWidth: showScore ? `calc(${2 * ROW_BOX_WIDTH_EM}em + 2 * ${displayList.cellGap} + ${displayList.colonWidth})` : displayList.separatorWidth,
          textAlign: 'center',
          fontWeight: showScore ? cssVars.fontWeights.bold : cssVars.fontWeights.normal,
          color: showScore ? colors.text : colors.textMuted,
        }}
      >
        {withBoxes && figures !== null ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: displayList.cellGap }}>
            {box('home', figures.goalsA)}
            <span aria-hidden="true" style={{ display: 'inline-block', width: displayList.colonWidth, textAlign: 'center' }}>:</span>
            {box('away', figures.goalsB)}
          </div>
        ) : showScore ? score : '–'}
        {showScore && scoreExtra && (
          <div data-testid="monitor-match-extra" style={{ fontSize: displayList.fontSizes.head, fontWeight: cssVars.fontWeights.normal, color: colors.textMuted, whiteSpace: 'nowrap' }}>
            {scoreExtra}
          </div>
        )}
      </div>
      {teamOf('away', 'start')}
      {match.labelText && (
        <div style={{ ...cell, color: colors.textMuted, flex: '0 1 auto', maxWidth: displayList.labelMaxWidth }}>{match.labelText}</div>
      )}
      {note && (
        <div data-testid="monitor-match-note" style={{ ...cell, color: colors.textMuted, flex: '0 1 auto', maxWidth: displayList.labelMaxWidth }}>{note}</div>
      )}
    </div>
  );
}
