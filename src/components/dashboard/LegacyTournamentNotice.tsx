/**
 * Hinweis auf beiseitegelegte Altformat-Turniere (A-05, @FU-007): ein Turnier ohne Spielseiten-Slots
 * wird beim Laden nicht still verworfen, sondern unter `tournaments_legacy_v1` abgelegt und hier gemeldet.
 */
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, touchTargets } from '../../design-tokens';
import { countLegacyTournaments, LEGACY_TOURNAMENTS_NOTICE_EVENT } from '../../core/storage/legacyTournamentStore';

const noticeStyle: CSSProperties = {
  background: cssVars.colors.warningBannerBg,
  border: `1px solid ${cssVars.colors.warningBannerBorder}`,
  borderRadius: cssVars.borderRadius.sm,
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textPrimary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: cssVars.spacing.sm,
};

const dismissStyle: CSSProperties = {
  minHeight: touchTargets.minimum,
  background: 'transparent',
  border: 'none',
  color: cssVars.colors.textPrimary,
  cursor: 'pointer',
  fontSize: cssVars.fontSizes.sm,
};

export function LegacyTournamentNotice() {
  const { t } = useTranslation('dashboard');
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void countLegacyTournaments().then((n) => {
        if (active) { setCount(n); }
      }).catch(() => undefined);
    };
    refresh();
    window.addEventListener(LEGACY_TOURNAMENTS_NOTICE_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(LEGACY_TOURNAMENTS_NOTICE_EVENT, refresh);
    };
  }, []);

  if (count === 0 || dismissed) { return null; }

  return (
    <div data-testid="legacy-tournament-notice" role="status" style={noticeStyle}>
      <span>{t('legacyNotice.message')}</span>
      <button type="button" data-testid="legacy-tournament-notice-dismiss" style={dismissStyle} onClick={() => setDismissed(true)}>
        {t('legacyNotice.dismiss')}
      </button>
    </div>
  );
}
