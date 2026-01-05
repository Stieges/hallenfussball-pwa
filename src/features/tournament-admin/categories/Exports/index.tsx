/**
 * ExportsCategory - Export and Backup Functions
 *
 * Central hub for all export and backup/restore functionality.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.3
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import type { Tournament } from '../../../../types/tournament';

// =============================================================================
// PROPS
// =============================================================================

interface ExportsCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  optionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  label: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.xs,
  } as CSSProperties,

  select: {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: cssVars.colors.inputBg,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodyMd,
    width: '100%',
  } as CSSProperties,

  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  } as CSSProperties,

  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textPrimary,
    cursor: 'pointer',
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
    transition: 'all 0.15s ease',
    marginTop: cssVars.spacing.md,
  } as CSSProperties,

  dropZone: {
    padding: cssVars.spacing.xl,
    border: `2px dashed ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    textAlign: 'center',
    color: cssVars.colors.textMuted,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  warning: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.warningSubtle,
    border: `1px solid ${cssVars.colors.warningBorder}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.warning,
    marginTop: cssVars.spacing.md,
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function ExportsCategory({
  tournament,
}: ExportsCategoryProps) {
  return (
    <CategoryPage
      icon="📤"
      title="Exporte"
      description="Daten exportieren und Backups verwalten"
    >
      {/* Game Events Export */}
      <CollapsibleSection icon="📋" title="Spielereignisse exportieren" defaultOpen>
        <div style={styles.optionGroup}>
          <label style={styles.label}>Spiel auswählen</label>
          <select style={styles.select}>
            <option value="all">Alle Spiele</option>
            {tournament.matches.slice(0, 10).map((match, i) => (
              <option key={match.id} value={match.id}>
                Spiel {i + 1}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.optionGroup}>
          <label style={styles.label}>Format</label>
          <select style={styles.select}>
            <option value="pdf">PDF (Druckoptimiert)</option>
            <option value="csv">CSV (Excel-kompatibel)</option>
            <option value="json">JSON (Technisch)</option>
          </select>
        </div>

        <div style={styles.optionGroup}>
          <label style={styles.label}>Inhalt</label>
          <div style={styles.checkboxGroup}>
            <label style={styles.checkbox}>
              <input type="checkbox" defaultChecked />
              <span>Tore (mit Torschütze, Minute)</span>
            </label>
            <label style={styles.checkbox}>
              <input type="checkbox" defaultChecked />
              <span>Karten (Gelb, Rot, Zeitstrafe)</span>
            </label>
            <label style={styles.checkbox}>
              <input type="checkbox" />
              <span>Wechsel</span>
            </label>
            <label style={styles.checkbox}>
              <input type="checkbox" defaultChecked />
              <span>Zeitstempel (sekundengenau)</span>
            </label>
          </div>
        </div>

        <button style={styles.button}>Exportieren</button>
      </CollapsibleSection>

      {/* Audit Log Export */}
      <CollapsibleSection icon="📋" title="Turnier-Audit-Log exportieren">
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Exportiert alle Änderungen aus dem Activity Log.
        </p>
        <button style={styles.button}>CSV exportieren</button>
      </CollapsibleSection>

      {/* Statistics Export */}
      <CollapsibleSection icon="📊" title="Statistiken exportieren">
        <div style={styles.checkboxGroup}>
          <label style={styles.checkbox}>
            <input type="checkbox" defaultChecked />
            <span>Torschützenliste</span>
          </label>
          <label style={styles.checkbox}>
            <input type="checkbox" defaultChecked />
            <span>Tabellen (alle Gruppen)</span>
          </label>
          <label style={styles.checkbox}>
            <input type="checkbox" />
            <span>Fair-Play-Wertung</span>
          </label>
          <label style={styles.checkbox}>
            <input type="checkbox" />
            <span>Schiedsrichter-Einsätze</span>
          </label>
        </div>
        <button style={styles.button}>PDF erstellen</button>
      </CollapsibleSection>

      {/* Tournament Summary */}
      <CollapsibleSection icon="📄" title="Turnier-Zusammenfassung">
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Generiert einen vollständigen Turnierbericht mit allen Ergebnissen, Tabellen und Statistiken.
        </p>
        <button style={styles.button}>PDF erstellen</button>
      </CollapsibleSection>

      {/* Backup & Restore */}
      <CollapsibleSection icon="💾" title="Backup & Restore" defaultOpen>
        <h4 style={{ ...styles.label, marginTop: 0 }}>Backup erstellen</h4>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Erstellt ein vollständiges Backup als JSON-Datei.
          Enthält: Turnier, Teams, Spielplan, Ergebnisse, Sponsoren.
        </p>
        <button style={styles.button}>📥 Backup herunterladen</button>

        <div style={{ marginTop: cssVars.spacing.xl }}>
          <h4 style={styles.label}>Backup wiederherstellen</h4>
          <div style={styles.dropZone}>
            <p>📁 JSON-Datei auswählen</p>
            <p style={{ fontSize: cssVars.fontSizes.labelSm }}>oder per Drag & Drop</p>
          </div>
          <div style={styles.warning}>
            <span>⚠️</span>
            <span>Überschreibt alle aktuellen Daten dieses Turniers! Ein neues Backup wird automatisch erstellt.</span>
          </div>
        </div>
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default ExportsCategory;
