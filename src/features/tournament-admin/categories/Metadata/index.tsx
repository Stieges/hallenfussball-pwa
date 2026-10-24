/**
 * MetadataCategory - Tournament Metadata & Notes
 *
 * Edit tournament basic data and private notes.
 * Migrated from SettingsTab with full functionality.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.9
 */

import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import { Input, Combobox } from '../../../../components/ui';
import { LocationForm } from '../../../../components/LocationForm';
import { ContactForm } from '../../../../components/ContactForm';
import { ConfirmDialog, useConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { RulebookField } from '../../../../components/ui/molecules/RulebookField';
import { getAgeClassOptions, DEFAULT_VALUES } from '../../../../constants/tournamentOptions';
import type { Tournament } from '../../../../types/tournament';
import { effectiveFieldCount, effectiveGroupCount } from '../../../../core/view';
import { validateTournamentMeta, hasMetaErrors, type TournamentMetaErrors } from '../../../../core/services/tournamentMetaValidation';

// =============================================================================
// PROPS
// =============================================================================

interface MetadataCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  formSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  } as CSSProperties,

  buttonRow: {
    display: 'flex',
    gap: cssVars.spacing.sm,
    marginTop: cssVars.spacing.md,
  } as CSSProperties,

  saveButton: {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    background: cssVars.colors.primary,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  saveButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as CSSProperties,

  resetButton: {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  dirtyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.medium,
  } as CSSProperties,

  dirtyBadgeUnsaved: {
    background: cssVars.colors.warningSubtle,
    color: cssVars.colors.warning,
  } as CSSProperties,

  dirtyBadgeSaved: {
    background: cssVars.colors.successLight,
    color: cssVars.colors.success,
  } as CSSProperties,

  lockedField: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceHover,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    marginBottom: cssVars.spacing.sm,
  } as CSSProperties,

  lockedFieldLabel: {
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  lockedFieldValue: {
    fontSize: cssVars.fontSizes.bodyMd,
    color: cssVars.colors.textPrimary,
    fontWeight: cssVars.fontWeights.medium,
  } as CSSProperties,

  lockedIcon: {
    fontSize: 16,
    color: cssVars.colors.textMuted,
  } as CSSProperties,

  hint: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textMuted,
    marginTop: cssVars.spacing.xs,
  } as CSSProperties,

  textarea: {
    padding: cssVars.spacing.md,
    background: cssVars.colors.inputBg,
    border: `1px solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodyMd,
    width: '100%',
    minHeight: 120,
    resize: 'vertical',
    fontFamily: 'inherit',
  } as CSSProperties,

  successMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: cssVars.spacing.sm,
    background: cssVars.colors.successLight,
    color: cssVars.colors.success,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.bodySm,
    marginTop: cssVars.spacing.sm,
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

/** Formularstand aus dem Turnier – eine Stelle für Init, Sync und Reset. */
const toFormData = (t: Tournament): Partial<Tournament> => ({
  title: t.title, organizer: t.organizer, rulebook: t.rulebook, ageClass: t.ageClass,
  location: t.location, contactInfo: t.contactInfo,
  startDate: t.startDate ?? t.date, startTime: t.startTime ?? t.timeSlot,
});

export function MetadataCategory({
  tournament,
  onTournamentUpdate,
}: MetadataCategoryProps) {
  const { t } = useTranslation('admin');
  const resetDialog = useConfirmDialog({
    title: t('metadata.confirmResetDialog.title'),
    message: t('metadata.confirmReset'),
    variant: 'warning',
    confirmText: t('metadata.confirmResetDialog.confirm'),
  });
  // Local form state (copy of tournament data)
  const [formData, setFormData] = useState<Partial<Tournament>>(() => toFormData(tournament));

  // Private notes (stored in tournament.adminNotes or similar)
  const [notes, setNotes] = useState(tournament.adminNotes ?? '');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [metaErrors, setMetaErrors] = useState<TournamentMetaErrors>({});

  // Sync formData when tournament changes (after save)
  useEffect(() => {
    setFormData(toFormData(tournament));
    setNotes(tournament.adminNotes ?? '');
  }, [tournament]);

  // Calculate dirty state
  const isDirty = useMemo(() => {
    const originalData = {
      title: tournament.title,
      organizer: tournament.organizer ?? '',
      rulebook: tournament.rulebook ?? '',
      ageClass: tournament.ageClass,
      locationName: tournament.location.name,
      locationCity: tournament.location.city ?? '',
      locationStreet: tournament.location.street ?? '',
      contactName: tournament.contactInfo?.name ?? '',
      contactPhone: tournament.contactInfo?.phone ?? '',
      contactEmail: tournament.contactInfo?.email ?? '',
      contactWebsite: tournament.contactInfo?.website ?? '',
      contactShowPublic: tournament.contactInfo?.showPublic === true, // B-14 (@W1-031): Häkchen allein speicherbar
      startDate: tournament.startDate ?? tournament.date,
      startTime: tournament.startTime ?? tournament.timeSlot,
      notes: tournament.adminNotes ?? '',
    };

    const currentData = {
      title: formData.title ?? '',
      organizer: formData.organizer ?? '',
      rulebook: formData.rulebook ?? '',
      ageClass: formData.ageClass ?? DEFAULT_VALUES.ageClass,
      locationName: formData.location?.name ?? '',
      locationCity: formData.location?.city ?? '',
      locationStreet: formData.location?.street ?? '',
      contactName: formData.contactInfo?.name ?? '',
      contactPhone: formData.contactInfo?.phone ?? '',
      contactEmail: formData.contactInfo?.email ?? '',
      contactWebsite: formData.contactInfo?.website ?? '',
      contactShowPublic: formData.contactInfo?.showPublic === true,
      startDate: formData.startDate ?? '',
      startTime: formData.startTime ?? '',
      notes: notes,
    };

    return JSON.stringify(originalData) !== JSON.stringify(currentData);
  }, [tournament, formData, notes]);

  // Browser warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        const message = t('metadata.unsavedChangesWarning');
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- Required for cross-browser compatibility
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, t]);

  // Update handler
  const handleUpdate = <K extends keyof Tournament>(field: K, value: Tournament[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'title' || field === 'startDate') { setMetaErrors(prev => ({ ...prev, [field]: undefined })); }
  };

  // Save handler
  const handleSave = () => {
    // @W5-002 / C-META-NOVALID: leerer Name oder leeres Datum werden nicht gespeichert (ein vergangenes Datum schon, @W5-003)
    const errors = validateTournamentMeta({ title: formData.title, startDate: formData.startDate });
    setMetaErrors(errors);
    if (hasMetaErrors(errors)) { return; }
    const updatedTournament: Tournament = {
      ...tournament,
      title: formData.title ?? tournament.title,
      organizer: formData.organizer,
      rulebook: formData.rulebook,
      ageClass: formData.ageClass ?? tournament.ageClass,
      location: formData.location ?? tournament.location,
      contactInfo: formData.contactInfo,
      startDate: formData.startDate,
      startTime: formData.startTime,
      adminNotes: notes || undefined,
      // Keep legacy fields in sync
      date: formData.startDate ?? tournament.date,
      timeSlot: formData.startTime ?? tournament.timeSlot,
      updatedAt: new Date().toISOString(),
    };

    onTournamentUpdate(updatedTournament);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  // Reset handler
  const handleReset = async () => {
    if (isDirty) {
      // @OB-017: Rückfrage im Dialog der App, nie als Fenster des Browsers
      const confirmReset = await resetDialog.confirm();
      if (!confirmReset) {return;}
    }

    setFormData(toFormData(tournament));
    setNotes(tournament.adminNotes ?? '');
    setMetaErrors({});
  };

  // Get mode display name
  const getModeDisplayName = () => {
    if (tournament.groupSystem === 'roundRobin') {
      return t('metadata.modeRoundRobin');
    }
    if (tournament.groupSystem === 'groupsAndFinals') {
      return t('metadata.modeGroupsAndFinals');
    }
    // Fallback: show mode name directly
    return tournament.mode;
  };

  return (
    <CategoryPage
      icon="📝"
      title={t('metadata.title')}
      description={t('metadata.description')}
      headerExtra={
        <span
          style={{
            ...styles.dirtyBadge,
            ...(isDirty ? styles.dirtyBadgeUnsaved : styles.dirtyBadgeSaved),
          }}
        >
          {isDirty ? t('metadata.unsaved') : t('metadata.saved')}
        </span>
      }
    >
      {/* Basic Data */}
      <CollapsibleSection icon="📋" title={t('metadata.masterData')} defaultOpen>
        <div style={styles.formSection}>
          <Input
            label={t('metadata.tournamentName')}
            value={formData.title ?? ''}
            onChange={(v) => handleUpdate('title', v)}
            placeholder={t('metadata.tournamentNamePlaceholder')}
            errorMessage={metaErrors.title ? t('metadata.tournamentNameRequired') : undefined}
            required
          />

          <Input
            label={t('metadata.organizerOptional')}
            value={formData.organizer ?? ''}
            onChange={(v) => handleUpdate('organizer', v)}
            placeholder={t('metadata.organizerPlaceholder')}
          />

          <RulebookField
            label={t('metadata.rulebook')}
            placeholder={t('metadata.rulebookPlaceholder')}
            limitHint={t('metadata.rulebookLimit')}
            truncatedHint={t('metadata.rulebookTruncated')}
            value={formData.rulebook}
            onChange={(v) => handleUpdate('rulebook', v)}
            testId="metadata-rulebook"
          />

          <Combobox
            label={t('metadata.ageClass')}
            value={formData.ageClass ?? DEFAULT_VALUES.ageClass}
            onChange={(v) => handleUpdate('ageClass', v)}
            options={getAgeClassOptions(tournament.sport)}
            placeholder={t('metadata.searchOrSelect')}
          />
        </div>
      </CollapsibleSection>

      {/* Location & Contact */}
      <CollapsibleSection icon="📍" title={t('metadata.locationAndContact')}>
        <div style={styles.formSection}>
          <LocationForm
            value={formData.location ?? { name: '' }}
            onChange={(location) => handleUpdate('location', location)}
            required
          />

          <div style={{ marginTop: cssVars.spacing.md }}>
            <ContactForm
              value={formData.contactInfo ?? {}}
              onChange={(contactInfo) => handleUpdate('contactInfo', contactInfo)}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Date & Time */}
      <CollapsibleSection icon="📅" title={t('metadata.dateAndTime')}>
        <div style={styles.formSection}>
          <Input
            label={t('metadata.startDate')}
            type="date"
            value={formData.startDate ?? ''}
            onChange={(v) => handleUpdate('startDate', v)}
            errorMessage={metaErrors.startDate ? t('metadata.startDateRequired') : undefined}
            required
          />
          <Input
            label={t('metadata.startTime')}
            type="time"
            value={formData.startTime ?? ''}
            onChange={(v) => handleUpdate('startTime', v)}
            placeholder="09:00"
            required
          />
        </div>
      </CollapsibleSection>

      {/* Locked Structure Info */}
      <CollapsibleSection icon="🔒" title={t('metadata.structureInfo')}>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          {t('metadata.structureInfoDesc')}
        </p>

        <div style={styles.lockedField}>
          <div>
            <div style={styles.lockedFieldLabel}>{t('metadata.numberOfTeams')}</div>
            <div style={styles.lockedFieldValue}>{tournament.numberOfTeams}</div>
          </div>
          <span style={styles.lockedIcon}>🔒</span>
        </div>

        <div style={styles.lockedField}>
          <div>
            <div style={styles.lockedFieldLabel}>{t('metadata.numberOfGroups')}</div>
            <div style={styles.lockedFieldValue}>{effectiveGroupCount(tournament)}</div>
          </div>
          <span style={styles.lockedIcon}>🔒</span>
        </div>

        <div style={styles.lockedField}>
          <div>
            <div style={styles.lockedFieldLabel}>{t('metadata.numberOfFields')}</div>
            <div style={styles.lockedFieldValue}>{effectiveFieldCount(tournament)}</div>
          </div>
          <span style={styles.lockedIcon}>🔒</span>
        </div>

        <div style={styles.lockedField}>
          <div>
            <div style={styles.lockedFieldLabel}>{t('metadata.gameMode')}</div>
            <div style={styles.lockedFieldValue}>{getModeDisplayName()}</div>
          </div>
          <span style={styles.lockedIcon}>🔒</span>
        </div>

        <p style={styles.hint}>
          {t('metadata.changeHint')}
        </p>
      </CollapsibleSection>

      {/* Private Notes */}
      <CollapsibleSection icon="📝" title={t('metadata.privateNotes')}>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          {t('metadata.privateNotesDesc')}
        </p>
        <textarea
          style={styles.textarea}
          placeholder={t('metadata.notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </CollapsibleSection>

      {/* Save/Reset Actions */}
      <div style={styles.buttonRow}>
        <button
          style={{
            ...styles.saveButton,
            ...(isDirty ? {} : styles.saveButtonDisabled),
          }}
          onClick={handleSave}
          disabled={!isDirty}
        >
          {t('metadata.saveChanges')}
        </button>
        <button
          style={styles.resetButton}
          onClick={() => { void handleReset(); }}
          disabled={!isDirty}
        >
          {t('metadata.reset')}
        </button>
      </div>

      {showSaveSuccess && (
        <div style={styles.successMessage}>
          <span>✓</span>
          <span>{t('metadata.changesSaved')}</span>
        </div>
      )}
      <ConfirmDialog {...resetDialog.dialogProps} />
    </CategoryPage>
  );
}

export default MetadataCategory;
