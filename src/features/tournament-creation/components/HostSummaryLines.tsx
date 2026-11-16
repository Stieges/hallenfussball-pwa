/**
 * Mannschaften des Veranstalters, gewählte Eröffnung, Spiel des Vereinsduells und Zahl der direkten Folgen
 * (@W4-034, @W4-048, @W4-050) – für die Übersicht und das Fenster „Neuplanung prüfen“.
 */
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { HOST_MODE_TEXT } from './hostModeTexts';
import type { HostSummary } from '../utils/hostOpeningSummary';

export const HostSummaryLines: React.FC<{ summary: HostSummary }> = ({ summary }) => {
  const { t } = useTranslation('wizard');
  const line = { margin: `${cssVars.spacing.xs} 0 0 0`, fontSize: cssVars.fontSizes.sm } as const;
  const effective = summary.bothHomeFailed ? 'guest-opening' : summary.mode;
  return (
    <div data-testid="host-summary">
      <div data-testid="host-summary-teams">{summary.teams.map((team) => team.name).join(', ')}</div>
      {summary.openingChoice && (
        <p style={line} data-testid="host-summary-mode">
          {t('step5.host.opening', { mode: t(HOST_MODE_TEXT[effective].title as 'step4.host.mode.guest.title') })}
        </p>
      )}
      {summary.bothHomeFailed && <p style={line} data-testid="host-summary-both-home-failed">{t('step5.host.bothHomeFailed')}</p>}
      {summary.openingChoice && summary.mode === 'both-home' && !summary.bothHomeFailed && summary.duelNumber !== undefined && (
        <p style={line} data-testid="host-summary-duel">{t('step5.host.duel', { number: summary.duelNumber })}</p>
      )}
      {summary.openingChoice && summary.follows !== undefined && (
        <p style={line} data-testid="host-summary-follows">{(summary.follows === 0 ? t('step5.host.followsNone') : t('step5.host.follows', { count: summary.follows }))}</p>
      )}
    </div>
  );
};
