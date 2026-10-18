import { Trans, useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayLayout } from '../../design-tokens';
import type { FinalScore } from '../../core/view';
import { monitorTeamName } from '../../core/models/teamNameAbbrev';
import { Icons } from '../ui/Icons';

export interface LiveFinalScoreProps {
  color: string;
  /** Endstand der Ansicht: nach einem Strafstoßschießen (@ZM-147) steht die Siegerzeile statt der Beschriftung „Endstand“ */
  finalScore?: FinalScore;
  /** Namen der Mannschaften (Heim, Gast); die Siegerzeile nennt den Namen in der Monitor-Form (Vereinskürzel, @ZM-087) */
  names: { home: string; away: string };
  /** Farbe des Pokal-Symbols (Primärfarbe des Themas) */
  accent: string;
}

/**
 * „Endstand“ an der Stelle der Uhr, wenn das Spiel beendet ist (Entscheidung Daniel 2026-10-15); Lage bleibt im festen Raster.
 * Nach einem Strafstoßschießen steht dort die Siegerzeile „<Name> gewinnt“ mit Pokal (Mockup K5g, @ZM-147/@ZM-049);
 * das Strafstoßergebnis steht klein unter dem Doppelpunkt (`LivePenaltyResult`). Ohne Schützen-Reihen.
 */
export function LiveFinalScore({ color, finalScore, names, accent }: LiveFinalScoreProps) {
  const { t } = useTranslation('monitor');
  if (finalScore?.penalty === undefined || finalScore.winner === null) {
    return (
      <div data-testid="live-endstand" data-monitor="uhr" style={{ fontSize: displayFontSizes.clockXL, fontWeight: cssVars.fontWeights.bold, lineHeight: 1, color, textAlign: 'center' }}>
        {t('liveMatch.finalScore')}
      </div>
    );
  }
  const winner = monitorTeamName(finalScore.winner === 'a' ? names.home : names.away);
  return (
    <div
      data-testid="live-winner"
      data-monitor="uhr"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: cssVars.spacing.sm, maxWidth: displayLayout.scoreArea.teamNameWidth,
        fontSize: displayFontSizes.monitorWinner, lineHeight: displayLayout.scoreArea.hintLineHeight, color, textAlign: 'center', overflowWrap: 'anywhere',
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0, color: accent }}><Icons.Trophy size="1em" /></span>
      <span>
        {/* Mockup `.fin b`: Teamname fett (800), der Rest normal */}
        <Trans t={t} i18nKey="liveMatch.winnerLine" values={{ name: winner }} components={{ name: <strong data-testid="live-winner-name" style={{ fontWeight: 800 }} /> }} />
      </span>
    </div>
  );
}

/** Strafstoßergebnis klein unter dem Doppelpunkt (Mockup K5g `.px`): Beschriftung klein, Zahl groß; „nach Verlängerung“ nur, wenn es eine gab. */
export function LivePenaltyResult({ finalScore, color, mutedColor }: { finalScore: FinalScore; color: string; mutedColor: string }) {
  const { t } = useTranslation('monitor');
  const penalty = finalScore.penalty;
  if (penalty === undefined) {
    return null;
  }
  const small = { fontSize: displayFontSizes.clockHint, fontWeight: cssVars.fontWeights.bold, lineHeight: displayLayout.scoreArea.hintLineHeight, color: mutedColor } as const;
  return (
    <div data-testid="live-penalty-block" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap', textAlign: 'center' }}>
      <div data-testid="live-penalty">
        <span style={{ ...small, display: 'block' }}>{t('liveMatch.penaltyLabel')}</span>{' '}
        <span style={{ display: 'block', fontSize: displayFontSizes.teamName, fontWeight: cssVars.fontWeights.bold, lineHeight: displayLayout.scoreArea.hintLineHeight, color, fontVariantNumeric: 'tabular-nums' }}>
          {t('liveMatch.penaltyNumbers', { home: penalty.a, away: penalty.b })}
        </span>
      </div>
    </div>
  );
}
