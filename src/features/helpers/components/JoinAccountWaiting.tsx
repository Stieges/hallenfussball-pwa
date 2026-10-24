/**
 * „Erst verbinden – N Einträge warten“ (A-17b, Mockup M1 `e4`, @HE-092): Auf dem Gerät warten Einträge des angemeldeten
 * Kontos; ein Abmelden wäre ein Datenverlust-Risiko, also gibt es kein „Weiter“. Die Haupttaste prüft Verbindung und Einträge
 * noch einmal (Review #331 N-7). Ist die Zahl nicht zählbar (`null`), steht der Text ohne Zahl (gesperrt, fail-closed).
 */
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { JoinNotice } from './JoinNotice';

export interface JoinAccountWaitingProps {
  waitingCount: number | null;
  onRecheck: () => void;
}

export const JoinAccountWaiting = ({ waitingCount, onRecheck }: JoinAccountWaitingProps) => {
  const { t } = useTranslation('helpers');
  const known = waitingCount !== null;
  return (
    <>
      <JoinNotice
        tone="warn"
        icon={<Icons.WifiOff size={iconSizeValues.sm} />}
        title={known ? t('join.account.waitingTitleCount', { count: waitingCount }) : t('join.account.waitingTitleUnknown')}
        text={known ? t('join.account.waitingTextCount', { count: waitingCount }) : t('join.account.waitingTextUnknown')}
        data-testid="join-pending-entries"
      />
      <Button
        variant="primary"
        fullWidth
        onClick={onRecheck}
        icon={<Icons.Refresh size={iconSizeValues.sm} />}
        style={{ minHeight: cssVars.touchTargets.primary, fontSize: cssVars.fontSizes.lg }}
        data-primary
        data-testid="join-retry"
      >
        {t('join.retry')}
      </Button>
    </>
  );
};
