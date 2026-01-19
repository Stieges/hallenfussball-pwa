/**
 * Tournament Migration Utilities
 *
 * MON-KONF-01: Automatische Migration bestehender Turniere
 * für neue Monitor-Konfigurator Felder.
 *
 * Die Migration ist idempotent - mehrfaches Ausführen erzeugt das gleiche Ergebnis.
 *
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P0-03
 */

import type { Tournament, TournamentField, RuntimeMatchEvent } from '../types/tournament';
import type { Sponsor } from '../types/sponsor';
import type { TournamentMonitor, MonitorTemplate } from '../types/monitor';

// =============================================================================
// MIGRATION VERSION
// =============================================================================

/**
 * Aktuelle Schema-Version für Turniere
 * Wird bei Breaking Changes erhöht
 */
export const CURRENT_SCHEMA_VERSION = 3;

/**
 * Schema-Version-Mapping:
 * - 1: Original-Schema (vor Monitor-Konfigurator)
 * - 2: Monitor-Konfigurator hinzugefügt (monitors[], sponsors[], monitorTemplates[])
 * - 3: Event-Felder Migration (deprecated single -> arrays)
 */

// =============================================================================
// FIELD MIGRATION
// =============================================================================

/**
 * Migriert Felder aus numberOfFields zu strukturiertem fields[]-Array
 *
 * @param tournament - Das zu migrierende Turnier
 * @returns Migriertes fields-Array oder undefined wenn bereits migriert
 */
export function migrateFields(tournament: Tournament): TournamentField[] | undefined {
  // Bereits migriert?
  if (tournament.fields && tournament.fields.length > 0) {
    return undefined; // Keine Migration nötig
  }

   
  const numberOfFields = tournament.numberOfFields ?? 1;
  const fields: TournamentField[] = [];

  for (let i = 1; i <= numberOfFields; i++) {
    fields.push({
      id: `field-${i}`,
      defaultName: `Feld ${i}`,
      // customName wird nicht gesetzt - User kann später anpassen
    });
  }

  return fields;
}

// =============================================================================
// SPONSOR MIGRATION
// =============================================================================

/**
 * Initialisiert leeres Sponsoren-Array wenn nicht vorhanden
 *
 * @param tournament - Das zu migrierende Turnier
 * @returns Leeres Sponsor-Array oder undefined wenn bereits initialisiert
 */
export function migrateSponsors(tournament: Tournament): Sponsor[] | undefined {
  // Bereits initialisiert?
  if (tournament.sponsors !== undefined) {
    return undefined; // Keine Migration nötig
  }

  return []; // Leeres Array initialisieren
}

// =============================================================================
// MONITOR MIGRATION
// =============================================================================

/**
 * Initialisiert leeres Monitor-Array wenn nicht vorhanden
 *
 * @param tournament - Das zu migrierende Turnier
 * @returns Leeres Monitor-Array oder undefined wenn bereits initialisiert
 */
export function migrateMonitors(tournament: Tournament): TournamentMonitor[] | undefined {
  // Bereits initialisiert?
  if (tournament.monitors !== undefined) {
    return undefined; // Keine Migration nötig
  }

  return []; // Leeres Array initialisieren
}

/**
 * Initialisiert leeres MonitorTemplates-Array wenn nicht vorhanden
 *
 * @param tournament - Das zu migrierende Turnier
 * @returns Leeres Template-Array oder undefined wenn bereits initialisiert
 */
export function migrateMonitorTemplates(tournament: Tournament): MonitorTemplate[] | undefined {
  // Bereits initialisiert?
  if (tournament.monitorTemplates !== undefined) {
    return undefined; // Keine Migration nötig
  }

  return []; // Leeres Array initialisieren
}

// =============================================================================
// EVENT MIGRATION (Schema v3)
// =============================================================================

/**
 * Payload-Typ mit legacy-Feldern für Migration
 * Diese Felder existieren möglicherweise in alten Daten
 */
interface LegacyEventPayload {
  assistPlayerNumber?: number;
  playerOutNumber?: number;
  playerInNumber?: number;
  assists?: number[];
  playersOut?: number[];
  playersIn?: number[];
  [key: string]: unknown;
}

/**
 * Migriert ein einzelnes Event von deprecated single-value zu array Format
 * Idempotent - kann mehrfach ausgeführt werden
 */
function migrateEventPayload(payload: LegacyEventPayload): LegacyEventPayload {
  const migrated = { ...payload };

  // assistPlayerNumber -> assists
  if ('assistPlayerNumber' in payload && payload.assistPlayerNumber !== undefined) {
    migrated.assists = migrated.assists ?? [payload.assistPlayerNumber];
    delete migrated.assistPlayerNumber;
  }

  // playerOutNumber -> playersOut
  if ('playerOutNumber' in payload && payload.playerOutNumber !== undefined) {
    migrated.playersOut = migrated.playersOut ?? [payload.playerOutNumber];
    delete migrated.playerOutNumber;
  }

  // playerInNumber -> playersIn
  if ('playerInNumber' in payload && payload.playerInNumber !== undefined) {
    migrated.playersIn = migrated.playersIn ?? [payload.playerInNumber];
    delete migrated.playerInNumber;
  }

  return migrated;
}

/**
 * Migriert alle Events eines Arrays von deprecated zu neuen Feldern
 * Gibt undefined zurück wenn keine Migration nötig war
 */
export function migrateMatchEvents(events: RuntimeMatchEvent[]): RuntimeMatchEvent[] | undefined {
  let anyMigrated = false;

  const migratedEvents = events.map((event) => {
    // Runtime safety: payload might be missing in corrupted/legacy data
     
    if (!event.payload) {return event;}

    const legacyPayload = event.payload as LegacyEventPayload;
    const hasDeprecated =
      'assistPlayerNumber' in legacyPayload ||
      'playerOutNumber' in legacyPayload ||
      'playerInNumber' in legacyPayload;

    if (!hasDeprecated) {return event;}

    anyMigrated = true;
    return {
      ...event,
      payload: migrateEventPayload(legacyPayload) as RuntimeMatchEvent['payload'],
    };
  });

   
  return anyMigrated ? migratedEvents : undefined;
}

// =============================================================================
// COMPLETE MIGRATION
// =============================================================================

/**
 * Ergebnis einer Turnier-Migration
 */
export interface MigrationResult {
  /** Wurde das Turnier modifiziert? */
  modified: boolean;
  /** Das (ggf. migrierte) Turnier */
  tournament: Tournament;
  /** Welche Migrationen wurden durchgeführt? */
  migrations: string[];
}

/**
 * Führt alle notwendigen Migrationen für ein Turnier durch
 *
 * Diese Funktion ist idempotent - mehrfaches Ausführen erzeugt das gleiche Ergebnis.
 *
 * @param tournament - Das zu migrierende Turnier
 * @returns Migration-Ergebnis mit modifiziertem Turnier
 */
export function migrateTournament(tournament: Tournament): MigrationResult {
  const migrations: string[] = [];
  let modified = false;

  // Shallow copy um Original nicht zu mutieren
  const migrated = { ...tournament };

  // 1. Fields Migration
  const migratedFields = migrateFields(tournament);
  if (migratedFields !== undefined) {
    migrated.fields = migratedFields;
    migrations.push('fields');
    modified = true;
  }

  // 2. Sponsors Migration
  const migratedSponsors = migrateSponsors(tournament);
  if (migratedSponsors !== undefined) {
    migrated.sponsors = migratedSponsors;
    migrations.push('sponsors');
    modified = true;
  }

  // 3. Monitors Migration
  const migratedMonitors = migrateMonitors(tournament);
  if (migratedMonitors !== undefined) {
    migrated.monitors = migratedMonitors;
    migrations.push('monitors');
    modified = true;
  }

  // 4. MonitorTemplates Migration
  const migratedTemplates = migrateMonitorTemplates(tournament);
  if (migratedTemplates !== undefined) {
    migrated.monitorTemplates = migratedTemplates;
    migrations.push('monitorTemplates');
    modified = true;
  }

  return {
    modified,
    tournament: migrated,
    migrations,
  };
}

/**
 * Batch-Migration für mehrere Turniere
 *
 * @param tournaments - Array von Turnieren
 * @returns Array von Migration-Ergebnissen
 */
export function migrateTournaments(tournaments: Tournament[]): MigrationResult[] {
  return tournaments.map(migrateTournament);
}

/**
 * Prüft ob ein Turnier Migration benötigt
 *
 * @param tournament - Das zu prüfende Turnier
 * @returns true wenn Migration nötig
 */
export function needsMigration(tournament: Tournament): boolean {
  // Prüfe ob eines der neuen Felder nicht initialisiert ist
  return (
    tournament.fields === undefined ||
    tournament.sponsors === undefined ||
    tournament.monitors === undefined ||
    tournament.monitorTemplates === undefined
  );
}
