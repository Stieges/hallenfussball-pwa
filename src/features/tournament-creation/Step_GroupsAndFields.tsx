import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CollapsibleSection } from '../../components/ui';
import { Tournament } from '../../types/tournament';
import { cssVars } from '../../design-tokens'
import { useGroupsAndFieldsState } from './hooks/useGroupsAndFieldsState';
import { NameGrid } from './components/NameGrid';
import { GroupFieldMatrix } from './components/GroupFieldMatrix';

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
  const { t } = useTranslation('wizard');
  const {
    groups,
    fields,
    updateGroup,
    updateField,
    toggleFieldForGroup,
    isDefaultAssignment,
    capacityWarnings,
    isFieldDuplicate,
    isFieldOriginal,
    isGroupDuplicate,
    isGroupOriginal,
  } = useGroupsAndFieldsState({ formData, onUpdate });

  // Nur bei groupsAndFinals anzeigen
  const hasGroups = formData.groupSystem === 'groupsAndFinals';

  // Map fields to NameGrid format
  const fieldItems = fields.map(f => ({
    id: f.id,
    defaultName: f.defaultName,
    customName: f.customName,
    shortCode: f.shortCode,
  }));

  // Map groups to NameGrid format
  const groupItems = groups.map(g => ({
    id: g.id,
    defaultName: t('groupsAndFields.defaultGroupName', { id: g.id }),
    customName: g.customName,
    shortCode: g.shortCode,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.lg }}>
      {/* Info-Box oben */}
      <Card style={{
        backgroundColor: cssVars.colors.surface,
        border: `1px solid ${cssVars.colors.border}`,
      }}>
        <p style={{
          margin: 0,
          color: cssVars.colors.textSecondary,
          fontSize: cssVars.fontSizes.sm,
          lineHeight: 1.5,
        }}>
          {t('groupsAndFields.infoText')}
        </p>
      </Card>

      {/* Felder-Sektion (zusammenklappbar) */}
      <CollapsibleSection
        title={t('groupsAndFields.fieldSection.title', { count: fields.length })}
        defaultOpen={false}
      >
        <p style={{
          margin: `0 0 ${cssVars.spacing.sm} 0`,
          color: cssVars.colors.textSecondary,
          fontSize: cssVars.fontSizes.sm,
        }}>
          {t('groupsAndFields.fieldSection.description')}
        </p>
        <p style={{
          margin: `0 0 ${cssVars.spacing.md} 0`,
          color: cssVars.colors.textSecondary,
          fontSize: cssVars.fontSizes.xs,
          opacity: 0.8,
        }}>
          {t('groupsAndFields.fieldSection.shortCodeHint')}
        </p>

        <NameGrid
          items={fieldItems}
          onUpdateItem={(id, updates) => updateField(id, updates)}
          checkDuplicate={isFieldDuplicate}
          checkOriginal={isFieldOriginal}
          namePlaceholder="Halle Nord"
          shortCodePlaceholder="HN"
        />
      </CollapsibleSection>

      {/* Gruppen-Sektion (nur bei groupsAndFinals, zusammenklappbar) */}
      {hasGroups && (
        <CollapsibleSection
          title={t('groupsAndFields.groupSection.title', { count: groups.length })}
          defaultOpen={false}
        >
          <p style={{
            margin: `0 0 ${cssVars.spacing.sm} 0`,
            color: cssVars.colors.textSecondary,
            fontSize: cssVars.fontSizes.sm,
          }}>
            {t('groupsAndFields.groupSection.description')}
          </p>
          <p style={{
            margin: `0 0 ${cssVars.spacing.md} 0`,
            color: cssVars.colors.textSecondary,
            fontSize: cssVars.fontSizes.xs,
            opacity: 0.8,
          }}>
            {t('groupsAndFields.groupSection.shortCodeHint')}
          </p>

          <NameGrid
            items={groupItems}
            onUpdateItem={(id, updates) => updateGroup(id, updates)}
            checkDuplicate={isGroupDuplicate}
            checkOriginal={isGroupOriginal}
            namePlaceholder="Löwen"
            shortCodePlaceholder="LÖ"
          />
        </CollapsibleSection>
      )}

      {/* Gruppen-Feld-Zuordnung (nur bei mehreren Feldern und Gruppen) */}
      {hasGroups && fields.length > 1 && (
        <CollapsibleSection
          title={t('groupsAndFields.matrix.title')}
          defaultOpen={false}
        >
          <p style={{
            margin: `0 0 ${cssVars.spacing.md} 0`,
            color: cssVars.colors.textSecondary,
            fontSize: cssVars.fontSizes.sm,
          }}>
            {t('groupsAndFields.matrix.description')}
          </p>

          <GroupFieldMatrix
            groups={groups}
            fields={fields}
            onToggle={toggleFieldForGroup}
            capacityWarnings={capacityWarnings}
            isDefaultAssignment={isDefaultAssignment}
          />
        </CollapsibleSection>
      )}

      {/* Info für roundRobin */}
      {!hasGroups && fields.length > 1 && (
        <Card style={{
          backgroundColor: cssVars.colors.secondarySubtle,
          border: `1px solid ${cssVars.colors.secondaryBorder}`,
        }}>
          <p style={{
            margin: 0,
            color: cssVars.colors.secondary,
            fontSize: cssVars.fontSizes.sm,
          }}>
            ℹ️ {t('groupsAndFields.roundRobinInfo')}
          </p>
        </Card>
      )}

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 480px) {
          .groups-fields-grid {
            grid-template-columns: 50px 1fr 60px !important;
            gap: 8px !important;
          }
          .groups-fields-header {
            grid-template-columns: 50px 1fr 60px !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Step_GroupsAndFields;
