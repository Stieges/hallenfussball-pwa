import { cssVars, displayColors, displayFontSizes, displaySpacing, zIndex } from '../../../design-tokens';
import type { CacheStatus } from '../../../types/monitor';

interface CacheIndicatorProps {
  cacheStatus: CacheStatus;
  visible: boolean;
}

/** Admin-Anzeige (Taste „c“): Alter der Daten und Verbindungsstatus. */
export function CacheIndicator({ cacheStatus, visible }: CacheIndicatorProps) {
  if (!visible) {return null;}

  const getStatusColor = () => {
    switch (cacheStatus.status) {
      case 'fresh': return displayColors.success;
      case 'stale': return displayColors.warning;
      case 'critical': return displayColors.error;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: displaySpacing.contentMD,
      right: displaySpacing.contentMD,
      display: 'flex',
      alignItems: 'center',
      gap: displaySpacing.inlineSM,
      padding: `${displaySpacing.contentSM} ${displaySpacing.contentMD}`,
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: cssVars.borderRadius.md,
      fontSize: displayFontSizes.bodySM,
      color: displayColors.textPrimary,
      zIndex: zIndex.navigation,
    }}>
      <div style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: getStatusColor(),
      }} />
      <span>{cacheStatus.ageSeconds}s</span>
      <span style={{ color: displayColors.textMuted }}>
        {cacheStatus.connectionStatus}
      </span>
    </div>
  );
}
