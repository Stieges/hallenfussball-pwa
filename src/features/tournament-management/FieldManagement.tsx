/**
 * FieldManagement - Felder-Verwaltung (Bezeichnungen bearbeiten)
 *
 * MON-KONF-01: Strukturierte Feldkonfiguration
 *
 * Features:
 * - Liste aller Felder mit Anzeige von defaultName/customName
 * - Bearbeiten von customName und shortCode
 * - Keine Add/Delete (Felder werden im Wizard konfiguriert)
 * - Hinweis wenn Feld in Monitor-Slides verwendet wird
 *
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P1-02
 */

import { useState, CSSProperties } from 'react';
import { Card, Input } from '../../components/ui';
import { cssVars } from '../../design-tokens';
import type { Tournament, TournamentField } from '../../types/tournament';
import { useFields } from '../../hooks';

// =============================================================================
// TYPES
// =============================================================================

interface FieldManagementProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => Promise<void>;
}

interface EditingState {
  fieldId: string;
  customName: string;
  shortCode: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FieldManagement({
  tournament,
  onTournamentUpdate,
}: FieldManagementProps) {
  // State
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hook
  const {
    fields,
    getFieldDisplayName,
    getFieldShortCode,
    updateField,
    isFieldUsedInSlides,
  } = useFields(tournament, onTournamentUpdate);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleStartEdit = (field: TournamentField) => {
    setEditing({
      fieldId: field.id,
      customName: field.customName ?? '',
      shortCode: field.shortCode ?? '',
    });
    setError(null);
  };

  const handleCancel = () => {
    setEditing(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!editing) {return;}

    setIsLoading(true);
    setError(null);

    try {
      await updateField(editing.fieldId, {
        customName: editing.customName,
        shortCode: editing.shortCode,
      });

      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================================================
  // STYLES
  // ==========================================================================

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: cssVars.spacing.sm,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const countBadgeStyle: CSSProperties = {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  };

  const listStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  };

  const fieldItemStyle = (isEditing: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: isEditing ? cssVars.colors.surface : cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${isEditing ? cssVars.colors.primary : cssVars.colors.border}`,
    transition: 'border-color 0.2s ease',
  });

  const fieldIconStyle: CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: cssVars.borderRadius.sm,
    background: cssVars.colors.primary,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.bold,
    flexShrink: 0,
  };

  const fieldInfoStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const fieldNameStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const fieldDefaultStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textMuted,
    margin: '2px 0 0',
  };

  const actionButtonStyle: CSSProperties = {
    minWidth: '44px',
    minHeight: '44px',
    padding: cssVars.spacing.sm,
    borderRadius: cssVars.borderRadius.md,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.lg,
  };

  const editFormStyle: CSSProperties = {
    marginTop: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  };

  const formRowStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.md,
    flexWrap: 'wrap',
  };

  const buttonRowStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    justifyContent: 'flex-end',
  };

  const cancelButtonStyle: CSSProperties = {
    minHeight: '44px',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.md,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
  };

  const saveButtonStyle: CSSProperties = {
    minHeight: '44px',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.md,
    background: cssVars.colors.primary,
    border: 'none',
    color: 'white',
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: isLoading ? 'wait' : 'pointer',
    opacity: isLoading ? 0.7 : 1,
  };

  const errorStyle: CSSProperties = {
    padding: cssVars.spacing.sm,
    background: `${cssVars.colors.error}22`,
    color: cssVars.colors.error,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    marginBottom: cssVars.spacing.md,
  };

  const emptyStateStyle: CSSProperties = {
    padding: cssVars.spacing.xl,
    textAlign: 'center',
    color: cssVars.colors.textSecondary,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
    border: `1px dashed ${cssVars.colors.border}`,
  };

  const usedBadgeStyle: CSSProperties = {
    padding: `2px 6px`,
    background: `${cssVars.colors.primary}22`,
    color: cssVars.colors.primary,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.xs,
    marginLeft: cssVars.spacing.sm,
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <Card>
      <div style={containerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h3 style={titleStyle}>Spielfelder</h3>
          <span style={countBadgeStyle}>
            {fields.length} {fields.length === 1 ? 'Feld' : 'Felder'}
          </span>
        </div>

        {/* Error */}
        {error && <div style={errorStyle}>{error}</div>}

        {/* List */}
        {fields.length === 0 ? (
          <div style={emptyStateStyle}>
            <p style={{ margin: 0, fontSize: cssVars.fontSizes.md }}>Keine Felder vorhanden</p>
            <p style={{ margin: `${cssVars.spacing.sm} 0 0`, fontSize: cssVars.fontSizes.sm }}>
              Felder werden im Wizard beim Erstellen des Turniers konfiguriert.
            </p>
          </div>
        ) : (
          <div style={listStyle}>
            {fields.map((field) => {
              const isEditing = editing?.fieldId === field.id;
              const isUsed = isFieldUsedInSlides(field.id);
              const displayName = getFieldDisplayName(field.id);
              const shortCode = getFieldShortCode(field.id);

              return (
                <div key={field.id}>
                  <div style={fieldItemStyle(isEditing)}>
                    {/* Field Icon */}
                    <div style={fieldIconStyle}>
                      {shortCode}
                    </div>

                    {/* Info */}
                    <div style={fieldInfoStyle}>
                      <h4 style={fieldNameStyle}>
                        {displayName}
                        {isUsed && <span style={usedBadgeStyle}>In Slides</span>}
                      </h4>
                      {field.customName && (
                        <p style={fieldDefaultStyle}>
                          Standard: {field.defaultName}
                        </p>
                      )}
                    </div>

                    {/* Edit Button */}
                    {!editing && (
                      <button
                        style={actionButtonStyle}
                        onClick={() => handleStartEdit(field)}
                        title="Bezeichnung bearbeiten"
                      >
                        ✏️
                      </button>
                    )}
                  </div>

                  {/* Edit Form */}
                  {isEditing && (
                    <div style={editFormStyle}>
                      <div style={formRowStyle}>
                        <div style={{ flex: 2, minWidth: '150px' }}>
                          <Input
                            label="Eigene Bezeichnung"
                            value={editing.customName}
                            onChange={(v) => setEditing({ ...editing, customName: v })}
                            placeholder={field.defaultName}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: '80px', maxWidth: '120px' }}>
                          <Input
                            label="Kurzcode (max 3)"
                            value={editing.shortCode}
                            onChange={(v) => setEditing({ ...editing, shortCode: v.toUpperCase().substring(0, 3) })}
                            placeholder="z.B. HN"
                          />
                        </div>
                      </div>
                      <div style={buttonRowStyle}>
                        <button style={cancelButtonStyle} onClick={handleCancel}>
                          Abbrechen
                        </button>
                        <button style={saveButtonStyle} onClick={() => void handleSave()} disabled={isLoading}>
                          {isLoading ? 'Speichern...' : 'Speichern'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Info Hint */}
        {fields.length > 0 && (
          <p style={{
            margin: `${cssVars.spacing.md} 0 0`,
            fontSize: cssVars.fontSizes.sm,
            color: cssVars.colors.textMuted,
          }}>
            Eigene Bezeichnungen werden in Monitor-Slides und im Spielplan angezeigt.
            Die Anzahl der Felder kann nur im Wizard geändert werden.
          </p>
        )}
      </div>
    </Card>
  );
}

export default FieldManagement;
