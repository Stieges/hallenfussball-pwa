/**
 * US-GROUPS-AND-FIELDS: Display Name Utilities
 *
 * Zentrale Funktionen für die Auflösung von Gruppen- und Feldnamen.
 * Diese Utilities werden von den gekapselten Komponenten GroupDisplay und FieldDisplay verwendet.
 */

import { TournamentGroup, TournamentField, Tournament } from '../types/tournament';
import { generateGroupLabels } from './groupHelpers';

/**
 * Flexible Typen für Lookup-Funktionen (akzeptiert Tournament oder partielle Objekte)
 */
type GroupLookupSource = Tournament | { groups?: TournamentGroup[] } | undefined;
type FieldLookupSource = Tournament | { fields?: TournamentField[] } | undefined;

// ============================================================================
// Group Display Functions
// ============================================================================

/**
 * Gibt den Anzeigenamen einer Gruppe zurück
 * @param group - TournamentGroup Objekt oder nur die Gruppen-ID (z.B. 'A')
 * @param source - Optional: Tournament oder Objekt mit groups-Array für Lookup
 */
export function getGroupDisplayName(
  group: TournamentGroup | string,
  source?: GroupLookupSource
): string {
  const resolvedGroup = resolveGroup(group, source);
  return resolvedGroup.customName || `Gruppe ${resolvedGroup.id}`;
}

/**
 * Gibt das Kürzel einer Gruppe zurück (für kompakte Anzeigen)
 * Fallback-Logik: shortCode > customName[0:2] > id
 */
export function getGroupShortCode(
  group: TournamentGroup | string,
  source?: GroupLookupSource
): string {
  const resolvedGroup = resolveGroup(group, source);

  if (resolvedGroup.shortCode) {
    return resolvedGroup.shortCode;
  }
  if (resolvedGroup.customName) {
    return resolvedGroup.customName.substring(0, 2).toUpperCase();
  }
  return resolvedGroup.id; // 'A', 'B', etc.
}

/**
 * Löst eine Gruppen-ID oder TournamentGroup zu einem vollständigen Objekt auf
 */
function resolveGroup(
  group: TournamentGroup | string,
  source?: GroupLookupSource
): TournamentGroup {
  if (typeof group === 'string') {
    // Suche in groups-Array nach der ID
    const found = source?.groups?.find(g => g.id === group);
    if (found) {
      return found;
    }
    // Fallback: Erstelle minimales Group-Objekt
    return { id: group };
  }
  return group;
}

// ============================================================================
// Field Display Functions
// ============================================================================

/**
 * Gibt den Anzeigenamen eines Feldes zurück
 * @param field - TournamentField Objekt oder Feld-Nummer/ID
 * @param source - Optional: Tournament oder Objekt mit fields-Array für Lookup
 */
export function getFieldDisplayName(
  field: TournamentField | number | string,
  source?: FieldLookupSource
): string {
  const resolvedField = resolveField(field, source);
  return resolvedField.customName || resolvedField.defaultName;
}

/**
 * Gibt das Kürzel eines Feldes zurück (für kompakte Anzeigen)
 * Fallback-Logik: shortCode > customName[0:2] > "F" + nummer
 */
export function getFieldShortCode(
  field: TournamentField | number | string,
  source?: FieldLookupSource
): string {
  const resolvedField = resolveField(field, source);

  if (resolvedField.shortCode) {
    return resolvedField.shortCode;
  }
  if (resolvedField.customName) {
    return resolvedField.customName.substring(0, 2).toUpperCase();
  }
  // Extrahiere Nummer aus ID oder defaultName
  const num = resolvedField.id.replace('field-', '');
  return `F${num}`;
}

/**
 * Löst eine Feld-Nummer/ID oder TournamentField zu einem vollständigen Objekt auf
 */
function resolveField(
  field: TournamentField | number | string,
  source?: FieldLookupSource
): TournamentField {
  if (typeof field === 'number') {
    const id = `field-${field}`;
    const found = source?.fields?.find(f => f.id === id);
    if (found) {
      return found;
    }
    return { id, defaultName: `Feld ${field}` };
  }

  if (typeof field === 'string') {
    const found = source?.fields?.find(f => f.id === field);
    if (found) {
      return found;
    }
    // Versuche Nummer zu extrahieren
    const num = field.replace('field-', '');
    return { id: field, defaultName: `Feld ${num}` };
  }

  return field;
}

// ============================================================================
// Initialization Helpers
// ============================================================================

/**
 * Erstellt Standard-Gruppen für eine gegebene Anzahl
 * Wird verwendet wenn Tournament.groups nicht definiert ist
 */
export function createDefaultGroups(count: number): TournamentGroup[] {
  return generateGroupLabels(count).map(id => ({
    id,
    // customName und shortCode bleiben undefined (= Standard-Anzeige)
    // allowedFieldIds bleibt undefined (= alle Felder erlaubt)
  }));
}

/**
 * Erstellt Standard-Felder für eine gegebene Anzahl
 * Wird verwendet wenn Tournament.fields nicht definiert ist
 */
export function createDefaultFields(count: number): TournamentField[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `field-${i + 1}`,
    defaultName: `Feld ${i + 1}`,
    // customName und shortCode bleiben undefined
  }));
}

// ============================================================================
// Lookup Helpers
// ============================================================================

/**
 * Findet eine Gruppe anhand ihrer ID im Tournament
 */
export function findGroupById(
  groupId: string,
  tournament: Tournament
): TournamentGroup | undefined {
  return tournament.groups?.find(g => g.id === groupId);
}

/**
 * Findet ein Feld anhand seiner ID oder Nummer im Tournament
 */
export function findFieldById(
  fieldIdOrNumber: string | number,
  tournament: Tournament
): TournamentField | undefined {
  const id = typeof fieldIdOrNumber === 'number'
    ? `field-${fieldIdOrNumber}`
    : fieldIdOrNumber;
  return tournament.fields?.find(f => f.id === id);
}

/**
 * Gibt alle erlaubten Felder für eine Gruppe zurück
 * Wenn allowedFieldIds nicht definiert ist, sind alle Felder erlaubt
 */
export function getAllowedFieldsForGroup(
  group: TournamentGroup,
  allFields: TournamentField[]
): TournamentField[] {
  if (!group.allowedFieldIds || group.allowedFieldIds.length === 0) {
    // Alle Felder erlaubt
    return allFields;
  }
  // allowedFieldIds is guaranteed non-empty at this point due to check above
  return allFields.filter(f => group.allowedFieldIds?.includes(f.id));
}

/**
 * Prüft ob ein Feld für eine Gruppe erlaubt ist
 */
export function isFieldAllowedForGroup(
  fieldId: string,
  group: TournamentGroup
): boolean {
  if (!group.allowedFieldIds || group.allowedFieldIds.length === 0) {
    return true; // Alle Felder erlaubt
  }
  return group.allowedFieldIds.includes(fieldId);
}
