/**
 * RefereeAssignmentEditor - UI für manuelle SR-Zuweisung mit Drag & Drop
 *
 * Features:
 * - Dropdown/Select für jedes Match zur SR-Änderung
 * - Drag & Drop Interface für komfortable Bedienung
 * - Anzeige der aktuellen Verteilung & Workload
 * - Reset auf automatische Zuweisung
 */

import { CSSProperties, useState } from 'react';
import { ScheduledMatch } from '../lib/scheduleGenerator';
import { RefereeConfig } from '../types/tournament';
import { borderRadius, colors, fontWeights } from '../design-tokens';
import { Select, Button } from './ui';

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
  onResetAssignments: () => void;
}

export const RefereeAssignmentEditor: React.FC<RefereeAssignmentEditorProps> = ({
  matches,
  refereeConfig,
  onAssignmentChange,
  onResetAssignments,
}) => {
  const [draggedReferee, setDraggedReferee] = useState<number | null>(null);
  const [dragOverMatch, setDragOverMatch] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true); // Collapsed by default

  if (!refereeConfig || refereeConfig.mode === 'none') {
    return null;
  }

  const numberOfReferees = refereeConfig.mode === 'organizer'
    ? (refereeConfig.numberOfReferees ?? 2)
    : matches.length; // Teams mode: each team can be referee

  // Calculate referee workload
  const refereeWorkload: Record<number, number> = {};
  for (let i = 1; i <= numberOfReferees; i++) {
    refereeWorkload[i] = 0;
  }
  matches.forEach(match => {
    if (match.referee) {
      refereeWorkload[match.referee] = (refereeWorkload[match.referee] || 0) + 1;
    }
  });

  // Generate referee options
  const getRefereeOptions = () => {
    const options: { value: string; label: string }[] = [
      { value: '', label: '- Kein SR -' }
    ];

    if (refereeConfig.mode === 'organizer') {
      for (let i = 1; i <= numberOfReferees; i++) {
        const name = refereeConfig.refereeNames?.[i] || `SR ${i}`;
        const count = refereeWorkload[i] ?? 0;
        options.push({
          value: i.toString(),
          label: `${name} (${count} Spiele)`
        });
      }
    } else if (refereeConfig.mode === 'teams') {
      // Teams mode: show team numbers
      for (let i = 1; i <= numberOfReferees; i++) {
        const count = refereeWorkload[i] ?? 0;
        options.push({
          value: i.toString(),
          label: `Team ${i} (${count} Spiele)`
        });
      }
    }

    return options;
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

  const handleDrop = (e: React.DragEvent, matchId: string) => {
    e.preventDefault();
    if (draggedReferee !== null) {
      // Check for conflicts
      const conflict = findOverlappingConflict(matches, matchId, draggedReferee);
      if (conflict) {
        const refName = refereeConfig.mode === 'organizer'
          ? (refereeConfig.refereeNames?.[draggedReferee] || `SR ${draggedReferee}`)
          : `Team ${draggedReferee}`;

        const confirmed = window.confirm(
          `⚠️ Zeitkonflikt erkannt!\n\n` +
          `${refName} ist bereits für Spiel #${conflict.matchNumber} (${conflict.time}) eingeteilt.\n\n` +
          `Die Spiele überschneiden sich zeitlich.\n\n` +
          `Möchtest du die Zuweisung trotzdem vornehmen?`
        );

        if (!confirmed) {
          setDraggedReferee(null);
          setDragOverMatch(null);
          return; // User canceled
        }
      }

      onAssignmentChange(matchId, draggedReferee);
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
    background: 'rgba(255,215,0,0.05)',
    borderRadius: borderRadius.md,
    border: '1px solid rgba(255,215,0,0.2)',
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
    fontSize: '16px',
    fontWeight: fontWeights.semibold,
    color: colors.accent,
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
    background: colors.background,
    border: `2px solid ${colors.accent}`,
    borderRadius: borderRadius.md,
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
      ? 'rgba(255,215,0,0.2)'
      : colors.background,
    border: `1px solid ${dragOverMatch === matchId
      ? colors.accent
      : colors.border}`,
    borderRadius: borderRadius.sm,
    transition: 'all 0.2s ease',
  });

  const matchNumberStyle: CSSProperties = {
    fontSize: '14px',
    fontWeight: fontWeights.bold,
    color: colors.primary,
  };

  const matchInfoStyle: CSSProperties = {
    fontSize: '13px',
    color: colors.textPrimary,
  };

  return (
    <div style={containerStyle} className="referee-assignment-editor">
      <div style={headerStyle} onClick={() => setIsCollapsed(!isCollapsed)}>
        <div>
          <h3 style={titleStyle}>
            <span style={toggleIconStyle}>▼</span>
            🟨 Manuelle Schiedsrichter-Zuweisung
          </h3>
          {isCollapsed && (
            <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '4px 0 0 24px' }}>
              Klicken zum Aufklappen
            </p>
          )}
        </div>
        {!isCollapsed && hasManualAssignments && (
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              variant="secondary"
              onClick={onResetAssignments}
              style={{ fontSize: '12px', padding: '8px 16px' }}
            >
              Automatische Zuweisung wiederherstellen
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
          <p style={{ fontSize: '13px', fontWeight: fontWeights.semibold, color: colors.textPrimary, marginBottom: '12px' }}>
            Verfügbare Schiedsrichter:
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
                <div style={{ fontSize: '14px', fontWeight: fontWeights.bold, marginBottom: '4px' }}>
                  {refereeConfig.refereeNames?.[refNum] || `SR ${refNum}`}
                </div>
                <div style={{ fontSize: '11px', color: colors.textSecondary }}>
                  {refereeWorkload[refNum] ?? 0} Spiele
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Matches List with Dropzones */}
      <p style={{ fontSize: '13px', fontWeight: fontWeights.semibold, color: colors.textPrimary, marginTop: '24px', marginBottom: '12px' }}>
        Spiele:
      </p>
      <div style={matchesListStyle}>
        {matches.map(match => (
          <div
            key={match.id}
            style={matchRowStyle(match.id)}
            onDragOver={(e) => handleDragOver(e, match.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, match.id)}
          >
            <div style={matchNumberStyle}>
              #{match.matchNumber}
            </div>
            <div style={matchInfoStyle}>
              <div style={{ fontWeight: fontWeights.semibold }}>
                {match.homeTeam} - {match.awayTeam}
              </div>
              <div style={{ fontSize: '11px', color: colors.textSecondary }}>
                {match.time} • Feld {match.field}
              </div>
            </div>
            <Select
              label=""
              value={match.referee?.toString() ?? ''}
              onChange={(value) => {
                const refNum = value ? parseInt(value) : null;

                // Check for conflicts if assigning a referee
                if (refNum !== null) {
                  const conflict = findOverlappingConflict(matches, match.id, refNum);
                  if (conflict) {
                    const refName = refereeConfig.mode === 'organizer'
                      ? (refereeConfig.refereeNames?.[refNum] || `SR ${refNum}`)
                      : `Team ${refNum}`;

                    const confirmed = window.confirm(
                      `⚠️ Zeitkonflikt erkannt!\n\n` +
                      `${refName} ist bereits für Spiel #${conflict.matchNumber} (${conflict.time}) eingeteilt.\n\n` +
                      `Die Spiele überschneiden sich zeitlich.\n\n` +
                      `Möchtest du die Zuweisung trotzdem vornehmen?`
                    );

                    if (!confirmed) {
                      return; // User canceled
                    }
                  }
                }

                onAssignmentChange(match.id, refNum);
              }}
              options={getRefereeOptions()}
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
          background: ${colors.border};
          border-radius: 4px;
        }
        .referee-assignment-editor::-webkit-scrollbar-thumb {
          background: ${colors.primary};
          border-radius: 4px;
        }
        .referee-assignment-editor::-webkit-scrollbar-thumb:hover {
          background: ${colors.secondary};
        }
      `}</style>
    </div>
  );
};
