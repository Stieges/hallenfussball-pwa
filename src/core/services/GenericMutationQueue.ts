
import { z } from 'zod';
import { generateUniqueId } from '../../utils/idGenerator';
import { safeLocalStorage } from '../utils/safeStorage';
import { captureFeatureError } from '../../lib/sentry';
import { definitiveRejectionReason, isTransientMutationError, isVersionConflict, type DefinitiveRejectionReason } from '../errors';
import { StorageError } from '../storage/StorageError';
import { QueueInFlight, QueueRetryTimer, globalQueueTimers, HOLD_RETRY_MS, isAuthExpired, type QueueTimers } from './mutationQueueRetry';
import { REQUEST_TIMEOUT_MS } from '../utils/syncRetryTiming';

/**
 * Structural (not enum-restricted) validation for a queued mutation item.
 *
 * The tournament queue's original schema (MutationItemSchema) restricted
 * `type` to a fixed enum of tournament mutation types. That restriction is
 * tournament-specific business logic, not shared machinery, so it does not
 * belong here — hard-coding it into the generic class would silently drop
 * every item for any other TType union (e.g. a future Tournament-Series
 * queue) at load time. This schema validates the same shape without
 * constraining `type` to a specific set of literals; for every value that
 * was ever valid under the old enum-restricted schema, validation outcome
 * is unchanged.
 */
const GenericMutationItemSchema = z.object({
    id: z.string(),
    type: z.string(),
    payload: z.unknown(),
    timestamp: z.number(),
    retryCount: z.number(),
});

const GenericFailedMutationItemSchema = GenericMutationItemSchema.extend({
    failedAt: z.number(),
    lastError: z.string().optional(),
    conflict: z.boolean().optional(),
    discardedCopy: z.boolean().optional(),
    rejection: z.enum(['invalidValue', 'tournamentGone']).optional(),
});

/**
 * A requested change to be persisted to the cloud, generic over the
 * consumer's mutation-type union.
 */
export interface GenericMutationItem<TType extends string> {
    id: string;
    type: TType;
    payload: unknown;
    timestamp: number;
    retryCount: number;
}

export const MAX_RETRIES = 5;

/** @FU-106 (Auflage A1): Grund im Dead-Letter, wenn ein Eintrag aus einer verworfenen Kopie nicht gesendet wurde. */
export const DISCARDED_COPY_ERROR = 'Dieser Stand beruht auf einer verworfenen Änderung und wurde nicht gesendet.';

/**
 * A mutation that failed permanently (exceeded max retries)
 */
export interface FailedMutationItem<TType extends string = string> extends GenericMutationItem<TType> {
    failedAt: number;
    lastError?: string;
    /** @FU-106: abgelehnt, weil ein anderes Gerät inzwischen gespeichert hat (Versionskonflikt). */
    conflict?: boolean;
    /**
     * @FU-109 (Befund C-VERWORFEN-FALSCHER-GRUND): nicht gesendet, weil die Kopie nach „Verwerfen“ noch auf den Stand des
     * Servers wartet (z. B. Server nicht erreichbar). Kein Konflikt mit einem anderen Gerät; „Erneut versuchen“ hilft nicht.
     */
    discardedCopy?: boolean;
    /**
     * BP-1 (@FU-126, Befund C-ENDGUELTIG-SOFORT-MELDEN): vom Server eindeutig abgelehnt, ohne Wiederholung abgelegt.
     * `invalidValue`: ungültiger Wert; `tournamentGone`: Turnier gibt es nicht mehr (@FU-123). Ein Konflikt trägt weiter `conflict`.
     */
    rejection?: Exclude<DefinitiveRejectionReason, 'conflict'>;
}

/**
 * Status info for subscribers
 */
export interface MutationQueueStatus {
    pendingCount: number;
    failedCount: number;
}

/**
 * Configuration for a GenericMutationQueue instance. Everything that used to
 * be hard-wired to tournaments (storage keys, the executor switch, the
 * coalesce rules, the Sentry feature tag) is injected here.
 */
export interface MutationQueueConfig<TType extends string> {
    storageKey: string;
    failedStorageKey: string;
    /** Führt eine Mutation gegen das Remote aus; wirft bei Fehler (Retry-Semantik der Queue). */
    execute: (item: GenericMutationItem<TType>) => Promise<void>;
    /** Coalesce-Schlüssel oder null (kein Coalescing) — Semantik wie Bestand. */
    coalesceKey: (type: TType, payload: unknown) => string | null;
    /** Sentry-Feature-Tag (Bestand: 'sync'). */
    sentryFeature: string;
    /**
     * Optional guard restricting which `type` values are accepted at load.
     * An item whose type fails this check is rejected exactly like a
     * schema-invalid item (filtered out, same Sentry/logging path) — it
     * never enters the queue. This exists because an unrecognized type that
     * *does* enter the queue can sit at the head and head-of-line-block
     * every mutation behind it: transient failures retry via timer 1/2/5/5/5 s
     * without counting, real ones count and pause 30 s (nudges via
     * `processIfDue`, `enqueue` and `online` wait that out), from MAX_RETRIES on the head is
     * dead-lettered (process() intentionally `break`s, not `continue`s).
     *
     * When omitted, every structurally-valid item is accepted (today's
     * default for a consumer that doesn't need this — e.g. a future
     * Tournament-Series queue that hasn't opted in yet).
     */
    isKnownType?: (type: string) => boolean;
    /** Injizierbare Timer (Standard: globale Wrapper wie MatchEngineProvider.tsx:72-75). */
    timers?: QueueTimers;
    /** A-08f3c2 (Regel Q): Bereich eines Eintrags (Turnier-ID) für `completedCount`/`hasPending`/`hasFailed`. */
    scopeOf?: (type: TType, payload: unknown) => string | null;
    /**
     * @FU-106 (Auflage A1, review-ca67): Typen, die den ganzen Inhalt des Bereichs tragen. Ist der Bereich nach „Verwerfen“
     * eines Konflikts gemerkt, gehen sie nicht zum Server, sondern sofort als Konflikt in den Dead-Letter.
     */
    wholeCopyTypes?: readonly TType[];
    /**
     * @FU-110: nach einem erfolgreich gesendeten Eintrag neue Nutzlasten für wartende Einträge (id → payload), z. B. eine
     * gestiegene Prüf-Version. Ohne Angabe bleiben wartende Einträge unverändert.
     */
    rebasePending?: (done: GenericMutationItem<TType>, pending: readonly GenericMutationItem<TType>[]) => ReadonlyArray<{ id: string; payload: unknown }> | undefined;
}

/**
 * Offline-first mutation queue machinery: persists to localStorage, retries
 * transient failures via timer 1/2/5/5/5 s without counting; real failures
 * count and pause 30 s (nudges via `processIfDue`, `enqueue` and `online`
 * wait that out); from MAX_RETRIES on the item is dead-lettered. Coalesces duplicate mutations,
 * validates on load with Zod, and notifies subscribers of status changes.
 *
 * Tournament-specific behaviour (mutation types, executor, coalesce rules,
 * storage keys) is injected via MutationQueueConfig — see MutationQueue.ts
 * for the tournament specialization.
 */
export class GenericMutationQueue<TType extends string> {
    private queue: GenericMutationItem<TType>[] = [];
    private failedQueue: FailedMutationItem<TType>[] = [];
    private isProcessing = false;
    private disposed = false;
    private retryTimer: QueueRetryTimer;
    private inFlight: QueueInFlight;
    private lastFailure: 'transient' | 'permanent' | 'storage' | 'storageBlocked' | null = null;
    private listeners: ((status: MutationQueueStatus) => void)[] = [];
    private readonly storageReported = new Set<string>(); // A-07i Fixrunde 1: Sentry je Ursache nur einmal
    private readonly completed = new Map<string, number>(); // A-08f3c2: erledigte Einträge je Bereich (H1)
    /** @FU-106: Bereiche, deren Kopie nach „Verwerfen“ den Cloud-Stand braucht (dauerhaft gespeichert). */
    private cloudCopyNeeded = new Set<string>();

    constructor(private config: MutationQueueConfig<TType>) {
        const timers = config.timers ?? globalQueueTimers();
        this.retryTimer = new QueueRetryTimer(timers, () => {
            void this.process();
        });
        this.inFlight = new QueueInFlight(timers);
        this.load();
        this.loadFailed();
        this.loadCloudCopyNeeded();

        // Auto-process on online
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.handleOnline);

            // Try processing on start if online
            if (navigator.onLine) {
                void this.process();
            }
        }
    }

    private readonly handleOnline = (): void => {
        // @FU-109: wartet ein verworfenes Turnier auf den Stand des Servers, melden – die Zuhörer laden ihn sofort nach
        if (this.cloudCopyNeeded.size > 0) { this.notifyListeners(); }
        if (this.retryTimer.inPause) { return; } // A-06d2: während der 30-s-Pause kein Versuch
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) { console.log('MutationQueue: Online detected, processing queue...'); }
        void this.process();
    };

    /**
     * Add a mutation to the queue and persist it.
     * Triggers processing immediately if online.
     *
     * COALESCING: For certain mutation types, existing pending mutations
     * for the same entity will be replaced instead of duplicated.
     * This prevents queue bloat during rapid updates (e.g., team renaming).
     */
    public enqueue(type: TType, payload: unknown): void {
        // Try to coalesce with existing mutation
        const coalesceKey = this.config.coalesceKey(type, payload);
        if (coalesceKey) {
            // Kopf-Schutz (A-06e): solange ein Durchgang läuft oder ein Versuch
            // gemerkt ist, ist Index 0 gesperrt; Zusammenfassen immer in den
            // LETZTEN Treffer (Rückwärtsschleife, kein findLastIndex/ES2023).
            const headLocked = this.isProcessing || this.inFlight.isActive;
            let existingIndex = -1;
            for (let i = this.queue.length - 1; i >= 0; i--) {
                if (i === 0 && headLocked) { continue; }
                if (this.config.coalesceKey(this.queue[i].type, this.queue[i].payload) === coalesceKey) { existingIndex = i; break; }
            }

            if (existingIndex !== -1) {
                // Replace existing mutation with newer payload
                this.queue[existingIndex] = {
                    ...this.queue[existingIndex],
                    payload,
                    timestamp: Date.now(),
                    // Keep retryCount from existing item (don't reset on coalesce)
                };
                this.save();
                this.notifyListeners();

                if (import.meta.env.DEV) {
                    // eslint-disable-next-line no-console
                    console.log(`MutationQueue: Coalesced ${type} for ${coalesceKey}`);
                }

                // Still trigger processing (A-06d2: nicht während der 30-s-Pause)
                if (navigator.onLine && !this.retryTimer.inPause) {
                    void this.process();
                }
                return;
            }
        }

        // No coalescing possible - add new item
        const item: GenericMutationItem<TType> = {
            id: generateUniqueId(),
            type,
            payload,
            timestamp: Date.now(),
            retryCount: 0
        };

        this.queue.push(item);
        this.save();
        this.notifyListeners();

        // Optimistic processing (A-06d2: nicht während der 30-s-Pause)
        if (navigator.onLine && !this.retryTimer.inPause) {
            void this.process();
        }
    }

    public getPendingCount(): number { return this.queue.length; }

    public getFailedCount(): number { return this.failedQueue.length; }

    public getFailedMutations(): FailedMutationItem<TType>[] { return [...this.failedQueue]; }

    public getStatus(): MutationQueueStatus {
        return { pendingCount: this.queue.length, failedCount: this.failedQueue.length };
    }

    private inScope(item: GenericMutationItem<TType>, scope: string): boolean { return this.config.scopeOf?.(item.type, item.payload) === scope; }
    /** A-08f3c2 (Regel Q, H1): erfolgreich gesendete Einträge des Bereichs seit dem Start der Instanz. */
    public completedCount(scope: string): number { return this.completed.get(scope) ?? 0; }
    /** A-08f3c2: wartet ein Eintrag des Bereichs? */
    public hasPending(scope: string): boolean { return this.queue.some((item) => this.inScope(item, scope)); }
    /** A-08f3c2 (H2): liegt ein Eintrag des Bereichs mit einem dieser Typen im Dead-Letter? */
    public hasFailed(scope: string, types: readonly TType[]): boolean {
        return this.failedQueue.some((item) => types.includes(item.type) && this.inScope(item, scope));
    }

    /** Letzter Fehlerabschluss (A-06e): 'transient' | 'permanent' | null nach Erfolg; 'storage' = Gerätespeicher voll (A-07i). */
    public getLastFailure(): 'transient' | 'permanent' | 'storage' | 'storageBlocked' | null { return this.lastFailure; }

    public subscribe(listener: (status: MutationQueueStatus) => void): () => void {
        this.listeners.push(listener);
        return () => { this.listeners = this.listeners.filter(l => l !== listener); };
    }

    private notifyListeners() { this.listeners.forEach(l => l(this.getStatus())); }

    /**
     * Move a failed mutation to the dead-letter queue
     */
    private moveToDeadLetter(item: GenericMutationItem<TType>, error?: string, reason?: DefinitiveRejectionReason | 'discardedCopy'): void {
        const failedItem: FailedMutationItem<TType> = {
            ...item,
            failedAt: Date.now(),
            lastError: error,
            ...(reason === 'conflict' ? { conflict: true } : {}),
            ...(reason === 'discardedCopy' ? { discardedCopy: true } : {}),
            ...(reason === 'invalidValue' || reason === 'tournamentGone' ? { rejection: reason } : {}),
        };
        this.failedQueue.push(failedItem);
        this.saveFailed();
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) { console.log(`MutationQueue: Moved ${item.id} to dead-letter queue`); }
    }

    /** Kopf der Warteschlange in den Dead-Letter (Sentry wie bisher) – nach MAX_RETRIES oder bei eindeutiger Ablehnung. */
    private deadLetterHead(item: GenericMutationItem<TType>, error: unknown, reason?: DefinitiveRejectionReason): void {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (error instanceof Error) { captureFeatureError(error, this.config.sentryFeature, 'deadLetter', { mutationType: item.type, mutationId: item.id }); }
        this.queue.shift();
        this.moveToDeadLetter(item, errorMessage, reason);
        this.lastFailure = 'permanent';
        this.save();
        this.notifyListeners();
    }

    /**
     * Retry a specific failed mutation
     * Moves it back to the regular queue for processing
     */
    public retryFailedMutation(id: string): boolean {
        const index = this.failedQueue.findIndex(item => item.id === id);
        if (index === -1) {
            return false;
        }

        const [failedItem] = this.failedQueue.splice(index, 1);
        this.saveFailed();

        // Reset retry count and re-enqueue
        const retriedItem: GenericMutationItem<TType> = {
            id: failedItem.id,
            type: failedItem.type,
            payload: failedItem.payload,
            timestamp: Date.now(),
            retryCount: 0,
        };

        this.queue.push(retriedItem);
        this.save();
        this.notifyListeners();

        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) { console.log(`MutationQueue: Retrying failed mutation ${id}`); }

        // Try to process immediately
        if (navigator.onLine) {
            void this.process();
        }

        return true;
    }

    /**
     * Retry all failed mutations
     */
    public retryAllFailed(): number {
        const count = this.failedQueue.length;
        if (count === 0) {
            return 0;
        }

        // Move all failed items back to main queue
        for (const failedItem of this.failedQueue) {
            const retriedItem: GenericMutationItem<TType> = {
                id: failedItem.id,
                type: failedItem.type,
                payload: failedItem.payload,
                timestamp: Date.now(),
                retryCount: 0,
            };
            this.queue.push(retriedItem);
        }

        this.failedQueue = [];
        this.saveFailed();
        this.save();
        this.notifyListeners();

        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) { console.log(`MutationQueue: Retrying ${count} failed mutations`); }

        // Try to process immediately
        if (navigator.onLine) {
            void this.process();
        }

        return count;
    }

    /**
     * Clear a specific failed mutation (discard it permanently)
     */
    public clearFailedMutation(id: string): boolean {
        const index = this.failedQueue.findIndex(item => item.id === id);
        if (index === -1) { return false; }

        const discarded = this.failedQueue.splice(index, 1);
        this.saveFailed();
        this.markCloudCopyNeeded(discarded);
        this.notifyListeners();
        return true;
    }

    /**
     * Clear all failed mutations
     */
    public clearAllFailed(): number {
        const discarded = this.failedQueue;
        this.failedQueue = [];
        this.saveFailed();
        this.markCloudCopyNeeded(discarded);
        this.notifyListeners();
        return discarded.length;
    }

    /**
     * @FU-106 (Befund C-VERWERFEN-BEHAELT-VERALTETEN-STAND; Entscheidung Daniel 20.10.: „Verwerfen = immer Server-Stand“,
     * mit und ohne Konflikt): die lokale Kopie trägt nach dem Verwerfen einen Inhalt, den der Server nie bekommt. Der
     * Bereich (Turnier) wird gemerkt, bis die Kopie den Cloud-Stand übernommen hat oder der Server das Turnier nicht kennt
     * (@FU-107: dann bleibt die Kopie); bis dahin geht aus ihr nichts zum Server.
     */
    private markCloudCopyNeeded(discarded: readonly FailedMutationItem<TType>[]): void {
        const scopes = discarded.map((item) => this.config.scopeOf?.(item.type, item.payload));
        const added = scopes.filter((scope): scope is string => !!scope && !this.cloudCopyNeeded.has(scope));
        if (added.length === 0) { return; }
        added.forEach((scope) => this.cloudCopyNeeded.add(scope));
        this.saveCloudCopyNeeded();
    }

    /** @FU-106: braucht die Kopie des Bereichs den Cloud-Stand (nach „Verwerfen“ eines Konflikts)? */
    public needsCloudCopy(scope: string): boolean { return this.cloudCopyNeeded.has(scope); }
    public scopesNeedingCloudCopy(): string[] { return [...this.cloudCopyNeeded]; }
    /** @FU-106: Merkung erledigt (Cloud-Stand übernommen, Turnier am Server weg oder gelöscht). */
    public forgetCloudCopy(scope: string): void {
        if (this.cloudCopyNeeded.delete(scope)) { this.saveCloudCopyNeeded(); this.notifyListeners(); }
    }

    private carriesDiscardedCopy(item: GenericMutationItem<TType>): boolean {
        if (!this.config.wholeCopyTypes?.includes(item.type)) { return false; }
        const scope = this.config.scopeOf?.(item.type, item.payload);
        return !!scope && this.cloudCopyNeeded.has(scope);
    }

    private get cloudCopyKey(): string { return `${this.config.failedStorageKey}:cloud-copy`; }
    private saveCloudCopyNeeded(): void { this.persist(this.cloudCopyKey, [...this.cloudCopyNeeded], 'saveCloudCopyNeeded'); }
    private loadCloudCopyNeeded(): void {
        try {
            const parsed: unknown = JSON.parse(safeLocalStorage.getItem(this.cloudCopyKey) ?? '[]');
            this.cloudCopyNeeded = new Set(Array.isArray(parsed) ? parsed.filter((scope): scope is string => typeof scope === 'string') : []);
        } catch {
            this.cloudCopyNeeded = new Set();
        }
    }

    private load() {
        try {
            const raw = safeLocalStorage.getItem(this.config.storageKey);
            if (raw) {
                const parsed: unknown[] = JSON.parse(raw) as unknown[];
                this.queue = parsed.filter((item) => {
                    const result = GenericMutationItemSchema.safeParse(item);
                    if (!result.success) {
                        captureFeatureError(
                            new Error(`Invalid mutation item in queue: ${result.error.message}`),
                            this.config.sentryFeature, 'loadQueue:validation'
                        );
                        return false;
                    }
                    if (this.config.isKnownType && !this.config.isKnownType(result.data.type)) {
                        captureFeatureError(
                            new Error(`Invalid mutation item in queue: unknown type "${result.data.type}"`),
                            this.config.sentryFeature, 'loadQueue:validation'
                        );
                        return false;
                    }
                    return true;
                }) as GenericMutationItem<TType>[];
            }
        } catch (e) {
            if (import.meta.env.DEV) { console.error('MutationQueue: Failed to load queue', e); }
            if (e instanceof Error) { captureFeatureError(e, this.config.sentryFeature, 'loadQueue'); }
            this.queue = [];
        }
    }

    private save() { this.persist(this.config.storageKey, this.queue, 'saveQueue'); }

    /** A-07i (@FU-004): nur ein im echten Speicher angekommener Stand gilt als gespeichert. */
    private persist(key: string, value: unknown, action: string): void {
        if (!safeLocalStorage.setItemPersisted(key, JSON.stringify(value))) { if (Array.isArray(value) && value.length === 0) { safeLocalStorage.removeItem(key); } this.reportStorageFailure(action); } // A-07i Fixrunde 1 (2): leerer Stand -> veralteten Schluessel entfernen (Doppelversand)
    }

    /** A-07i: Speichern fehlgeschlagen → Störungsanzeige „Gerätespeicher voll“ (lastFailure 'storage') + Sentry (1× je Ursache). */
    protected reportStorageFailure(action: string): void {
        this.lastFailure = safeLocalStorage.getIsAvailable() ? 'storage' : 'storageBlocked'; this.notifyListeners(); // 1b: gesperrt vs. voll
        if (!this.storageReported.has(action)) { this.storageReported.add(action); captureFeatureError(new StorageError('Warteschlange nicht dauerhaft gespeichert'), this.config.sentryFeature, action); }
    }

    private loadFailed() {
        try {
            const raw = safeLocalStorage.getItem(this.config.failedStorageKey);
            if (raw) {
                const parsed: unknown[] = JSON.parse(raw) as unknown[];
                this.failedQueue = parsed.filter((item) => {
                    const result = GenericFailedMutationItemSchema.safeParse(item);
                    if (!result.success) {
                        captureFeatureError(
                            new Error(`Invalid failed mutation item: ${result.error.message}`),
                            this.config.sentryFeature, 'loadFailedQueue:validation'
                        );
                        return false;
                    }
                    if (this.config.isKnownType && !this.config.isKnownType(result.data.type)) {
                        captureFeatureError(
                            new Error(`Invalid failed mutation item: unknown type "${result.data.type}"`),
                            this.config.sentryFeature, 'loadFailedQueue:validation'
                        );
                        return false;
                    }
                    return true;
                }) as FailedMutationItem<TType>[];
            }
        } catch (e) {
            if (import.meta.env.DEV) { console.error('MutationQueue: Failed to load failed queue', e); }
            if (e instanceof Error) { captureFeatureError(e, this.config.sentryFeature, 'loadFailedQueue'); }
            this.failedQueue = [];
        }
    }

    private saveFailed() { this.persist(this.config.failedStorageKey, this.failedQueue, 'saveFailedQueue'); }

    /**
     * Process the queue sequentially.
     * Stops on error (preserving order) unless max retries exceeded.
     */
    public async process(): Promise<void> {
        // A-06f: solange die Anmeldung abgelaufen ist, startet kein Lauf (auch nicht über Timer/online/enqueue).
        if (this.isProcessing || this.queue.length === 0 || this.retryTimer.authHold) { return; }
        // A-07b Fixrunde 1: eine entsorgte Instanz startet keinen Lauf mehr (Konto-/Token-Wechsel).
        if (this.disposed) { return; }
        if (!(navigator.onLine)) { return; }

        // Ein Lauf ersetzt einen anstehenden Wiederholungs-Zeitgeber.
        this.retryTimer.clear();
        this.isProcessing = true;
        let scheduleMs: number | null = null;

        try {
            // Process head of queue
            while (this.queue.length > 0) {
                // A-07b Fixrunde 1: nach dispose() kein weiterer Versuch, kein Speichern durch die alte Instanz.
                if (this.disposed || !(navigator.onLine)) { break; }

                const item = this.queue[0]; // Peek

                // @FU-106 (Auflage A1): die gemerkte Kopie trägt einen Stand, den der Server nie bekam – nicht senden, sichtbar ablegen
                if (this.carriesDiscardedCopy(item)) {
                    this.queue.shift();
                    this.moveToDeadLetter(item, DISCARDED_COPY_ERROR, 'discardedCopy'); // @FU-109: eigener Grund, kein Konflikt
                    this.save();
                    this.lastFailure = 'permanent';
                    this.notifyListeners();
                    continue;
                }

                try {
                    // A-06e: gemerkter Versuch + Race gegen REQUEST_TIMEOUT_MS; A-06f Fixrunde 2: Generation am Versuch
                    await this.inFlight.attempt(item.id, () => this.config.execute(item), REQUEST_TIMEOUT_MS, this.retryTimer.authEpoch);
                } catch (error) {
                    // A-07b Fixrunde 1: entsorgte Instanz schreibt nach einem Fehler nichts mehr.
                    if (this.disposed) { break; }
                    if (import.meta.env.DEV) { console.warn(`MutationQueue: Error processing ${item.type} (${item.id})`, error); }

                    const authFailure = isAuthExpired(error);
                    if (authFailure && this.retryTimer.holdForAuth(this.inFlight.lastEpoch)) {
                        // A-06f (@FU-009): Anmeldung abgelaufen – zählt nicht, kein Zeitgeber; nur resumeAfterAuth() hebt auf.
                        this.lastFailure = 'permanent'; this.notifyListeners();
                        break;
                    }

                    // Veralteter Anmeldefehler (Versuch vor resumeAfterAuth) läuft hier durch.
                    if (authFailure || isTransientMutationError(error)) {
                        // Vorübergehender Fehler (z. B. kein echtes Internet trotz
                        // navigator.onLine — Hallen-WLAN-Anmeldeseite, Server-Überlastung):
                        // zählt nicht als Fehlversuch. Item bleibt unverändert an erster
                        // Stelle stehen und wird beim nächsten Anstoß erneut versucht.
                        this.lastFailure = 'transient'; this.notifyListeners();
                        this.retryTimer.hold = false;
                        scheduleMs = this.retryTimer.takeBackoffMs();
                        break;
                    }

                    // BP-1 (@FU-126): eindeutig endgültige Ablehnung – sofort mit Grund ablegen, kein neuer Versuch
                    const rejection = definitiveRejectionReason(error);
                    if (rejection) {
                        this.deadLetterHead(item, error, rejection);
                        continue;
                    }

                    this.lastFailure = 'permanent'; this.notifyListeners();
                    item.retryCount++;

                    if (item.retryCount >= MAX_RETRIES) {
                        if (import.meta.env.DEV) { console.error(`MutationQueue: Max retries exceeded for ${item.id}. Moving to dead-letter queue.`); }
                        this.deadLetterHead(item, error, isVersionConflict(error) ? 'conflict' : undefined);
                        continue; // Continue to next item
                    } else {
                        // Keep in queue, stop processing for now (retry later)
                        this.save();
                        // Echter Fehler: feste 30-s-Sperre, bis der Zeitgeber ruft.
                        this.retryTimer.hold = true;
                        scheduleMs = HOLD_RETRY_MS;
                        // break loop to retry later
                        break;
                    }
                }

                // A-07b Fixrunde 1: Versand ist während des Laufs durch dispose() entsorgt – Eintrag nicht entfernen, nicht speichern.
                if (this.disposed) { break; }
                this.lastFailure = null;
                this.queue.shift(); // Remove handled item
                for (const next of this.config.rebasePending?.(item, this.queue) ?? []) {
                    this.queue = this.queue.map((p) => (p.id === next.id ? { ...p, payload: next.payload } : p));
                }
                const scope = this.config.scopeOf?.(item.type, item.payload);
                if (scope) { this.completed.set(scope, this.completedCount(scope) + 1); }
                this.retryTimer.reset();
                this.retryTimer.hold = false;
                this.save();
                this.notifyListeners();
            }
        } finally {
            this.isProcessing = false;
        }

        // Genau eine Planungsstelle (A-06d): kein Zeitgeber offline, disposed oder ohne Bedarf.
        if (this.queue.length === 0) {
            this.retryTimer.reset();
            this.retryTimer.clear();
            this.retryTimer.hold = false;
            return;
        }
        if (scheduleMs !== null && navigator.onLine && !this.disposed) {
            this.retryTimer.schedule(scheduleMs);
        }
    }

    /**
     * Anstoß von außen (resync, Sichtbarkeit) — während der 30-s-Sperre nach einem
     * echten Fehler wird kein Versuch gezählt und nichts ausgelöst.
     */
    public async processIfDue(): Promise<void> {
        if (this.retryTimer.hold) { return; }
        return this.process();
    }

    /**
     * A-06f (@FU-009): Nach erneuter Anmeldung aufrufen – hebt die Anmelde-Sperre
     * (`authHold`) auf und sendet die Queue weiter. Aufrufer: Anmelde-Ereignis
     * im Sync-Wiring (kommt mit A-06g; bis dahin bewusst ohne Aufrufer).
     * A-06d2: läuft gerade die 30-s-Pause nach einem echten Fehler, startet hier
     * nichts – der Zeitgeber sendet nach Ablauf.
     */
    public async resumeAfterAuth(): Promise<void> {
        this.retryTimer.authEpoch += 1;
        // A-06d2: während einer 30-s-Pause nur die Generation erhöhen (kein zählender Anstoß).
        if (!this.retryTimer.releaseAuthHold()) { return; }
        return this.process();
    }

    /** Zeitgeber/Sperre löschen, `online`-Listener abmelden; `process()`/`enqueue` arbeiten weiter. */
    public dispose(): void {
        this.disposed = true;
        this.retryTimer.clear();
        this.retryTimer.hold = false;
        if (typeof window !== 'undefined') { window.removeEventListener('online', this.handleOnline); }
    }
}
