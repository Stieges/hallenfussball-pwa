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

export class ClockSync {
  private offsetMs = 0;
  private measuredAt = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private lastData: ClockSyncData | null = null;

  constructor(
    private fetchServerTime: () => Promise<number>,
    private now: () => number,
    private storage: ClockStorage,
  ) {
    const raw = this.storage.get('clockSync:v1');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ClockSyncData>;
        if (typeof parsed.offsetMs === 'number') {
          this.offsetMs = Math.round(parsed.offsetMs);
        }
        if (typeof parsed.measuredAt === 'number') {
          this.measuredAt = parsed.measuredAt;
        }
        this.lastData = {
          offsetMs: this.offsetMs,
          measuredAt: this.measuredAt,
          rttMs: typeof parsed.rttMs === 'number' ? parsed.rttMs : 0,
        };
      } catch {
        // Ignoriere defekten Speicherinhalt
      }
    }
  }

  get offsetMsValue(): number {
    return this.offsetMs;
  }

  get isKnown(): boolean {
    return this.measuredAt > 0 || this.offsetMs !== 0;
  }

  get measuredAtValue(): number {
    return this.measuredAt;
  }

  serverNow(): number {
    return Math.round(this.now() + this.offsetMs);
  }

  async sync(): Promise<boolean> {
    const measurements: { rtt: number; offset: number }[] = [];
    const attempts = 3;
    for (let i = 0; i < attempts; i++) {
      try {
        const t0 = this.now();
        const s = await this.fetchServerTime();
        const t1 = this.now();
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
    this.offsetMs = Math.round(best.offset);
    this.measuredAt = this.now();
    this.lastData = { offsetMs: this.offsetMs, measuredAt: this.measuredAt, rttMs: best.rtt };
    this.storage.set('clockSync:v1', JSON.stringify(this.lastData));
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
