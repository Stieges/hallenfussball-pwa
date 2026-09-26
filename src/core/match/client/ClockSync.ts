/**
 * ClockSync (RC5): Abstand zur Serverzeit messen, Offset speichern,
 * periodisches Nachmessen. Reine Klasse mit injizierten Abhängigkeiten.
 */
export interface ClockStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface ClockSyncData {
  offsetMs: number;
  measuredAt: number;
  rttMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class ClockSync {
  private currentOffsetMs = 0;
  private lastMeasuredAt = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<boolean> | null = null;

  constructor(
    private fetchServerTime: () => Promise<number>,
    private now: () => number,
    private storage: ClockStorage,
  ) {
    const raw = this.storage.get('clockSync:v1');
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isRecord(parsed)) {
          if (typeof parsed.offsetMs === 'number') {
            this.currentOffsetMs = Math.round(parsed.offsetMs);
          }
          if (typeof parsed.measuredAt === 'number') {
            this.lastMeasuredAt = parsed.measuredAt;
          }
        }
      } catch {
        // Ignoriere defekten Speicherinhalt
      }
    }
  }

  get offsetMs(): number {
    return this.currentOffsetMs;
  }

  get measuredAt(): number {
    return this.lastMeasuredAt;
  }

  get isKnown(): boolean {
    return this.lastMeasuredAt > 0 || this.currentOffsetMs !== 0;
  }

  serverNow(): number {
    return this.now() + this.currentOffsetMs;
  }

  /** Misst den Abstand; parallele Aufrufe teilen eine Messreihe (M-5). */
  async sync(): Promise<boolean> {
    if (this.inFlight) {
      return this.inFlight;
    }
    this.inFlight = this.runSync();
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async runSync(): Promise<boolean> {
    const measurements: { rtt: number; offset: number }[] = [];
    const attempts = 3;
    for (let i = 0; i < attempts; i++) {
      try {
        const t0 = this.now();
        const s = await this.fetchServerTime();
        const t1 = this.now();
        // N10: eine nicht endliche Serverzeit (NaN/Infinity) ist keine Messung.
        if (!Number.isFinite(s)) {
          continue;
        }
        const rtt = t1 - t0;
        const offset = s - (t0 + rtt / 2);
        measurements.push({ rtt, offset });
      } catch {
        // Messung scheitert – überspringen
      }
    }
    if (measurements.length === 0) {
      return false;
    }
    // Es zählt die Messung mit der kleinsten RTT
    const best = measurements.reduce((min, m) => (m.rtt < min.rtt ? m : min));
    this.currentOffsetMs = Math.round(best.offset);
    this.lastMeasuredAt = this.now();
    // N10: Speichern ist best effort (Safari privat, Quota) – die Messung bleibt gültig.
    try {
      this.storage.set('clockSync:v1', JSON.stringify({
        offsetMs: this.currentOffsetMs,
        measuredAt: this.lastMeasuredAt,
        rttMs: best.rtt,
      }));
    } catch {
      // Speichern gescheitert – Offset gilt trotzdem fuer diese Sitzung
    }
    return true;
  }

  start(intervalMs = 60000): void {
    if (this.timerId !== null) {
      return;
    }
    this.timerId = setInterval(() => {
      void this.sync();
    }, intervalMs);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
