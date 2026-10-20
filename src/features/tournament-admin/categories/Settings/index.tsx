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
import { useCopyTournament } from '../../../../hooks/useCopyTournament';
import { Input } from '../../../../components/ui/Input';
import { proposeCopyTitle, proposeProbeDate } from '../../../../core/models/tournamentCopy';
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
    border: `1px solid ${cssVars.colors.borderControl}`,
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
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const { saveTournament } = useTournaments();
  const copyTournament = useCopyTournament(saveTournament);

  // State for duplicate function
  const [duplicateName, setDuplicateName] = useState(proposeCopyTitle(tournament.title, tCommon('tournament.copySuffix')));
  const [duplicateDate, setDuplicateDate] = useState(proposeProbeDate(tournament, new Date()));
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

      // Gleiche Kopierlogik wie im Dashboard (Paket KP): Teams, Gruppen, Spielplan, Regeln; ohne Freigabe,
      // Ergebnisse, Abschluss und Monitore
      const duplicatedTournament = await copyTournament(
        tournament,
        duplicateName.trim() || proposeCopyTitle(tournament.title, tCommon('tournament.copySuffix')),
        duplicateDate || undefined,
      );
      const newId = duplicatedTournament.id;

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
  }, [tournament, duplicateName, duplicateDate, copyTournament, navigate, t, tCommon]);

  return (
    <CategoryPage
      icon="⚙️"
      title={t('settingsSection.title')}
      description={t('settingsSection.description')}
    >


      {/* Duplicate Tournament - Functional */}
      <CollapsibleSection icon="📋" title={t('settingsSection.duplicateTournament')} defaultOpen>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          {t('settingsSection.duplicateDesc')}
        </p>

        <div style={styles.formGroup}>
          <Input
            label={t('settingsSection.copyName')}
            value={duplicateName}
            onChange={setDuplicateName}
            data-testid="duplicate-tournament-name"
          />
        </div>

        <div style={styles.formGroup}>
          <Input
            type="date"
            label={tCommon('tournament.copyDialog.dateLabel')}
            value={duplicateDate}
            onChange={setDuplicateDate}
            data-testid="duplicate-tournament-date"
          />
        </div>

        <button
          style={{
            ...styles.button,
            ...(isDuplicating ? styles.buttonDisabled : {}),
          }}
          data-testid="duplicate-tournament-button"
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
              value={tournament.groupPhaseBreakDuration ?? 2}
              min={0}
              max={30}
              disabled
              style={{ ...styles.input, opacity: 0.6 }}
            />
            <span style={styles.inputUnit}>{t('settingsSection.minutesLocked')}</span>
          </div>
          <p style={{ fontSize: cssVars.fontSizes.labelSm, color: cssVars.colors.textMuted }}>
            {t('settingsSection.gameTimeLockedHint')}
          </p>
        </div>
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default SettingsCategory;
