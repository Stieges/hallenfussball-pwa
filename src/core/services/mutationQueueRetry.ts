/**
 * Zeitgeber-Logik der Warteschlange für Weg B (A-06d, Brief A5).
 *
 * Vorübergehende Fehler: Zeitgeber 1/2/5/5/5 s ohne Zählung der Fehlversuche.
 * Echte (nicht-finale) Fehler: Zählung + feste 30-s-Sperre; Anstöße über
 * `processIfDue` warten diese 30 s ab. Ab MAX_RETRIES Dead-Letter
 * (siehe GenericMutationQueue).
 */

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
