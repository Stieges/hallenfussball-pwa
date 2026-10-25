/**
 * Geräte-Meldung wartender Einträge (R3-2a, Plan F3; Befund C-GERAET-STILL-OHNE-MELDUNG; @LZ-018, @FU-068), rein, ohne React.
 *
 * Der Server warnt vor dem Abschluss aus der jeweils letzten Meldung eines Geräts (`finish_warnings`, 20261113_003):
 * - `outbox_pending`: die gemeldete Zahl ist > 0 („Feld 2: 3 Einträge noch nicht übertragen“);
 * - `device_silent`: ein Gerät steuert ein Feld und hat sich seit mehr als 2 Minuten nicht gemeldet.
 *
 * Regel je Turnier und Takt (30 s): melden, wenn Einträge warten (jeden Takt – die Zahl bleibt frisch), wenn dieses Gerät ein Feld
 * steuert (auch 0 – sonst gälte es nach 2 Minuten als still) oder wenn sich Zahl oder Feld seit der letzten Meldung geändert haben
 * (z. B. von 3 auf 0). Sonst nichts. Feld = das niedrigste Feld, das dieses Gerät steuert, sonst unbekannt (`null`).
 * Kopien ohne Turnier (Schlüssel '') melden nichts.
 */

export interface OutboxReport {
  tournamentId: string;
  field: number | null;
  pending: number;
}

export interface OutboxReportInput {
  /** Wartende Einträge je Turnier (Status des Ausgangs, `pendingByTournament`). */
  pendingByTournament: Readonly<Record<string, number>>;
  /** Felder, die dieses Gerät je Turnier steuert (zuletzt gelesener Stand von `field_control_state`). */
  ownFieldsByTournament: Readonly<Record<string, readonly number[]>>;
  /** Zuletzt erfolgreich gemeldet, je Turnier. */
  lastSent: Readonly<Record<string, OutboxReport>>;
}

function lowestField(fields: readonly number[] | undefined): number | null {
  return fields !== undefined && fields.length > 0 ? Math.min(...fields) : null;
}

/** Meldungen, die bei diesem Takt fällig sind. */
export function dueOutboxReports(input: OutboxReportInput): OutboxReport[] {
  const tournaments = new Set([
    ...Object.keys(input.pendingByTournament),
    ...Object.keys(input.ownFieldsByTournament),
    ...Object.keys(input.lastSent),
  ]);
  tournaments.delete('');
  const due: OutboxReport[] = [];
  for (const tournamentId of [...tournaments].sort()) {
    const pending = input.pendingByTournament[tournamentId] ?? 0;
    const field = lowestField(input.ownFieldsByTournament[tournamentId]);
    const last = input.lastSent[tournamentId] as OutboxReport | undefined;
    const changed = last !== undefined && (last.pending !== pending || last.field !== field);
    if (pending > 0 || field !== null || changed) {
      due.push({ tournamentId, field, pending });
    }
  }
  return due;
}
