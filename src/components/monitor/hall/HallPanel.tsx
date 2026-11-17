/**
 * HallPanel – eine Farbfläche der Live-Folie im Profil „Halle (sehr fern)“ (@ZM-213, @ZM-214): oben der Teamname in höchstens zwei
 * Zeilen, darunter die Torzahl, an derselben Stelle in jedem Zustand. Getragene Farbe als Fläche (bestätigte Leibchen: Leibchenfarbe
 * mit dem Leibchen-Zeichen klein oben links; ohne Trikotfarbe: das Fallback-Streifenmuster), Schrift schwarz oder weiß nach Kontrast
 * (mindestens 4,5 : 1), Ring beim Sieger, Verlierer gedämpft, Pokal (Finalrunde) oben rechts. Logos entfallen in diesem Profil.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { SideBox } from '../../../core/models/scoreBoxColors';
import type { OeffentlicheZeitstrafen } from '../../../core/view';
import type { MonitorThemeColors } from '../../../design-tokens';
import { Icons } from '../../ui/Icons';
import { VestGlyph } from '../../ui/molecules/VestGlyph';
import type { FrameStrength, ScoreBoxOutcome } from '../../ui/molecules/scoreBoxStyle';
import { LivePenaltyCircles } from '../LivePenaltyCircles';
import { HallTeamName } from './HallTeamName';
import { digitStyle, markStyle, nameFieldStyle, panelStyle } from './hallStyles';

const CUP_ICON_STROKE = 2.4;

export interface HallPanelProps {
  side: 'home' | 'away';
  name: string;
  /** `null` = keine Ziffer (Kindermodus); der Platz bleibt frei */
  score: number | null;
  box: SideBox;
  outcome?: ScoreBoxOutcome;
  /** Pokal oben rechts (Aufrufer entscheidet: Sieger in der Finalrunde) */
  cup: boolean;
  frame: FrameStrength;
  colors: MonitorThemeColors;
  sizePx?: number;
  onFitPx?: (px: number) => void;
  zeitstrafen?: OeffentlicheZeitstrafen;
}

export function HallPanel({ side, name, score, box, outcome, cup, frame, colors, sizePx, onFitPx, zeitstrafen }: HallPanelProps): ReactElement {
  const { t } = useTranslation('monitor');
  const aria = [`${side === 'home' ? 'Heim' : 'Gast'}: ${score === null ? '' : String(score)}`, cup ? t('liveMatch.winnerAria') : null, box.bib ? t('liveMatch.bibAria') : null]
    .filter((part) => part !== null).join(', ');
  return (
    <div
      role="group"
      aria-label={aria}
      style={panelStyle({ box, outcome, colors, frame })}
      data-testid={`hall-panel-${side}`}
      data-position={side}
      data-fill={box.fill.kind}
      {...(outcome === undefined ? {} : { 'data-outcome': outcome })}
    >
      <div style={nameFieldStyle} data-testid={`hall-name-${side}`}>
        <HallTeamName name={name} outcome={outcome} sizePx={sizePx} onFitPx={onFitPx} testId={`hall-teamname-${side}`} />
      </div>
      {score !== null && (
        <span style={digitStyle} data-monitor="stand" data-testid={`hall-digits-${side}`}>{score}</span>
      )}
      {box.bib && (
        <span style={markStyle('bib', colors)} aria-hidden="true" data-testid={`hall-bib-${side}`}><VestGlyph /></span>
      )}
      {cup && (
        <span style={markStyle('cup', colors)} aria-hidden="true" data-testid={`hall-cup-${side}`}><Icons.Trophy size="1em" strokeWidth={CUP_ICON_STROKE} /></span>
      )}
      {zeitstrafen && <LivePenaltyCircles side={side} zeitstrafen={zeitstrafen} themeColors={colors} />}
    </div>
  );
}
