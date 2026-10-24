/**
 * SettingsTab - Turnier-Einstellungen bearbeiten (TOUR-EDIT-META)
 *
 * Ermöglicht das Bearbeiten von Metadaten eines veröffentlichten Turniers:
 * - Turniername, Veranstalter
 * - Altersklasse
 * - Ort, Kontaktdaten
 * - Datum, Startzeit
 *
 * Features:
 * - Dirty-State-Tracking (erkennt ungespeicherte Änderungen)
 * - beforeunload-Handler (Browser-Warnung beim Schließen)
 * - Kommuniziert Dirty-State an Parent für Tab-Wechsel-Warnung
 */

import { useState, useEffect, useMemo, useCallback, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Input, Combobox } from '../../components/ui';
import { Tournament } from '../../types/tournament';
import { cssVars } from '../../design-tokens'
import { getAgeClassOptions, DEFAULT_VALUES } from '../../constants/tournamentOptions';
import { LocationForm } from '../../components/LocationForm';
import { ContactForm } from '../../components/ContactForm';
import { SponsorManagement } from './SponsorManagement';
import { FieldManagement } from './FieldManagement';
import { PlayOutPlacesSettings } from './standings/PlayOutPlacesSettings';
import type { PlayOutPlacesResult } from '../../core/services/PlayOutPlacesService';
import { immutableDescriptionKey, immutableFacts } from './immutableFacts';
import { useTournamentStartState } from '../../hooks/useTournamentStartState';
import { useCan } from '../auth/hooks/useCan';
import { ConfirmDialog, useConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LeadOnlyHint } from '../../components/ui/molecules/LeadOnlyHint';
import { validateTournamentMeta, hasMetaErrors, type TournamentMetaErrors } from '../../core/services/tournamentMetaValidation';

interface SettingsTabProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onEditInWizard?: (tournament: Tournament, targetStep?: number) => void;
  /** Abschnitt, den die Adresse ansteuert (`?abschnitt=gleichstand`, Paket TB-B). */
  focusSection?: string;
  /** Schmaler Speicherweg der Einstellung „Plätze ausspielen“; ohne ihn bleibt der Abschnitt weg. */
  onSavePlayOutPlaces?: (places: number[]) => Promise<PlayOutPlacesResult>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  tournament,
  onTournamentUpdate,
  onDirtyChange,
  onEditInWizard,
  focusSection,
  onSavePlayOutPlaces,
}) => {
  const { t } = useTranslation('tournament');
  // @OB-017: Alle Rückfragen laufen über den Dialog der App (Titel, Text und Variante je Aufruf)
  const confirmDialog = useConfirmDialog({ title: '', message: '', cancelText: t('common.cancel') });
  // @W5-004: „Im Wizard bearbeiten" setzt ein festgelegtes Turnier NIE auf Entwurf zurück.
  // @LZ-003 / W3: nach dem ersten Anpfiff nicht anbieten (gleiche Sperre wie „Turnier löschen",
  // gemeinsame Funktion statt Kopie).
  const { state: matchStartState } = useTournamentStartState(tournament);
  const canEditInWizard = matchStartState === 'not-started';
  // A-11 (@W5-017, @HE-042, L6): Einstellungen ändern = tournamentSettings (sonst lesend mit Hinweis); Neuplanen und
  // Teams ersetzen (Erweiterte Bearbeitung) = restructure. Rechte nur über useCan.
  const canChangeRules = useCan('tournamentSettings', tournament.id);
  const canRestructure = useCan('restructure', tournament.id);
  // Collapse-State für Formular-Bereich
  const [isFormCollapsed, setIsFormCollapsed] = useState(true);

  // Lokale Form-Daten (Kopie des Turniers)
  const [formData, setFormData] = useState<Partial<Tournament>>({
    title: tournament.title,
    organizer: tournament.organizer,
    ageClass: tournament.ageClass,
    location: tournament.location,
    contactInfo: tournament.contactInfo,
    startDate: tournament.startDate ?? tournament.date,
    startTime: tournament.startTime ?? tournament.timeSlot,
  });

  const [metaErrors, setMetaErrors] = useState<TournamentMetaErrors>({});

  // Sync formData wenn sich tournament ändert (nach Speichern)
  useEffect(() => {
    setMetaErrors({});
    setFormData({
      title: tournament.title,
      organizer: tournament.organizer,
      ageClass: tournament.ageClass,
      location: tournament.location,
      contactInfo: tournament.contactInfo,
      startDate: tournament.startDate ?? tournament.date,
      startTime: tournament.startTime ?? tournament.timeSlot,
    });
  }, [tournament]);

  // Dirty-State berechnen
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
    };

    return JSON.stringify(originalData) !== JSON.stringify(currentData);
  }, [tournament, formData]);

  // Kommuniziere Dirty-State an Parent
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Browser-Warnung bei ungespeicherten Änderungen
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        const message = t('settings.unsavedChangesWarning');
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- Required for cross-browser compatibility
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, t]);

  // Update Handler
  const handleUpdate = <K extends keyof Tournament>(field: K, value: Tournament[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'title' || field === 'startDate') { setMetaErrors(prev => ({ ...prev, [field]: undefined })); }
  };

  // Speichern Handler
  const handleSave = () => {
    // @W5-002 / C-META-NOVALID: leerer Name oder leeres Datum werden nicht gespeichert (ein vergangenes Datum schon, @W5-003)
    const errors = validateTournamentMeta({ title: formData.title, startDate: formData.startDate });
    setMetaErrors(errors);
    if (hasMetaErrors(errors)) { return; }
    const updatedTournament: Tournament = {
      ...tournament,
      title: formData.title ?? tournament.title,
      organizer: formData.organizer,
      ageClass: formData.ageClass ?? tournament.ageClass,
      location: formData.location ?? tournament.location,
      contactInfo: formData.contactInfo,
      startDate: formData.startDate,
      startTime: formData.startTime,
      // Legacy-Felder synchron halten
      date: formData.startDate ?? tournament.date,
      timeSlot: formData.startTime ?? tournament.timeSlot,
      updatedAt: new Date().toISOString(),
    };

    onTournamentUpdate(updatedTournament, false);
  };

  // Zurücksetzen Handler
  const handleReset = async () => {
    if (isDirty) {
      // @OB-017: Rückfrage im Dialog der App, nie als Fenster des Browsers
      const confirmReset = await confirmDialog.confirm({
        title: t('settings.confirmDialog.resetTitle'),
        message: t('settings.confirmReset'),
        variant: 'warning',
        confirmText: t('settings.confirmDialog.resetConfirm'),
      });
      if (!confirmReset) {return;}
    }

    setMetaErrors({});
    setFormData({
      title: tournament.title,
      organizer: tournament.organizer,
      ageClass: tournament.ageClass,
      location: tournament.location,
      contactInfo: tournament.contactInfo,
      startDate: tournament.startDate ?? tournament.date,
      startTime: tournament.startTime ?? tournament.timeSlot,
    });
  };

  // Edit in Wizard Handler - mit Ziel-Schritt
  const handleEditInWizard = async (targetStep: number) => {
    if (isDirty) {
      const confirmLeave = await confirmDialog.confirm({
        title: t('settings.confirmDialog.leaveTitle'),
        message: t('settings.confirmLeaveToWizard'),
        variant: 'warning',
        confirmText: t('settings.confirmDialog.leaveConfirm'),
      });
      if (!confirmLeave) {return;}
    }

    // Wizard-Step-Namen (US-GROUPS-AND-FIELDS: 6 Steps statt 5)
    const stepNames: Record<number, string> = {
      1: t('settings.wizardSteps.masterData'),
      2: t('settings.wizardSteps.sport'),
      3: t('settings.wizardSteps.gameMode'),
      4: t('settings.wizardSteps.groupsAndFields'),
      5: t('settings.wizardSteps.teams'),
      6: t('settings.wizardSteps.overview'),
    };

    // Ergebnisse gehen verloren: gefährliche Rückfrage, Fokus zuerst auf „Abbrechen“ (@OB-014)
    const confirmWizard = await confirmDialog.confirm({
      title: t('settings.confirmDialog.wizardTitle'),
      message: t('settings.confirmWizardEdit', { step: stepNames[targetStep] ?? t('settings.wizard') }),
      variant: 'danger',
      confirmText: t('settings.confirmDialog.wizardConfirm'),
    });

    if (confirmWizard && onEditInWizard) {
      // @W5-004/@LZ-004: Bearbeiten setzt ein Turnier NIE auf Entwurf zurück.
      const wizardTournament: Tournament = {
        ...tournament,
        lastVisitedStep: targetStep,
      };
      onEditInWizard(wizardTournament, targetStep);
    }
  };

  // Async Tournament Update Handler für SponsorManagement
  const handleAsyncTournamentUpdate = useCallback(async (updatedTournament: Tournament) => {
    onTournamentUpdate(updatedTournament, false);
  }, [onTournamentUpdate]);

  // Styles
  const containerStyle: CSSProperties = {
    padding: cssVars.spacing.lg,
    background: cssVars.colors.background,
    minHeight: 'calc(100vh - 200px)',
  };

  const contentStyle: CSSProperties = {
    maxWidth: '800px',
    margin: '0 auto',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: cssVars.spacing.lg,
    flexWrap: 'wrap',
    gap: cssVars.spacing.md,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
  };

  const buttonStyle = (variant: 'primary' | 'secondary' | 'danger'): CSSProperties => ({
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: variant === 'primary' && !isDirty ? 'not-allowed' : 'pointer',
    opacity: variant === 'primary' && !isDirty ? 0.5 : 1,
    transition: 'all 0.2s ease',
    background:
      variant === 'primary'
        ? cssVars.colors.primary
        : variant === 'danger'
          ? cssVars.colors.error
          : 'transparent',
    color:
      variant === 'primary' || variant === 'danger'
        ? 'white'
        : cssVars.colors.textSecondary,
    border: variant === 'secondary' ? `1px solid ${cssVars.colors.borderControl}` : 'none',
  });

  const dirtyIndicatorStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: isDirty ? cssVars.colors.dirtyIndicatorBg : cssVars.colors.successLight,
    color: isDirty ? cssVars.colors.warning : cssVars.colors.success,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
  };

  const toggleIconStyle: CSSProperties = {
    transition: 'transform 0.2s ease',
    transform: isFormCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
    display: 'inline-block',
  };

  const collapsibleHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: cssVars.spacing.lg,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
    cursor: 'pointer',
    userSelect: 'none',
    marginBottom: isFormCollapsed ? '0' : cssVars.spacing.lg,
  };

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        {!canChangeRules && <div style={{ marginBottom: cssVars.spacing.md }}><LeadOnlyHint /></div>}
        {/* Collapsible Header für Metadaten-Bearbeitung */}
        <div
          style={collapsibleHeaderStyle}
          onClick={() => setIsFormCollapsed(!isFormCollapsed)}
        >
          <div>
            <h2 style={{ ...titleStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={toggleIconStyle}>▼</span>
              {t('settings.editMetadata')}
            </h2>
            {isFormCollapsed && (
              <p style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, margin: '4px 0 0 24px' }}>
                {t('settings.editMetadataHint')}
              </p>
            )}
          </div>
          <span style={dirtyIndicatorStyle}>
            {isDirty ? t('settings.unsavedChanges') : t('settings.saved')}
          </span>
        </div>

        {/* Collapsible Form Content (ohne tournamentSettings lesend: alle Eingaben gesperrt, L6) */}
        <fieldset disabled={!canChangeRules} style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
        {!isFormCollapsed && (
          <>
            {/* Header mit Buttons */}
            <div style={headerStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.md }}>
                <h3 style={{ ...titleStyle, fontSize: cssVars.fontSizes.lg }}>{t('settings.title')}</h3>
              </div>
              <div style={buttonGroupStyle}>
                <button
                  style={buttonStyle('secondary')}
                  onClick={() => { void handleReset(); }}
                  disabled={!isDirty}
                  title={t('settings.discardChanges')}
                >
                  {t('settings.reset')}
                </button>
                <button
                  style={buttonStyle('primary')}
                  onClick={handleSave}
                  disabled={!isDirty}
                  title={isDirty ? t('settings.saveChanges') : t('settings.noChanges')}
                >
                  {t('common.save')}
                </button>
              </div>
            </div>

            {/* Formular */}
            <Card>
              <h3 style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.lg, margin: '0 0 24px 0' }}>
                {t('settings.masterData')}
              </h3>

              <Input
                label={t('settings.tournamentName')}
                value={formData.title ?? ''}
                onChange={(v) => handleUpdate('title', v)}
                placeholder={t('settings.tournamentNamePlaceholder')}
                errorMessage={metaErrors.title ? t('settings.tournamentNameRequired') : undefined}
                required
              />

              <Input
                label={t('settings.organizer')}
                value={formData.organizer ?? ''}
                onChange={(v) => handleUpdate('organizer', v)}
                placeholder={t('settings.organizerPlaceholder')}
                style={{ marginTop: '16px' }}
              />

              <Combobox
                label={t('settings.ageClass')}
                value={formData.ageClass ?? DEFAULT_VALUES.ageClass}
                onChange={(v) => handleUpdate('ageClass', v)}
                options={getAgeClassOptions(tournament.sport)}
                placeholder={t('settings.ageClassPlaceholder')}
                style={{ marginTop: '16px' }}
              />
            </Card>

            <Card style={{ marginTop: cssVars.spacing.lg }}>
              <h3 style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.lg, margin: '0 0 24px 0' }}>
                {t('settings.locationAndContact')}
              </h3>

              <LocationForm
                value={formData.location ?? { name: '' }}
                onChange={(location) => handleUpdate('location', location)}
                required
              />

              <div style={{ marginTop: '24px' }}>
                <ContactForm
                  value={formData.contactInfo ?? {}}
                  onChange={(contactInfo) => handleUpdate('contactInfo', contactInfo)}
                />
              </div>
            </Card>

            <Card style={{ marginTop: cssVars.spacing.lg }}>
              <h3 style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.lg, margin: '0 0 24px 0' }}>
                {t('settings.dateAndTime')}
              </h3>

              <div className="date-time-grid" style={{ display: 'grid', gap: '16px' }}>
                <Input
                  label={t('settings.startDate')}
                  type="date"
                  value={formData.startDate ?? ''}
                  onChange={(v) => handleUpdate('startDate', v)}
                  errorMessage={metaErrors.startDate ? t('settings.startDateRequired') : undefined}
                  required
                />
                <Input
                  label={t('settings.startTime')}
                  type="time"
                  value={formData.startTime ?? ''}
                  onChange={(v) => handleUpdate('startTime', v)}
                  placeholder="09:00"
                  required
                />
              </div>

              {/* Responsive Styles */}
              <style>{`
                .date-time-grid {
                  grid-template-columns: 1fr 1fr;
                }

                @media (max-width: 480px) {
                  .date-time-grid {
                    grid-template-columns: 1fr !important;
                  }
                }
              `}</style>
            </Card>

            {/* Info-Box für nicht-editierbare Felder */}
            <Card style={{ marginTop: cssVars.spacing.lg, background: cssVars.colors.infoBannerBg }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: cssVars.spacing.md }}>
                <span style={{ fontSize: cssVars.fontSizes.xxl }}>ℹ️</span>
                <div>
                  <h4 style={{ margin: '0 0 8px 0', color: cssVars.colors.textPrimary }}>
                    {t('settings.immutableSettings.title')}
                  </h4>
                  <p style={{ margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>
                    {t(immutableDescriptionKey(canEditInWizard, canRestructure))}
                  </p>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>
                    {immutableFacts(tournament, (key) => t(key)).map((fact) => (
                      <li key={fact.key}>{t(fact.labelKey, fact.params)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Sponsoren-Verwaltung - MON-KONF-01 */}
        <div style={{ marginTop: cssVars.spacing.lg }}>
          <SponsorManagement
            tournament={tournament}
            onTournamentUpdate={handleAsyncTournamentUpdate}
          />
        </div>

        {/* Felder-Verwaltung - MON-KONF-01 */}
        <div style={{ marginTop: cssVars.spacing.lg }}>
          <FieldManagement
            tournament={tournament}
            onTournamentUpdate={handleAsyncTournamentUpdate}
          />
        </div>

        {/* Gleichstand: welche Plätze ausgespielt werden müssen (Paket TB-B, @W2A-068) */}
        {onSavePlayOutPlaces && <PlayOutPlacesSettings tournament={tournament} onSave={onSavePlayOutPlaces} jumpHere={focusSection === 'gleichstand'} />}
        </fieldset>

        {/* Wizard-Bearbeitung (Neuplanen, Teams ersetzen) — nur vor dem ersten Anpfiff (@LZ-003 / W3), nur mit restructure (@W5-017) */}
        {onEditInWizard && canEditInWizard && canRestructure && (
          <Card style={{ marginTop: cssVars.spacing.lg, background: cssVars.colors.warningBannerBg, border: `1px solid ${cssVars.colors.warningBannerBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: cssVars.spacing.md }}>
              <span style={{ fontSize: cssVars.fontSizes.xxl }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 8px 0', color: cssVars.colors.textPrimary }}>
                  {t('settings.advancedEditing.title')}
                </h4>
                <p style={{ margin: '0 0 12px 0', color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>
                  {t('settings.advancedEditing.description')}
                </p>
                <p style={{ margin: '0 0 16px 0', color: cssVars.colors.warning, fontSize: cssVars.fontSizes.xs, fontWeight: cssVars.fontWeights.medium }}>
                  {t('settings.advancedEditing.warning')}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    data-testid="wizard-edit-edit-teams"
                    onClick={() => { void handleEditInWizard(5); }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: cssVars.borderRadius.md,
                      fontSize: cssVars.fontSizes.sm,
                      fontWeight: cssVars.fontWeights.semibold,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: cssVars.colors.warning,
                      color: cssVars.colors.onWarning,
                      border: 'none',
                    }}
                  >
                    {t('settings.advancedEditing.editTeams')}
                  </button>
                  <button
                    data-testid="wizard-edit-change-game-mode"
                    onClick={() => { void handleEditInWizard(3); }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: cssVars.borderRadius.md,
                      fontSize: cssVars.fontSizes.sm,
                      fontWeight: cssVars.fontWeights.semibold,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: cssVars.colors.warning,
                      color: cssVars.colors.onWarning,
                      border: 'none',
                    }}
                  >
                    {t('settings.advancedEditing.changeGameMode')}
                  </button>
                  <button
                    data-testid="wizard-edit-groups-and-fields"
                    onClick={() => { void handleEditInWizard(4); }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: cssVars.borderRadius.md,
                      fontSize: cssVars.fontSizes.sm,
                      fontWeight: cssVars.fontWeights.semibold,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: cssVars.colors.warning,
                      color: cssVars.colors.onWarning,
                      border: 'none',
                    }}
                  >
                    {t('settings.advancedEditing.groupsAndFields')}
                  </button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
};
