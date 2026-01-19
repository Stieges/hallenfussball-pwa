/**
 * useFields Hook - Felder-Verwaltung
 *
 * MON-KONF-01: Strukturierte Feldkonfiguration
 *
 * Felder werden im Tournament-Objekt gespeichert.
 * In Monitor-Slides wird die fieldId referenziert.
 *
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P1-02
 */

import { useCallback, useMemo } from 'react';
import type { Tournament, TournamentField } from '../types/tournament';

// =============================================================================
// TYPES
// =============================================================================

export interface UseFieldsResult {
  /** Alle Felder des Turniers */
  fields: TournamentField[];

  /** Feld nach ID finden */
  getFieldById: (id: string) => TournamentField | undefined;

  /** Anzeigename eines Feldes (customName oder defaultName) */
  getFieldDisplayName: (id: string) => string;

  /** Kurzcode eines Feldes (shortCode, customName Initialen, oder Nummer) */
  getFieldShortCode: (id: string) => string;

  /** Feld aktualisieren (customName, shortCode) */
  updateField: (id: string, updates: Partial<Pick<TournamentField, 'customName' | 'shortCode'>>) => Promise<TournamentField | undefined>;

  /** Prüft ob Feld in Monitor-Slides verwendet wird */
  isFieldUsedInSlides: (id: string) => boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Findet alle Slides die ein bestimmtes Feld referenzieren
 */
function findSlidesUsingField(tournament: Tournament, fieldId: string): number {
  let count = 0;

  const monitors = tournament.monitors ?? [];
  for (const monitor of monitors) {
    for (const slide of monitor.slides) {
      if (
        (slide.type === 'live' || slide.type === 'schedule-field') &&
        slide.config.fieldId === fieldId
      ) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Generiert Default-Kurzcode aus einem Namen
 */
function generateShortCode(name: string): string {
  // Nimm die ersten 2 Buchstaben des Namens
  const cleaned = name.replace(/[^a-zA-ZäöüÄÖÜß]/g, '').toUpperCase();
  return cleaned.substring(0, 2) || 'F1';
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook für Felder-Verwaltung
 *
 * @param tournament - Das aktuelle Turnier
 * @param saveTournament - Callback zum Speichern des Turniers
 * @returns Felder-API
 *
 * @example
 * const { fields, updateField, getFieldDisplayName } = useFields(tournament, saveTournament);
 */
export function useFields(
  tournament: Tournament | null | undefined,
  saveTournament: (tournament: Tournament) => Promise<void>
): UseFieldsResult {
  // Fields aus Tournament (oder leeres Array)
  const fields = useMemo(
    () => tournament?.fields ?? [],
    [tournament?.fields]
  );

  // Feld nach ID finden
  const getFieldById = useCallback(
    (id: string) => fields.find(f => f.id === id),
    [fields]
  );

  // Anzeigename: customName > defaultName
  const getFieldDisplayName = useCallback(
    (id: string): string => {
      const field = fields.find(f => f.id === id);
      if (!field) {return `Feld ${id}`;}
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty customName should use default
      return field.customName || field.defaultName;
    },
    [fields]
  );

  // Kurzcode: shortCode > customName Initialen > Nummer
  const getFieldShortCode = useCallback(
    (id: string): string => {
      const field = fields.find(f => f.id === id);
      if (!field) {return id.replace('field-', 'F');}

      if (field.shortCode) {return field.shortCode;}
      if (field.customName) {return generateShortCode(field.customName);}

      // Fallback: "F1", "F2", etc.
      const num = id.replace('field-', '');
      return `F${num}`;
    },
    [fields]
  );

  // Prüft ob Feld in Slides verwendet wird
  const isFieldUsedInSlides = useCallback(
    (id: string) => {
      if (!tournament) {return false;}
      return findSlidesUsingField(tournament, id) > 0;
    },
    [tournament]
  );

  // Feld aktualisieren
  const updateField = useCallback(
    async (
      id: string,
      updates: Partial<Pick<TournamentField, 'customName' | 'shortCode'>>
    ): Promise<TournamentField | undefined> => {
      if (!tournament) {
        throw new Error('Kein Turnier ausgewählt');
      }

      const existingField = fields.find(f => f.id === id);
      if (!existingField) {
        console.warn(`Feld mit ID ${id} nicht gefunden`);
        return undefined;
      }

      const updatedField: TournamentField = {
        ...existingField,
        customName: updates.customName !== undefined
          ? (updates.customName.trim() || undefined)
          : existingField.customName,
        shortCode: updates.shortCode !== undefined
          ? (updates.shortCode.trim().toUpperCase().substring(0, 3) || undefined)
          : existingField.shortCode,
      };

      const updatedFields = fields.map(f =>
        f.id === id ? updatedField : f
      );

      const now = new Date().toISOString();
      const updatedTournament: Tournament = {
        ...tournament,
        fields: updatedFields,
        updatedAt: now,
      };

      await saveTournament(updatedTournament);
      return updatedField;
    },
    [tournament, fields, saveTournament]
  );

  return {
    fields,
    getFieldById,
    getFieldDisplayName,
    getFieldShortCode,
    updateField,
    isFieldUsedInSlides,
  };
}

export default useFields;
