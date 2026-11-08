/**
 * `ownFields` hält je Turnier die Felder, die dieses Gerät steuert – das Lebenszeichen der Leitung braucht ihn (H3b-3,
 * @HT-035). Den Beobachter für den Hallen-Lautsprecher (Befund 6a) gibt es seit H3b-4 nicht mehr: unter Regel 2 zählt für den
 * Lautsprecher nicht, wer das Feld leitet.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { FieldControlInfo } from '../../repositories/fieldControlRpc';
import { clearOwnFields, noteFieldControlList, ownFieldsByTournament } from '../ownFields';

const info = (field: number, isMine: boolean): FieldControlInfo => ({
  field, epoch: 1, holderName: null, holderRole: null, holderDeviceLabel: null, isMine, claimedAt: null,
});

afterEach(() => {
  clearOwnFields();
});

describe('ownFieldsByTournament', () => {
  it('hält nur die eigenen Felder sortiert; ein Stand ohne eigenes Feld nimmt das Turnier heraus; Abmelden leert alles', () => {
    noteFieldControlList('hallencup-nord', [info(2, true), info(1, true), info(3, false)]);
    noteFieldControlList('hallencup-sued', [info(1, true)]);
    expect(ownFieldsByTournament()).toEqual({ 'hallencup-nord': [1, 2], 'hallencup-sued': [1] });
    noteFieldControlList('hallencup-sued', [info(1, false)]);
    expect(ownFieldsByTournament()).toEqual({ 'hallencup-nord': [1, 2] });
    clearOwnFields();
    expect(ownFieldsByTournament()).toEqual({});
  });
});
