import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tournament, TournamentGroup, TournamentField } from '../../../types/tournament';
import { createDefaultGroups, createDefaultFields } from '../../../utils/displayNames';

interface UseGroupsAndFieldsStateProps {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

interface UseGroupsAndFieldsStateReturn {
  groups: TournamentGroup[];
  fields: TournamentField[];
  updateGroup: (groupId: string, updates: Partial<TournamentGroup>) => void;
  updateField: (fieldId: string, updates: Partial<TournamentField>) => void;
  toggleFieldForGroup: (groupId: string, fieldId: string) => void;
  isDefaultAssignment: boolean;
  capacityWarnings: string[];
  isFieldDuplicate: (fieldId: string, customName: string | undefined) => boolean;
  isFieldOriginal: (fieldId: string, customName: string | undefined) => boolean;
  isGroupDuplicate: (groupId: string, customName: string | undefined) => boolean;
  isGroupOriginal: (groupId: string, customName: string | undefined) => boolean;
}

/**
 * Hook for managing groups and fields state in the wizard
 * Extracted from Step_GroupsAndFields for better testability and reusability
 */
export function useGroupsAndFieldsState({
  formData,
  onUpdate,
}: UseGroupsAndFieldsStateProps): UseGroupsAndFieldsStateReturn {
  // Initialize groups from formData or create defaults
  const [groups, setGroups] = useState<TournamentGroup[]>(() => {
    if (formData.groups && formData.groups.length > 0) {
      return formData.groups;
    }
    const count = formData.numberOfGroups ?? 2;
    return createDefaultGroups(count);
  });

  // Initialize fields from formData or create defaults
  const [fields, setFields] = useState<TournamentField[]>(() => {
    if (formData.fields && formData.fields.length > 0) {
      return formData.fields;
    }
    const count = formData.numberOfFields ?? 1;
    return createDefaultFields(count);
  });

  // Sync when group count changes in previous step
  useEffect(() => {
    const targetGroupCount = formData.numberOfGroups ?? 2;
    if (groups.length !== targetGroupCount) {
      if (groups.length < targetGroupCount) {
        const newGroups = createDefaultGroups(targetGroupCount);
        setGroups(prev => [...prev, ...newGroups.slice(prev.length)]);
      } else {
        setGroups(prev => prev.slice(0, targetGroupCount));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.numberOfGroups]);

  // Sync when field count changes in previous step
  useEffect(() => {
    const targetFieldCount = formData.numberOfFields ?? 1;
    if (fields.length !== targetFieldCount) {
      if (fields.length < targetFieldCount) {
        const newFields = createDefaultFields(targetFieldCount);
        setFields(prev => [...prev, ...newFields.slice(prev.length)]);
      } else {
        setFields(prev => prev.slice(0, targetFieldCount));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.numberOfFields]);

  // Sync to formData
  useEffect(() => {
    onUpdate('groups', groups);
  }, [groups, onUpdate]);

  useEffect(() => {
    onUpdate('fields', fields);
  }, [fields, onUpdate]);

  // Handler for group changes
  const updateGroup = useCallback((groupId: string, updates: Partial<TournamentGroup>) => {
    setGroups(prev =>
      prev.map(g => (g.id === groupId ? { ...g, ...updates } : g))
    );
  }, []);

  // Handler for field changes
  const updateField = useCallback((fieldId: string, updates: Partial<TournamentField>) => {
    setFields(prev =>
      prev.map(f => (f.id === fieldId ? { ...f, ...updates } : f))
    );
  }, []);

  // Toggle field assignment for a group
  const toggleFieldForGroup = useCallback((groupId: string, fieldId: string) => {
    setGroups(prev =>
      prev.map(g => {
        if (g.id !== groupId) {return g;}

        const currentAllowed = g.allowedFieldIds ?? fields.map(f => f.id);
        const isCurrentlyAllowed = currentAllowed.includes(fieldId);

        // At least one field must remain allowed
        if (isCurrentlyAllowed && currentAllowed.length <= 1) {
          return g;
        }

        const newAllowed = isCurrentlyAllowed
          ? currentAllowed.filter(id => id !== fieldId)
          : [...currentAllowed, fieldId];

        return { ...g, allowedFieldIds: newAllowed };
      })
    );
  }, [fields]);

  // Check if all groups use all fields (default state)
  const isDefaultAssignment = useMemo(() => {
    return groups.every(g => !g.allowedFieldIds || g.allowedFieldIds.length === fields.length);
  }, [groups, fields]);

  // Capacity warnings
  const capacityWarnings = useMemo(() => {
    const warnings: string[] = [];

    groups.forEach(group => {
      const allowedFields = group.allowedFieldIds ?? fields.map(f => f.id);
      if (allowedFields.length === 1 && (formData.numberOfTeams ?? 0) > 4) {
        const groupName = group.customName ?? `Gruppe ${group.id}`;
        warnings.push(`${groupName} hat nur 1 Feld - bei vielen Teams kann es eng werden`);
      }
    });

    return warnings;
  }, [groups, fields, formData.numberOfTeams]);

  // Duplicate checking functions
  const isFieldDuplicate = useCallback((fieldId: string, customName: string | undefined): boolean => {
    if (!customName?.trim()) {return false;}
    const normalizedName = customName.trim().toLowerCase();
    const fieldIndex = fields.findIndex(f => f.id === fieldId);
    return fields.slice(0, fieldIndex).some(f =>
      f.customName?.trim().toLowerCase() === normalizedName
    );
  }, [fields]);

  const isFieldOriginal = useCallback((fieldId: string, customName: string | undefined): boolean => {
    if (!customName?.trim()) {return false;}
    const normalizedName = customName.trim().toLowerCase();
    const fieldIndex = fields.findIndex(f => f.id === fieldId);
    return fields.slice(fieldIndex + 1).some(f =>
      f.customName?.trim().toLowerCase() === normalizedName
    );
  }, [fields]);

  const isGroupDuplicate = useCallback((groupId: string, customName: string | undefined): boolean => {
    if (!customName?.trim()) {return false;}
    const normalizedName = customName.trim().toLowerCase();
    const groupIndex = groups.findIndex(g => g.id === groupId);
    return groups.slice(0, groupIndex).some(g =>
      g.customName?.trim().toLowerCase() === normalizedName
    );
  }, [groups]);

  const isGroupOriginal = useCallback((groupId: string, customName: string | undefined): boolean => {
    if (!customName?.trim()) {return false;}
    const normalizedName = customName.trim().toLowerCase();
    const groupIndex = groups.findIndex(g => g.id === groupId);
    return groups.slice(groupIndex + 1).some(g =>
      g.customName?.trim().toLowerCase() === normalizedName
    );
  }, [groups]);

  return {
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
  };
}
