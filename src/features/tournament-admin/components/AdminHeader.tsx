/**
 * AdminHeader - Admin Center Header Component
 *
 * Header with back navigation, title, and optional search.
 * Used for both desktop (with sidebar) and mobile spoke views.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 2.3
 */

import { useState, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { AdminHeaderProps } from '../types/admin.types';
import { ADMIN_LAYOUT } from '../constants/admin.constants';
import { SyncStatusBar } from '../../collaboration';
import { useSyncStatus } from '../../../hooks/useSyncStatus';

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    height: ADMIN_LAYOUT.headerHeight,
    padding: `0 ${cssVars.spacing.lg}`,
    background: cssVars.colors.surface,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 20,
  } as CSSProperties,

  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.bodySm,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  } as CSSProperties,

  backButtonMobile: {
    width: 40,
    height: 40,
    padding: 0,
    justifyContent: 'center',
    fontSize: '1.25rem',
  } as CSSProperties,

  title: {
    flex: 1,
    fontSize: cssVars.fontSizes.titleMd,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    textAlign: 'center',
  } as CSSProperties,

  titleDesktop: {
    textAlign: 'left',
  } as CSSProperties,

  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  } as CSSProperties,

  searchButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textSecondary,
    fontSize: '1.25rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  searchInput: {
    width: 200,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: cssVars.colors.inputBg,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodySm,
    outline: 'none',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  searchInputExpanded: {
    width: 280,
    borderColor: cssVars.colors.primary,
  } as CSSProperties,

  spacer: {
    width: 40,
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function AdminHeader({
  title,
  showBackToHub = false,
  hideBackButton = false,
  onBackToHub,
  onBackToTournament,
  onSearch,
  tournamentId,
  showSyncStatus = false,
}: AdminHeaderProps) {
  const { t } = useTranslation('admin');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { status, isSyncing, lastSyncedAt, syncTournament } = useSyncStatus();

  const handleSyncClick = () => {
    if (tournamentId) {
      void syncTournament(tournamentId);
    }
  };

  const handleSearchToggle = () => {
    if (isSearchExpanded && searchQuery) {
      // Clear search when closing
      setSearchQuery('');
      onSearch?.('');
    }
    setIsSearchExpanded(!isSearchExpanded);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const handleBackClick = () => {
    if (showBackToHub && onBackToHub) {
      onBackToHub();
    } else {
      onBackToTournament();
    }
  };

  // Desktop layout: no back button (sidebar has it), title left-aligned, search on right
  // Mobile layout: back arrow, centered title, search icon

  return (
    <header style={styles.header}>
      {/* Back Button - hidden on desktop (sidebar has the back button) */}
      {!hideBackButton && (
        <button
          style={{
            ...styles.backButton,
            ...(showBackToHub ? styles.backButtonMobile : {}),
          }}
          onClick={handleBackClick}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = cssVars.colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <span>←</span>
          {!showBackToHub && <span>{t('header.backToTournament')}</span>}
        </button>
      )}

      {/* Title */}
      <div
        style={{
          ...styles.title,
          ...(hideBackButton || !showBackToHub ? styles.titleDesktop : {}),
        }}
      >
        {showBackToHub ? title : t('header.title')}
      </div>

      {/* Sync Status */}
      {showSyncStatus && (
        <SyncStatusBar
          status={status}
          isSyncing={isSyncing}
          lastSyncedAt={lastSyncedAt}
          onSyncClick={handleSyncClick}
          compact
        />
      )}

      {/* Search */}
      {onSearch && (
        <div style={styles.searchContainer}>
          {isSearchExpanded && (
            <input
              type="text"
              placeholder={t('header.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                ...styles.searchInput,
                ...(searchQuery ? styles.searchInputExpanded : {}),
              }}
              autoFocus
              onBlur={() => {
                if (!searchQuery) {
                  setIsSearchExpanded(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  onSearch('');
                  setIsSearchExpanded(false);
                }
              }}
            />
          )}
          <button
            style={styles.searchButton}
            onClick={handleSearchToggle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = cssVars.colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            aria-label={isSearchExpanded ? t('header.closeSearch') : t('header.search')}
          >
            {isSearchExpanded ? '✕' : '🔍'}
          </button>
        </div>
      )}

      {/* Spacer for mobile layout balance (when no search) */}
      {!onSearch && showBackToHub && <div style={styles.spacer} />}
    </header>
  );
}

export default AdminHeader;
