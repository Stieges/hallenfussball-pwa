/**
 * SettingsCategory - Tournament Settings
 *
 * Non-destructive tournament operations and field management.
 * Implements:
 * - Match Cockpit Pro settings (sound, haptic, timer)
 * - Tournament duplication
 * - Field management
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.6
 */

import { CSSProperties, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import { FieldManagement } from '../../../tournament-management/FieldManagement';
import { useTournaments } from '../../../../hooks';
import { generateTeamId } from '../../../../utils/idGenerator';
import type { Tournament } from '../../../../types/tournament';

// =============================================================================
// PROPS
// =============================================================================

interface SettingsCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  label: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  } as CSSProperties,

  input: {
    width: 80,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: cssVars.colors.inputBg,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodyMd,
    textAlign: 'center',
  } as CSSProperties,

  inputUnit: {
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  button: {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    background: cssVars.colors.primary,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
  } as CSSProperties,

  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as CSSProperties,

  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.bodyMd,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  comingSoon: {
    textAlign: 'center',
    padding: cssVars.spacing.lg,
    color: cssVars.colors.textMuted,
  } as CSSProperties,

  badge: {
    display: 'inline-block',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    background: cssVars.colors.primarySubtle,
    color: cssVars.colors.primary,
    borderRadius: cssVars.borderRadius.full,
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.medium,
    marginTop: cssVars.spacing.sm,
  } as CSSProperties,

  success: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.successLight,
    border: `1px solid ${cssVars.colors.success}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.success,
    marginTop: cssVars.spacing.md,
  } as CSSProperties,

  error: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.errorSubtle,
    border: `1px solid ${cssVars.colors.error}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.error,
    marginTop: cssVars.spacing.md,
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function SettingsCategory({
  tournament,
  onTournamentUpdate,
}: SettingsCategoryProps) {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { saveTournament } = useTournaments();

  // State for duplicate function
  const [duplicateName, setDuplicateName] = useState(`${tournament.title} (Kopie)`);
  const [duplicateOptions, setDuplicateOptions] = useState({
    settings: true,
    groups: true,
    fields: true,
    teams: false,
    sponsors: true,
  });
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateSuccess, setDuplicateSuccess] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const handleTournamentUpdate = async (updatedTournament: Tournament) => {
    onTournamentUpdate(updatedTournament);
  };



  // Handle duplicate tournament
  const handleDuplicate = useCallback(async () => {
    try {
      setIsDuplicating(true);
      setDuplicateError(null);

      // Create new tournament with selected options
      const now = new Date().toISOString();
      const newId = `tournament-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

      const duplicatedTournament: Tournament = {
        // Spread all properties from original
        ...tournament,

        // Override with new values
        id: newId,
        title: duplicateName.trim() || `${tournament.title} (Kopie)`,
        createdAt: now,
        updatedAt: now,
        status: 'draft',

        // Settings (conditionally copied)
        matchCockpitSettings: duplicateOptions.settings
          ? tournament.matchCockpitSettings
          : undefined,

        // Groups (conditionally copied)
        numberOfGroups: duplicateOptions.groups ? tournament.numberOfGroups : 1,
        groups: duplicateOptions.groups ? tournament.groups : undefined,

        // Fields (conditionally copied)
        numberOfFields: duplicateOptions.fields ? tournament.numberOfFields : 1,
        fields: duplicateOptions.fields ? tournament.fields : undefined,

        // Teams (empty or copied without results)
        teams: duplicateOptions.teams
          ? tournament.teams.map((team) => ({
            ...team,
            id: generateTeamId(),
          }))
          : [],
        numberOfTeams: duplicateOptions.teams ? tournament.numberOfTeams : 0,

        // Matches - always empty for duplicate
        matches: [],

        // Sponsors (conditionally copied)
        sponsors: duplicateOptions.sponsors ? tournament.sponsors : undefined,
      };

      // Save the new tournament
      await saveTournament(duplicatedTournament);

      setDuplicateSuccess(t('settingsSection.duplicateSuccess', { title: duplicatedTournament.title }));
      setTimeout(() => {
        // Navigate to the new tournament
        void navigate(`/tournament/${newId}`);
      }, 1500);
    } catch (error) {
      console.error('Duplicate failed:', error);
      setDuplicateError(
        error instanceof Error ? error.message : t('settingsSection.duplicateError')
      );
    } finally {
      setIsDuplicating(false);
    }
  }, [tournament, duplicateName, duplicateOptions, saveTournament, navigate, t]);

  // Toggle duplicate option
  const toggleOption = (key: keyof typeof duplicateOptions) => {
    setDuplicateOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <CategoryPage
      icon="⚙️"
      title={t('settingsSection.title')}
      description={t('settingsSection.description')}
    >


      {/* Pause Tournament - Coming Soon */}
      <CollapsibleSection icon="⏸️" title={t('settingsSection.pauseTournament')}>
        <div style={styles.comingSoon}>
          <p>
            {t('settingsSection.pauseDesc')}
          </p>
          <span style={styles.badge}>{t('settingsSection.comingSoon')}</span>
        </div>
      </CollapsibleSection>

      {/* Auto-Time-Continuation - Coming Soon */}
      <CollapsibleSection icon="🔄" title={t('settingsSection.autoTimeContinuation')}>
        <div style={styles.comingSoon}>
          <p>{t('settingsSection.autoTimeDesc')}</p>
          <span style={styles.badge}>{t('settingsSection.comingSoon')}</span>
        </div>
      </CollapsibleSection>

      {/* Duplicate Tournament - Functional */}
      <CollapsibleSection icon="📋" title={t('settingsSection.duplicateTournament')} defaultOpen>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          {t('settingsSection.duplicateDesc')}
        </p>

        <div style={styles.checkboxGroup}>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={duplicateOptions.settings}
              onChange={() => toggleOption('settings')}
            />
            <span>{t('settingsSection.tournamentSettings')}</span>
          </label>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={duplicateOptions.groups}
              onChange={() => toggleOption('groups')}
            />
            <span>{t('settingsSection.groupStructure')}</span>
          </label>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={duplicateOptions.fields}
              onChange={() => toggleOption('fields')}
            />
            <span>{t('settingsSection.fieldNames')}</span>
          </label>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={duplicateOptions.teams}
              onChange={() => toggleOption('teams')}
            />
            <span>{t('settingsSection.teamsWithoutResults')}</span>
          </label>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={duplicateOptions.sponsors}
              onChange={() => toggleOption('sponsors')}
            />
            <span>{t('settingsSection.sponsors')}</span>
          </label>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>{t('settingsSection.copyName')}</label>
          <input
            type="text"
            value={duplicateName}
            onChange={(e) => setDuplicateName(e.target.value)}
            style={{ ...styles.input, width: '100%', textAlign: 'left' }}
          />
        </div>

        <button
          style={{
            ...styles.button,
            ...(isDuplicating ? styles.buttonDisabled : {}),
          }}
          onClick={() => void handleDuplicate()}
          disabled={isDuplicating}
        >
          {isDuplicating ? t('settingsSection.duplicating') : t('settingsSection.duplicateTournament')}
        </button>

        {duplicateSuccess && (
          <div style={styles.success}>
            <span>✅</span>
            <span>{duplicateSuccess}</span>
          </div>
        )}

        {duplicateError && (
          <div style={styles.error}>
            <span>❌</span>
            <span>{duplicateError}</span>
          </div>
        )}
      </CollapsibleSection>

      {/* Field Management */}
      <CollapsibleSection icon="🏟️" title={t('settingsSection.fieldManagement')} defaultOpen>
        <FieldManagement tournament={tournament} onTournamentUpdate={handleTournamentUpdate} />
      </CollapsibleSection>

      {/* Game Times (Locked if matches started) */}
      <CollapsibleSection icon="⏱️" title={t('settingsSection.gameTimes')}>
        <div style={styles.formGroup}>
          <label style={styles.label}>{t('settingsSection.gameTimePerMatch')}</label>
          <div style={styles.inputRow}>
            <input
              type="number"
              value={tournament.groupPhaseGameDuration}
              disabled
              style={{ ...styles.input, opacity: 0.6 }}
            />
            <span style={styles.inputUnit}>{t('settingsSection.minutesLocked')}</span>
          </div>
          <p style={{ fontSize: cssVars.fontSizes.labelSm, color: cssVars.colors.textMuted }}>
            {t('settingsSection.gameTimeLockedHint')}
          </p>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>{t('settingsSection.breakTime')}</label>
          <div style={styles.inputRow}>
            <input
              type="number"
              defaultValue={tournament.groupPhaseBreakDuration ?? 2}
              min={0}
              max={30}
              style={styles.input}
            />
            <span style={styles.inputUnit}>{t('settingsSection.minutes')}</span>
          </div>
        </div>
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default SettingsCategory;
