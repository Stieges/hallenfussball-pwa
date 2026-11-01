/**
 * RefereeAssignmentEditor - UI für manuelle SR-Zuweisung mit Drag & Drop
 *
 * Features:
 * - Dropdown/Select für jedes Match zur SR-Änderung
 * - Drag & Drop Interface für komfortable Bedienung
 * - Anzeige der aktuellen Verteilung & Workload
 * - Reset auf automatische Zuweisung, nach Rückfrage, nur für offene Spiele (@W3-034)
 * - Angepfiffene Spiele (läuft, Halbzeit, beendet) sind gesperrt (@ZP-093); Auswahl aus `refereeChoices` (@W3-011)
 */

import { CSSProperties, useState } from 'react';
import { ScheduledMatch } from '../core/generators';
import { RefereeConfig, Team } from '../types/tournament';
import { cssVars } from '../design-tokens'
import { useTranslation } from 'react-i18next';
import { Select, Button } from './ui';
import { ConfirmDialog, useConfirmDialog } from './ui/ConfirmDialog';
import { useRefereeChoices } from './schedule/refereeChoices';

/**
 * Check if a referee is already assigned to an overlapping match
 * Returns the conflicting match if there's a conflict, otherwise null
 */
function findOverlappingConflict(
  matches: ScheduledMatch[],
  targetMatchId: string,
  refereeNumber: number
): ScheduledMatch | null {
  const targetMatch = matches.find(m => m.id === targetMatchId);
  if (!targetMatch) {return null;}

  // Find all matches where this referee is assigned
  const refereeMatches = matches.filter(m => m.referee === refereeNumber && m.id !== targetMatchId);

  // Check for time overlaps
  for (const match of refereeMatches) {
    // Check if times overlap
    const targetStart = targetMatch.startTime.getTime();
    const targetEnd = targetMatch.endTime.getTime();
    const matchStart = match.startTime.getTime();
    const matchEnd = match.endTime.getTime();

    // Overlap occurs if: (start1 < end2) AND (start2 < end1)
    if (targetStart < matchEnd && matchStart < targetEnd) {
      return match;
    }
  }

  return null;
}

interface RefereeAssignmentEditorProps {
  matches: ScheduledMatch[];
  refereeConfig: RefereeConfig;
  onAssignmentChange: (matchId: string, refereeNumber: number | null) => void;
  /** wird erst nach der Rückfrage aufgerufen */
  onResetAssignments: () => void;
  /** Teams des Turniers (Modus „Teams pfeifen“: Auswahl mit Teamnamen) */
  teams?: readonly Team[];
  /** Angepfiffene Spiele: Auswahl gesperrt (@ZP-093) */
  lockedMatchIds?: ReadonlySet<string>;
}

export const RefereeAssignmentEditor: React.FC<RefereeAssignmentEditorProps> = ({
  matches,
  refereeConfig,
  onAssignmentChange,
  onResetAssignments,
  teams,
  lockedMatchIds,
}) => {
  const { t } = useTranslation('wizard');
  const choices = useRefereeChoices(refereeConfig, teams);
  const resetDialog = useConfirmDialog({ title: t('refereeEditor.resetTitle'), message: t('refereeEditor.resetMessage'), variant: 'warning', confirmText: t('refereeEditor.resetConfirm') });
  // @OB-017: Zeitkonflikt-Rückfrage im Dialog der App, nie als Fenster des Browsers
  const conflictDialog = useConfirmDialog({
    title: t('refereeConflict.title'),
    message: '',
    variant: 'warning',
    confirmText: t('refereeConflict.confirm'),
  });
  const [draggedReferee, setDraggedReferee] = useState<number | null>(null);
  const [dragOverMatch, setDragOverMatch] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true); // Collapsed by default

   
  if (!refereeConfig || refereeConfig.mode === 'none') {
    return null;
  }

  const numberOfReferees = refereeConfig.numberOfReferees ?? 2;
  const nameOf = (n: number): string => choices.find((c) => c.value === n)?.label ?? String(n);

  // Calculate referee workload
  const refereeWorkload: Record<number, number> = {};
  matches.forEach(match => {
    if (match.referee) {
      refereeWorkload[match.referee] = (refereeWorkload[match.referee] ?? 0) + 1;
    }
  });

  // Eine Quelle der Auswahl (refereeChoices), hier mit der Zahl der Spiele je Schiedsrichter
  const refereeOptions = [
    { value: '', label: t('refereeEditor.noReferee') },
    ...choices.map((c) => ({ value: String(c.value), label: t('refereeEditor.optionCount', { label: c.label, count: refereeWorkload[c.value] ?? 0 }) })),
  ];

  // Fragt nach, wenn sich die Einteilung zeitlich mit einem anderen Spiel überschneidet; true = zuweisen
  const confirmConflict = async (matchId: string, refereeNumber: number): Promise<boolean> => {
    const conflict = findOverlappingConflict(matches, matchId, refereeNumber);
    if (!conflict) { return true; }
    const refName = nameOf(refereeNumber);
    return conflictDialog.confirm({
      message: t('refereeConflict.message', { refName, matchNumber: conflict.matchNumber, time: conflict.time }),
    });
  };

  // Drag & Drop Handlers
  const handleDragStart = (refereeNumber: number) => {
    setDraggedReferee(refereeNumber);
  };

  const handleDragEnd = () => {
    setDraggedReferee(null);
    setDragOverMatch(null);
  };

  const handleDragOver = (e: React.DragEvent, matchId: string) => {
    e.preventDefault();
    setDragOverMatch(matchId);
  };

  const handleDragLeave = () => {
    setDragOverMatch(null);
  };

  const handleDrop = async (e: React.DragEvent, matchId: string) => {
    e.preventDefault();
    const refereeNumber = draggedReferee;
    if (refereeNumber !== null && !lockedMatchIds?.has(matchId) && await confirmConflict(matchId, refereeNumber)) {
      onAssignmentChange(matchId, refereeNumber);
    }
    setDraggedReferee(null);
    setDragOverMatch(null);
  };

  const hasManualAssignments = refereeConfig.manualAssignments &&
    Object.keys(refereeConfig.manualAssignments).length > 0;

  // Styles
  const containerStyle: CSSProperties = {
    marginTop: '24px',
    padding: '20px',
    background: cssVars.colors.accentSubtle,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.accentLight}`,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isCollapsed ? '0' : '20px',
    cursor: 'pointer',
    userSelect: 'none',
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.accent,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const toggleIconStyle: CSSProperties = {
    transition: 'transform 0.2s ease',
    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
  };

  const refereeGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '12px',
    marginBottom: '24px',
  };

  const refereeCardStyle = (): CSSProperties => ({
    padding: '12px',
    background: cssVars.colors.background,
    border: `2px solid ${cssVars.colors.accent}`,
    borderRadius: cssVars.borderRadius.md,
    textAlign: 'center',
    cursor: 'grab',
    transition: 'all 0.2s ease',
    userSelect: 'none',
  });

  const refereeCardDraggingStyle: CSSProperties = {
    opacity: 0.5,
    cursor: 'grabbing',
  };

  const matchesListStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '500px',
    overflowY: 'auto',
    padding: '4px',
  };

  const matchRowStyle = (matchId: string): CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: '60px 1fr 200px',
    gap: '12px',
    alignItems: 'center',
    padding: '12px',
    background: dragOverMatch === matchId
      ? cssVars.colors.accentLight
      : cssVars.colors.background,
    border: `1px solid ${dragOverMatch === matchId
      ? cssVars.colors.accent
      : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.sm,
    transition: 'all 0.2s ease',
  });

  const matchNumberStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.primary,
  };

  const matchInfoStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
  };

  return (
    <div style={containerStyle} className="referee-assignment-editor">
      <div style={headerStyle} onClick={() => setIsCollapsed(!isCollapsed)}>
        <div>
          <h3 style={titleStyle}>
            <span style={toggleIconStyle}>▼</span>
            🟨 {t('refereeEditor.title')}
          </h3>
          {isCollapsed && (
            <p style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, margin: '4px 0 0 24px' }}>
              {t('refereeEditor.expandHint')}
            </p>
          )}
        </div>
        {!isCollapsed && hasManualAssignments && (
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              variant="secondary"
              onClick={() => { void resetDialog.confirm().then((ok) => { if (ok) { onResetAssignments(); } }); }}
              style={{ fontSize: cssVars.fontSizes.sm, padding: '8px 16px' }}
              data-testid="referee-reset"
            >
              {t('refereeEditor.reset')}
            </Button>
          </div>
        )}
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <>
      {/* Referee Drag Source */}
      {refereeConfig.mode === 'organizer' && (
        <>
          <p style={{ fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary, marginBottom: '12px' }}>
            {t('refereeEditor.available')}
          </p>
          <div style={refereeGridStyle}>
            {Array.from({ length: numberOfReferees }, (_, i) => i + 1).map(refNum => (
              <div
                key={refNum}
                draggable
                onDragStart={() => handleDragStart(refNum)}
                onDragEnd={handleDragEnd}
                style={{
                  ...refereeCardStyle(),
                  ...(draggedReferee === refNum ? refereeCardDraggingStyle : {}),
                }}
              >
                <div style={{ fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.bold, marginBottom: '4px' }}>
                  {nameOf(refNum)}
                </div>
                <div style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary }}>
                  {t('refereeEditor.workload', { count: refereeWorkload[refNum] ?? 0 })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Matches List with Dropzones */}
      <p style={{ fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary, marginTop: '24px', marginBottom: '12px' }}>
        {t('refereeEditor.matches')}
      </p>
      <div style={matchesListStyle}>
        {matches.map(match => (
          <div
            key={match.id}
            style={matchRowStyle(match.id)}
            onDragOver={(e) => handleDragOver(e, match.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => { void handleDrop(e, match.id); }}
          >
            <div style={matchNumberStyle}>
              #{match.matchNumber}
            </div>
            <div style={matchInfoStyle}>
              <div style={{ fontWeight: cssVars.fontWeights.semibold }}>
                {match.homeTeam} - {match.awayTeam}
              </div>
              <div style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary }}>
                {t('refereeEditor.matchMeta', { time: match.time, field: match.field })}
              </div>
            </div>
            <Select
              label=""
              disabled={lockedMatchIds?.has(match.id)}
              data-testid={`referee-select-${match.id}`}
              value={match.referee?.toString() ?? ''}
              onChange={(value) => {
                const refNum = value ? parseInt(value) : null;
                void (async () => {
                  if (refNum !== null && !(await confirmConflict(match.id, refNum))) { return; }
                  onAssignmentChange(match.id, refNum);
                })();
              }}
              options={refereeOptions}
            />
          </div>
        ))}
      </div>
        </>
      )}

      <style>{`
        .referee-assignment-editor {
          /* Custom scrollbar */
        }
        .referee-assignment-editor::-webkit-scrollbar {
          width: 8px;
        }
        .referee-assignment-editor::-webkit-scrollbar-track {
          background: ${cssVars.colors.border};
          border-radius: 4px;
        }
        .referee-assignment-editor::-webkit-scrollbar-thumb {
          background: ${cssVars.colors.primary};
          border-radius: 4px;
        }
        .referee-assignment-editor::-webkit-scrollbar-thumb:hover {
          background: ${cssVars.colors.secondary};
        }
      `}</style>
      <ConfirmDialog {...conflictDialog.dialogProps} />
      <ConfirmDialog {...resetDialog.dialogProps} />
    </div>
  );
};
