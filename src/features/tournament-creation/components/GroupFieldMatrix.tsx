import React from 'react';
import { TournamentGroup, TournamentField } from '../../../types/tournament';
import { cssVars } from '../../../design-tokens'

interface GroupFieldMatrixProps {
  groups: TournamentGroup[];
  fields: TournamentField[];
  onToggle: (groupId: string, fieldId: string) => void;
  capacityWarnings: string[];
  isDefaultAssignment: boolean;
}

/**
 * Matrix component for group-field assignment
 * Extracted from Step_GroupsAndFields for better maintainability
 */
export const GroupFieldMatrix: React.FC<GroupFieldMatrixProps> = ({
  groups,
  fields,
  onToggle,
  capacityWarnings,
  isDefaultAssignment,
}) => {
  return (
    <>
      {/* Matrix representation */}
      <div className="matrix-container" style={{ borderRadius: cssVars.borderRadius.md, overflow: 'hidden' }}>
        {/* Header */}
        <div
          className="matrix-header"
          style={{
            display: 'grid',
            gridTemplateColumns: `100px repeat(${fields.length}, 1fr)`,
            gap: cssVars.spacing.sm,
            alignItems: 'center',
            padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
            backgroundColor: cssVars.colors.surface,
            borderBottom: `1px solid ${cssVars.colors.border}`,
          }}
        >
          <div></div>
          {fields.map(field => (
            <div
              key={field.id}
              style={{
                textAlign: 'center',
                fontSize: cssVars.fontSizes.sm,
                color: cssVars.colors.textSecondary,
                fontWeight: 600,
              }}
            >
              {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty customName should use default */}
              {field.customName || field.defaultName}
            </div>
          ))}
        </div>

        {/* Rows */}
        {groups.map((group, index) => {
          const allowedFields = group.allowedFieldIds ?? fields.map(f => f.id);
          const isEvenRow = index % 2 === 0;

          return (
            <div
              key={group.id}
              className="matrix-row"
              style={{
                display: 'grid',
                gridTemplateColumns: `100px repeat(${fields.length}, 1fr)`,
                gap: cssVars.spacing.sm,
                alignItems: 'center',
                padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
                backgroundColor: isEvenRow ? 'transparent' : cssVars.colors.surfaceSubtle,
                transition: 'background-color 0.15s ease',
              }}
            >
              <div style={{
                fontSize: cssVars.fontSizes.sm,
                color: cssVars.colors.textPrimary,
                fontWeight: 500,
              }}>
                {group.customName ?? `Gruppe ${group.id}`}
              </div>
              {fields.map(field => {
                const isAllowed = allowedFields.includes(field.id);
                const isOnlyOne = allowedFields.length === 1 && isAllowed;

                return (
                  <div
                    key={field.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <label
                      className="matrix-checkbox"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '44px',
                        height: '44px',
                        borderRadius: cssVars.borderRadius.md,
                        backgroundColor: isAllowed
                          ? cssVars.colors.primary
                          : cssVars.colors.surface,
                        border: `2px solid ${isAllowed ? cssVars.colors.primary : cssVars.colors.borderMedium}`,
                        cursor: isOnlyOne ? 'not-allowed' : 'pointer',
                        opacity: isOnlyOne ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                        boxShadow: isAllowed ? `0 2px 8px ${cssVars.colors.primary}40` : 'none',
                      }}
                      title={isOnlyOne ? 'Mindestens ein Feld muss zugewiesen sein' : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={isAllowed}
                        onChange={() => onToggle(group.id, field.id)}
                        disabled={isOnlyOne}
                        style={{ display: 'none' }}
                      />
                      {isAllowed && (
                        <span style={{ color: cssVars.colors.textPrimary, fontSize: '20px', fontWeight: 'bold' }}>✓</span>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Capacity warnings */}
      {capacityWarnings.length > 0 && (
        <div style={{
          marginTop: cssVars.spacing.md,
          padding: cssVars.spacing.md,
          backgroundColor: cssVars.colors.warning + '20',
          borderRadius: cssVars.borderRadius.md,
          border: `1px solid ${cssVars.colors.warning}`,
        }}>
          {capacityWarnings.map((warning, i) => (
            <p key={i} style={{
              margin: i > 0 ? `${cssVars.spacing.xs} 0 0 0` : 0,
              color: cssVars.colors.warning,
              fontSize: cssVars.fontSizes.sm,
            }}>
              ⚠️ {warning}
            </p>
          ))}
        </div>
      )}

      {/* Info when default assignment */}
      {isDefaultAssignment && (
        <p style={{
          marginTop: cssVars.spacing.md,
          color: cssVars.colors.success,
          fontSize: cssVars.fontSizes.sm,
        }}>
          ✓ Alle Gruppen können auf allen Feldern spielen – optimale Spielplan-Verteilung
        </p>
      )}
    </>
  );
};
