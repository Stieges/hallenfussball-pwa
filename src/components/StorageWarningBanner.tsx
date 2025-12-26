/**
 * StorageWarningBanner - Shows warning when localStorage is full
 *
 * BUG-CRIT-003 FIX: Provides UI feedback for storage quota issues
 * Listens for 'storage-quota-warning' custom events
 */

import { useState, useEffect, CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../design-tokens';
import { checkStorageHealth } from '../utils/storageCleanup';

export const StorageWarningBanner: React.FC = () => {
  const [warning, setWarning] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Initial health check
    const health = checkStorageHealth();
    if (!health.isHealthy && health.message) {
      setWarning(health.message);
    }

    // Listen for quota warnings
    const handleQuotaWarning = (event: Event) => {
      const customEvent = event as CustomEvent<{ message: string; timestamp: number }>;
      setWarning(customEvent.detail.message);
      setIsDismissed(false);
    };

    window.addEventListener('storage-quota-warning', handleQuotaWarning);

    return () => {
      window.removeEventListener('storage-quota-warning', handleQuotaWarning);
    };
  }, []);

  if (!warning || isDismissed) {
    return null;
  }

  const bannerStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    padding: `${spacing.md} ${spacing.lg}`,
    background: colors.error,
    color: 'white',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 9999,
    fontSize: fontSizes.sm,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  };

  const iconStyle: CSSProperties = {
    fontSize: '20px',
    flexShrink: 0,
  };

  const messageStyle: CSSProperties = {
    flex: 1,
  };

  const buttonStyle: CSSProperties = {
    background: 'rgba(255,255,255,0.2)',
    border: '1px solid rgba(255,255,255,0.5)',
    color: 'white',
    padding: `${spacing.xs} ${spacing.md}`,
    borderRadius: borderRadius.sm,
    cursor: 'pointer',
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    transition: 'background 0.2s',
    flexShrink: 0,
  };

  return (
    <div style={bannerStyle} role="alert">
      <span style={iconStyle}>!</span>
      <span style={messageStyle}>{warning}</span>
      <button
        onClick={() => setIsDismissed(true)}
        style={buttonStyle}
        onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
      >
        Verstanden
      </button>
    </div>
  );
};
