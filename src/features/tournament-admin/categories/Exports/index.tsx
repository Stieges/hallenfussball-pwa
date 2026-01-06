/**
 * ExportsCategory - Export and Backup Functions
 *
 * Central hub for all export and backup/restore functionality.
 * Implements PDF export using existing pdfExporter, JSON backup/restore.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.3
 */

import { CSSProperties, useState, useCallback, useMemo, useRef } from 'react';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import { PDFExportDialog } from '../../../../components/dialogs/PDFExportDialog';
import { generateFullSchedule } from '../../../../lib/scheduleGenerator';
import { calculateStandings } from '../../../../utils/calculations';
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

  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
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

  dropZoneActive: {
    borderColor: cssVars.colors.primary,
    background: cssVars.colors.primarySubtle,
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

  hiddenInput: {
    display: 'none',
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function ExportsCategory({
  tournament,
  onTournamentUpdate,
}: ExportsCategoryProps) {
  // State
  const [showPDFDialog, setShowPDFDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate schedule and standings for PDF export
  const schedule = useMemo(() => {
    return generateFullSchedule(tournament);
  }, [tournament]);

  const standings = useMemo(() => {
    return calculateStandings(tournament.teams, tournament.matches, tournament);
  }, [tournament]);

  // Backup download handler
  const handleBackupDownload = useCallback(() => {
    try {
      setIsExporting(true);
      setExportError(null);

      // Create backup data
      const backupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        tournament: tournament,
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tournament.title.replace(/[^a-zA-Z0-9]/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess('Backup erfolgreich heruntergeladen!');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (error) {
      console.error('Backup download failed:', error);
      setExportError('Fehler beim Erstellen des Backups');
    } finally {
      setIsExporting(false);
    }
  }, [tournament]);

  // Restore handler
  const handleRestore = useCallback(
    async (file: File) => {
      try {
        setIsExporting(true);
        setExportError(null);

        const text = await file.text();
        const data = JSON.parse(text) as { version?: string; tournament?: Tournament };

        // Validate backup data
        if (!data.tournament?.id) {
          throw new Error('Ungültiges Backup-Format');
        }

        // Create automatic backup before restore
        const preRestoreBackup = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          tournament: tournament,
          note: 'Auto-Backup vor Wiederherstellung',
        };
        const preRestoreBlob = new Blob([JSON.stringify(preRestoreBackup, null, 2)], {
          type: 'application/json',
        });
        const preRestoreUrl = URL.createObjectURL(preRestoreBlob);
        const preRestoreLink = document.createElement('a');
        preRestoreLink.href = preRestoreUrl;
        preRestoreLink.download = `${tournament.title.replace(/[^a-zA-Z0-9]/g, '_')}_pre_restore_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(preRestoreLink);
        preRestoreLink.click();
        document.body.removeChild(preRestoreLink);
        URL.revokeObjectURL(preRestoreUrl);

        // Apply restored data (keep the current tournament ID)
        const restoredTournament: Tournament = {
          ...data.tournament,
          id: tournament.id, // Keep current ID to not create a new tournament
          updatedAt: new Date().toISOString(),
        };

        onTournamentUpdate(restoredTournament);
        setExportSuccess('Turnier erfolgreich wiederhergestellt!');
        setTimeout(() => setExportSuccess(null), 3000);
      } catch (error) {
        console.error('Restore failed:', error);
        setExportError(
          error instanceof Error
            ? `Fehler: ${error.message}`
            : 'Fehler beim Wiederherstellen des Backups'
        );
      } finally {
        setIsExporting(false);
      }
    },
    [tournament, onTournamentUpdate]
  );

  // File input change handler
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleRestore(file);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleRestore]
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      const file = event.dataTransfer.files[0];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check: files[0] can be undefined
      if (file && file.type === 'application/json') {
        void handleRestore(file);
      } else {
        setExportError('Bitte eine JSON-Datei auswählen');
      }
    },
    [handleRestore]
  );

  // Click on drop zone
  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <CategoryPage
      icon="📤"
      title="Exporte"
      description="Daten exportieren und Backups verwalten"
    >
      {/* Game Events Export - Coming Soon */}
      <CollapsibleSection icon="📋" title="Spielereignisse exportieren">
        <div style={styles.comingSoon}>
          <p>Export von detaillierten Spielereignissen (Tore, Karten, Wechsel).</p>
          <span style={styles.badge}>Coming Soon</span>
        </div>
      </CollapsibleSection>

      {/* Audit Log Export - Coming Soon */}
      <CollapsibleSection icon="📋" title="Turnier-Audit-Log exportieren">
        <div style={styles.comingSoon}>
          <p>Exportiert alle Änderungen aus dem Activity Log.</p>
          <span style={styles.badge}>Benötigt Activity Log</span>
        </div>
      </CollapsibleSection>

      {/* Statistics Export - Coming Soon */}
      <CollapsibleSection icon="📊" title="Statistiken exportieren">
        <div style={styles.comingSoon}>
          <p>Export von Torschützenliste, Fair-Play-Wertung und mehr.</p>
          <span style={styles.badge}>Coming Soon</span>
        </div>
      </CollapsibleSection>

      {/* Tournament Summary - Uses existing PDF Export */}
      <CollapsibleSection icon="📄" title="Turnier-Zusammenfassung" defaultOpen>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Generiert einen vollständigen Turnierbericht mit allen Ergebnissen, Tabellen und
          Statistiken als PDF.
        </p>
        <button style={styles.button} onClick={() => setShowPDFDialog(true)}>
          PDF erstellen
        </button>
      </CollapsibleSection>

      {/* Backup & Restore */}
      <CollapsibleSection icon="💾" title="Backup & Restore" defaultOpen>
        <h4 style={{ ...styles.label, marginTop: 0 }}>Backup erstellen</h4>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Erstellt ein vollständiges Backup als JSON-Datei. Enthält: Turnier, Teams, Spielplan,
          Ergebnisse, Sponsoren.
        </p>
        <button
          style={{
            ...styles.button,
            ...(isExporting ? styles.buttonDisabled : {}),
          }}
          onClick={handleBackupDownload}
          disabled={isExporting}
        >
          {isExporting ? 'Wird exportiert...' : '📥 Backup herunterladen'}
        </button>

        {exportSuccess && (
          <div style={styles.success}>
            <span>✅</span>
            <span>{exportSuccess}</span>
          </div>
        )}

        {exportError && (
          <div style={styles.warning}>
            <span>❌</span>
            <span>{exportError}</span>
          </div>
        )}

        <div style={{ marginTop: cssVars.spacing.xl }}>
          <h4 style={styles.label}>Backup wiederherstellen</h4>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            style={styles.hiddenInput}
          />
          <div
            style={{
              ...styles.dropZone,
              ...(isDragOver ? styles.dropZoneActive : {}),
            }}
            onClick={handleDropZoneClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleDropZoneClick();
              }
            }}
          >
            <p>📁 JSON-Datei auswählen</p>
            <p style={{ fontSize: cssVars.fontSizes.labelSm }}>oder per Drag & Drop</p>
          </div>
          <div style={styles.warning}>
            <span>⚠️</span>
            <span>
              Überschreibt alle aktuellen Daten dieses Turniers! Ein neues Backup wird automatisch
              erstellt.
            </span>
          </div>
        </div>
      </CollapsibleSection>

      {/* PDF Export Dialog */}
      <PDFExportDialog
        isOpen={showPDFDialog}
        onClose={() => setShowPDFDialog(false)}
        tournament={tournament}
        schedule={schedule}
        standings={standings}
      />
    </CategoryPage>
  );
}

export default ExportsCategory;
