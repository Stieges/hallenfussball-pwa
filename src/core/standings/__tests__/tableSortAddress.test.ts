/**
 * Task 2 „Tabellen sortieren“: Sortierung in der Adresse (`?ts=…`), Record `2026-11-25_tabellen-sortieren`.
 */
import { describe, expect, it } from 'vitest';
import { decodeSortParam, encodeSortParam, SORT_PARAM, tableKey } from '../tableSortAddress';
import type { SortState } from '../tableSort';

/** `decodeSortParam` liefert bei gesetztem Parameter immer eine Map. */
function decoded(raw: string | null): Map<string, SortState> {
  const map = decodeSortParam(raw);
  if (!map) {throw new Error('Parameter fehlt');}
  return map;
}

const st = (column: 'pkt' | 'team' | 'tore', reversed = false): SortState => ({ column, reversed });

describe('Adresse der Sortierung', () => {
  it('@TS-010 Parametername und Tabellen-Schlüssel', () => {
    expect(SORT_PARAM).toBe('ts');
    expect(tableKey('gruppe', 'A')).toBe('gA');
    expect(tableKey('gruppe')).toBe('g');
    expect(tableKey('gesamt')).toBe('gesamt');
    expect(tableKey('end')).toBe('end');
    expect(tableKey('tor')).toBe('tor');
  });

  it('@TS-010 Rundlauf encode/decode, Format <tabelle>.<spalte>[.r]', () => {
    const map = new Map<string, SortState>([['gA', st('tore')], ['gB', st('pkt', true)]]);
    const raw = encodeSortParam(map);
    expect(raw).toBe('gA.tore,gB.pkt.r');
    expect(decoded(raw)).toEqual(map);
  });

  it('@TS-010 Gruppen-ID mit Punkt und Komma übersteht encode/decode', () => {
    const key = tableKey('gruppe', 'A.1,x');
    const raw = encodeSortParam(new Map([[key, st('team')]]));
    expect(raw.split(',')).toHaveLength(1);
    expect(decoded(raw).get(key)).toEqual(st('team'));
  });

  it('@TS-010 unbekannte Spalte oder Tabelle: Eintrag fehlt, Rest bleibt', () => {
    const map = decoded('gA.quatsch,xyz.pkt,gB.pkt.r,gesamt.tore.x,end');
    expect([...map.keys()]).toEqual(['gB']);
    expect(map.get('gB')).toEqual(st('pkt', true));
  });

  it('@TS-010 „platz“ und leere Einträge werden nicht gespeichert', () => {
    expect(decoded('gA.platz,,tor.tore').size).toBe(1);
    expect(encodeSortParam(new Map([['gA', null]]))).toBe('');
  });

  it('@TS-020 kein Parameter (null) ist etwas anderes als leerer Parameter („“)', () => {
    // null = Adresse sagt nichts → Gerätevorlieben dürfen greifen; '' = Adresse sagt „alles Platzierung“.
    expect(decodeSortParam(null)).toBeNull();
    expect(decoded('')).toEqual(new Map());
    expect(encodeSortParam(new Map())).toBe('');
  });
});
