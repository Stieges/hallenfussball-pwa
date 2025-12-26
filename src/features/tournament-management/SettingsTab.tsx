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

import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { Card, Input, Select } from '../../components/ui';
import { Tournament } from '../../types/tournament';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../design-tokens';
import { getAgeClassOptions, DEFAULT_VALUES } from '../../constants/tournamentOptions';
import { LocationForm } from '../../components/LocationForm';
import { ContactForm } from '../../components/ContactForm';

interface SettingsTabProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onEditInWizard?: (tournament: Tournament, targetStep?: number) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  tournament,
  onTournamentUpdate,
  onDirtyChange,
  onEditInWizard,
}) => {
  // Collapse-State für Formular-Bereich
  const [isFormCollapsed, setIsFormCollapsed] = useState(true);

  // Lokale Form-Daten (Kopie des Turniers)
  const [formData, setFormData] = useState<Partial<Tournament>>({
    title: tournament.title,
    organizer: tournament.organizer,
    ageClass: tournament.ageClass,
    location: tournament.location,
    contactInfo: tournament.contactInfo,
    startDate: tournament.startDate || tournament.date,
    startTime: tournament.startTime || tournament.timeSlot,
  });

  // Sync formData wenn sich tournament ändert (nach Speichern)
  useEffect(() => {
    setFormData({
      title: tournament.title,
      organizer: tournament.organizer,
      ageClass: tournament.ageClass,
      location: tournament.location,
      contactInfo: tournament.contactInfo,
      startDate: tournament.startDate || tournament.date,
      startTime: tournament.startTime || tournament.timeSlot,
    });
  }, [tournament]);

  // Dirty-State berechnen
  const isDirty = useMemo(() => {
    const originalData = {
      title: tournament.title || '',
      organizer: tournament.organizer || '',
      ageClass: tournament.ageClass || DEFAULT_VALUES.ageClass,
      locationName: tournament.location.name || '',
      locationCity: tournament.location.city || '',
      locationStreet: tournament.location.street || '',
      contactName: tournament.contactInfo?.name || '',
      contactPhone: tournament.contactInfo?.phone || '',
      contactEmail: tournament.contactInfo?.email || '',
      startDate: tournament.startDate || tournament.date || '',
      startTime: tournament.startTime || tournament.timeSlot || '',
    };

    const currentData = {
      title: formData.title || '',
      organizer: formData.organizer || '',
      ageClass: formData.ageClass || DEFAULT_VALUES.ageClass,
      locationName: formData.location?.name || '',
      locationCity: formData.location?.city || '',
      locationStreet: formData.location?.street || '',
      contactName: formData.contactInfo?.name || '',
      contactPhone: formData.contactInfo?.phone || '',
      contactEmail: formData.contactInfo?.email || '',
      startDate: formData.startDate || '',
      startTime: formData.startTime || '',
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
        e.returnValue = 'Du hast ungespeicherte Änderungen. Möchtest du wirklich die Seite verlassen?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Update Handler
  const handleUpdate = <K extends keyof Tournament>(field: K, value: Tournament[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Speichern Handler
  const handleSave = () => {
    const updatedTournament: Tournament = {
      ...tournament,
      title: formData.title || tournament.title,
      organizer: formData.organizer,
      ageClass: formData.ageClass || tournament.ageClass,
      location: formData.location || tournament.location,
      contactInfo: formData.contactInfo,
      startDate: formData.startDate,
      startTime: formData.startTime,
      // Legacy-Felder synchron halten
      date: formData.startDate || tournament.date,
      timeSlot: formData.startTime || tournament.timeSlot,
      updatedAt: new Date().toISOString(),
    };

    onTournamentUpdate(updatedTournament, false);
  };

  // Zurücksetzen Handler
  const handleReset = () => {
    if (isDirty) {
      const confirmReset = window.confirm(
        'Möchtest du alle Änderungen verwerfen und die ursprünglichen Werte wiederherstellen?'
      );
      if (!confirmReset) {return;}
    }

    setFormData({
      title: tournament.title,
      organizer: tournament.organizer,
      ageClass: tournament.ageClass,
      location: tournament.location,
      contactInfo: tournament.contactInfo,
      startDate: tournament.startDate || tournament.date,
      startTime: tournament.startTime || tournament.timeSlot,
    });
  };

  // Edit in Wizard Handler - mit Ziel-Schritt
  const handleEditInWizard = (targetStep: number) => {
    if (isDirty) {
      const confirmLeave = window.confirm(
        'Du hast ungespeicherte Änderungen. Möchtest du wirklich zum Wizard wechseln?\n\n' +
        'Die Änderungen in diesem Tab gehen verloren.'
      );
      if (!confirmLeave) {return;}
    }

    // Wizard-Step-Namen (US-GROUPS-AND-FIELDS: 6 Steps statt 5)
    const stepNames: Record<number, string> = {
      1: 'Stammdaten',
      2: 'Sportart',
      3: 'Spielmodus',
      4: 'Gruppen & Felder',
      5: 'Teams',
      6: 'Übersicht',
    };

    const confirmWizard = window.confirm(
      `Möchtest du "${stepNames[targetStep] || 'Wizard'}" bearbeiten?\n\n` +
      'Der Spielplan wird dabei neu generiert und alle bisherigen Ergebnisse gehen verloren!'
    );

    if (confirmWizard && onEditInWizard) {
      // Set tournament back to draft status for wizard editing
      const draftTournament: Tournament = {
        ...tournament,
        status: 'draft',
        lastVisitedStep: targetStep,
      };
      onEditInWizard(draftTournament, targetStep);
    }
  };

  // Styles
  const containerStyle: CSSProperties = {
    padding: spacing.lg,
    background: colors.background,
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
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
    gap: spacing.md,
  };

  const titleStyle: CSSProperties = {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    margin: 0,
  };

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.sm,
  };

  const buttonStyle = (variant: 'primary' | 'secondary' | 'danger'): CSSProperties => ({
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    cursor: variant === 'primary' && !isDirty ? 'not-allowed' : 'pointer',
    opacity: variant === 'primary' && !isDirty ? 0.5 : 1,
    transition: 'all 0.2s ease',
    background:
      variant === 'primary'
        ? colors.primary
        : variant === 'danger'
          ? colors.error
          : 'transparent',
    color:
      variant === 'primary' || variant === 'danger'
        ? 'white'
        : colors.textSecondary,
    border: variant === 'secondary' ? `1px solid ${colors.border}` : 'none',
  });

  const dirtyIndicatorStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    background: isDirty ? 'rgba(255, 152, 0, 0.15)' : 'rgba(76, 175, 80, 0.15)',
    color: isDirty ? '#FF9800' : '#4CAF50',
    borderRadius: borderRadius.sm,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
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
    padding: spacing.lg,
    background: colors.surface,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border}`,
    cursor: 'pointer',
    userSelect: 'none',
    marginBottom: isFormCollapsed ? '0' : spacing.lg,
  };

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        {/* Collapsible Header für Metadaten-Bearbeitung */}
        <div
          style={collapsibleHeaderStyle}
          onClick={() => setIsFormCollapsed(!isFormCollapsed)}
        >
          <div>
            <h2 style={{ ...titleStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={toggleIconStyle}>▼</span>
              Metadaten bearbeiten
            </h2>
            {isFormCollapsed && (
              <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '4px 0 0 24px' }}>
                Turniername, Ort, Datum & Zeit anpassen • Klicken zum Aufklappen
              </p>
            )}
          </div>
          <span style={dirtyIndicatorStyle}>
            {isDirty ? '● Ungespeicherte Änderungen' : '✓ Gespeichert'}
          </span>
        </div>

        {/* Collapsible Form Content */}
        {!isFormCollapsed && (
          <>
            {/* Header mit Buttons */}
            <div style={headerStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                <h3 style={{ ...titleStyle, fontSize: fontSizes.lg }}>Einstellungen</h3>
              </div>
              <div style={buttonGroupStyle}>
                <button
                  style={buttonStyle('secondary')}
                  onClick={handleReset}
                  disabled={!isDirty}
                  title="Änderungen verwerfen"
                >
                  Zurücksetzen
                </button>
                <button
                  style={buttonStyle('primary')}
                  onClick={handleSave}
                  disabled={!isDirty}
                  title={isDirty ? 'Änderungen speichern' : 'Keine Änderungen vorhanden'}
                >
                  Speichern
                </button>
              </div>
            </div>

            {/* Formular */}
            <Card>
              <h3 style={{ color: colors.textPrimary, fontSize: fontSizes.lg, margin: '0 0 24px 0' }}>
                Stammdaten
              </h3>

              <Input
                label="Turniername"
                value={formData.title || ''}
                onChange={(v) => handleUpdate('title', v)}
                placeholder="z.B. TSV Waging Hallencup 2025"
                required
              />

              <Input
                label="Veranstalter (optional)"
                value={formData.organizer || ''}
                onChange={(v) => handleUpdate('organizer', v)}
                placeholder="z.B. TSV Waging e.V."
                style={{ marginTop: '16px' }}
              />

              <Select
                label="Altersklasse"
                value={formData.ageClass || DEFAULT_VALUES.ageClass}
                onChange={(v) => handleUpdate('ageClass', v)}
                options={getAgeClassOptions(tournament.sport || 'football')}
                style={{ marginTop: '16px' }}
              />
            </Card>

            <Card style={{ marginTop: spacing.lg }}>
              <h3 style={{ color: colors.textPrimary, fontSize: fontSizes.lg, margin: '0 0 24px 0' }}>
                Ort & Kontakt
              </h3>

              <LocationForm
                value={formData.location || { name: '' }}
                onChange={(location) => handleUpdate('location', location)}
                required
              />

              <div style={{ marginTop: '24px' }}>
                <ContactForm
                  value={formData.contactInfo || {}}
                  onChange={(contactInfo) => handleUpdate('contactInfo', contactInfo)}
                />
              </div>
            </Card>

            <Card style={{ marginTop: spacing.lg }}>
              <h3 style={{ color: colors.textPrimary, fontSize: fontSizes.lg, margin: '0 0 24px 0' }}>
                Datum & Zeit
              </h3>

              <div className="date-time-grid" style={{ display: 'grid', gap: '16px' }}>
                <Input
                  label="Startdatum"
                  type="date"
                  value={formData.startDate || ''}
                  onChange={(v) => handleUpdate('startDate', v)}
                  required
                />
                <Input
                  label="Startzeit"
                  type="time"
                  value={formData.startTime || ''}
                  onChange={(v) => handleUpdate('startTime', v)}
                  placeholder="z.B. 09:00"
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
            <Card style={{ marginTop: spacing.lg, background: 'rgba(33, 150, 243, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                <span style={{ fontSize: '24px' }}>ℹ️</span>
                <div>
                  <h4 style={{ margin: '0 0 8px 0', color: colors.textPrimary }}>
                    Nicht änderbare Einstellungen
                  </h4>
                  <p style={{ margin: 0, color: colors.textSecondary, fontSize: fontSizes.sm }}>
                    Die folgenden Einstellungen können nach Veröffentlichung nicht mehr geändert werden,
                    da sie den Spielplan beeinflussen würden:
                  </p>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: colors.textSecondary, fontSize: fontSizes.sm }}>
                    <li>Anzahl Teams ({tournament.numberOfTeams})</li>
                    <li>Anzahl Gruppen ({tournament.numberOfGroups})</li>
                    <li>Anzahl Felder ({tournament.numberOfFields})</li>
                    <li>Spielmodus ({tournament.mode})</li>
                    <li>Turniertyp ({tournament.tournamentType})</li>
                  </ul>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Wizard-Bearbeitung Buttons - IMMER SICHTBAR */}
        {onEditInWizard && (
          <Card style={{ marginTop: spacing.lg, background: 'rgba(255, 152, 0, 0.08)', border: `1px solid rgba(255, 152, 0, 0.3)` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 8px 0', color: colors.textPrimary }}>
                  Erweiterte Bearbeitung
                </h4>
                <p style={{ margin: '0 0 12px 0', color: colors.textSecondary, fontSize: fontSizes.sm }}>
                  Wähle den Bereich, den du bearbeiten möchtest. Nach dem Speichern kommst du direkt zurück.
                </p>
                <p style={{ margin: '0 0 16px 0', color: '#FF9800', fontSize: fontSizes.xs, fontWeight: fontWeights.medium }}>
                  Achtung: Der Spielplan wird neu generiert und alle Ergebnisse gehen verloren!
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    onClick={() => handleEditInWizard(5)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: borderRadius.md,
                      fontSize: fontSizes.sm,
                      fontWeight: fontWeights.semibold,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: '#FF9800',
                      color: 'white',
                      border: 'none',
                    }}
                  >
                    Teams bearbeiten
                  </button>
                  <button
                    onClick={() => handleEditInWizard(3)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: borderRadius.md,
                      fontSize: fontSizes.sm,
                      fontWeight: fontWeights.semibold,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: '#FF9800',
                      color: 'white',
                      border: 'none',
                    }}
                  >
                    Spielmodus ändern
                  </button>
                  <button
                    onClick={() => handleEditInWizard(4)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: borderRadius.md,
                      fontSize: fontSizes.sm,
                      fontWeight: fontWeights.semibold,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: '#FF9800',
                      color: 'white',
                      border: 'none',
                    }}
                  >
                    Gruppen & Felder
                  </button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
