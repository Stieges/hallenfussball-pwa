/**
 * Folge des Zugangsstatus fürs Turnier-Fenster (A-17c): @HE-055 (beide Zeilen), @HE-070, @HE-098, @OB-053.
 * Texte und Kennungen aus dem Record; die Zuordnung Server → Anzeige selbst ist in helperAccessRpc.test getestet.
 */
import { describe, expect, it } from 'vitest';
import type { HelperAccessEntry, HelperAccessStatus } from '../../../core/repositories/helperAccessRpc';
import { isTerminalOutcome, outcomeFromEntry, outcomeFromStatus } from '../helperAccessOutcome';

const CUP = { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' };
const status = (s: Partial<HelperAccessStatus>): HelperAccessStatus => ({ state: 'open', tournament: CUP, ...s });

describe('outcomeFromStatus', () => {
  it('@HE-055 Zeile 1: entzogen → noAccess', () => {
    expect(outcomeFromStatus(status({ relation: 'revoked' }))).toEqual({ kind: 'noAccess' });
  });

  it('@HE-055 Zeile 2: zum Zuschauer gemacht → watchOnly', () => {
    expect(outcomeFromStatus(status({ relation: 'viewer' }))).toEqual({ kind: 'watchOnly' });
  });

  it('@HE-070 / @HE-098 Zeile 2: zugelassen, Turnier abgeschlossen → closed (nicht allowed)', () => {
    expect(outcomeFromStatus(status({ relation: 'accepted', field: 2, closed: true }))).toEqual({ kind: 'closed' });
    expect(outcomeFromStatus({ relation: 'accepted', field: 2, tournament: CUP, state: 'closed' })).toEqual({ kind: 'closed' });
  });

  it('@HE-098 Zeile 3: Code abgelaufen, Turnier läuft → allowed mit Feld 2', () => {
    expect(outcomeFromStatus(status({ relation: 'accepted', field: 2, state: 'expired', closed: false }))).toEqual({ kind: 'allowed', field: 2 });
  });

  it('zugelassen ohne Feldzuteilung → Feld 1', () => {
    expect(outcomeFromStatus(status({ relation: 'accepted', field: null }))).toEqual({ kind: 'allowed', field: 1 });
  });

  it('@OB-053: offene Anfrage → pending mit Prüfzahl, abgelehnt → declined', () => {
    expect(outcomeFromStatus(status({ relation: 'pending', checkNumber: 47 }))).toEqual({ kind: 'pending', checkNumber: 47 });
    expect(outcomeFromStatus(status({ relation: 'declined' }))).toEqual({ kind: 'declined' });
  });

  it('Gegenbeispiel: keine Beziehung / Leitung → none (nichts sperren, eigene Turniere bleiben nutzbar)', () => {
    expect(outcomeFromStatus({ relation: 'none' })).toEqual({ kind: 'none' });
    expect(outcomeFromStatus(status({ relation: 'leader' }))).toEqual({ kind: 'none' });
  });
});

describe('outcomeFromEntry (Wegweiser aus dem Index, ohne Netz)', () => {
  const entry = (o: Partial<HelperAccessEntry>): HelperAccessEntry => ({
    tournamentId: 't-cup', title: 'Live-Cup', date: '2026-11-28', code: 'CODE123456', field: 2, relation: 'accepted',
    closed: false, checkNumber: null, homeHintDismissed: false, offlineReadyAt: null, updatedAt: '2026-11-28T09:00:00Z', ...o,
  });

  it.each([
    [{ relation: 'accepted' as const }, { kind: 'allowed', field: 2 }],
    [{ relation: 'accepted' as const, closed: true }, { kind: 'closed' }],
    [{ relation: 'viewer' as const }, { kind: 'watchOnly' }],
    [{ relation: 'revoked' as const }, { kind: 'noAccess' }],
    [{ relation: 'pending' as const, checkNumber: 47 }, { kind: 'pending', checkNumber: 47 }],
    [{ relation: 'declined' as const }, { kind: 'declined' }],
    [{ relation: 'expired' as const }, { kind: 'expired' }],
  ])('%j → %j', (override, expected) => {
    expect(outcomeFromEntry(entry(override))).toEqual(expected);
  });
});

describe('isTerminalOutcome: die Abfrage hört bei Endzuständen auf (Egress)', () => {
  it('laufende Zustände fragen weiter, Endzustände nicht', () => {
    expect(isTerminalOutcome({ kind: 'allowed', field: 2 })).toBe(false);
    expect(isTerminalOutcome({ kind: 'pending', checkNumber: 47 })).toBe(false);
    expect(isTerminalOutcome({ kind: 'watchOnly' })).toBe(false);
    expect(isTerminalOutcome({ kind: 'noAccess' })).toBe(true);
    expect(isTerminalOutcome({ kind: 'closed' })).toBe(true);
    expect(isTerminalOutcome({ kind: 'declined' })).toBe(true);
  });
});
