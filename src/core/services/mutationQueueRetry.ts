/**
 * Zeitgeber-Logik der Warteschlange für Weg B (A-06d, Brief A5).
 *
 * Vorübergehende Fehler: Zeitgeber 1/2/5/5/5 s ohne Zählung der Fehlversuche.
 * Echte (nicht-finale) Fehler: Zählung + feste 30-s-Sperre; Anstöße über
 * `processIfDue` warten diese 30 s ab. Ab MAX_RETRIES Dead-Letter
 * (siehe GenericMutationQueue).
 */

import { withRequestTimeout } from '../utils/syncRetryTiming';
import { AuthenticationError, RepositoryError } from '../errors';


/** Wiederholungs-Folge für vorübergehende Fehler: 1, 2, 5, 5, 5 s (Brief A5). */
export const RETRY_BACKOFF_MS = [1000, 2000, 5000, 5000, 5000] as const;

/** Feste Wartezeit nach einem echten, nicht-finalen Fehler (Brief A5). */
export const HOLD_RETRY_MS = 30000;

export type QueueTimerHandle = ReturnType<typeof setTimeout>;

/**
 * Injizierbare Timer (Standard: globale Wrapper). Eigener Typ — bewusst NICHT
 * `OutboxTimers` aus `core/match/client` (Brief A5).
 */
export type QueueTimers = {
    setTimeout: (callback: () => void, ms: number) => QueueTimerHandle;
    clearTimeout: (handle: QueueTimerHandle) => void;
};

export function globalQueueTimers(): QueueTimers {
    return {
        setTimeout: (callback, ms) => setTimeout(callback, ms),
        clearTimeout: (handle) => { clearTimeout(handle); },
    };
}

/**
 * Wiederholungs-Zeitgeber der Warteschlange: hält höchstens einen anstehenden
 * Timer (`schedule` löscht selbst), die Folge 1/2/5/5/5 s (`takeBackoffMs`,
 * eigener Zähler `backoffStep`) und die 30-s-Sperre (`hold`).
 */
export class QueueRetryTimer {
    private handle: QueueTimerHandle | null = null;
    private backoffStep = 0;
    /** 30-s-Sperre nach einem echten Fehler: `processIfDue` stößt dann nicht an. */
    hold = false;
    /**
     * A-06f: Anmeldung abgelaufen. Getrennt von `hold`; kein Zeitgeber, nur
     * `resumeAfterAuth()` hebt die Sperre auf.
     */
    authHold = false;

    constructor(
        private readonly timers: QueueTimers,
        private readonly onFire: () => void,
    ) {}

    /** Steht ein Timer? */
    get isOpen(): boolean {
        return this.handle !== null;
    }

    /** Planung (idempotent): löscht einen anstehenden Timer, nie zwei gleichzeitig. */
    schedule(ms: number): void {
        this.clear();
        this.handle = this.timers.setTimeout(() => {
            this.handle = null;
            this.hold = false;
            this.onFire();
        }, ms);
    }

    clear(): void {
        if (this.handle !== null) {
            this.timers.clearTimeout(this.handle);
            this.handle = null;
        }
    }

    /** Nächster Wert der Folge 1/2/5/5/5 s und einen Schritt weiter. */
    takeBackoffMs(): number {
        const ms = RETRY_BACKOFF_MS[Math.min(this.backoffStep, RETRY_BACKOFF_MS.length - 1)];
        this.backoffStep += 1;
        return ms;
    }

    /** Erfolg: Folge wieder bei 1 s beginnen (Timer/Sperre löscht der Aufrufer). */
    reset(): void {
        this.backoffStep = 0;
    }
}

/** Ergebnis eines gemerkten Versuchs (A-06e): erledigt oder Fehler — `settled` lehnt nie ab. */
export type InFlightOutcome = { ok: true } | { ok: false; error: unknown };

/** Nach zwei Zeitlimit-Fenstern wird ein gemerkter Versuch verworfen (Politik Weg B). */
export const MAX_IN_FLIGHT_WINDOWS = 2;

type InFlightRecord = {
    itemId: string;
    settled: Promise<InFlightOutcome>;
    windows: number;
};

/** Mikroaufgaben-Spülung für den Schnellpfad ohne Zeitlimit-Timer (A-06e). */
async function microtaskDrain(rounds = 10): Promise<void> {
    for (let i = 0; i < rounds; i++) { await Promise.resolve(); }
}

/**
 * Gemerkter Versuch (A-06e, Weg B): `run` läuft, der nächste Lauf für dieselbe
 * `itemId` wartet auf den ALTEN Versuch statt neu zu starten. Jedes Warten ist
 * ein Race gegen das Zeitlimit (`withRequestTimeout`, injizierter Timer) —
 * der Zeitlimit-Timer wird im `finally` des Wartens gelöscht. `settled` lehnt
 * nie ab (Fehler landen als `{ ok: false, error }`). Nach zwei
 * Zeitlimit-Fenstern desselben Versuchs wird er verworfen, der nächste Lauf
 * führt `run` neu aus. Weicht die `itemId` ab, wird der gemerkte Versuch
 * verworfen.
 */
export class QueueInFlight {
    private current: InFlightRecord | null = null;

    constructor(private readonly timers: QueueTimers) {}

    /** Läuft ein gemerkter Versuch? */
    get isActive(): boolean {
        return this.current !== null;
    }

    /**
     * Führt `run` für `itemId` aus oder wartet auf den gemerkten Versuch.
     * Wirft den Fehler des Versuchs bzw. bei Zeitlimit einen `TimeoutError`
     * (läuft im transienten Zweig der Queue).
     */
    async attempt(itemId: string, run: () => Promise<void>, ms: number): Promise<void> {
        const existing = this.current;
        const record = (existing?.itemId === itemId ? existing : null) ?? this.start(itemId, run);
        let outcome: InFlightOutcome;
        try {
            // Schnellpfad: endet der Versuch sofort, wird KEIN Zeitlimit-Timer
            // geöffnet (A-06d-Tests erwarten limitDelays [] bei sofortigen Fehlern).
            const fast = await Promise.race([
                record.settled.then((o) => ({ o })),
                microtaskDrain().then(() => null),
            ]);
            outcome = fast !== null ? fast.o : await withRequestTimeout(this.timers, ms, () => record.settled);
        } catch (error) {
            // Zeitlimit: Fenster zählen; ab 2 Fenstern verwerfen (nächster Lauf neu).
            if (this.current === record) {
                record.windows += 1;
                if (record.windows >= MAX_IN_FLIGHT_WINDOWS) { this.current = null; }
            }
            throw error;
        }
        // Abgeschlossener Versuch: nicht mehr gemerkt (Erfolg wie Fehler).
        if (this.current === record) { this.current = null; }
        if (!outcome.ok) { throw outcome.error; }
    }

    /**
     * Neuen Versuch merken. `run` wird sofort aufgerufen (bestehende Tests hängen
     * ihre Rejects daran); geworfene Fehler und Rejects landen in `settled`, das
     * nie ablehnt.
     */
    private start(itemId: string, run: () => Promise<void>): InFlightRecord {
        const settled = (async (): Promise<InFlightOutcome> => {
            try {
                await run();
                return { ok: true };
            } catch (error) {
                return { ok: false, error };
            }
        })();
        const record: InFlightRecord = { itemId, settled, windows: 0 };
        this.current = record;
        return record;
    }
}

/** Status-Codes eines abgelaufenen Anmeldestatus (AuthApiError aus @supabase/auth-js). */
const AUTH_EXPIRED_STATUSES = [401, 403] as const;

/**
 * Erkennt „Anmeldung abgelaufen“ (A-06f, @FU-009). Beide Fehlerformen zählen:
 * - `AuthenticationError`;
 * - `RepositoryError` mit `originalError` = AuthApiError 401/403;
 * - AuthApiError 400 „Invalid Refresh Token…“ (bare oder als `originalError`).
 * `AuthRetryableFetchError` (Status 0 / 503) und alle übrigen Fehler sind NICHT
 * „abgelaufen“ — sie laufen über den transienten Weg.
 */
export function isAuthExpired(error: unknown): boolean {
  if (error instanceof AuthenticationError) { return true; }
  if (error instanceof RepositoryError) {
    return isAuthApiExpired(error.originalError, true);
  }
  return isAuthApiExpired(error, false);
}

function isAuthApiExpired(candidate: unknown, wrapped: boolean): boolean {
  if (!candidate || typeof candidate !== 'object') { return false; }
  const e = candidate as { name?: unknown; status?: unknown; message?: unknown };
  if (e.name !== 'AuthApiError') { return false; }
  if (typeof e.status === 'number' && (AUTH_EXPIRED_STATUSES as readonly number[]).includes(e.status) && wrapped) {
    return true;
  }
  return e.status === 400 && typeof e.message === 'string' && e.message.includes('Invalid Refresh Token');
}
