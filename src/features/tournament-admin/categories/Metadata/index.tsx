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
import { getAgeClassOptions, DEFAULT_VALUES } from '../../../../constants/tournamentOptions';
import type { Tournament } from '../../../../types/tournament';

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
    border: `1px solid ${cssVars.colors.border}`,
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
    border: `1px solid ${cssVars.colors.border}`,
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

export function MetadataCategory({
  tournament,
  onTournamentUpdate,
}: MetadataCategoryProps) {
  const { t } = useTranslation('admin');
  // Local form state (copy of tournament data)
  const [formData, setFormData] = useState<Partial<Tournament>>({
    title: tournament.title,
    organizer: tournament.organizer,
    ageClass: tournament.ageClass,
    location: tournament.location,
    contactInfo: tournament.contactInfo,
    startDate: tournament.startDate ?? tournament.date,
    startTime: tournament.startTime ?? tournament.timeSlot,
  });

  // Private notes (stored in tournament.adminNotes or similar)
  const [notes, setNotes] = useState(tournament.adminNotes ?? '');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Sync formData when tournament changes (after save)
  useEffect(() => {
    setFormData({
      title: tournament.title,
      organizer: tournament.organizer,
      ageClass: tournament.ageClass,
      location: tournament.location,
      contactInfo: tournament.contactInfo,
      startDate: tournament.startDate ?? tournament.date,
      startTime: tournament.startTime ?? tournament.timeSlot,
    });
    setNotes(tournament.adminNotes ?? '');
  }, [tournament]);

  // Calculate dirty state
  const isDirty = useMemo(() => {
    const originalData = {
      title: tournament.title,
      organizer: tournament.organizer ?? '',
      ageClass: tournament.ageClass,
      locationName: tournament.location.name,
      locationCity: tournament.location.city ?? '',
      locationStreet: tournament.location.street ?? '',
      contactName: tournament.contactInfo?.name ?? '',
      contactPhone: tournament.contactInfo?.phone ?? '',
      contactEmail: tournament.contactInfo?.email ?? '',
      startDate: tournament.startDate ?? tournament.date,
      startTime: tournament.startTime ?? tournament.timeSlot,
      notes: tournament.adminNotes ?? '',
    };

    const currentData = {
      title: formData.title ?? '',
      organizer: formData.organizer ?? '',
      ageClass: formData.ageClass ?? DEFAULT_VALUES.ageClass,
      locationName: formData.location?.name ?? '',
      locationCity: formData.location?.city ?? '',
      locationStreet: formData.location?.street ?? '',
      contactName: formData.contactInfo?.name ?? '',
      contactPhone: formData.contactInfo?.phone ?? '',
      contactEmail: formData.contactInfo?.email ?? '',
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
  };

  // Save handler
  const handleSave = () => {
    const updatedTournament: Tournament = {
      ...tournament,
      title: formData.title ?? tournament.title,
      organizer: formData.organizer,
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
  const handleReset = () => {
    if (isDirty) {
      const confirmReset = window.confirm(t('metadata.confirmReset'));
      if (!confirmReset) {return;}
    }

    setFormData({
      title: tournament.title,
      organizer: tournament.organizer,
      ageClass: tournament.ageClass,
      location: tournament.location,
      contactInfo: tournament.contactInfo,
      startDate: tournament.startDate ?? tournament.date,
      startTime: tournament.startTime ?? tournament.timeSlot,
    });
    setNotes(tournament.adminNotes ?? '');
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
            required
          />

          <Input
            label={t('metadata.organizerOptional')}
            value={formData.organizer ?? ''}
            onChange={(v) => handleUpdate('organizer', v)}
            placeholder={t('metadata.organizerPlaceholder')}
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
            <div style={styles.lockedFieldValue}>{tournament.numberOfGroups ?? 1}</div>
          </div>
          <span style={styles.lockedIcon}>🔒</span>
        </div>

        <div style={styles.lockedField}>
          <div>
            <div style={styles.lockedFieldLabel}>{t('metadata.numberOfFields')}</div>
            <div style={styles.lockedFieldValue}>{tournament.numberOfFields}</div>
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
          onClick={handleReset}
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
    </CategoryPage>
  );
}

export default MetadataCategory;
