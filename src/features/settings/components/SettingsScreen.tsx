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

import React, { CSSProperties, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cssVars } from '../../../design-tokens';
import { useTheme } from '../../../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { SettingsCategory } from './SettingsCategory';
import { SettingItem } from './SettingItem';
import { BaseThemeSelector } from './BaseThemeSelector';
import { FontSizeSelector } from './FontSizeSelector';
import { BaseTheme } from '../types/settings.types';
import {
  getConsentStatus,
  setConsentStatus,
  revokeConsent,
  type ConsentStatus,
} from '../../../lib/consent';
import { reinitializeSentry } from '../../../lib/sentry';

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
  const { theme, setTheme, resolvedTheme } = useTheme();
  const {
    fontSize,
    setFontSize,
    confirmDelete,
    autoSave,
    timerSound,
    hapticFeedback,
    toggleConfirmDelete,
    toggleAutoSave,
    toggleTimerSound,
    toggleHapticFeedback,
  } = useSettings();

  // Consent state
  const [consent, setConsent] = useState<ConsentStatus | null>(() =>
    getConsentStatus()
  );

  // Sync consent state with localStorage on mount
  useEffect(() => {
    setConsent(getConsentStatus());
  }, []);

  // Handle consent toggle changes
  const handleConsentChange = useCallback(
    (key: 'errorTracking' | 'sessionReplay', value: boolean) => {
      const currentConsent = getConsentStatus();
      if (!currentConsent) {
        // If no consent exists, create new one
        const newConsent = {
          errorTracking: key === 'errorTracking' ? value : false,
          sessionReplay: key === 'sessionReplay' ? value : false,
        };
        setConsentStatus(newConsent);
        setConsent(getConsentStatus());
      } else {
        // Update existing consent
        const updatedConsent = {
          errorTracking:
            key === 'errorTracking' ? value : currentConsent.errorTracking,
          sessionReplay:
            key === 'sessionReplay' ? value : currentConsent.sessionReplay,
        };
        setConsentStatus(updatedConsent);
        setConsent(getConsentStatus());
      }
      // Reinitialize Sentry with new consent
      void reinitializeSentry();
    },
    []
  );

  // Handle consent revocation
  const handleRevokeConsent = useCallback(() => {
    const confirmed = window.confirm(
      'Möchten Sie Ihre Datenschutz-Einwilligung widerrufen?\n\n' +
      'Dies deaktiviert Error-Tracking und Session-Replay. ' +
      'Beim nächsten App-Start werden Sie erneut nach Ihrer Einwilligung gefragt.'
    );
    if (confirmed) {
      revokeConsent();
      setConsent(null);
      void reinitializeSentry();
      alert('Ihre Einwilligung wurde widerrufen.');
    }
  }, []);

  // Map current theme to BaseTheme
  const currentBaseTheme: BaseTheme = theme as BaseTheme;

  const handleBaseThemeChange = (newTheme: BaseTheme) => {
    setTheme(newTheme);
  };

  // Support email helpers
  const createSupportEmail = (type: 'bug' | 'feature' | 'feedback') => {
    const subjects = {
      bug: 'Fehler melden – Spielplan App',
      feature: 'Feature-Vorschlag – Spielplan App',
      feedback: 'Feedback – Spielplan App',
    };

    /* eslint-disable @typescript-eslint/no-deprecated -- navigator.platform still useful for support emails */
    const body = `
───────────────────────────────
App-Version: ${APP_VERSION}
Browser: ${navigator.userAgent}
Plattform: ${navigator.platform}
Sprache: ${navigator.language}
Datum: ${new Date().toISOString()}
Theme: ${resolvedTheme}
───────────────────────────────

Meine Nachricht:

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
          aria-label="Zurück"
        >
          ← Zurück
        </button>
        <h1 style={styles.title}>Einstellungen</h1>
        <div style={styles.headerSpacer} />
      </header>

      {/* Content */}
      <div style={styles.content}>
        {/* Erscheinungsbild */}
        <SettingsCategory title="Erscheinungsbild" icon="🎨">
          <div style={styles.selectorContainer}>
            <span style={styles.selectorLabel}>Theme</span>
            <BaseThemeSelector
              value={currentBaseTheme}
              onChange={handleBaseThemeChange}
              resolvedTheme={resolvedTheme}
            />
          </div>

          <div style={styles.divider} />

          <div style={styles.selectorContainer}>
            <span style={styles.selectorLabel}>Schriftgröße</span>
            <FontSizeSelector value={fontSize} onChange={setFontSize} />
          </div>
        </SettingsCategory>

        {/* Sprache */}
        <SettingsCategory title="Sprache" icon="🌍">
          <SettingItem
            variant="select"
            icon="🗣️"
            label="Sprache"
            description="App-Sprache auswählen"
            value="de"
            options={[
              { value: 'de', label: 'Deutsch' },
              { value: 'en', label: 'English (coming soon)' },
            ]}
            onChange={() => {
              // TODO: i18n in Phase 2
            }}
            disabled
          />
        </SettingsCategory>

        {/* App-Verhalten */}
        <SettingsCategory title="App-Verhalten" icon="⚡">
          <SettingItem
            variant="toggle"
            icon="⚠️"
            label="Löschen bestätigen"
            description="Vor dem Löschen nachfragen"
            value={confirmDelete}
            onChange={toggleConfirmDelete}
          />
          <SettingItem
            variant="toggle"
            icon="💾"
            label="Auto-Speichern"
            description="Änderungen automatisch speichern"
            value={autoSave}
            onChange={toggleAutoSave}
          />
          <SettingItem
            variant="toggle"
            icon="🔔"
            label="Timer-Sound"
            description="Ton bei Spielende abspielen"
            value={timerSound}
            onChange={toggleTimerSound}
          />
          <SettingItem
            variant="toggle"
            icon="📳"
            label="Haptisches Feedback"
            description="Vibration bei Aktionen"
            value={hapticFeedback}
            onChange={toggleHapticFeedback}
          />
        </SettingsCategory>

        {/* Daten */}
        <SettingsCategory title="Daten" icon="💾">
          <SettingItem
            variant="action"
            icon="📤"
            label="Alle Daten exportieren"
            description="Turniere und Einstellungen als JSON"
            actionLabel="Exportieren"
            onClick={() => {
              // TODO: Implement export
              alert('Export wird in Kürze implementiert');
            }}
          />
          <SettingItem
            variant="action"
            icon="📥"
            label="Daten importieren"
            description="Aus einer Backup-Datei wiederherstellen"
            actionLabel="Importieren"
            onClick={() => {
              // TODO: Implement import
              alert('Import wird in Kürze implementiert');
            }}
          />
          <SettingItem
            variant="action"
            icon="🗑️"
            label="Cache leeren"
            description="Temporäre Daten löschen"
            actionLabel="Leeren"
            onClick={() => {
              // Clear caches
              if ('caches' in window) {
                void caches.keys().then((names) => {
                  names.forEach((name) => void caches.delete(name));
                });
              }
              alert('Cache wurde geleert');
            }}
          />
        </SettingsCategory>

        {/* Hilfe & Support */}
        <SettingsCategory title="Hilfe & Support" icon="❓">
          <SettingItem
            variant="link"
            icon="🐛"
            label="Fehler melden"
            description="Bug Report per E-Mail senden"
            onClick={() => {
              window.location.href = createSupportEmail('bug');
            }}
          />
          <SettingItem
            variant="link"
            icon="💡"
            label="Feature vorschlagen"
            description="Ideen für neue Funktionen"
            onClick={() => {
              window.location.href = createSupportEmail('feature');
            }}
          />
          <SettingItem
            variant="link"
            icon="💬"
            label="Feedback senden"
            description="Allgemeines Feedback"
            onClick={() => {
              window.location.href = createSupportEmail('feedback');
            }}
          />
        </SettingsCategory>

        {/* Über */}
        <SettingsCategory title="Über" icon="ℹ️">
          <SettingItem
            variant="info"
            icon="📱"
            label="Version"
            value={APP_VERSION}
          />
          <SettingItem
            variant="link"
            icon="📋"
            label="Changelog"
            description="Was ist neu?"
            onClick={() => {
              // TODO: Show changelog modal
              alert(`Version ${APP_VERSION}\n\n• Settings-Screen hinzugefügt\n• Theme-Auswahl\n• Schriftgröße anpassbar`);
            }}
          />
        </SettingsCategory>

        {/* Datenschutz */}
        <SettingsCategory title="Datenschutz" icon="🛡️">
          <SettingItem
            variant="toggle"
            icon="📊"
            label="Error-Tracking"
            description="Anonymisierte Fehlerberichte senden"
            value={consent?.errorTracking ?? false}
            onChange={(value) => handleConsentChange('errorTracking', value)}
          />
          <SettingItem
            variant="toggle"
            icon="🎬"
            label="Session Replay"
            description="Anonymisierte Sitzungsaufzeichnungen zur Fehlerbehebung"
            value={consent?.sessionReplay ?? false}
            onChange={(value) => handleConsentChange('sessionReplay', value)}
          />
          {consent && (
            <SettingItem
              variant="action"
              icon="🗑️"
              label="Einwilligung widerrufen"
              description="Alle Tracking-Einstellungen zurücksetzen"
              actionLabel="Widerrufen"
              onClick={handleRevokeConsent}
            />
          )}
        </SettingsCategory>

        {/* Rechtliches */}
        <SettingsCategory title="Rechtliches" icon="⚖️">
          <SettingItem
            variant="link"
            icon="📄"
            label="Impressum"
            onClick={() => void navigate('/impressum')}
          />
          <SettingItem
            variant="link"
            icon="🔒"
            label="Datenschutz"
            onClick={() => void navigate('/datenschutz')}
          />
          <SettingItem
            variant="link"
            icon="📜"
            label="Nutzungsbedingungen"
            onClick={() => {
              // TODO: Add Terms of Service page
              alert('Nutzungsbedingungen werden in Kürze hinzugefügt');
            }}
          />
        </SettingsCategory>
      </div>
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
