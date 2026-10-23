/**
 * B-49: Steuer je Feld aus Sicht dieses Geräts (rein). Werte aus dem Gherkin: Toms Handy steuert Feld 2 (@FU-026, @FU-030),
 * Tom hat auch ein Tablet (@HE-049 Gegenbeispiel), Feld frei vor dem ersten Anpfiff (@FU-030).
 */
import { describe, expect, it } from 'vitest';
import type { FieldControlInfo } from '../../repositories/fieldControlRpc';
import { fieldControlView, mayControlField, ownFieldsWithoutLabel } from '../fieldControlView';

const info = (over: Partial<FieldControlInfo>): FieldControlInfo => ({
  field: 2, epoch: 1, holderName: 'Tom', holderRole: 'helper', holderDeviceLabel: 'phone', isMine: false, claimedAt: 1_790_000_000_000, ...over,
});

describe('fieldControlView (B-49)', () => {
  it('@FU-026 ein anderes Gerät steuert Feld 2 → fremd, dieses Gerät darf nicht eintragen', () => {
    const view = fieldControlView([info({})], 2);
    expect(view.kind).toBe('foreign');
    expect(mayControlField(view)).toBe(false);
  });

  it('@FU-026 Gegenbeispiel: Toms Handy selbst (isMine) → steuert, darf eintragen', () => {
    const view = fieldControlView([info({ isMine: true })], 2);
    expect(view.kind).toBe('mine');
    expect(mayControlField(view)).toBe(true);
  });

  it('@HE-049 Gegenbeispiel: Toms Tablet (gleiches Konto, anderes Gerät, isMine false) ist fremd', () => {
    expect(fieldControlView([info({ holderName: 'Tom', isMine: false })], 2).kind).toBe('foreign');
  });

  it('@FU-030 freies Feld (nie gesteuert oder ohne Halter) → frei mit Epoche, Anpfiff erlaubt', () => {
    expect(fieldControlView([], 2)).toEqual({ kind: 'free', epoch: 0 });
    const frei = fieldControlView([info({ epoch: 4, holderName: null, holderRole: null, holderDeviceLabel: null, claimedAt: null })], 2);
    expect(frei).toEqual({ kind: 'free', epoch: 4 });
    expect(mayControlField(frei)).toBe(true);
  });

  it('Halter ohne Namen und Rolle (Mitglied entfernt) gilt trotzdem als fremd (claimedAt gesetzt)', () => {
    expect(fieldControlView([info({ holderName: null, holderRole: null })], 2).kind).toBe('foreign');
  });

  it('ein anderes Feld zählt nicht: Feld 1 ist frei, wenn nur Feld 2 gesteuert wird', () => {
    expect(fieldControlView([info({})], 1).kind).toBe('free');
  });

  it('unbekannt (Gast, noch nicht gelesen) → nichts gesperrt, der Server entscheidet', () => {
    const view = fieldControlView(null, 2);
    expect(view.kind).toBe('unknown');
    expect(mayControlField(view)).toBe(true);
  });

  it('@HE-049 eigene Felder ohne Gerätebezeichnung (Anspruch per Anpfiff) werden zum Nachtragen gefunden', () => {
    const ohne = info({ field: 1, isMine: true, holderDeviceLabel: null });
    expect(ownFieldsWithoutLabel([ohne, info({ isMine: true }), info({ field: 3, holderDeviceLabel: null })])).toEqual([ohne]);
    expect(ownFieldsWithoutLabel(null)).toEqual([]);
  });
});
