/**
 * LiveScoreGrid – Raster der Live-Folie: Kästen, Doppelpunkt, Namen (@ZM-140) und das Ende (Mockup K5g, @ZM-147/@ZM-049):
 * Sieger-Kasten mit Ring (Pokal-Kreis nur in der Finalrunde), Verlierer zurückgenommen, Strafstoßergebnis klein unter dem Doppelpunkt.
 */
import { CSSProperties, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayLayout, displaySizes } from '../../design-tokens';
import type { monitorThemes } from '../../design-tokens';
import type { MonitorTheme } from '../../types/monitor';
import type { FinalScore } from '../../core/view';
import type { LiveMatch } from '../../hooks/useLiveMatches';
import { Icons } from '../ui/Icons';
import { ScoreBlock } from './ScoreBlock';
import { TeamNameDisplay } from './TeamNameDisplay';
import { LivePenaltyResult } from './LiveFinalScore';
import { TEAM_NAME_ZEILENHOEHE, gemeinsameNamenGroesse } from './teamNameFit';
import type { BlockFrame } from './liveBlockFrame';

export interface LiveScoreGridProps {
  match: LiveMatch;
  size: 'md' | 'lg' | 'xl';
  theme: MonitorTheme;
  themeColors: (typeof monitorThemes)[keyof typeof monitorThemes];
  hideScore: boolean;
  homeColor: string;
  awayColor: string;
  frames: { home: BlockFrame; away: BlockFrame };
  /** Endstand der Ansicht; nur ein beendetes Spiel trägt Ring, Pokal und Strafstoßergebnis */
  finalScore?: FinalScore;
  /** Finalrunde: nur dort bekommt der Sieger den Pokal (Ring hat jeder Sieger, Spec 4.5) */
  finalRound?: boolean;
}

const layout = displayLayout.scoreArea;
/** Mit Strafstoßergebnis in der Mitte sind die Namen um diesen Anteil schmaler als der Kasten: Platz für „Strafstoßschießen“ zwischen den Namen (Mockup K5g) */
const PENALTY_NAME_SHARE = 0.8;
/** Pokal-Kreis (Mockup K5g `.cup`): Versatz über/rechts neben der Kastenecke als Bruchteil des Kreisdurchmessers, Symbolgröße als Anteil, Strichstärke des Symbols */
const CUP_OFFSET_TOP_DIVISOR = 3;
const CUP_OFFSET_RIGHT_DIVISOR = 5;
const CUP_ICON_SHARE = 0.6;
const CUP_ICON_STROKE = 2.4;

export function LiveScoreGrid({ match, size, theme, themeColors, hideScore, homeColor, awayColor, frames, finalScore, finalRound = false }: LiveScoreGridProps) {
  const { t } = useTranslation('monitor');
  // B3: beide Teamnamen in derselben Größe (die kleinere der beiden passenden)
  const [namePx, setNamePx] = useState<{ home?: number; away?: number }>({});
  const onHomePx = useCallback((px: number) => setNamePx(p => (p.home === px ? p : { ...p, home: px })), []);
  const onAwayPx = useCallback((px: number) => setNamePx(p => (p.away === px ? p : { ...p, away: px })), []);
  const sharedNamePx = gemeinsameNamenGroesse(namePx.home, namePx.away);

  // Sieger/Verlierer nur nach dem Abpfiff und mit Entscheidung; ein Unentschieden in der Gruppe hat weder Ring noch Pokal; der Pokal nur in der Finalrunde
  const winner = !hideScore && match.status === 'FINISHED' ? finalScore?.winner ?? null : null;
  const outcomeOf = (side: 'a' | 'b') => (winner === null ? undefined : winner === side ? 'winner' : 'loser');
  const withPenalty = winner !== null && finalScore?.penalty !== undefined;

  // @ZM-140 Raster: Kasten (Zeile 1) und Namen (Zeile 2) teilen sich ein Raster, Spalten 1 | 2 | 3
  // B-44a2: Zeile 1 hat die feste Kastenhöhe (auch im Kindermodus, gleiche Lage), Zeile 2 reserviert zwei Namenszeilen
  // Dazu eine Zeile für Zusätze unter dem Namen („nach Verlängerung“, @ZM-156/@ZM-157), in jedem Zustand reserviert: die Kästen springen nicht (@ZM-151)
  const addonLineHeight = `calc(${displayFontSizes.clockHint} * ${layout.hintLineHeight})`;
  const nameRowHeight = `calc(${displayFontSizes.teamName} * ${TEAM_NAME_ZEILENHOEHE * layout.nameLines} + ${addonLineHeight})`;
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1fr) ${layout.separatorWidth} minmax(0, 1fr)`,
    gridTemplateRows: `${layout.blockHeight} ${nameRowHeight}`,
    columnGap: layout.blockGap,
    rowGap: layout.teamNamesGap,
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

  // Pokal-Kreis oben rechts am Sieger-Kasten (Mockup K5g `.cup`), Maße aus `monitorCup`
  const cupStyle: CSSProperties = {
    position: 'absolute',
    top: `calc(${layout.monitorCup} / -${CUP_OFFSET_TOP_DIVISOR})`,
    right: `calc(${layout.monitorCup} / -${CUP_OFFSET_RIGHT_DIVISOR})`,
    width: layout.monitorCup,
    height: layout.monitorCup,
    borderRadius: cssVars.borderRadius.full,
    background: themeColors.progressBar,
    color: themeColors.background,
    border: `${layout.frameWidthSubtle} solid ${themeColors.background}`,
    fontSize: `calc(${layout.monitorCup} * ${CUP_ICON_SHARE})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
  };

  const block = (side: 'a' | 'b') => {
    const home = side === 'a';
    return (
      <div style={blockCellStyle(home ? 1 : 3)} data-testid={home ? 'live-block-home' : 'live-block-away'}>
        <ScoreBlock
          score={home ? match.homeScore : match.awayScore}
          backgroundColor={home ? homeColor : awayColor}
          position={home ? 'home' : 'away'}
          size={size}
          frame={home ? frames.home : frames.away}
          outcome={outcomeOf(side)}
          ringColor={themeColors.progressBar}
          dimColor={themeColors.background}
        />
        {winner === side && finalRound && (
          <span style={cupStyle} role="img" aria-label={t('liveMatch.winnerAria')} data-testid={`live-cup-${home ? 'home' : 'away'}`}>
            <Icons.Trophy size="1em" strokeWidth={CUP_ICON_STROKE} />
          </span>
        )}
      </div>
    );
  };

  const name = (side: 'a' | 'b') => {
    const home = side === 'a';
    return (
      <div style={nameCellStyle(home ? 1 : 3)} data-testid={home ? 'live-name-home' : 'live-name-away'}>
        <TeamNameDisplay
          name={home ? match.homeTeam.name : match.awayTeam.name}
          size={size}
          theme={theme}
          maxWidth="100%"
          fontSize={hideScore ? displayFontSizes.teamNameKids : undefined}
          sizePx={sharedNamePx}
          onFitPx={home ? onHomePx : onAwayPx}
          emphasis={outcomeOf(side)}
        />
        {/* unter dem Namen des Siegers (Spec 4.4): Sieg nach Verlängerung, mit oder ohne Strafstoßschießen */}
        {winner === side && finalScore?.overtime !== undefined && (
          <div data-testid="live-after-overtime" style={{ fontSize: displayFontSizes.clockHint, fontWeight: cssVars.fontWeights.bold, lineHeight: layout.hintLineHeight, color: themeColors.textSecondary, whiteSpace: 'nowrap' }}>
            {t('liveMatch.afterOvertime')}
          </div>
        )}
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
