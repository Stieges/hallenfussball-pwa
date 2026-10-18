/**
 * A-10 Teil C (brief-A-10.md § 10 „Lesen change_revision“): Spalte fehlt oder NULL → 0, kein Fehler; Wert → Wert.
 * Die App muss vor und nach dem Einspielen von 20261028_005 laufen (@TM-027, @FU-089).
 */
import { describe, it, expect } from 'vitest';
import { changeRevisionFromRow } from '../tournamentChangeRevisionRow';

describe('A-10 changeRevisionFromRow', () => {
  it('Spalte vorhanden → Wert der Cloud', () => {
    expect(changeRevisionFromRow({ id: 'T', change_revision: 3 })).toEqual({ changeRevision: 3 });
  });
  it('Gegenbeispiel: Spalte fehlt (DB vor F2b) → 0', () => {
    expect(changeRevisionFromRow({ id: 'T' })).toEqual({ changeRevision: 0 });
  });
  it('Gegenbeispiel: NULL oder kein Zahlwert → 0', () => {
    expect(changeRevisionFromRow({ change_revision: null })).toEqual({ changeRevision: 0 });
    expect(changeRevisionFromRow({ change_revision: '7' })).toEqual({ changeRevision: 0 });
  });
});
