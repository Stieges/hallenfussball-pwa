/**
 * Hinweis und Wahl der Eröffnung im Schritt „Teams“ (@W4-034, @W4-033, @W4-048, @W4-041, @W4-044).
 * Eine markierte Mannschaft: nur der Hinweis. Zwei oder mehr ohne Wahl (kein Runden-Spielplan, verschiedene Gruppen):
 * Hinweis, dass eine von ihnen eröffnet. Wahl mit drei Arten nur, wenn `summary.openingChoice`.
 */
import { useTranslation } from 'react-i18next';
import { ChoiceCard } from '../../../components/ui/molecules/ChoiceCard';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { Icons } from '../../../components/ui';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { OPENING_MODES, type OpeningMode } from '../../../types/tournament';
import { HOST_MODE_TEXT } from './hostModeTexts';
import type { HostSummary } from '../utils/hostOpeningSummary';

export interface HostOpeningChoiceProps {
  summary: HostSummary;
  onChange: (mode: OpeningMode) => void;
}

const MODE_ICON: Record<OpeningMode, React.ReactNode> = {
  'guest-opening': <Icons.User size={iconSizeValues.sm} />, 'club-derby': <Icons.Users size={iconSizeValues.sm} />, 'both-home': <Icons.List size={iconSizeValues.sm} />,
};

export const HostOpeningChoice: React.FC<HostOpeningChoiceProps> = ({ summary, onChange }) => {
  const { t } = useTranslation('wizard');
  const [first, second] = summary.teams;
  if (!summary.openingChoice) {
    return (
      <div data-testid="wizard-host-hint">
        <InlineNotice tone="info">
          {second === undefined
            ? t('step4.host.single', { name: first.name })
            : t('step4.host.oneOfThem', { names: summary.teams.map((team) => team.name).join(', ') })}
        </InlineNotice>
      </div>
    );
  }
  return (
    <div data-testid="wizard-host-choice" style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm }}>
      <strong style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.md }}>{t('step4.host.choiceTitle')}</strong>
      <div role="radiogroup" aria-label={t('step4.host.choiceTitle')} style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm }}>
        {OPENING_MODES.map((mode) => (
          <ChoiceCard
            key={mode}
            title={t(HOST_MODE_TEXT[mode].title as 'step4.host.mode.guest.title')}
            description={t(HOST_MODE_TEXT[mode].description as 'step4.host.mode.derby.description', { a: first.name, b: second.name })}
            icon={MODE_ICON[mode]}
            selected={summary.mode === mode}
            onSelect={() => onChange(mode)}
            data-testid={`wizard-opening-${mode}`}
          />
        ))}
      </div>
    </div>
  );
};
