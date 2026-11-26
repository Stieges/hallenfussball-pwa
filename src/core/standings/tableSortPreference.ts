/**
 * Gerätevorliebe der Sortierung (@TS-011): je Tabellenart ein Wert, nur auf diesem Gerät, kein Konto, keine Cloud.
 * `localStorage['hallenfussball.tabellenSortierung']` = JSON `{ gruppe?, gesamt?, end?, tor? }`,
 * Wert = Spalten kurz (`pkt`, `pkt.r`) oder `"platz"` (= Platzierung bewusst gemerkt).
 * Jeder Zugriff in try/catch: fehlt der Speicher oder wirft er, gilt „nichts gemerkt“.
 */
import { parseSortToken, sortToken, type SortState, type TableKind } from './tableSort';

const KEY = 'hallenfussball.tabellenSortierung';
const PLATZ = 'platz';

export interface SortPreferenceStore {
  /** `undefined` = nichts gemerkt, `null` = Platzierung gemerkt. */
  read(kind: TableKind): SortState | undefined;
  write(kind: TableKind, state: SortState): void;
}

function readAll(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export const deviceSortPreferences: SortPreferenceStore = {
  read(kind) {
    const value = readAll()[kind];
    if (typeof value !== 'string') {return undefined;}
    if (value === PLATZ) {return null;}
    return parseSortToken(value) ?? undefined;
  },
  write(kind, state) {
    try {
      const all = readAll();
      all[kind] = state ? sortToken(state) : PLATZ;
      window.localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      // Speicher gesperrt oder voll: die Vorliebe entfällt, mehr nicht.
    }
  },
};
