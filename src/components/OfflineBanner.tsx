/**
 * OfflineBanner - Visual feedback for offline/online status
 *
 * US-PWA-OFFLINE: Phase 2 - Offline-UX
 *
 * Features:
 * - Shows banner when offline
 * - Shows "Reconnected" message when coming back online
 * - Future: Shows pending sync count (Phase 3)
 */

import { CSSProperties } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { colors, fontSizes, fontWeights } from '../design-tokens';
interface OfflineBannerProps {
  /** Optional: Number of pending changes waiting to sync (Phase 3) */
  pendingSyncCount?: number;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  pendingSyncCount = 0,
}) => {
  const { isOnline, wasOffline } = useOnlineStatus();

  // Don't render if online and not recently reconnected and no pending syncs
  if (isOnline && !wasOffline && pendingSyncCount === 0) {
    return null;
  }

  const getBackgroundColor = (): string => {
    if (isOnline && wasOffline) {
      return colors.success; // Green for reconnected
    } else if (isOnline && pendingSyncCount > 0) {
      return colors.secondary; // Blue for syncing
    }
    return colors.warning; // Orange for offline
  };

  const bannerStyle: CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '10px 16px',
    textAlign: 'center',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: getBackgroundColor(),
    color: '#000',
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.2)',
    animation: 'slideUp 0.3s ease-out',
  };

  const badgeStyle: CSSProperties = {
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '12px',
    padding: '2px 10px',
    fontSize: fontSizes.xs,
  };

  // Offline state
  if (!isOnline) {
    return (
      <div style={bannerStyle} role="status" aria-live="polite">
        <span role="img" aria-label="Offline">📡</span>
        <span>Offline-Modus - Änderungen werden lokal gespeichert</span>
        {pendingSyncCount > 0 && (
          <span style={badgeStyle}>
            {pendingSyncCount} ausstehend
          </span>
        )}
      </div>
    );
  }

  // Just reconnected
  if (wasOffline) {
    return (
      <div style={bannerStyle} role="status" aria-live="polite">
        <span role="img" aria-label="Connected">✓</span>
        <span>Verbindung wiederhergestellt</span>
        {pendingSyncCount > 0 && (
          <span style={badgeStyle}>
            Synchronisiere {pendingSyncCount} Änderung{pendingSyncCount > 1 ? 'en' : ''}...
          </span>
        )}
      </div>
    );
  }

  // Online with pending syncs (Phase 3)
  if (pendingSyncCount > 0) {
    return (
      <div style={bannerStyle} role="status" aria-live="polite">
        <span role="img" aria-label="Syncing">🔄</span>
        <span>
          Synchronisiere {pendingSyncCount} Änderung{pendingSyncCount > 1 ? 'en' : ''}...
        </span>
      </div>
    );
  }

  return null;
};

// CSS animation (add to global styles or use CSS-in-JS)
// @keyframes slideUp {
//   from { transform: translateY(100%); }
//   to { transform: translateY(0); }
// }
