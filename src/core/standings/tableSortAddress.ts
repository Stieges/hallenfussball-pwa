/**
 * Sortierung in der Adresse: ein Parameter `ts`, Einträge `<tabelle>.<spalte>[.r]`, durch `,` getrennt,
 * z. B. `?ts=gA.tore,gB.pkt.r` (@TS-010). `.r` = umgekehrt. Fehlender Eintrag = Platzierung.
 * Rein, ohne React und ohne react-router: Lesen/Schreiben der Adresse macht der Aufrufer.
 *
 * Tabellen-Schlüssel: `g<Gruppen-ID>` (ohne Gruppen: `g`), `gesamt`, `end`, `tor`. Gruppen-IDs mit `.`, `,` oder `%`
 * stehen per encodeURIComponent (und `.` → `%2E`) im Schlüssel, damit sie die Trennzeichen nicht stören.
 *
 * Wichtig für die Vorrang-Regel (@TS-020): „kein Parameter“ und „leerer Parameter“ sind verschieden.
 *  - `decodeSortParam(null)` = die Adresse sagt nichts → Gerätevorlieben dürfen greifen.
 *  - `decodeSortParam('')`   = leere Map → die Adresse sagt „alles Platzierung“, Gerätevorlieben gelten nicht.
 *  - `encodeSortParam(leere Map)` = `''` (der Parameter bleibt als `ts=` stehen), nie `null`.
 */
import { parseSortToken, sortToken, type SortState, type TableKind } from './tableSort';

export const SORT_PARAM = 'ts';

export function tableKey(kind: TableKind, groupId?: string): string {
  if (kind !== 'gruppe') {return kind;}
  return `g${encodeURIComponent(groupId ?? '').replace(/\./g, '%2E')}`;
}

function isKnownKey(key: string): boolean {
  return key === 'gesamt' || key === 'end' || key === 'tor' || key.startsWith('g');
}

export function decodeSortParam(raw: string | null): Map<string, SortState> | null {
  if (raw === null) {return null;}
  const result = new Map<string, SortState>();
  for (const entry of raw.split(',')) {
    const dot = entry.indexOf('.');
    if (dot <= 0) {continue;}
    const key = entry.slice(0, dot);
    if (!isKnownKey(key)) {continue;}
    const state = parseSortToken(entry.slice(dot + 1));
    if (state) {result.set(key, state);}
  }
  return result;
}

export function encodeSortParam(map: ReadonlyMap<string, SortState>): string {
  const parts: string[] = [];
  for (const [key, state] of map) {
    if (state) {parts.push(`${key}.${sortToken(state)}`);}
  }
  return parts.join(',');
}
