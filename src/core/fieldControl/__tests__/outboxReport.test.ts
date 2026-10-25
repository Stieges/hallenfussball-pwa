/**
 * R3-2a Geräte-Meldung (Plan F3, Befund C-GERAET-STILL-OHNE-MELDUNG): Welche Meldungen `report_device_outbox` ein Gerät bei einem
 * Takt (30 s) schickt. Der Server baut daraus die Warnungen vor dem Abschluss (`finish_warnings`, 20261113_003):
 * `outbox_pending` (Zahl > 0 der letzten Meldung) und `device_silent` (steuerndes Gerät, letzte Meldung älter als 2 Minuten).
 *
 * Szenarien:
 * - @LZ-018 / @FU-068: Claras (Toms) Gerät an Feld 2 hat 3 Einträge noch nicht übertragen → die Liste warnt „Feld 2: 3 Einträge
 *   noch nicht übertragen“ → das Gerät meldet Feld 2 und 3, solange es wartet (jeder Takt, damit die Zahl frisch ist).
 * - Plan-Pflichttest „Gerät meldet 0 → keine Warnung ‚still‘“: ein steuerndes Gerät meldet auch 0 jeden Takt.
 * Gegenbeispiel (Plan): 0 wartend und keine Änderung → keine Meldung (Gerät ohne Feld).
 */
import { describe, expect, it } from 'vitest';
import { dueOutboxReports, type OutboxReport } from '../outboxReport';

const leer = { pendingByTournament: {}, ownFieldsByTournament: {}, lastSent: {} };

describe('R3-2a dueOutboxReports (@LZ-018, @FU-068)', () => {
  it('@LZ-018 Claras Gerät an Feld 2 mit 3 wartenden Einträgen: meldet Feld 2 und 3', () => {
    expect(dueOutboxReports({ ...leer, pendingByTournament: { 'live-cup': 3 }, ownFieldsByTournament: { 'live-cup': [2] } }))
      .toEqual([{ tournamentId: 'live-cup', field: 2, pending: 3 }]);
  });

  it('@FU-068 Zahl > 0 wird jeden Takt gemeldet, auch unverändert (die Warnung zeigt den Stand der letzten Meldung)', () => {
    const lastSent: Record<string, OutboxReport> = { 'live-cup': { tournamentId: 'live-cup', field: 2, pending: 3 } };
    expect(dueOutboxReports({ ...leer, pendingByTournament: { 'live-cup': 3 }, ownFieldsByTournament: { 'live-cup': [2] }, lastSent }))
      .toEqual([{ tournamentId: 'live-cup', field: 2, pending: 3 }]);
  });

  it('@LZ-018 auch ohne gesteuertes Feld (Feld unbekannt): meldet die Zahl ohne Feld', () => {
    expect(dueOutboxReports({ ...leer, pendingByTournament: { 'live-cup': 3 } })).toEqual([{ tournamentId: 'live-cup', field: null, pending: 3 }]);
  });

  it('Pflichttest „Gerät meldet 0 → keine Warnung still“: das steuernde Gerät meldet 0 jeden Takt', () => {
    const lastSent: Record<string, OutboxReport> = { 'live-cup': { tournamentId: 'live-cup', field: 2, pending: 0 } };
    expect(dueOutboxReports({ ...leer, ownFieldsByTournament: { 'live-cup': [2] }, lastSent }))
      .toEqual([{ tournamentId: 'live-cup', field: 2, pending: 0 }]);
  });

  it('@FU-068 von 3 auf 0 (alles übertragen): einmal 0 melden, danach Ruhe', () => {
    const first = dueOutboxReports({ ...leer, lastSent: { 'live-cup': { tournamentId: 'live-cup', field: null, pending: 3 } } });
    expect(first).toEqual([{ tournamentId: 'live-cup', field: null, pending: 0 }]);
    expect(dueOutboxReports({ ...leer, lastSent: { 'live-cup': first[0] } })).toEqual([]);
  });

  it('Gegenbeispiel: 0 wartend, kein Feld, nie gemeldet → keine Meldung', () => {
    expect(dueOutboxReports({ ...leer, pendingByTournament: { 'live-cup': 0 } })).toEqual([]);
  });

  it('mehrere Felder: das niedrigste gesteuerte Feld; Kopien ohne Turnier (Schlüssel „“) melden nichts', () => {
    expect(dueOutboxReports({ ...leer, pendingByTournament: { 'live-cup': 1, '': 4 }, ownFieldsByTournament: { 'live-cup': [3, 1] } }))
      .toEqual([{ tournamentId: 'live-cup', field: 1, pending: 1 }]);
  });

  it('Feldwechsel bei 0 wartend: die Änderung wird gemeldet', () => {
    const lastSent: Record<string, OutboxReport> = { 'live-cup': { tournamentId: 'live-cup', field: 2, pending: 0 } };
    expect(dueOutboxReports({ ...leer, lastSent })).toEqual([{ tournamentId: 'live-cup', field: null, pending: 0 }]);
  });
});
