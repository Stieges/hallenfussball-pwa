/**
 * `ownFields` meldet jeden gelesenen Steuer-Stand an Beobachter (H3b-3, Befund 6a: der Hallen-Lautsprecher merkt ihn für ein
 * Neuladen ohne Netz, @HT-033 Zeile 11) – auch einen ohne eigenes Feld, und das Leeren beim Abmelden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { FieldControlInfo } from '../../repositories/fieldControlRpc';
import { clearOwnFields, noteFieldControlList, onOwnFieldsNoted, ownFieldsByTournament } from '../ownFields';

const info = (field: number, isMine: boolean): FieldControlInfo => ({
  field, epoch: 1, holderName: null, holderRole: null, holderDeviceLabel: null, isMine, claimedAt: null,
});

afterEach(() => {
  clearOwnFields();
});

describe('onOwnFieldsNoted', () => {
  it('meldet jeden gelesenen Stand mit den eigenen Feldern, auch ohne eigenes Feld, und das Leeren (null)', () => {
    const gesehen: Array<[string | null, readonly number[]]> = [];
    const ab = onOwnFieldsNoted((tid, felder) => { gesehen.push([tid, felder]); });
    noteFieldControlList('hallencup-nord', [info(2, true), info(1, true), info(3, false)]);
    noteFieldControlList('hallencup-nord', [info(1, false)]);
    clearOwnFields();
    ab();
    noteFieldControlList('hallencup-nord', [info(1, true)]);
    expect(gesehen).toEqual([['hallencup-nord', [1, 2]], ['hallencup-nord', []], [null, []]]);
    expect(ownFieldsByTournament()).toEqual({ 'hallencup-nord': [1] });
  });
});
