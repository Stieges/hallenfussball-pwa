/**
 * TournamentAdminCenter - Main Admin Center Container
 *
 * Central hub for all tournament administration tasks.
 * Handles responsive layout (sidebar vs hub-and-spoke) and category routing.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md
 */

import { useState, useEffect, lazy, Suspense, CSSProperties, useCallback } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useNavigate, useLocation } from 'react-router-dom';
import { cssVars } from '../../design-tokens';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTournamentSync } from '../../hooks/useTournamentSync';
import type { AdminCategoryId, AdminWarning } from './types/admin.types';
import { ADMIN_LAYOUT, getAdminCategory } from './constants/admin.constants';

// Components
import { AdminSidebar } from './components/AdminSidebar';
import { AdminMobileHub } from './components/AdminMobileHub';
import { AdminHeader } from './components/AdminHeader';
import { CategorySkeleton } from './components/CategorySkeleton';

// =============================================================================
// LAZY LOADED CATEGORIES
// =============================================================================

// Dashboard
const DashboardCategory = lazy(() =>
  import('./categories/Dashboard').then((m) => ({ default: m.DashboardCategory }))
);

// Management
const ActivityLogCategory = lazy(() =>
  import('./categories/ActivityLog').then((m) => ({ default: m.ActivityLogCategory }))
);
const ExportsCategory = lazy(() =>
  import('./categories/Exports').then((m) => ({ default: m.ExportsCategory }))
);
const TeamHelpersCategory = lazy(() =>
  import('./categories/TeamHelpers').then((m) => ({ default: m.TeamHelpersCategory }))
);
const SponsorsCategory = lazy(() =>
  import('./categories/Sponsors').then((m) => ({ default: m.SponsorsCategory }))
);

// Settings
const SettingsCategory = lazy(() =>
  import('./categories/Settings').then((m) => ({ default: m.SettingsCategory }))
);
const VisibilityCategory = lazy(() =>
  import('./categories/Visibility').then((m) => ({ default: m.VisibilityCategory }))
);
const NotificationsCategory = lazy(() =>
  import('./categories/Notifications').then((m) => ({ default: m.NotificationsCategory }))
);
const MetadataCategory = lazy(() =>
  import('./categories/Metadata').then((m) => ({ default: m.MetadataCategory }))
);

// Support
const HelpCategory = lazy(() =>
  import('./categories/Help').then((m) => ({ default: m.HelpCategory }))
);

// Danger Zone
const DangerZoneCategory = lazy(() =>
  import('./categories/DangerZone').then((m) => ({ default: m.DangerZoneCategory }))
);

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: cssVars.colors.background,
  } as CSSProperties,

  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  } as CSSProperties,

  contentArea: {
    flex: 1,
    padding: cssVars.spacing.lg,
    maxWidth: ADMIN_LAYOUT.contentMaxWidth,
    margin: '0 auto',
    width: '100%',
    overflowY: 'auto',
  } as CSSProperties,

  contentAreaMobile: {
    padding: cssVars.spacing.md,
    maxWidth: 'none',
  } as CSSProperties,

  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  errorContainer: {
    padding: cssVars.spacing.lg,
    background: cssVars.colors.errorSubtle,
    border: `1px solid ${cssVars.colors.errorBorder}`,
    borderRadius: cssVars.borderRadius.lg,
    color: cssVars.colors.error,
    textAlign: 'center',
  } as CSSProperties,
} as const;

// =============================================================================
// PROPS
// =============================================================================

interface TournamentAdminCenterProps {
  tournamentId: string;
  onBackToTournament: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TournamentAdminCenter({
  tournamentId,
  onBackToTournament,
}: TournamentAdminCenterProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useBreakpoint();

  // Parse category from URL
  const pathParts = location.pathname.split('/');
  const adminIndex = pathParts.indexOf('admin');
  const categoryFromUrl = adminIndex >= 0 ? pathParts[adminIndex + 1] : undefined;

  // Determine active category
  const [activeCategory, setActiveCategory] = useState<AdminCategoryId>('dashboard');
  const [showMobileHub, setShowMobileHub] = useState(true);

  // Tournament data
  const { tournament, handleTournamentUpdate, loadingError } = useTournamentSync(tournamentId);

  // Warnings (placeholder - will be computed from tournament state)
  const [warnings] = useState<AdminWarning[]>([]);

  // Update active category from URL
  useEffect(() => {
    if (categoryFromUrl) {
      const category = getAdminCategory(categoryFromUrl);
      if (category) {
        setActiveCategory(category.id);
        setShowMobileHub(false);
      }
    } else {
      // No category in URL - show hub on mobile, dashboard on desktop
      if (isMobile) {
        setShowMobileHub(true);
      } else {
        setActiveCategory('dashboard');
      }
    }
  }, [categoryFromUrl, isMobile]);

  // Navigation handler
  const handleNavigate = useCallback((categoryId: AdminCategoryId) => {
    setActiveCategory(categoryId);
    setShowMobileHub(false);
    void navigate(`/tournament/${tournamentId}/admin/${categoryId}`);
  }, [navigate, tournamentId]);

  // Back to hub (mobile only)
  const handleBackToHub = () => {
    setShowMobileHub(true);
    void navigate(`/tournament/${tournamentId}/admin`);
  };

  // Render category content
  const renderCategoryContent = () => {
    if (!tournament) {
      return (
        <div style={styles.loadingContainer}>
          <div>Lade Turnierdaten...</div>
        </div>
      );
    }

    if (loadingError) {
      return (
        <div style={styles.errorContainer}>
          <div>Fehler beim Laden: {loadingError}</div>
        </div>
      );
    }

    const categoryProps = {
      tournamentId,
      tournament,
      onTournamentUpdate: handleTournamentUpdate,
    };

    switch (activeCategory) {
      case 'dashboard':
        return <DashboardCategory {...categoryProps} />;
      case 'activity-log':
        return <ActivityLogCategory {...categoryProps} />;
      case 'exports':
        return <ExportsCategory {...categoryProps} />;
      case 'team-helpers':
        return <TeamHelpersCategory {...categoryProps} />;
      case 'sponsors':
        return <SponsorsCategory {...categoryProps} />;
      case 'settings':
        return <SettingsCategory {...categoryProps} />;
      case 'visibility':
        return <VisibilityCategory {...categoryProps} />;
      case 'notifications':
        return <NotificationsCategory {...categoryProps} />;
      case 'metadata':
        return <MetadataCategory {...categoryProps} />;
      case 'help':
        return <HelpCategory {...categoryProps} />;
      case 'danger-zone':
        return <DangerZoneCategory {...categoryProps} />;
      default:
        return <DashboardCategory {...categoryProps} />;
    }
  };

  // Get category title for header
  const categoryConfig = getAdminCategory(activeCategory);
  const categoryTitle = categoryConfig?.label ?? 'Admin Center';

  // Error boundary reset handler - navigate to dashboard
  const handleErrorReset = useCallback(() => {
    setActiveCategory('dashboard');
    void navigate(`/tournament/${tournamentId}/admin/dashboard`);
  }, [navigate, tournamentId]);

  // Warning click handler - navigate to action path if available
  const handleWarningClick = useCallback((warning: AdminWarning) => {
    if (warning.actionPath) {
      // actionPath is a category ID like 'settings' or 'visibility'
      handleNavigate(warning.actionPath as AdminCategoryId);
    }
  }, [handleNavigate]);

  // Mobile: Show hub or spoke
  if (isMobile) {
    if (showMobileHub) {
      return (
        <AdminMobileHub
          onNavigate={handleNavigate}
          warnings={warnings}
          onBackToTournament={onBackToTournament}
        />
      );
    }

    // Mobile spoke view
    return (
      <div style={styles.container}>
        <div style={styles.mainContent}>
          <AdminHeader
            title={categoryTitle}
            showBackToHub
            onBackToHub={handleBackToHub}
            onBackToTournament={onBackToTournament}
          />
          <div style={{ ...styles.contentArea, ...styles.contentAreaMobile }}>
            <ErrorBoundary onReset={handleErrorReset}>
              <Suspense fallback={<CategorySkeleton />}>
                {renderCategoryContent()}
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    );
  }

  // Tablet: Drawer sidebar (TODO: implement drawer behavior)
  // For now, use same layout as desktop

  // Desktop: Fixed sidebar with content area
  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <AdminSidebar
        activeCategory={activeCategory}
        onNavigate={handleNavigate}
        warnings={warnings}
        onBackToTournament={onBackToTournament}
        onWarningClick={handleWarningClick}
      />

      {/* Main Content */}
      <div style={styles.mainContent}>
        <AdminHeader
          title={categoryTitle}
          onBackToTournament={onBackToTournament}
        />
        <div style={styles.contentArea}>
          <ErrorBoundary onReset={handleErrorReset}>
            <Suspense fallback={<CategorySkeleton />}>
              {renderCategoryContent()}
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default TournamentAdminCenter;
