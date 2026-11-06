/**
 * SettingsScreen - Hauptbildschirm für Einstellungen
 *
 * Kategorien:
 * 1. Erscheinungsbild (Theme, Schriftgröße)
 * 2. Sprache (i18n - Phase 2)
 * 3. App-Verhalten (Toggles)
 * 4. Daten (Export/Import)
 * 5. Hilfe & Support
 * 6. Über
 * 7. Rechtliches
 *
 * @see docs/concepts/SETTINGS-KONZEPT.md
 */

import React, { CSSProperties, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { cssVars } from '../../../design-tokens';
import { useTheme } from '../../../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { SettingsCategory } from './SettingsCategory';
import { SettingItem } from './SettingItem';
import { BaseThemeSelector } from './BaseThemeSelector';
import { FontSizeSelector } from './FontSizeSelector';
import { BaseTheme } from '../types/settings.types';
import { isErrorReportingEnabled, setErrorReportingEnabled } from '../../../lib/errorReportPreference';
import { applyErrorReportingPreference } from '../../../lib/sentry';
import { useToast } from '../../../components/ui/Toast';
import { ConfirmDialog, useConfirmDialog } from '../../../components/ui/ConfirmDialog';

// =============================================================================
// Types
// =============================================================================

interface SettingsScreenProps {
  /** Zurück-Handler */
  onBack: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const APP_VERSION = '2.3.0';

// =============================================================================
// Component
// =============================================================================

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation('settings');
  // @OB-017: Rückfragen im Dialog der App, Hinweise als Meldung der App, nie als Fenster des Browsers
  const { showSuccess, showError, showInfo } = useToast();
  const forceUpdateDialog = useConfirmDialog({
    title: t('data.forceUpdate.dialogTitle'),
    message: t('data.forceUpdate.confirmMessage'),
    variant: 'warning',
    confirmText: t('data.forceUpdate.action'),
  });
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { fontSize, setFontSize } = useSettings();

  // @RE-002: Fehlerberichte senden (je Gerät gespeichert, vorbelegt an)
  const [errorReports, setErrorReports] = useState<boolean>(() => isErrorReportingEnabled());

  const handleErrorReportsChange = useCallback((value: boolean) => {
    setErrorReportingEnabled(value);
    setErrorReports(value);
    void applyErrorReportingPreference();
  }, []);

  // Force update: Clear Service Worker + Caches + Reload
  const [isClearing, setIsClearing] = useState(false);

  const handleForceUpdate = useCallback(async () => {
    const confirmed = await forceUpdateDialog.confirm();

    if (!confirmed) {
      return;
    }

    setIsClearing(true);

    try {
      // 1. Unregister all Service Workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log(`[ForceUpdate] Unregistered ${registrations.length} service worker(s)`);
        }
      }

      // 2. Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log(`[ForceUpdate] Cleared ${cacheNames.length} cache(s)`);
        }
      }

      // 3. Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // 4. Hard reload (bypass cache)
      window.location.reload();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[ForceUpdate] Error:', err);
      }
      setIsClearing(false);
      showError(t('data.forceUpdate.errorMessage'));
    }
  }, [t, forceUpdateDialog, showError]);

  // Map current theme to BaseTheme
  const currentBaseTheme: BaseTheme = theme;

  const handleBaseThemeChange = (newTheme: BaseTheme) => {
    setTheme(newTheme);
  };

  // Support email helpers
  const createSupportEmail = (type: 'bug' | 'feature' | 'feedback') => {
    const subjects = {
      bug: t('support.bug.subject'),
      feature: t('support.feature.subject'),
      feedback: t('support.feedback.subject'),
    };

     
    const body = `
───────────────────────────────
App-Version: ${APP_VERSION}
Browser: ${navigator.userAgent}
Plattform: ${navigator.platform}
Sprache: ${navigator.language}
Datum: ${new Date().toISOString()}
Theme: ${resolvedTheme}
───────────────────────────────

${t('support.emailBody')}

`;

    return `mailto:support@spielplan.app?subject=${encodeURIComponent(
      subjects[type]
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <button
          type="button"
          onClick={onBack}
          style={styles.backButton}
          aria-label={t('backAriaLabel')}
        >
          {t('backWithArrow')}
        </button>
        <h1 style={styles.title}>{t('pageTitle')}</h1>
        <div style={styles.headerSpacer} />
      </header>

      {/* Content */}
      <div style={styles.content}>
        {/* Erscheinungsbild */}
        <SettingsCategory title={t('categories.appearance')} icon="🎨">
          <div style={styles.selectorContainer}>
            <span style={styles.selectorLabel}>{t('appearance.theme')}</span>
            <BaseThemeSelector
              value={currentBaseTheme}
              onChange={handleBaseThemeChange}
              resolvedTheme={resolvedTheme}
            />
          </div>

          <div style={styles.divider} />

          <div style={styles.selectorContainer}>
            <span style={styles.selectorLabel}>{t('appearance.fontSize')}</span>
            <FontSizeSelector value={fontSize} onChange={setFontSize} />
          </div>
        </SettingsCategory>

        {/* Sprache */}
        <SettingsCategory title={t('categories.language')} icon="🌍">
          <SettingItem
            variant="select"
            icon="🗣️"
            label={t('language.label')}
            description={t('language.description')}
            value={i18n.language}
            options={[
              { value: 'de', label: t('language.de') },
              { value: 'en', label: t('language.en') },
            ]}
            onChange={(value) => {
              void i18n.changeLanguage(value);
              document.documentElement.lang = value;
            }}
          />
        </SettingsCategory>

        {/* Daten */}
        <SettingsCategory title={t('categories.data')} icon="💾">
          <SettingItem
            variant="action"
            icon="🗑️"
            label={t('data.clearCache.label')}
            description={t('data.clearCache.description')}
            actionLabel={t('data.clearCache.action')}
            onClick={() => {
              // Clear caches
              if ('caches' in window) {
                void caches.keys().then((names) => {
                  names.forEach((name) => void caches.delete(name));
                });
              }
              showSuccess(t('data.clearCache.success'));
            }}
          />
          <SettingItem
            variant="action"
            icon="🔄"
            label={t('data.forceUpdate.label')}
            description={t('data.forceUpdate.description')}
            actionLabel={isClearing ? t('data.forceUpdate.loading') : t('data.forceUpdate.action')}
            onClick={() => void handleForceUpdate()}
            disabled={isClearing}
          />
        </SettingsCategory>

        {/* Hilfe & Support */}
        <SettingsCategory title={t('categories.support')} icon="❓">
          <SettingItem
            variant="link"
            icon="🐛"
            label={t('support.bug.label')}
            description={t('support.bug.description')}
            onClick={() => {
              window.location.href = createSupportEmail('bug');
            }}
          />
          <SettingItem
            variant="link"
            icon="💡"
            label={t('support.feature.label')}
            description={t('support.feature.description')}
            onClick={() => {
              window.location.href = createSupportEmail('feature');
            }}
          />
          <SettingItem
            variant="link"
            icon="💬"
            label={t('support.feedback.label')}
            description={t('support.feedback.description')}
            onClick={() => {
              window.location.href = createSupportEmail('feedback');
            }}
          />
        </SettingsCategory>

        {/* Über */}
        <SettingsCategory title={t('categories.about')} icon="ℹ️">
          <SettingItem
            variant="info"
            icon="📱"
            label={t('about.version')}
            value={APP_VERSION}
          />
          <SettingItem
            variant="link"
            icon="📋"
            label={t('about.changelog.label')}
            description={t('about.changelog.description')}
            onClick={() => {
              // TODO: Show changelog modal
              showInfo(t('about.changelog.content', { version: APP_VERSION }), { duration: 8000 });
            }}
          />
        </SettingsCategory>

        {/* Datenschutz */}
        <SettingsCategory title={t('categories.privacy')} icon="🛡️">
          <SettingItem
            variant="toggle"
            icon="📊"
            label={t('privacy.errorReports.label')}
            description={t('privacy.errorReports.description')}
            value={errorReports}
            onChange={handleErrorReportsChange}
            testId="settings-error-reports-toggle"
          />
        </SettingsCategory>

        {/* Rechtliches */}
        <SettingsCategory title={t('categories.legal')} icon="⚖️">
          <SettingItem
            variant="link"
            icon="📄"
            label={t('legal.imprint')}
            onClick={() => void navigate('/impressum')}
          />
          <SettingItem
            variant="link"
            icon="🔒"
            label={t('legal.privacy')}
            onClick={() => void navigate('/datenschutz')}
          />
        </SettingsCategory>
      </div>
      <ConfirmDialog {...forceUpdateDialog.dialogProps} />
    </div>
  );
};

// =============================================================================
// Styles
// =============================================================================

const styles: Record<string, CSSProperties> = {
  container: {
    minHeight: 'var(--min-h-screen)',
    background: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.md,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    position: 'sticky',
    top: 0,
    background: cssVars.colors.background,
    zIndex: 100,
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: 'transparent',
    border: 'none',
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.md,
    cursor: 'pointer',
    minWidth: '80px',
  },
  title: {
    margin: 0,
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  },
  headerSpacer: {
    minWidth: '80px',
  },
  content: {
    padding: cssVars.spacing.lg,
    paddingBottom: cssVars.spacing.xxl,
  },
  selectorContainer: {
    padding: `${cssVars.spacing.md} 0`,
  },
  selectorLabel: {
    display: 'block',
    marginBottom: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
  },
  divider: {
    height: '1px',
    background: cssVars.colors.border,
    margin: `${cssVars.spacing.sm} 0`,
  },
};

export default SettingsScreen;
