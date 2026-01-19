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
import { generateFullSchedule } from '../../../../core/generators';
import { calculateStandings } from '../../../../utils/calculations';
import type { Match, Tournament } from '../../../../types/tournament';
import { exportStatisticsToPDF } from '../../../../lib/pdfStatisticsExporter';

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

  // Export Settings
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  // Initialize selected teams with all teams once tournament loads
  useMemo(() => {
    if (tournament.teams.length > 0 && selectedTeamIds.length === 0) {
      setSelectedTeamIds(tournament.teams.map(t => t.id));
    }
  }, [tournament.teams, selectedTeamIds.length]); // Only run when teams change

  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([
    'GOAL', 'YELLOW_CARD', 'RED_CARD', 'TIME_PENALTY', 'SUBSTITUTION'
  ]);

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
       
      if (file?.type === 'application/json') {
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
      {/* Game Events Export */}
      <CollapsibleSection icon="📋" title="Spielereignisse exportieren">
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Exportiert Ereignisse (Tore, Karten, Strafen) als CSV oder JSON-Datei.
        </p>

        {/* Format Selection */}
        <div style={styles.optionGroup}>
          <label style={styles.label}>Format</label>
          <div style={{ display: 'flex', gap: cssVars.spacing.md }}>
            <label style={styles.checkbox}>
              <input
                type="radio"
                name="exportFormat"
                checked={exportFormat === 'csv'}
                onChange={() => setExportFormat('csv')}
              />
              CSV (Excel)
            </label>
            <label style={styles.checkbox}>
              <input
                type="radio"
                name="exportFormat"
                checked={exportFormat === 'json'}
                onChange={() => setExportFormat('json')}
              />
              JSON (Daten)
            </label>
          </div>
        </div>

        {/* Event Types Selection */}
        <div style={styles.optionGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cssVars.spacing.xs }}>
            <label style={{ ...styles.label, marginBottom: 0 }}>Ereignisse</label>
            <div style={{ display: 'flex', gap: cssVars.spacing.sm }}>
              <button
                type="button"
                style={{ ...styles.badge, border: 'none', cursor: 'pointer', fontSize: cssVars.fontSizes.labelSm }}
                onClick={() => setSelectedEventTypes(['GOAL', 'YELLOW_CARD', 'RED_CARD', 'TIME_PENALTY', 'SUBSTITUTION'])}
              >
                Alle
              </button>
              <button
                type="button"
                style={{ ...styles.badge, background: cssVars.colors.background, border: `1px solid ${cssVars.colors.border}`, cursor: 'pointer', fontSize: cssVars.fontSizes.labelSm }}
                onClick={() => setSelectedEventTypes([])}
              >
                Keine
              </button>
            </div>
          </div>
          <div style={styles.checkboxGroup}>
            {[
              { id: 'GOAL', label: 'Tore' },
              { id: 'YELLOW_CARD', label: 'Gelbe Karten' },
              { id: 'RED_CARD', label: 'Rote Karten' },
              { id: 'TIME_PENALTY', label: 'Zeitstrafen' },
              { id: 'SUBSTITUTION', label: 'Wechsel' },
            ].map((type) => (
              <label key={type.id} style={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={selectedEventTypes.includes(type.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedEventTypes([...selectedEventTypes, type.id]);
                    } else {
                      setSelectedEventTypes(selectedEventTypes.filter((t) => t !== type.id));
                    }
                  }}
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        {/* Teams Selection (Multi-Select) */}
        <div style={styles.optionGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cssVars.spacing.xs }}>
            <label style={{ ...styles.label, marginBottom: 0 }}>Teams Filter</label>
            <div style={{ display: 'flex', gap: cssVars.spacing.sm }}>
              <button
                type="button"
                style={{ ...styles.badge, border: 'none', cursor: 'pointer', fontSize: cssVars.fontSizes.labelSm }}
                onClick={() => setSelectedTeamIds(tournament.teams.map(t => t.id))}
              >
                Alle
              </button>
              <button
                type="button"
                style={{ ...styles.badge, background: cssVars.colors.background, border: `1px solid ${cssVars.colors.border}`, cursor: 'pointer', fontSize: cssVars.fontSizes.labelSm }}
                onClick={() => setSelectedTeamIds([])}
              >
                Keine
              </button>
            </div>
          </div>

          <div style={{
            maxHeight: '150px',
            overflowY: 'auto',
            border: `1px solid ${cssVars.colors.border}`,
            borderRadius: cssVars.borderRadius.md,
            padding: cssVars.spacing.sm,
            background: cssVars.colors.inputBg
          }}>
            {tournament.teams.length === 0 && <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.bodySm }}>Keine Teams vorhanden</span>}
            {tournament.teams.map((team) => (
              <label key={team.id} style={{ ...styles.checkbox, marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={selectedTeamIds.includes(team.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTeamIds([...selectedTeamIds, team.id]);
                    } else {
                      setSelectedTeamIds(selectedTeamIds.filter((id) => id !== team.id));
                    }
                  }}
                />
                {team.name}
              </label>
            ))}
          </div>
          <div style={{ fontSize: cssVars.fontSizes.labelSm, color: cssVars.colors.textMuted, marginTop: 4 }}>
            {selectedTeamIds.length} von {tournament.teams.length} ausgewählt
          </div>
        </div>

        <button
          style={{
            ...styles.button,
            ...(isExporting ? styles.buttonDisabled : {})
          }}
          onClick={() => {
            try {
              setIsExporting(true);
              setExportError(null); // Clear previous errors

              const getTeamName = (id?: string) => tournament.teams.find(t => t.id === id)?.name ?? 'Unbekannt';

              // Filter Matches Logic: Include if AT LEAST ONE selected team is involved
              // If no teams are selected, effectively exporting nothing (unless we want 'All' logic when empty? Typically explicit selection implies restriction)
              // Correction: If selectedTeamIds is empty, we export nothing. User must select teams. (Or default to all initially)

              const matchesToExport = tournament.matches.filter(m => {
                if (selectedTeamIds.length === 0) {return false;}
                return selectedTeamIds.includes(m.teamA) || selectedTeamIds.includes(m.teamB);
              });

              if (matchesToExport.length === 0) {
                setExportError('Keine Spiele für die ausgewählten Teams gefunden.');
                setIsExporting(false);
                return;
              }

              // Collect Data - Improved JSON structure with metadata
              interface ExportEventItem {
                matchId: string;
                round: number;
                homeTeam: { id: string; name: string };
                guestTeam: { id: string; name: string };
                minute: number;
                type: string;
                team: { id?: string; name: string };
                playerNumber?: number;
                // Structured details instead of string
                scoreAfter?: { home: number; away: number };
                assists?: number[];
                penaltyDuration?: number;
                playersIn?: number[];
                playersOut?: number[];
              }
              const exportData: ExportEventItem[] = [];
              const csvRows: string[] = [];

              // Summary counters for JSON export
              const summary = {
                totalEvents: 0,
                goals: 0,
                yellowCards: 0,
                redCards: 0,
                timePenalties: 0,
                substitutions: 0,
              };

              matchesToExport.forEach(match => {
                const homeTeamName = getTeamName(match.teamA);
                const guestTeamName = getTeamName(match.teamB);

                // Filter Events Logic
                const relevantEvents = (match.events ?? []).filter(e => selectedEventTypes.includes(e.type));
                const sortedEvents = [...relevantEvents].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

                sortedEvents.forEach(event => {
                  let details = '';
                  let eventTypeLabel = event.type as string;
                  let player = event.payload.playerNumber ? `#${event.payload.playerNumber}` : '';
                  const teamName = getTeamName(event.payload.teamId);

                  // Update summary counters
                  summary.totalEvents++;
                  if (event.type === 'GOAL') {summary.goals++;}
                  else if (event.type === 'YELLOW_CARD') {summary.yellowCards++;}
                  else if (event.type === 'RED_CARD') {summary.redCards++;}
                  else if (event.type === 'TIME_PENALTY') {summary.timePenalties++;}
                  else if (event.type === 'SUBSTITUTION') {summary.substitutions++;}

                  // Formatting details for CSV
                  if (event.type === 'GOAL') {
                    eventTypeLabel = 'Tor';
                    details = `Stand: ${event.scoreAfter.home}:${event.scoreAfter.away}`;
                    if (event.payload.assists && event.payload.assists.length > 0) {
                      details += ` (Vorlage: ${event.payload.assists.map(a => '#' + a).join(', ')})`;
                    }
                  } else if (event.type === 'YELLOW_CARD') {
                    eventTypeLabel = 'Gelbe Karte';
                  } else if (event.type === 'RED_CARD') {
                    eventTypeLabel = 'Rote Karte';
                  } else if (event.type === 'TIME_PENALTY') {
                    eventTypeLabel = 'Zeitstrafe';
                    details = `${event.payload.penaltyDuration || 120}s`;
                  } else if (event.type === 'SUBSTITUTION') {
                    eventTypeLabel = 'Wechsel';
                    const inPlayers = event.payload.playersIn?.map(p => `#${p}`).join(', ') || '';
                    const outPlayers = event.payload.playersOut?.map(p => `#${p}`).join(', ') || '';
                    details = `Raus: ${outPlayers} -> Rein: ${inPlayers}`;
                    player = '';
                  }

                  // JSON Structure - clean, structured data (no rawEvent)
                  if (exportFormat === 'json') {
                    const eventItem: ExportEventItem = {
                      matchId: match.id,
                      round: match.round,
                      homeTeam: { id: match.teamA, name: homeTeamName },
                      guestTeam: { id: match.teamB, name: guestTeamName },
                      minute: Math.floor(event.timestampSeconds / 60) + 1,
                      type: event.type,
                      team: { id: event.payload.teamId, name: teamName },
                      playerNumber: event.payload.playerNumber,
                    };

                    // Add type-specific structured data
                    if (event.type === 'GOAL') {
                      eventItem.scoreAfter = { home: event.scoreAfter.home, away: event.scoreAfter.away };
                      if (event.payload.assists && event.payload.assists.length > 0) {
                        eventItem.assists = event.payload.assists;
                      }
                    } else if (event.type === 'TIME_PENALTY') {
                      eventItem.penaltyDuration = event.payload.penaltyDuration || 120;
                    } else if (event.type === 'SUBSTITUTION') {
                      eventItem.playersIn = event.payload.playersIn;
                      eventItem.playersOut = event.payload.playersOut;
                    }

                    exportData.push(eventItem);
                  } else {
                    // CSV Row
                    csvRows.push([
                      match.id,
                      match.round,
                      homeTeamName,
                      guestTeamName,
                      Math.floor(event.timestampSeconds / 60) + 1 + "'",
                      eventTypeLabel,
                      teamName,
                      player,
                      details
                    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(';'));
                  }
                });
              });

              // Generate File
              const timestamp = new Date().toISOString().split('T')[0];
              const safeTitle = tournament.title.replace(/[^a-zA-Z0-9]/g, '_');

              if (exportFormat === 'json') {
                // Create wrapper with metadata, filters, and summary
                const exportWrapper = {
                  version: '1.0',
                  exportedAt: new Date().toISOString(),
                  tournament: {
                    id: tournament.id,
                    name: tournament.title,
                  },
                  filters: {
                    teams: selectedTeamIds.map(id => ({
                      id,
                      name: getTeamName(id),
                    })),
                    eventTypes: selectedEventTypes,
                  },
                  summary,
                  events: exportData,
                };

                const blob = new Blob([JSON.stringify(exportWrapper, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${safeTitle}_events_${timestamp}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              } else {
                const headers = ['Match ID', 'Runde', 'Heimmannschaft', 'Gastmannschaft', 'Spielminute', 'Ereignis', 'Team', 'Spieler', 'Details'];
                const csvContent = [headers.join(';'), ...csvRows].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${safeTitle}_events_${timestamp}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }

              setIsExporting(false);
              setExportSuccess('Spielereignisse erfolgreich exportiert!');
              setTimeout(() => setExportSuccess(null), 3000);

            } catch (e) {
              console.error(e);
              setExportError('Fehler beim Exportieren der Ereignisse.');
              setIsExporting(false);
            }
          }}
          disabled={isExporting}
        >
          {isExporting ? 'Wird exportiert...' : `📥 Als ${exportFormat.toUpperCase()} herunterladen`}
        </button>
      </CollapsibleSection>

      {/* Audit Log Export */}
      <CollapsibleSection icon="📋" title="Turnier-Audit-Log exportieren">
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Exportiert das gesamte Änderungsprotokoll (Ergebnisse, Korrekturen, Statusänderungen) als CSV-Datei.
        </p>
        <button
          style={{
            ...styles.button,
            ...(isExporting ? styles.buttonDisabled : {})
          }}
          onClick={() => {
            try {
              setIsExporting(true);

              // Define interface for local aggregation
              interface AuditEntry {
                timestamp: string;
                type: string;
                matchLabel: string;
                description: string;
                details: string;
                oldValue: string;
                newValue: string;
              }

              const entries: AuditEntry[] = [];
              const getTeamName = (id?: string) => tournament.teams.find(t => t.id === id)?.name || 'Unbekannt';
              const getMatchLabel = (m: Match) => `${getTeamName(m.teamA)} vs ${getTeamName(m.teamB)}`;

              // 1. Tournament Creation
              if (tournament.createdAt) {
                entries.push({
                  timestamp: tournament.createdAt,
                  type: 'tournament_created',
                  matchLabel: '-',
                  description: 'Turnier erstellt',
                  details: tournament.title,
                  oldValue: '-',
                  newValue: '-'
                });
              }

              // 2. Match Events (Finished, Corrections, Result Entered)
              tournament.matches.forEach(match => {
                const label = getMatchLabel(match);

                if (match.finishedAt) {
                  entries.push({
                    timestamp: match.finishedAt,
                    type: 'match_finished',
                    matchLabel: label,
                    description: 'Spiel beendet',
                    details: '',
                    oldValue: '-',
                    newValue: `${match.scoreA}:${match.scoreB}`
                  });
                }

                interface CorrectionHistoryItem {
                  timestamp: string;
                  reason?: string;
                  note?: string;
                  previousScoreA: number;
                  previousScoreB: number;
                  newScoreA: number;
                  newScoreB: number;
                }

                if (match.correctionHistory && match.correctionHistory.length > 0) {
                  match.correctionHistory.forEach((item: unknown) => {
                    const c = item as CorrectionHistoryItem;
                    entries.push({
                      timestamp: c.timestamp,
                      type: 'result_changed',
                      matchLabel: label,
                      description: 'Ergebnis korrigiert',
                      details: c.reason || c.note || '',
                      oldValue: `${c.previousScoreA}:${c.previousScoreB}`,
                      newValue: `${c.newScoreA}:${c.newScoreB}`
                    });
                  });
                } else if (match.matchStatus === 'finished' && match.scoreA !== undefined) {
                  // Initial result (inferred)
                  entries.push({
                    timestamp: match.finishedAt || new Date().toISOString(),
                    type: 'result_entered',
                    matchLabel: label,
                    description: 'Ergebnis eingetragen',
                    details: '',
                    oldValue: '-',
                    newValue: `${match.scoreA}:${match.scoreB}`
                  });
                }
              });

              // Sort by timestamp
              entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

              // Generate CSV
              const headers = ['Zeitstempel', 'Typ', 'Match', 'Beschreibung', 'Details', 'Alt', 'Neu'];
              const csvRows: string[] = entries.map(e => [
                e.timestamp,
                e.type,
                e.matchLabel,
                e.description,
                e.details,
                e.oldValue,
                e.newValue
              ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(';'));

              const csvContent = [headers.join(';'), ...csvRows].join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${tournament.title.replace(/[^a-zA-Z0-9]/g, '_')}_audit_log_${new Date().toISOString().split('T')[0]}.csv`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);

              setIsExporting(false);
              setExportSuccess('Audit Log erfolgreich exportiert!');
              setTimeout(() => setExportSuccess(null), 3000);

            } catch (e) {
              console.error(e);
              setExportError('Fehler beim Exportieren des Audit Logs.');
              setIsExporting(false);
            }
          }}
          disabled={isExporting}
        >
          {isExporting ? 'Wird exportiert...' : '📥 Als CSV herunterladen'}
        </button>
      </CollapsibleSection>

      {/* Statistics Export */}
      <CollapsibleSection icon="📊" title="Statistiken exportieren">
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.md }}>
          Exportiert Statistiken wie Torschützenliste und Fair-Play-Tabelle als PDF.
        </p>
        <button
          style={{
            ...styles.button,
            ...(isExporting ? styles.buttonDisabled : {})
          }}
          onClick={() => {
            const runExport = async () => {
              try {
                setIsExporting(true);
                await exportStatisticsToPDF(tournament);
                setIsExporting(false);
                setExportSuccess('Statistik-Report erfolgreich erstellt!');
                setTimeout(() => setExportSuccess(null), 3000);
              } catch (e) {
                console.error(e);
                setExportError('Fehler beim Erstellen des Reports.');
                setIsExporting(false);
              }
            };
            void runExport();
          }}
          disabled={isExporting}
        >
          {isExporting ? 'Wird erstellt...' : '📊 Als PDF exportieren'}
        </button>
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
