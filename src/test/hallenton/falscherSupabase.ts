/**
 * Test-Hilfe Hallenton (H3b-2a): Supabase-Doppel für den Feldstand. Kennt nur die Ketten, die der Feldstand nutzt
 * (`from(…).select(…).eq/in/not/is/gt/order/limit/abortSignal/maybeSingle` und `rpc('is_real_account')`), wendet die
 * Filter wirklich auf die Tabellen an und zählt jede Abfrage. `netz` steuert das Netz: `ok`, `fehler` (Abfrage scheitert)
 * oder `haengt` (Antwort kommt nie, nur der Abbruch beendet sie).
 */
import type { FeldStandClient } from '../../features/hallenton/runtime/feldStandAbfragen';

type Zeile = Record<string, unknown>;
type Filter = (zeile: Zeile) => boolean;

export interface Abfrage {
  tabelle: string;
  spalten: string;
  filter: string[];
  /** Ob der Aufrufer ein Abbruchsignal übergab. */
  mitSignal: boolean;
}

export class FalscherSupabase {
  tabellen: Record<string, Zeile[]> = { tournaments: [], matches: [], match_events: [] };
  echtesKonto = true;
  netz: 'ok' | 'fehler' | 'haengt' = 'ok';
  /** Fehlercode für die nächsten Abfragen (z. B. '55000'), solange gesetzt. */
  fehlerCode: string | null = null;
  /** Tabellen, deren Abfragen scheitern, während das Netz sonst geht (z. B. nur `match_events`). */
  readonly tabellenFehler = new Set<string>();
  /** Funktionen, deren Antwort nie kommt (H3b-3 Fixrunde 1: z. B. `hall_speaker_release` im schwachen WLAN). */
  readonly haengendeRpcs = new Set<string>();
  readonly abfragen: Abfrage[] = [];
  rpcAufrufe = 0;
  /** Öffentliche Adressen im Speicher (H3c: Torhymnen, eigener Ton), wie `storage.from(bucket).getPublicUrl(pfad)`. */
  readonly storage = {
    from: (bucket: string) => ({ getPublicUrl: (pfad: string) => ({ data: { publicUrl: `https://halle.test/${bucket}/${pfad}` } }) }),
  };

  get client(): FeldStandClient {
    return this as unknown as FeldStandClient;
  }

  abfragenAuf(tabelle: string): Abfrage[] {
    return this.abfragen.filter((a) => a.tabelle === tabelle);
  }

  /** Antworten weiterer Funktionen (H3b-2b, z. B. `hall_speaker_assign`) und alle Aufrufe mit Argumenten. */
  readonly rpcDaten: Record<string, unknown> = {};
  readonly rpcLog: Array<{ fn: string; args: unknown }> = [];

  rpc(fn: string, args?: unknown) {
    this.rpcAufrufe += 1;
    this.rpcLog.push({ fn, args });
    const ergebnis = (): { data: unknown; error: unknown } => {
      if (fn === 'is_real_account') {
        return { data: this.echtesKonto, error: null };
      }
      return Object.hasOwn(this.rpcDaten, fn) ? { data: this.rpcDaten[fn], error: null } : { data: null, error: { code: 'PGRST202', message: fn } };
    };
    return this.kette({ tabelle: `rpc:${fn}`, spalten: '', filter: [], mitSignal: false }, () => ergebnis());
  }

  from(tabelle: string) {
    return {
      select: (spalten: string) => {
        const abfrage: Abfrage = { tabelle, spalten, filter: [], mitSignal: false };
        const filter: Filter[] = [];
        let sortiert: string | null = null;
        let grenze = Number.POSITIVE_INFINITY;
        let einzeln = false;
        const zeilen = (): Zeile[] => {
          let liste = (this.tabellen[tabelle] ?? []).filter((z) => filter.every((f) => f(z)));
          if (sortiert !== null) {
            const spalte = sortiert;
            liste = [...liste].sort((a, b) => Number(a[spalte]) - Number(b[spalte]));
          }
          return liste.slice(0, grenze).map((z) => ({ ...z }));
        };
        const builder = this.kette(abfrage, () => {
          const liste = zeilen();
          return { data: einzeln ? (liste[0] ?? null) : liste, error: null };
        }) as ReturnType<FalscherSupabase['kette']> & Record<string, unknown>;
        Object.assign(builder, {
          eq: (spalte: string, wert: unknown) => {
            abfrage.filter.push(`eq ${spalte}`);
            filter.push((z) => z[spalte] === wert);
            return builder;
          },
          in: (spalte: string, werte: readonly unknown[]) => {
            abfrage.filter.push(`in ${spalte} ${werte.length}`);
            filter.push((z) => werte.includes(z[spalte]));
            return builder;
          },
          not: (spalte: string, op: string, wert: unknown) => {
            abfrage.filter.push(`not ${spalte} ${op} ${String(wert)}`);
            filter.push((z) => (op === 'is' && wert === null ? z[spalte] !== null && z[spalte] !== undefined : z[spalte] !== wert));
            return builder;
          },
          is: (spalte: string, wert: unknown) => {
            abfrage.filter.push(`is ${spalte} ${String(wert)}`);
            filter.push((z) => (wert === null ? z[spalte] === null || z[spalte] === undefined : z[spalte] === wert));
            return builder;
          },
          gt: (spalte: string, wert: number) => {
            abfrage.filter.push(`gt ${spalte} ${wert}`);
            filter.push((z) => Number(z[spalte]) > wert);
            return builder;
          },
          order: (spalte: string) => {
            sortiert = spalte;
            return builder;
          },
          limit: (n: number) => {
            grenze = n;
            return builder;
          },
          maybeSingle: () => {
            einzeln = true;
            return builder;
          },
        });
        return builder;
      },
    };
  }

  /** Thenable mit `abortSignal`; das Netz wird erst beim Warten auf die Antwort befragt. */
  private kette(abfrage: Abfrage, antwort: () => { data: unknown; error: unknown }) {
    let signal: AbortSignal | null = null;
    const builder = {
      abortSignal: (s: AbortSignal) => {
        signal = s;
        abfrage.mitSignal = true;
        return builder;
      },
      then: <A, B = never>(ok?: (wert: { data: unknown; error: unknown }) => A, nein?: (grund: unknown) => B): Promise<A | B> => {
        this.abfragen.push(abfrage);
        const lauf = new Promise<{ data: unknown; error: unknown }>((resolve, reject) => {
          if (this.fehlerCode !== null) {
            resolve({ data: null, error: { code: this.fehlerCode, message: 'TOURNAMENT_FINISHED' } });
          } else if (this.netz === 'fehler' || this.tabellenFehler.has(abfrage.tabelle)) {
            reject(new TypeError('Failed to fetch'));
          } else if (this.netz === 'haengt' || this.haengendeRpcs.has(abfrage.tabelle.replace(/^rpc:/, ''))) {
            signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          } else {
            resolve(antwort());
          }
        });
        return lauf.then(ok, nein);
      },
    };
    return builder;
  }
}
