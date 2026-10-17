import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayLayout } from '../../design-tokens';
import { monitorTeamName } from '../../core/models/teamNameAbbrev';
import type { FinalScore } from '../../core/view';

export interface LiveFinalScoreProps {
  color: string;
  /** Endstand der Ansicht: nach einem Strafstoßschießen (@ZM-147) steht „Strafstoßschießen 4 : 3“ statt „Endstand“ */
  finalScore?: FinalScore;
  /** Namen der Mannschaften (Heim, Gast); die Siegerzeile nennt den Namen in der Monitor-Form (Vereinskürzel, @ZM-087) */
  names: { home: string; away: string };
}

/**
 * „Endstand“ an der Stelle der Uhr, wenn das Spiel beendet ist (Entscheidung Daniel 2026-10-15); Lage bleibt im festen Raster.
 * Nach einem Strafstoßschießen steht dort das Strafstoßergebnis mit dem Sieger (Mockup K5g, @ZM-147) – ohne
 * Schützen-Reihen und ohne leere Platzhalter, wenn nur das Ergebnis eingetragen wurde.
 */
export function LiveFinalScore({ color, finalScore, names }: LiveFinalScoreProps) {
  const { t } = useTranslation('monitor');
  const penalty = finalScore?.penalty;
  if (penalty === undefined) {
    return (
      <div data-testid="live-endstand" data-monitor="uhr" style={{ fontSize: displayFontSizes.clockXL, fontWeight: cssVars.fontWeights.bold, lineHeight: 1, color, textAlign: 'center' }}>
        {t('liveMatch.finalScore')}
      </div>
    );
  }
  return (
    <div data-testid="live-endstand" data-monitor="uhr" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: cssVars.spacing.xs, maxWidth: displayLayout.scoreArea.teamNameWidth, color, textAlign: 'center' }}>
      <div data-testid="live-penalty" style={{ fontSize: displayFontSizes.teamName, fontWeight: cssVars.fontWeights.bold, lineHeight: displayLayout.scoreArea.hintLineHeight, fontVariantNumeric: 'tabular-nums' }}>
        {t('liveMatch.penaltyScore', { home: penalty.a, away: penalty.b })}
      </div>
      {finalScore?.winner !== undefined && finalScore.winner !== null && (
        <div data-testid="live-winner" style={{ fontSize: displayFontSizes.liveInfo, fontWeight: cssVars.fontWeights.semibold, lineHeight: displayLayout.scoreArea.hintLineHeight, overflowWrap: 'anywhere' }}>
          {t('liveMatch.winnerLine', { name: monitorTeamName(finalScore.winner === 'a' ? names.home : names.away) })}
        </div>
      )}
    </div>
  );
}
