/**
 * SettingsCategory - Tournament Settings
 *
 * Non-destructive tournament operations and field management.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.6
 */

import { CSSProperties, useCallback } from 'react';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import { FieldManagement } from '../../../tournament-management/FieldManagement';
import { MatchCockpitSettingsPanel } from '../../../../components/match-cockpit/MatchCockpitSettingsPanel';
import { useMatchSound } from '../../../../hooks/useMatchSound';
import type { Tournament, MatchCockpitSettings } from '../../../../types/tournament';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../../types/tournament';

// =============================================================================
// PROPS
// =============================================================================

interface SettingsCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// Helper to get cockpit settings with defaults
function getCockpitSettings(tournament: Tournament): MatchCockpitSettings {
  return {
    ...DEFAULT_MATCH_COCKPIT_SETTINGS,
    ...tournament.matchCockpitSettings,
  };
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

  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  } as CSSProperties,

  radio: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    cursor: 'pointer',
  } as CSSProperties,

  radioLabel: {
    fontSize: cssVars.fontSizes.bodyMd,
    color: cssVars.colors.textPrimary,
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

  preview: {
    background: cssVars.colors.surfaceHover,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.md,
    marginTop: cssVars.spacing.md,
  } as CSSProperties,

  previewTitle: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textMuted,
    marginBottom: cssVars.spacing.sm,
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function SettingsCategory({
  tournamentId,
  tournament,
  onTournamentUpdate,
}: SettingsCategoryProps) {
  const handleTournamentUpdate = async (updatedTournament: Tournament) => {
    onTournamentUpdate(updatedTournament);
  };

  // Match Cockpit Pro settings
  const cockpitSettings = getCockpitSettings(tournament);

  // Sound hook for testing
  const sound = useMatchSound(
    cockpitSettings.soundId,
    cockpitSettings.soundVolume,
    cockpitSettings.soundEnabled,
    tournamentId
  );

  // Handle cockpit settings change
  const handleCockpitSettingsChange = useCallback(
    (newSettings: MatchCockpitSettings) => {
      onTournamentUpdate({
        ...tournament,
        matchCockpitSettings: newSettings,
      });
    },
    [tournament, onTournamentUpdate]
  );

  // Handle test sound
  const handleTestSound = useCallback(() => {
    void sound.testPlay();
  }, [sound]);

  return (
    <CategoryPage
      icon="⚙️"
      title="Turnier-Einstellungen"
      description="Nicht-destruktive Turnier-Operationen und Feld-Management"
    >
      {/* Match Cockpit Pro Settings */}
      <CollapsibleSection icon="🎮" title="Match Cockpit Pro" defaultOpen>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Einstellungen für das Live-Spielverwaltungs-Cockpit: Timer, Sound, Haptik und mehr.
        </p>
        <MatchCockpitSettingsPanel
          settings={cockpitSettings}
          onChange={handleCockpitSettingsChange}
          tournamentId={tournamentId}
          onTestSound={handleTestSound}
        />
      </CollapsibleSection>

      {/* Pause Tournament */}
      <CollapsibleSection icon="⏸️" title="Turnier pausieren" defaultOpen>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Pausiert alle laufenden Aktivitäten und fügt einen Pause-Block in den Spielplan ein.
        </p>

        <div style={styles.formGroup}>
          <label style={styles.label}>Pause-Dauer</label>
          <div style={styles.inputRow}>
            <input
              type="number"
              defaultValue={15}
              min={1}
              max={120}
              style={styles.input}
            />
            <span style={styles.inputUnit}>Minuten</span>
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Grund (optional)</label>
          <input
            type="text"
            placeholder="z.B. Siegerehrung Vorrunde"
            style={{ ...styles.input, width: '100%', textAlign: 'left' }}
          />
        </div>

        <button style={styles.button}>Pause einfügen</button>
      </CollapsibleSection>

      {/* Auto-Time-Continuation */}
      <CollapsibleSection icon="🔄" title="Auto-Time-Continuation">
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Passt Spielplan-Zeiten automatisch an Verzögerungen an.
        </p>

        <div style={styles.radioGroup}>
          <label style={styles.radio}>
            <input type="radio" name="autoTime" defaultChecked />
            <div>
              <div style={styles.radioLabel}>Aus</div>
              <div style={{ fontSize: cssVars.fontSizes.labelSm, color: cssVars.colors.textMuted }}>
                Zeiten bleiben wie geplant
              </div>
            </div>
          </label>
          <label style={styles.radio}>
            <input type="radio" name="autoTime" />
            <div>
              <div style={styles.radioLabel}>Automatisch</div>
              <div style={{ fontSize: cssVars.fontSizes.labelSm, color: cssVars.colors.textMuted }}>
                System erkennt Verzögerungen
              </div>
            </div>
          </label>
          <label style={styles.radio}>
            <input type="radio" name="autoTime" />
            <div>
              <div style={styles.radioLabel}>Manuell</div>
              <div style={{ fontSize: cssVars.fontSizes.labelSm, color: cssVars.colors.textMuted }}>
                Offset selbst eingeben
              </div>
            </div>
          </label>
        </div>
      </CollapsibleSection>

      {/* Duplicate Tournament */}
      <CollapsibleSection icon="📋" title="Turnier duplizieren">
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Erstellt eine Kopie als Vorlage für nächstes Jahr.
        </p>

        <div style={styles.checkboxGroup}>
          <label style={styles.checkbox}>
            <input type="checkbox" defaultChecked />
            <span>Turnier-Einstellungen</span>
          </label>
          <label style={styles.checkbox}>
            <input type="checkbox" defaultChecked />
            <span>Gruppen-Struktur</span>
          </label>
          <label style={styles.checkbox}>
            <input type="checkbox" defaultChecked />
            <span>Feld-Namen</span>
          </label>
          <label style={styles.checkbox}>
            <input type="checkbox" />
            <span>Teams (ohne Ergebnisse)</span>
          </label>
          <label style={styles.checkbox}>
            <input type="checkbox" defaultChecked />
            <span>Sponsoren</span>
          </label>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Name der Kopie</label>
          <input
            type="text"
            defaultValue={`${tournament.title} (Kopie)`}
            style={{ ...styles.input, width: '100%', textAlign: 'left' }}
          />
        </div>

        <button style={styles.button}>Turnier duplizieren</button>
      </CollapsibleSection>

      {/* Field Management */}
      <CollapsibleSection icon="🏟️" title="Feld-Management" defaultOpen>
        <FieldManagement
          tournament={tournament}
          onTournamentUpdate={handleTournamentUpdate}
        />
      </CollapsibleSection>

      {/* Game Times (Locked if matches started) */}
      <CollapsibleSection icon="⏱️" title="Spielzeiten">
        <div style={styles.formGroup}>
          <label style={styles.label}>Spielzeit pro Spiel</label>
          <div style={styles.inputRow}>
            <input
              type="number"
              value={tournament.groupPhaseGameDuration}
              disabled
              style={{ ...styles.input, opacity: 0.6 }}
            />
            <span style={styles.inputUnit}>Minuten 🔒</span>
          </div>
          <p style={{ fontSize: cssVars.fontSizes.labelSm, color: cssVars.colors.textMuted }}>
            Gesperrt, da bereits Spiele gestartet wurden. Spielplan zurücksetzen um zu ändern.
          </p>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Pausenzeit zwischen Spielen</label>
          <div style={styles.inputRow}>
            <input
              type="number"
              defaultValue={tournament.groupPhaseBreakDuration ?? 2}
              min={0}
              max={30}
              style={styles.input}
            />
            <span style={styles.inputUnit}>Minuten</span>
          </div>
        </div>
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default SettingsCategory;
