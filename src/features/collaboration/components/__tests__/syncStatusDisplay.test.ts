/**
 * A-06i (Brief A10): Ableitung des Wartegrundes fuer die Sync-Anzeige.
 * Reihenfolge der Regeln ist Teil des Vertrags (siehe deriveWaitReason).
 */
import { describe, it, expect } from 'vitest';
import { deriveWaitReason } from '../syncStatusDisplay';

describe('deriveWaitReason: Geraetespeicher voll (A-07i, @FU-004)', () => {
  it('queueFailure storage bei wartenden Eintraegen -> storageFull', () => {
    expect(deriveWaitReason({ pendingCount: 1, status: 'synced', outboxKind: null, queueFailure: 'storage' })).toBe('storageFull');
  });

  it('storageFull gewinnt vor offline (Verlust auf dem Geraet ist wichtiger als der Netzstatus)', () => {
    expect(deriveWaitReason({ pendingCount: 2, status: 'offline', outboxKind: 'transient', queueFailure: 'storage' })).toBe('storageFull');
  });

  it('queueFailure storageBlocked -> storageBlocked (eigener Wartegrund, A-07i 1b)', () => {
    expect(deriveWaitReason({ pendingCount: 1, status: 'synced', outboxKind: null, queueFailure: 'storageBlocked' })).toBe('storageBlocked');
  });

  it('ohne wartende Eintraege bleibt es bei null', () => {
    expect(deriveWaitReason({ pendingCount: 0, status: 'synced', outboxKind: null, queueFailure: 'storage' })).toBeNull();
  });
});

describe('deriveWaitReason (A-06i)', () => {
  it('liefert null ohne wartende Eintraege, auch bei transientem Fehler', () => {
    expect(deriveWaitReason({ pendingCount: 0, status: 'synced', outboxKind: 'transient', queueFailure: 'transient' })).toBeNull();
    expect(deriveWaitReason({ pendingCount: 0, status: 'offline', outboxKind: null, queueFailure: null })).toBeNull();
  });

  it('liefert null bei wartenden Eintraegen ohne Problem', () => {
    expect(deriveWaitReason({ pendingCount: 2, status: 'synced', outboxKind: null, queueFailure: null })).toBeNull();
    expect(deriveWaitReason({ pendingCount: 2, status: 'updated', outboxKind: null, queueFailure: undefined })).toBeNull();
  });

  it('status offline mit wartenden Eintraegen -> noInternet', () => {
    expect(deriveWaitReason({ pendingCount: 3, status: 'offline', outboxKind: null, queueFailure: null })).toBe('noInternet');
  });

  it('outboxKind transient -> noInternet', () => {
    expect(deriveWaitReason({ pendingCount: 1, status: 'synced', outboxKind: 'transient', queueFailure: null })).toBe('noInternet');
  });

  it('queueFailure transient -> noInternet', () => {
    expect(deriveWaitReason({ pendingCount: 1, status: 'synced', outboxKind: null, queueFailure: 'transient' })).toBe('noInternet');
  });

  it('outboxKind permanent -> disturbed', () => {
    expect(deriveWaitReason({ pendingCount: 1, status: 'synced', outboxKind: 'permanent', queueFailure: null })).toBe('disturbed');
  });

  it('queueFailure permanent -> disturbed (ab dem ersten abgelehnten Versuch, Entscheidung 2026-10-10)', () => {
    expect(deriveWaitReason({ pendingCount: 1, status: 'synced', outboxKind: null, queueFailure: 'permanent' })).toBe('disturbed');
  });

  it('gemischt: outboxKind transient + queueFailure permanent -> noInternet', () => {
    expect(deriveWaitReason({ pendingCount: 2, status: 'synced', outboxKind: 'transient', queueFailure: 'permanent' })).toBe('noInternet');
  });

  it('gemischt: outboxKind permanent + queueFailure transient -> noInternet', () => {
    expect(deriveWaitReason({ pendingCount: 2, status: 'synced', outboxKind: 'permanent', queueFailure: 'transient' })).toBe('noInternet');
  });

  it('Regelreihenfolge: offline gewinnt vor permanentem Fehler', () => {
    expect(deriveWaitReason({ pendingCount: 1, status: 'offline', outboxKind: 'permanent', queueFailure: 'permanent' })).toBe('noInternet');
  });
});
