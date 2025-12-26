import React, { useState, useEffect, useMemo } from 'react';
import { Card, Input, CollapsibleSection } from '../../components/ui';
import { Tournament, TournamentGroup, TournamentField } from '../../types/tournament';
import { borderRadius, colors, fontSizes, spacing } from '../../design-tokens';
import { createDefaultGroups, createDefaultFields } from '../../utils/displayNames';

interface StepGroupsAndFieldsProps {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

/**
 * US-GROUPS-AND-FIELDS: Wizard-Step für Gruppen- und Feldkonfiguration
 *
 * Ermöglicht:
 * - Benutzerdefinierte Gruppennamen und Kürzel
 * - Benutzerdefinierte Feldnamen und Kürzel
 * - Zuordnung von Gruppen zu Feldern (optional)
 */
export const Step_GroupsAndFields: React.FC<StepGroupsAndFieldsProps> = ({
  formData,
  onUpdate,
}) => {
  // Initialisiere Gruppen aus formData oder erstelle Defaults
  const [groups, setGroups] = useState<TournamentGroup[]>(() => {
    if (formData.groups && formData.groups.length > 0) {
      return formData.groups;
    }
    const count = formData.numberOfGroups ?? 2;
    return createDefaultGroups(count);
  });

  // Initialisiere Felder aus formData oder erstelle Defaults
  const [fields, setFields] = useState<TournamentField[]>(() => {
    if (formData.fields && formData.fields.length > 0) {
      return formData.fields;
    }
    const count = formData.numberOfFields ?? 1;
    return createDefaultFields(count);
  });

  // Sync bei Änderung der Gruppen-/Feldanzahl im vorherigen Step
  useEffect(() => {
    const targetGroupCount = formData.numberOfGroups ?? 2;
    if (groups.length !== targetGroupCount) {
      // Behalte bestehende Konfiguration, füge neue hinzu oder entferne überschüssige
      if (groups.length < targetGroupCount) {
        const newGroups = createDefaultGroups(targetGroupCount);
        setGroups(prev => [
          ...prev,
          ...newGroups.slice(prev.length),
        ]);
      } else {
        setGroups(prev => prev.slice(0, targetGroupCount));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only sync when formData changes, not local state
  }, [formData.numberOfGroups]);

  useEffect(() => {
    const targetFieldCount = formData.numberOfFields ?? 1;
    if (fields.length !== targetFieldCount) {
      if (fields.length < targetFieldCount) {
        const newFields = createDefaultFields(targetFieldCount);
        setFields(prev => [
          ...prev,
          ...newFields.slice(prev.length),
        ]);
      } else {
        setFields(prev => prev.slice(0, targetFieldCount));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only sync when formData changes, not local state
  }, [formData.numberOfFields]);

  // Sync zu formData
  useEffect(() => {
    onUpdate('groups', groups);
  }, [groups, onUpdate]);

  useEffect(() => {
    onUpdate('fields', fields);
  }, [fields, onUpdate]);

  // Handler für Gruppenänderungen
  const updateGroup = (groupId: string, updates: Partial<TournamentGroup>) => {
    setGroups(prev =>
      prev.map(g => (g.id === groupId ? { ...g, ...updates } : g))
    );
  };

  // Handler für Feldänderungen
  const updateField = (fieldId: string, updates: Partial<TournamentField>) => {
    setFields(prev =>
      prev.map(f => (f.id === fieldId ? { ...f, ...updates } : f))
    );
  };

  // Toggle Feld-Zuordnung für eine Gruppe
  const toggleFieldForGroup = (groupId: string, fieldId: string) => {
    setGroups(prev =>
      prev.map(g => {
        if (g.id !== groupId) {return g;}

        const currentAllowed = g.allowedFieldIds || fields.map(f => f.id);
        const isCurrentlyAllowed = currentAllowed.includes(fieldId);

        // Mindestens ein Feld muss erlaubt bleiben
        if (isCurrentlyAllowed && currentAllowed.length <= 1) {
          return g;
        }

        const newAllowed = isCurrentlyAllowed
          ? currentAllowed.filter(id => id !== fieldId)
          : [...currentAllowed, fieldId];

        return { ...g, allowedFieldIds: newAllowed };
      })
    );
  };

  // Prüfe ob alle Gruppen alle Felder nutzen (Standard-Zustand)
  const isDefaultAssignment = useMemo(() => {
    return groups.every(g => !g.allowedFieldIds || g.allowedFieldIds.length === fields.length);
  }, [groups, fields]);

  // Kapazitäts-Warnung
  const capacityWarnings = useMemo(() => {
    const warnings: string[] = [];

    groups.forEach(group => {
      const allowedFields = group.allowedFieldIds || fields.map(f => f.id);
      if (allowedFields.length === 1 && (formData.numberOfTeams ?? 0) > 4) {
        const groupName = group.customName ?? `Gruppe ${group.id}`;
        warnings.push(`${groupName} hat nur 1 Feld - bei vielen Teams kann es eng werden`);
      }
    });

    return warnings;
  }, [groups, fields, formData.numberOfTeams]);

  // Prüft ob ein Feld ein Duplikat ist (= ein vorheriges Feld hat denselben Namen)
  const isFieldDuplicate = (fieldId: string, customName: string | undefined): boolean => {
    if (!customName?.trim()) {return false;}
    const normalizedName = customName.trim().toLowerCase();
    const fieldIndex = fields.findIndex(f => f.id === fieldId);
    return fields.slice(0, fieldIndex).some(f =>
      f.customName?.trim().toLowerCase() === normalizedName
    );
  };

  // Prüft ob ein Feld ein Original ist (= ein späteres Feld hat denselben Namen)
  const isFieldOriginal = (fieldId: string, customName: string | undefined): boolean => {
    if (!customName?.trim()) {return false;}
    const normalizedName = customName.trim().toLowerCase();
    const fieldIndex = fields.findIndex(f => f.id === fieldId);
    return fields.slice(fieldIndex + 1).some(f =>
      f.customName?.trim().toLowerCase() === normalizedName
    );
  };

  // Prüft ob eine Gruppe ein Duplikat ist (= eine vorherige Gruppe hat denselben Namen)
  const isGroupDuplicate = (groupId: string, customName: string | undefined): boolean => {
    if (!customName?.trim()) {return false;}
    const normalizedName = customName.trim().toLowerCase();
    const groupIndex = groups.findIndex(g => g.id === groupId);
    return groups.slice(0, groupIndex).some(g =>
      g.customName?.trim().toLowerCase() === normalizedName
    );
  };

  // Prüft ob eine Gruppe ein Original ist (= eine spätere Gruppe hat denselben Namen)
  const isGroupOriginal = (groupId: string, customName: string | undefined): boolean => {
    if (!customName?.trim()) {return false;}
    const normalizedName = customName.trim().toLowerCase();
    const groupIndex = groups.findIndex(g => g.id === groupId);
    return groups.slice(groupIndex + 1).some(g =>
      g.customName?.trim().toLowerCase() === normalizedName
    );
  };

  // Nur bei groupsAndFinals anzeigen
  const hasGroups = formData.groupSystem === 'groupsAndFinals';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {/* Info-Box oben */}
      <Card style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
      }}>
        <p style={{
          margin: 0,
          color: colors.textSecondary,
          fontSize: fontSizes.sm,
          lineHeight: 1.5,
        }}>
          Dieser Schritt ist optional. Du kannst direkt auf "Weiter" klicken –
          die Standard-Bezeichnungen (Gruppe A, B, C... und Feld 1, 2...) werden dann verwendet.
          Klappe die Sektionen unten auf, wenn du eigene Namen vergeben möchtest.
        </p>
      </Card>

      {/* Felder-Sektion (zusammenklappbar) */}
      <CollapsibleSection
        title={`Felder benennen (${fields.length})`}
        defaultOpen={false}
      >
        <p style={{
          margin: `0 0 ${spacing.sm} 0`,
          color: colors.textSecondary,
          fontSize: fontSizes.sm,
        }}>
          Gib deinen Spielfeldern eigene Namen (z.B. "Halle Nord", "Platz 1").
        </p>
        <p style={{
          margin: `0 0 ${spacing.md} 0`,
          color: colors.textSecondary,
          fontSize: fontSizes.xs,
          opacity: 0.8,
        }}>
          Das Kürzel (max. 3 Zeichen) wird in kompakten Ansichten wie dem PDF-Export verwendet.
        </p>

        {/* Spaltenüberschriften */}
        <div
          className="groups-fields-header"
          style={{
            display: 'grid',
            gridTemplateColumns: '80px 1fr 80px',
            gap: spacing.md,
            marginBottom: spacing.sm,
            paddingBottom: spacing.sm,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ color: colors.textSecondary, fontSize: fontSizes.xs, fontWeight: 500 }}>
            Standard
          </span>
          <span style={{ color: colors.textSecondary, fontSize: fontSizes.xs, fontWeight: 500 }}>
            Eigener Name
          </span>
          <span style={{ color: colors.textSecondary, fontSize: fontSizes.xs, fontWeight: 500, textAlign: 'center' }}>
            Kürzel
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {fields.map((field) => {
            const isDuplicate = isFieldDuplicate(field.id, field.customName);
            const isOriginal = isFieldOriginal(field.id, field.customName);
            const hasError = isDuplicate || isOriginal;
            return (
              <div key={field.id}>
                <div
                  className="groups-fields-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 80px',
                    gap: spacing.md,
                    alignItems: 'center',
                  }}
                >
                  <span style={{
                    color: colors.textSecondary,
                    fontSize: fontSizes.sm,
                  }}>
                    {field.defaultName}
                  </span>
                  <div style={{ position: 'relative' }}>
                    <Input
                      placeholder={`z.B. Halle Nord`}
                      value={field.customName ?? ''}
                      onChange={(value) => updateField(field.id, { customName: value ?? undefined })}
                      error={hasError}
                    />
                  </div>
                  <Input
                    placeholder="HN"
                    value={field.shortCode ?? ''}
                    onChange={(value) => updateField(field.id, { shortCode: value.slice(0, 3).toUpperCase() || undefined })}
                    style={{ width: '80px', textAlign: 'center' }}
                  />
                </div>
                {hasError && (
                  <p style={{
                    margin: `${spacing.xs} 0 0 88px`,
                    color: colors.error,
                    fontSize: fontSizes.xs,
                  }}>
                    Dieser Name wird bereits verwendet
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Gruppen-Sektion (nur bei groupsAndFinals, zusammenklappbar) */}
      {hasGroups && (
        <CollapsibleSection
          title={`Gruppen benennen (${groups.length})`}
          defaultOpen={false}
        >
          <p style={{
            margin: `0 0 ${spacing.sm} 0`,
            color: colors.textSecondary,
            fontSize: fontSizes.sm,
          }}>
            Gib deinen Gruppen eigene Namen (z.B. "Löwen", "Tiger").
          </p>
          <p style={{
            margin: `0 0 ${spacing.md} 0`,
            color: colors.textSecondary,
            fontSize: fontSizes.xs,
            opacity: 0.8,
          }}>
            Das Kürzel (max. 3 Zeichen) wird in kompakten Ansichten wie dem PDF-Export verwendet.
          </p>

          {/* Spaltenüberschriften */}
          <div
            className="groups-fields-header"
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 80px',
              gap: spacing.md,
              marginBottom: spacing.sm,
              paddingBottom: spacing.sm,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <span style={{ color: colors.textSecondary, fontSize: fontSizes.xs, fontWeight: 500 }}>
              Standard
            </span>
            <span style={{ color: colors.textSecondary, fontSize: fontSizes.xs, fontWeight: 500 }}>
              Eigener Name
            </span>
            <span style={{ color: colors.textSecondary, fontSize: fontSizes.xs, fontWeight: 500, textAlign: 'center' }}>
              Kürzel
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {groups.map((group) => {
              const isDuplicate = isGroupDuplicate(group.id, group.customName);
              const isOriginal = isGroupOriginal(group.id, group.customName);
              const hasError = isDuplicate || isOriginal;
              return (
                <div key={group.id}>
                  <div
                    className="groups-fields-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 1fr 80px',
                      gap: spacing.md,
                      alignItems: 'center',
                    }}
                  >
                    <span style={{
                      color: colors.textSecondary,
                      fontSize: fontSizes.sm,
                    }}>
                      Gruppe {group.id}
                    </span>
                    <div style={{ position: 'relative' }}>
                      <Input
                        placeholder={`z.B. Löwen`}
                        value={group.customName ?? ''}
                        onChange={(value) => updateGroup(group.id, { customName: value ?? undefined })}
                        error={hasError}
                      />
                    </div>
                    <Input
                      placeholder="LÖ"
                      value={group.shortCode ?? ''}
                      onChange={(value) => updateGroup(group.id, { shortCode: value.slice(0, 3).toUpperCase() || undefined })}
                      style={{ width: '80px', textAlign: 'center' }}
                    />
                  </div>
                  {hasError && (
                    <p style={{
                      margin: `${spacing.xs} 0 0 88px`,
                      color: colors.error,
                      fontSize: fontSizes.xs,
                    }}>
                      Dieser Name wird bereits verwendet
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Gruppen-Feld-Zuordnung (nur bei mehreren Feldern und Gruppen) */}
      {hasGroups && fields.length > 1 && (
        <CollapsibleSection
          title="Gruppen-Feld-Zuordnung"
          defaultOpen={false}
        >
          <p style={{
            margin: `0 0 ${spacing.md} 0`,
            color: colors.textSecondary,
            fontSize: fontSizes.sm,
          }}>
            Optional: Lege fest, auf welchen Feldern jede Gruppe spielen darf.
            Standardmäßig können alle Gruppen auf allen Feldern spielen.
          </p>

          {/* Matrix-Darstellung */}
          <div className="matrix-container" style={{ borderRadius: borderRadius.md, overflow: 'hidden' }}>
            {/* Header */}
            <div
              className="matrix-header"
              style={{
                display: 'grid',
                gridTemplateColumns: `100px repeat(${fields.length}, 1fr)`,
                gap: spacing.sm,
                alignItems: 'center',
                padding: `${spacing.sm} ${spacing.md}`,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <div></div>
              {fields.map(field => (
                <div
                  key={field.id}
                  style={{
                    textAlign: 'center',
                    fontSize: fontSizes.sm,
                    color: colors.textSecondary,
                    fontWeight: 600,
                  }}
                >
                  {field.customName || field.defaultName}
                </div>
              ))}
            </div>

            {/* Rows */}
            {groups.map((group, index) => {
              const allowedFields = group.allowedFieldIds || fields.map(f => f.id);
              const isEvenRow = index % 2 === 0;

              return (
                <div
                  key={group.id}
                  className="matrix-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `100px repeat(${fields.length}, 1fr)`,
                    gap: spacing.sm,
                    alignItems: 'center',
                    padding: `${spacing.sm} ${spacing.md}`,
                    backgroundColor: isEvenRow ? 'transparent' : 'rgba(255,255,255,0.03)',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <div style={{
                    fontSize: fontSizes.sm,
                    color: colors.textPrimary,
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
                            width: '40px',
                            height: '40px',
                            borderRadius: borderRadius.md,
                            backgroundColor: isAllowed
                              ? colors.primary
                              : 'rgba(255,255,255,0.05)',
                            border: `2px solid ${isAllowed ? colors.primary : 'rgba(255,255,255,0.2)'}`,
                            cursor: isOnlyOne ? 'not-allowed' : 'pointer',
                            opacity: isOnlyOne ? 0.5 : 1,
                            transition: 'all 0.2s ease',
                            boxShadow: isAllowed ? `0 2px 8px ${colors.primary}40` : 'none',
                          }}
                          title={isOnlyOne ? 'Mindestens ein Feld muss zugewiesen sein' : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={isAllowed}
                            onChange={() => toggleFieldForGroup(group.id, field.id)}
                            disabled={isOnlyOne}
                            style={{ display: 'none' }}
                          />
                          {isAllowed && (
                            <span style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>✓</span>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Kapazitäts-Warnungen */}
          {capacityWarnings.length > 0 && (
            <div style={{
              marginTop: spacing.md,
              padding: spacing.md,
              backgroundColor: colors.warning + '20',
              borderRadius: borderRadius.md,
              border: `1px solid ${colors.warning}`,
            }}>
              {capacityWarnings.map((warning, i) => (
                <p key={i} style={{
                  margin: i > 0 ? `${spacing.xs} 0 0 0` : 0,
                  color: colors.warning,
                  fontSize: fontSizes.sm,
                }}>
                  ⚠️ {warning}
                </p>
              ))}
            </div>
          )}

          {/* Info wenn Standard-Zuordnung */}
          {isDefaultAssignment && (
            <p style={{
              marginTop: spacing.md,
              color: colors.success,
              fontSize: fontSizes.sm,
            }}>
              ✓ Alle Gruppen können auf allen Feldern spielen – optimale Spielplan-Verteilung
            </p>
          )}
        </CollapsibleSection>
      )}

      {/* Info für roundRobin */}
      {!hasGroups && fields.length > 1 && (
        <Card style={{
          backgroundColor: colors.secondary + '10',
          border: `1px solid ${colors.secondary}30`,
        }}>
          <p style={{
            margin: 0,
            color: colors.secondary,
            fontSize: fontSizes.sm,
          }}>
            ℹ️ Bei Jeder-gegen-Jeden werden alle Spiele automatisch auf die verfügbaren Felder verteilt.
          </p>
        </Card>
      )}

      {/* Responsive Styles + Matrix Hover */}
      <style>{`
        /* Matrix Row Hover */
        .matrix-row:hover {
          background-color: rgba(0, 176, 255, 0.08) !important;
        }

        /* Checkbox Hover */
        .matrix-checkbox:hover:not([style*="not-allowed"]) {
          transform: scale(1.1);
        }

        /* Responsive */
        @media (max-width: 480px) {
          .groups-fields-grid {
            grid-template-columns: 50px 1fr 60px !important;
            gap: 8px !important;
          }
          .groups-fields-header {
            grid-template-columns: 50px 1fr 60px !important;
            gap: 8px !important;
          }
          .matrix-header,
          .matrix-row {
            grid-template-columns: 80px repeat(auto-fit, minmax(40px, 1fr)) !important;
            padding: 8px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Step_GroupsAndFields;
