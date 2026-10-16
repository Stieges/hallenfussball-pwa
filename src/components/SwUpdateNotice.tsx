/**
 * Persistenter Update-Hinweis (C3b-2d, G8): meldet eine wartende neue
 * App-Version und bleibt stehen (kein Auto-Ausblenden). Der Knopf
 * „Jetzt aktualisieren“ lädt sofort neu — auch wenn Einträge im Ausgang
 * warten (sie liegen in IndexedDB und überstehen das Neuladen).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../design-tokens';
import { Button } from './ui/Button';

export interface SwUpdateNoticeProps {
  /** Lädt sofort neu (updateSW(true)), ohne Leerlauf-Prüfung. */
  onUpdateNow: () => void;
}

const noticeStyle: CSSProperties = {
  background: cssVars.colors.warningBannerBg,
  border: `1px solid ${cssVars.colors.warningBannerBorder}`,
  borderRadius: cssVars.borderRadius.sm,
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textPrimary,
  fontWeight: cssVars.fontWeights.semibold,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: cssVars.spacing.sm,
};

export function SwUpdateNotice({ onUpdateNow }: SwUpdateNoticeProps) {
  const { t } = useTranslation('common');
  return (
    <div data-testid="sw-update-notice" role="status" style={noticeStyle}>
      <span>{t('outbox.notice.updateAvailable')}</span>
      <Button data-testid="sw-update-now" variant="secondary" onClick={onUpdateNow}>
        {t('outbox.notice.reloadNow')}
      </Button>
    </div>
  );
}
