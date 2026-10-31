/**
 * LiveScoreGrid – Raster der Live-Folie: Kästen, Doppelpunkt, Namen (@ZM-140) und das Ende (Mockup K5g, @ZM-147/@ZM-049):
 * Sieger-Kasten mit Ring (Pokal-Kreis nur in der Finalrunde), Verlierer zurückgenommen, Strafstoßergebnis klein unter dem Doppelpunkt.
 * Kästen sind `ScoreBox` (Weste, Ecken, Ring), Namen `TeamName` (Logo bzw. Initialen mittig darüber, zwei freigehaltene Zusatzzeilen, @ZM-157).
 */
import { CSSProperties, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayLayout, displaySizes } from '../../design-tokens';
import type { monitorThemes } from '../../design-tokens';
import type { MonitorTheme } from '../../types/monitor';
import type { FinalScore, MatchView } from '../../core/view';
import type { LiveMatch } from '../../hooks/useLiveMatches';
import { ScoreBox } from '../ui/molecules/ScoreBox';
import { TeamName } from '../ui/molecules/TeamName';
import { pairFrameStrength } from '../ui/molecules/scoreBoxStyle';
import { TeamNameDisplay } from './TeamNameDisplay';
import { LivePenaltyResult } from './LiveFinalScore';
import { TEAM_NAME_ZEILENHOEHE, gemeinsameNamenGroesse } from './teamNameFit';

export interface LiveScoreGridProps {
  match: LiveMatch;
  size: 'md' | 'lg' | 'xl';
  theme: MonitorTheme;
  themeColors: (typeof monitorThemes)[keyof typeof monitorThemes];
  hideScore: boolean;
  /** Kästen je Seite (`MatchView.boxes`): Farbe bzw. Weste und Leibchen-Zeichen */
  boxes: MatchView['boxes'];
  /** Endstand der Ansicht; nur ein beendetes Spiel trägt Ring, Pokal und Strafstoßergebnis */
  finalScore?: FinalScore;
  /** Finalrunde: nur dort bekommt der Sieger den Pokal (Ring hat jeder Sieger, Spec 4.5) */
  finalRound?: boolean;
}

const layout = displayLayout.scoreArea;
/** Mit Strafstoßergebnis in der Mitte sind die Namen um diesen Anteil schmaler als der Kasten: Platz für „Strafstoßschießen“ zwischen den Namen (Mockup K5g) */
const PENALTY_NAME_SHARE = 0.8;
/** Zusatzzeilen unter dem Namen, in jedem Zustand freigehalten (@ZM-157, @ZM-151) */
const ADDON_LINES = 2;

export function LiveScoreGrid({ match, size, theme, themeColors, hideScore, boxes, finalScore, finalRound = false }: LiveScoreGridProps) {
  const { t } = useTranslation('monitor');
  // B3: beide Teamnamen in derselben Größe (die kleinere der beiden passenden)
  const [namePx, setNamePx] = useState<{ home?: number; away?: number }>({});
  const onHomePx = useCallback((px: number) => setNamePx(p => (p.home === px ? p : { ...p, home: px })), []);
  const onAwayPx = useCallback((px: number) => setNamePx(p => (p.away === px ? p : { ...p, away: px })), []);
  const sharedNamePx = gemeinsameNamenGroesse(namePx.home, namePx.away);

  // Sieger/Verlierer nur nach dem Abpfiff und mit Entscheidung; ein Unentschieden in der Gruppe hat weder Ring noch Pokal; der Pokal nur in der Finalrunde
  const winner = !hideScore && match.status === 'FINISHED' ? finalScore?.winner ?? null : null;
  const outcomeOf = (side: 'a' | 'b') => (winner === null ? undefined : winner === side ? 'winner' : 'loser');
  // Strafstoßergebnis: nach dem Ende mit Sieger, im laufenden Strafstoßschießen als Zwischenstand am selben Platz (@ZM-047:teil)
  const shootoutRunning = match.status === 'RUNNING' || match.status === 'PAUSED';
  const withPenalty = !hideScore && finalScore?.penalty !== undefined && (winner !== null || shootoutRunning);
  // Rahmenbreite aus den getragenen Farben, nicht aus der gedämpften: sie ändert sich am Ende nicht (@ZM-151)
  const frameStrength = pairFrameStrength({ fill: boxes.home.fill }, { fill: boxes.away.fill }, themeColors.background);

  // @ZM-140 Raster: Kasten (Zeile 1) und Namen (Zeile 2) teilen sich ein Raster, Spalten 1 | 2 | 3
  // B-44a2: Zeile 1 hat die feste Kastenhöhe (auch im Kindermodus, gleiche Lage), Zeile 2 reserviert zwei Namenszeilen
  // Dazu zwei Zeilen für Zusätze unter dem Namen („nach Verlängerung“, @ZM-156/@ZM-157), in jedem Zustand reserviert: die Kästen springen nicht (@ZM-151)
  const addonLineHeight = `calc(${displayFontSizes.clockHint} * ${layout.clockLineHeight})`;
  // @ZM-157: Logo bzw. Initialen mittig über dem Namen, direkt unter dem Kasten – Höhe und Abstand kommen zur Namenszeile dazu
  const nameRowHeight = `calc(${layout.avatarSize} + ${layout.avatarGap} + ${displayFontSizes.teamName} * ${TEAM_NAME_ZEILENHOEHE * layout.nameLines} + ${addonLineHeight} * ${ADDON_LINES})`;
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1fr) ${layout.separatorWidth} minmax(0, 1fr)`,
    gridTemplateRows: `${layout.blockHeight} ${nameRowHeight}`,
    columnGap: layout.blockGap,
    // Abstand Kasten zu Namen = Ringbreite (der Ring liegt außen, die Zeilenhöhe des Namens lässt oben Luft); die Höhe geht an die zwei Zusatzzeilen (@ZM-157)
    rowGap: layout.frameWidthStrong,
    alignItems: 'center',
    width: '100%',
    flexShrink: 0,
  };

  // B-44a2: Doppelpunkt genau mittig – Zelle ohne Breite, Flex mit Mitte lässt das Zeichen nach beiden Seiten gleich überstehen
  const centeredCell: CSSProperties = { gridRow: 1, gridColumn: 2, display: 'flex', justifyContent: 'center', justifySelf: 'center', width: 0 };
  const separatorStyle: CSSProperties = {
    ...centeredCell,
    alignSelf: 'center',
    fontSize: size === 'xl' ? displayFontSizes.liveSeparator : displaySizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    lineHeight: 1,
    color: themeColors.textSecondary,
    userSelect: 'none',
  };

  const blockCellStyle = (column: 1 | 3): CSSProperties => ({
    gridRow: 1,
    gridColumn: column,
    display: 'flex',
    justifyContent: 'center',
    justifySelf: 'center',
    position: 'relative',
    width: layout.blockWidth,
    height: layout.blockHeight,
    minWidth: 0,
  });

  // B-44a2: Namen oben bündig unter dem Kasten, höchstens so breit wie der Kasten; im Kindermodus mittig über beide Zeilen (kein Kasten darüber).
  // Mit Strafstoßergebnis in der Mitte schmaler als der Kasten, damit nichts überlappt (@ZM-087).
  const nameCellStyle = (column: 1 | 3): CSSProperties => ({
    gridRow: hideScore ? 1 : 2,
    gridColumn: column,
    justifySelf: 'center',
    alignSelf: 'start',
    marginTop: hideScore ? layout.kidsNamesOffset : undefined,
    width: withPenalty ? `calc(${layout.blockWidth} * ${PENALTY_NAME_SHARE})` : layout.teamNameWidth,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '100%',
  });

  const block = (side: 'a' | 'b') => {
    const home = side === 'a';
    const sideBox = home ? boxes.home : boxes.away;
    const cup = winner === side && finalRound;
    // Zugänglicher Name wie bisher am ScoreBlock (Wortlaut „Heim: 2“ von Tests gepinnt), in der Finalrunde beim Sieger dazu „Pokal“; die Zeichen selbst sind dekorativ
    const ariaLabel = [`${home ? 'Heim' : 'Gast'}: ${home ? match.homeScore : match.awayScore}`, cup ? t('liveMatch.winnerAria') : ''].filter(Boolean).join(', ');
    return (
      <div style={blockCellStyle(home ? 1 : 3)} data-testid={home ? 'live-block-home' : 'live-block-away'}>
        <ScoreBox
          score={home ? match.homeScore : match.awayScore}
          fill={sideBox.fill}
          size="display"
          background={themeColors.background}
          textColor={themeColors.text}
          outcome={outcomeOf(side)}
          ringColor={themeColors.progressBar}
          cup={cup}
          bib={sideBox.bib}
          frameStrength={frameStrength}
          ariaLabel={ariaLabel}
          testId={home ? 'live-box-home' : 'live-box-away'}
        />
      </div>
    );
  };

  const name = (side: 'a' | 'b') => {
    const home = side === 'a';
    const team = home ? match.homeTeam : match.awayTeam;
    // unter dem Namen des Siegers (Spec 4.4): Sieg nach Verlängerung, mit oder ohne Strafstoßschießen
    const addons = winner === side && finalScore?.overtime !== undefined ? [t('liveMatch.afterOvertime')] : [];
    return (
      <div style={nameCellStyle(home ? 1 : 3)} data-testid={home ? 'live-name-home' : 'live-name-away'}>
        <TeamName
          team={team}
          layout="stacked"
          avatarSize="display"
          avatarPlacement="above"
          avatarGap={layout.avatarGap}
          avatarNeutral={{ background: themeColors.surfaceHover, color: themeColors.text, border: themeColors.border }}
          addons={addons}
          reserveAddonLines={ADDON_LINES}
          emphasis={outcomeOf(side)}
          addonColor={themeColors.textSecondary}
          addonFontSize={displayFontSizes.clockHint}
          addonLineHeight={layout.clockLineHeight}
          testId={home ? 'live-team-home' : 'live-team-away'}
          name={
            <TeamNameDisplay
              name={team.name}
              size={size}
              theme={theme}
              maxWidth="100%"
              fontSize={hideScore ? displayFontSizes.teamNameKids : undefined}
              sizePx={sharedNamePx}
              onFitPx={home ? onHomePx : onAwayPx}
              emphasis={outcomeOf(side)}
            />
          }
        />
      </div>
    );
  };

  return (
    <div style={gridStyle} data-testid="live-grid">
      {!hideScore && block('a')}
      {!hideScore && <span style={separatorStyle} data-testid="live-separator">:</span>}
      {!hideScore && block('b')}
      {name('a')}
      {name('b')}
      {withPenalty && finalScore && (
        <div style={{ ...centeredCell, gridRow: 2, alignSelf: 'start', overflow: 'visible' }}>
          <LivePenaltyResult finalScore={finalScore} color={themeColors.text} mutedColor={themeColors.textSecondary} />
        </div>
      )}
      {/* Kindermodus (@W2A-031): lesbar in Textfarbe, in der Namenszeile (Kastenreihe zeigt die Namen) */}
      {hideScore && (
        <div
          data-testid="live-without-result"
          style={{ gridRow: 2, gridColumn: '1 / 4', justifySelf: 'center', alignSelf: 'start', fontSize: displayFontSizes.clockHint, color: themeColors.text, textAlign: 'center' }}
        >
          {t('liveMatch.withoutResult')}
        </div>
      )}
    </div>
  );
}
