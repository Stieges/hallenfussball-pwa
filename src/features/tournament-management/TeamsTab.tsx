/**
 * TeamsTab - Team-Verwaltung für veröffentlichte Turniere (TOUR-EDIT-TEAMS)
 *
 * Ermöglicht:
 * - Teams umbenennen (mit Warnung bei vorhandenen Ergebnissen)
 * - Teams löschen (intelligent basierend auf Ergebnissen)
 * - Visuelle Kennzeichnung für Teams mit Spielen/Ergebnissen
 *
 * Regeln:
 * - Teams mit Matches OHNE Ergebnisse: Matches werden entfernt
 * - Teams mit Matches MIT Ergebnissen: Team wird als "entfernt" markiert
 */

import { useState, CSSProperties, useCallback } from 'react';
import { Card, Input, Button, TeamAvatar, ColorPicker, LogoUploadDialog } from '../../components/ui';
import { Tournament, Team, TeamLogo } from '../../types/tournament';
import { cssVars } from '../../design-tokens'
import {
  analyzeTeamMatches,
  deleteTeamSafely,
  renameTeam,
  getTeamDeletionWarning,
  getTeamRenameWarning,
  getActiveTeams,
  getRemovedTeams,
  TeamMatchAnalysis,
} from '../../utils/teamHelpers';
import { getGroupDisplayName } from '../../utils/displayNames';
import { createPortal } from 'react-dom';

interface TeamsTabProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

export const TeamsTab: React.FC<TeamsTabProps> = ({
  tournament,
  onTournamentUpdate,
}) => {
  // State für Bearbeitung
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // State für expandierte Team-Cards
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  // State für Logo-Upload Dialog
  const [logoUploadTeamId, setLogoUploadTeamId] = useState<string | null>(null);

  // State für Lösch-Dialog
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState<{
    team: Team;
    analysis: TeamMatchAnalysis;
  } | null>(null);

  // Aktive und entfernte Teams
  const activeTeams = getActiveTeams(tournament.teams);
  const removedTeams = getRemovedTeams(tournament.teams);

  // Team-Analyse für alle Teams
  const teamAnalyses: Record<string, TeamMatchAnalysis> = {};
  tournament.teams.forEach(team => {
    teamAnalyses[team.id] = analyzeTeamMatches(team, tournament.matches);
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleStartEdit = (team: Team) => {
    setEditingTeamId(team.id);
    setEditingName(team.name);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingTeamId(null);
    setEditingName('');
    setError(null);
  };

  const handleSaveRename = () => {
    if (!editingTeamId) { return; }

    const analysis = teamAnalyses[editingTeamId];
    const warning = getTeamRenameWarning(analysis.teamName, analysis.matchesWithResults);

    // Wenn Warnung und noch nicht bestätigt
    if (warning) {
      const confirmed = window.confirm(
        `⚠️ Warnung\n\n${warning}\n\nMöchtest du den Namen trotzdem ändern?`
      );
      if (!confirmed) { return; }
    }

    try {
      const result = renameTeam(tournament, editingTeamId, editingName.trim());

      const updatedTournament: Tournament = {
        ...tournament,
        teams: result.updatedTeams,
        updatedAt: new Date().toISOString(),
      };

      onTournamentUpdate(updatedTournament);
      handleCancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Umbenennen');
    }
  };

  const handleDeleteClick = (team: Team) => {
    const analysis = teamAnalyses[team.id];
    setDeleteConfirmTeam({ team, analysis });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmTeam) { return; }

    try {
      const result = deleteTeamSafely(tournament, deleteConfirmTeam.team.id);

      const updatedTournament: Tournament = {
        ...tournament,
        teams: result.updatedTeams,
        matches: result.updatedMatches,
        updatedAt: new Date().toISOString(),
      };

      onTournamentUpdate(updatedTournament);
      setDeleteConfirmTeam(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      setDeleteConfirmTeam(null);
    }
  };

  const handleRestoreTeam = (teamId: string) => {
    const confirmed = window.confirm(
      'Möchtest du dieses Team wiederherstellen?\n\n' +
      'Das Team wird wieder in der Tabelle und im Spielplan angezeigt.'
    );

    if (!confirmed) { return; }

    const updatedTeams = tournament.teams.map(t =>
      t.id === teamId
        ? { ...t, isRemoved: false, removedAt: undefined }
        : t
    );

    const updatedTournament: Tournament = {
      ...tournament,
      teams: updatedTeams,
      updatedAt: new Date().toISOString(),
    };

    onTournamentUpdate(updatedTournament);
  };

  // Toggle expanded state for a team card
  const toggleExpanded = useCallback((teamId: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  }, []);

  // Handle logo save
  const handleLogoSave = useCallback((teamId: string, logo: TeamLogo) => {
    const updatedTeams = tournament.teams.map(t =>
      t.id === teamId ? { ...t, logo } : t
    );

    onTournamentUpdate({
      ...tournament,
      teams: updatedTeams,
      updatedAt: new Date().toISOString(),
    });
    setLogoUploadTeamId(null);
  }, [tournament, onTournamentUpdate]);

  // Handle logo remove
  const handleLogoRemove = useCallback((teamId: string) => {
    const updatedTeams = tournament.teams.map(t =>
      t.id === teamId ? { ...t, logo: undefined } : t
    );

    onTournamentUpdate({
      ...tournament,
      teams: updatedTeams,
      updatedAt: new Date().toISOString(),
    });
  }, [tournament, onTournamentUpdate]);

  // Handle color change
  const handleColorChange = useCallback((teamId: string, color: string) => {
    const updatedTeams = tournament.teams.map(t =>
      t.id === teamId ? { ...t, colors: { ...t.colors, primary: color } } : t
    );

    onTournamentUpdate({
      ...tournament,
      teams: updatedTeams,
      updatedAt: new Date().toISOString(),
    });
  }, [tournament, onTournamentUpdate]);

  // Get team for logo upload dialog
  const logoUploadTeam = logoUploadTeamId
    ? tournament.teams.find(t => t.id === logoUploadTeamId)
    : null;

  // ============================================================================
  // STYLES
  // ============================================================================

  const containerStyle: CSSProperties = {
    padding: cssVars.spacing.lg,
    background: cssVars.colors.background,
    minHeight: 'calc(100vh - 200px)',
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    marginBottom: cssVars.spacing.lg,
  };

  const teamRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.md,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    gap: cssVars.spacing.md,
  };

  const teamInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    flex: 1,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    marginBottom: '4px',
  };

  const badgeStyle = (color: string, bgColor: string): CSSProperties => ({
    fontSize: cssVars.fontSizes.xs,
    padding: '2px 8px',
    borderRadius: cssVars.borderRadius.sm,
    background: bgColor,
    color: color,
    fontWeight: cssVars.fontWeights.medium,
  });

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
  };

  const actionButtonStyle = (variant: 'edit' | 'delete'): CSSProperties => ({
    padding: '6px 12px',
    fontSize: cssVars.fontSizes.sm,
    borderRadius: cssVars.borderRadius.sm,
    border: 'none',
    cursor: 'pointer',
    fontWeight: cssVars.fontWeights.medium,
    background: variant === 'edit' ? cssVars.colors.surface : cssVars.colors.dangerActionBg,
    color: variant === 'edit' ? cssVars.colors.textPrimary : cssVars.colors.error,
    transition: 'all 0.2s ease',
  });

  const editInputStyle: CSSProperties = {
    flex: 1,
    maxWidth: '300px',
  };

  const removedTeamStyle: CSSProperties = {
    ...teamRowStyle,
    opacity: 0.6,
    background: cssVars.colors.neutralRowBg,
  };

  const removedTeamNameStyle: CSSProperties = {
    ...teamNameStyle,
    textDecoration: 'line-through',
    color: cssVars.colors.textSecondary,
  };

  // New card-based styles
  const teamCardStyle: CSSProperties = {
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    marginBottom: cssVars.spacing.md,
    overflow: 'hidden',
    transition: 'border-color 0.2s ease',
  };

  const teamCardHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.lg, // Increased padding
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    minHeight: '80px', // Enforce height for logo space
  };

  const teamCardLeftStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.lg, // Increased gap
    flex: 1,
    minWidth: 0,
  };

  const teamCardMetaStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
  };

  const expandButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: cssVars.spacing.xs,
    color: cssVars.colors.primary,
    fontSize: cssVars.fontSizes.lg,
    transition: 'transform 0.2s ease',
  };

  const expandedSectionStyle: CSSProperties = {
    borderTop: `1px solid ${cssVars.colors.border}`,
    padding: cssVars.spacing.lg,
    background: cssVars.colors.surfaceVariant,
  };

  const expandedRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.lg,
    flexWrap: 'wrap',
    marginBottom: cssVars.spacing.md,
  };

  const expandedLabelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
    minWidth: '100px',
  };

  const colorIndicatorStyle = (color: string): CSSProperties => ({
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: color,
    border: '2px solid rgba(255,255,255,0.3)',
    flexShrink: 0,
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Teams verwalten</h1>

      {/* Error Message */}
      {error && (
        <Card style={{ background: cssVars.colors.dangerActionBg, marginBottom: cssVars.spacing.lg }}>
          <div style={{ color: cssVars.colors.error, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>❌</span>
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: cssVars.fontSizes.lg }}
            >
              ✕
            </button>
          </div>
        </Card>
      )}

      {/* Info Box */}
      <Card style={{ marginBottom: cssVars.spacing.lg, background: cssVars.colors.infoBannerBg }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: cssVars.spacing.md }}>
          <span style={{ fontSize: cssVars.fontSizes.xxl }}>ℹ️</span>
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: cssVars.colors.textPrimary }}>
              Team-Bearbeitung
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>
              <li><strong>Umbenennen:</strong> Jederzeit möglich (z.B. für Rechtschreibkorrekturen)</li>
              <li><strong>Löschen ohne Ergebnisse:</strong> Team und alle Spiele werden entfernt</li>
              <li><strong>Löschen mit Ergebnissen:</strong> Spiele mit Ergebnissen bleiben erhalten</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Active Teams */}
      <Card>
        <h3 style={{ color: cssVars.colors.textPrimary, margin: '0 0 16px 0' }}>
          Aktive Teams ({activeTeams.length})
        </h3>

        {activeTeams.length === 0 ? (
          <p style={{ color: cssVars.colors.textSecondary, fontStyle: 'italic' }}>
            Keine aktiven Teams vorhanden.
          </p>
        ) : (
          activeTeams.map(team => {
            const analysis = teamAnalyses[team.id];
            const isEditing = editingTeamId === team.id;
            const isExpanded = expandedTeams.has(team.id);
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty color should use fallback
            const primaryColor = team.colors?.primary || '#CCCCCC';

            return (
              <div
                key={team.id}
                style={{
                  ...teamCardStyle,
                  borderColor: isExpanded ? cssVars.colors.primary : cssVars.colors.border,
                }}
              >
                {/* Card Header */}
                <div
                  style={teamCardHeaderStyle}
                  onClick={() => !isEditing && toggleExpanded(team.id)}
                >
                  <div style={teamCardLeftStyle}>
                    {/* TeamAvatar with click to open logo dialog */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setLogoUploadTeamId(team.id);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <TeamAvatar team={team} size="lg" showColorRing />
                    </div>

                    {/* Team Name and Badges */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm }}>
                        <span style={teamNameStyle}>{team.name}</span>
                        {team.group && (
                          <span style={badgeStyle(cssVars.colors.primary, cssVars.colors.infoBadgeBg)}>
                            {getGroupDisplayName(team.group, tournament)}
                          </span>
                        )}
                      </div>
                      <div style={teamCardMetaStyle}>
                        <span style={colorIndicatorStyle(primaryColor)} title={`Trikotfarbe: ${primaryColor}`} />
                        {analysis.matchesWithResults > 0 && (
                          <span>{analysis.matchesWithResults} Ergebnis{analysis.matchesWithResults !== 1 ? 'se' : ''}</span>
                        )}
                        {analysis.matchesWithoutResults > 0 && (
                          <span>{analysis.matchesWithoutResults} geplant</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expand/Collapse Button */}
                  <button
                    style={{
                      ...expandButtonStyle,
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(team.id);
                    }}
                    aria-label={isExpanded ? 'Einklappen' : 'Aufklappen'}
                  >
                    ▼
                  </button>
                </div>

                {/* Expanded Section */}
                {
                  isExpanded && (
                    <div style={expandedSectionStyle}>
                      {isEditing ? (
                        // Edit Mode
                        <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.md, flexWrap: 'wrap' }}>
                          <div style={editInputStyle}>
                            <Input
                              label="Teamname"
                              value={editingName}
                              onChange={setEditingName}
                              placeholder="Teamname"
                            />
                          </div>
                          <div style={buttonGroupStyle}>
                            <Button variant="secondary" onClick={handleCancelEdit}>
                              Abbrechen
                            </Button>
                            <Button
                              variant="primary"
                              onClick={handleSaveRename}
                              disabled={!editingName.trim() || editingName.trim() === team.name}
                            >
                              Speichern
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View Mode - Expanded Details
                        <>
                          {/* Logo Section */}
                          <div style={expandedRowStyle}>
                            <span style={expandedLabelStyle}>Logo:</span>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setLogoUploadTeamId(team.id)}
                            >
                              {team.logo ? 'Logo ändern' : 'Logo hochladen'}
                            </Button>
                            {team.logo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLogoRemove(team.id)}
                              >
                                Logo entfernen
                              </Button>
                            )}
                          </div>

                          {/* Color Section */}
                          <div style={expandedRowStyle}>
                            <span style={expandedLabelStyle}>Trikotfarbe:</span>
                            <ColorPicker
                              value={primaryColor}
                              onChange={(color) => handleColorChange(team.id, color)}
                            />
                          </div>

                          {/* Action Buttons */}
                          <div style={{ ...expandedRowStyle, marginTop: cssVars.spacing.lg, marginBottom: 0 }}>
                            <button
                              style={actionButtonStyle('edit')}
                              onClick={() => handleStartEdit(team)}
                            >
                              ✏️ Umbenennen
                            </button>
                            <button
                              style={actionButtonStyle('delete')}
                              onClick={() => handleDeleteClick(team)}
                            >
                              🗑️ Löschen
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                }
              </div >
            );
          })
        )}
      </Card >

      {/* Removed Teams */}
      {
        removedTeams.length > 0 && (
          <Card style={{ marginTop: cssVars.spacing.lg }}>
            <h3 style={{ color: cssVars.colors.textSecondary, margin: '0 0 16px 0' }}>
              Entfernte Teams ({removedTeams.length})
            </h3>
            <p style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, marginBottom: '16px' }}>
              Diese Teams wurden entfernt, aber ihre historischen Ergebnisse sind noch im Spielplan sichtbar.
            </p>

            {removedTeams.map(team => {
              const analysis = teamAnalyses[team.id];

              return (
                <div key={team.id} style={removedTeamStyle}>
                  <div style={teamInfoStyle}>
                    <TeamAvatar team={team} size="sm" style={{ opacity: 0.5 }} />
                    <span style={removedTeamNameStyle}>{team.name}</span>
                    {analysis.matchesWithResults > 0 && (
                      <span style={badgeStyle(cssVars.colors.textSecondary, cssVars.colors.neutralBadgeBg)}>
                        {analysis.matchesWithResults} historische Ergebnis{analysis.matchesWithResults !== 1 ? 'se' : ''}
                      </span>
                    )}
                    {team.removedAt && (
                      <span style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary }}>
                        Entfernt am {new Date(team.removedAt).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </div>
                  <button
                    style={{
                      padding: '6px 12px',
                      fontSize: cssVars.fontSizes.sm,
                      borderRadius: cssVars.borderRadius.sm,
                      border: `1px solid ${cssVars.colors.border}`,
                      cursor: 'pointer',
                      background: 'transparent',
                      color: cssVars.colors.textSecondary,
                    }}
                    onClick={() => handleRestoreTeam(team.id)}
                  >
                    ↩️ Wiederherstellen
                  </button>
                </div>
              );
            })}
          </Card>
        )
      }

      {/* Delete Confirmation Dialog */}
      {
        deleteConfirmTeam && (
          <div style={overlayStyle}>
            <div style={dialogStyle}>
              <h3 style={{ margin: '0 0 16px 0', color: cssVars.colors.textPrimary }}>
                Team löschen?
              </h3>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: cssVars.colors.textSecondary, margin: '0 0 12px 0' }}>
                  {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty warning should use default question */}
                  {getTeamDeletionWarning(deleteConfirmTeam.analysis) ||
                    `Möchtest du "${deleteConfirmTeam.team.name}" wirklich löschen?`}
                </p>

                {deleteConfirmTeam.analysis.matchesWithResults > 0 && (
                  <div style={{
                    padding: cssVars.spacing.md,
                    background: cssVars.colors.warningBannerBgStrong,
                    borderRadius: cssVars.borderRadius.sm,
                    marginTop: '12px',
                  }}>
                    <p style={{ margin: 0, color: cssVars.colors.warning, fontSize: cssVars.fontSizes.sm }}>
                      ⚠️ Das Team wird als "entfernt" markiert. Die Ergebnisse bleiben für die Fairness der anderen Teams erhalten.
                    </p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setDeleteConfirmTeam(null)}>
                  Abbrechen
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmDelete}
                  style={{ background: cssVars.colors.error }}
                >
                  {deleteConfirmTeam.analysis.matchesWithResults > 0
                    ? 'Als entfernt markieren'
                    : 'Löschen'}
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Logo Upload Dialog */}
      {
        logoUploadTeam && createPortal(
          <LogoUploadDialog
            teamName={logoUploadTeam.name}
            currentLogo={logoUploadTeam.logo}
            onSave={(logo) => handleLogoSave(logoUploadTeam.id, logo)}
            onCancel={() => setLogoUploadTeamId(null)}
            onRemove={logoUploadTeam.logo ? () => {
              handleLogoRemove(logoUploadTeam.id);
              setLogoUploadTeamId(null);
            } : undefined}
          />,
          document.body
        )
      }
    </div >
  );
};

// ============================================================================
// DIALOG STYLES
// ============================================================================

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: cssVars.colors.overlay,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: CSSProperties = {
  background: cssVars.colors.surface,
  borderRadius: cssVars.borderRadius.lg,
  padding: cssVars.spacing.xl,
  maxWidth: '500px',
  width: '90%',
  boxShadow: cssVars.shadows.xl,
};
