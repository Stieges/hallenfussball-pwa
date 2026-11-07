/**
 * Test-Hilfe Hallenton (H3b-3): Server-Doppel der Lebenszeichen-Funktionen nach `supabase/migrations/20261121_001_hallenton.sql`
 * – `hall_speaker_heartbeat`, `hall_test_tone_request` (höchstens einmal je 3 s und Feld), `hall_test_tone_ack`,
 * `hall_field_lead_heartbeat`, `hall_output_heard` und `hall_sound_status` (volle/schmale Sicht). Zeit ist die Serverzeit
 * `jetzt()`; Alter rechnet der Server. `netz` steuert das Netz (`weg` = jede Anfrage scheitert mit `netz`), `fehler` liefert
 * einen festen Fehlergrund (z. B. `kein_recht`, `turnier_beendet`). Jedes Lebenszeichen wird mit Absender protokolliert.
 */
import type {
  HallArgs, HallErgebnis, HallFehlerGrund, HallHeartbeatAntwort, HallHeardAntwort, HallLeadHeartbeatAntwort,
  HallSpeakerState, HallStatusAntwort, HallTestAckAntwort, HallTestRequestAntwort,
} from '../../core/repositories/hallentonRpc';

interface Lautsprecher {
  deviceId: string;
  deviceName: string;
  state: HallSpeakerState | null;
  lastSeen: number | null;
  hintAt: number | null;
  test: { testId: string; requestedAt: number; playedAt: number | null } | null;
  assignedAt: number;
}

export interface GesendetesLebenszeichen {
  von: string;
  at: number;
  state: string;
  outputChanged: boolean;
  fields: number[];
}

export class FalscherHallServer {
  readonly lautsprecher = new Map<number, Lautsprecher>();
  readonly leitung = new Map<number, { deviceId: string; lastSeen: number }>();
  /** Felder, die das Konto steuert (field_control), je Gerät. */
  readonly steuer = new Map<number, string>();
  readonly lebenszeichen: GesendetesLebenszeichen[] = [];
  readonly quittungen: Array<{ field: number; testId: string; at: number }> = [];
  readonly aufrufe: string[] = [];
  netz: 'ok' | 'weg' = 'ok';
  fehler: HallFehlerGrund | null = null;
  /** Antwort auf Lebenszeichen kommt so viel später an (ms, über `spaeter`). */
  verzoegerungMs = 0;
  vollSicht = true;
  private testZaehler = 0;

  constructor(readonly jetzt: () => number, private readonly spaeter: (fn: () => void, ms: number) => void = (fn) => fn()) {}

  zuordnen(feld: number, deviceId: string, deviceName = 'Rechner der Turnierleitung'): void {
    this.lautsprecher.set(feld, { deviceId, deviceName, state: null, lastSeen: null, hintAt: null, test: null, assignedAt: this.jetzt() });
  }

  private antwort<T>(fn: string, bau: () => T): Promise<HallErgebnis<T>> {
    this.aufrufe.push(fn);
    if (this.netz === 'weg') {
      return Promise.resolve({ ok: false, grund: 'netz' });
    }
    if (this.fehler !== null) {
      return Promise.resolve({ ok: false, grund: this.fehler });
    }
    return Promise.resolve({ ok: true, ...bau() } as HallErgebnis<T>);
  }

  /** Absender `von` (Tab) nur fürs Protokoll. */
  heartbeat(von: string, a: HallArgs<'hall_speaker_heartbeat'>): Promise<HallErgebnis<HallHeartbeatAntwort>> {
    const lauf = this.antwort('hall_speaker_heartbeat', (): HallHeartbeatAntwort => {
      const now = this.jetzt();
      this.lebenszeichen.push({ von, at: now, state: a.p_state, outputChanged: a.p_output_changed === true, fields: [...a.p_fields] });
      const fields = a.p_fields.map((feld) => {
        const s = this.lautsprecher.get(feld);
        if (s?.deviceId === a.p_device_id) {
          s.state = a.p_state as HallSpeakerState;
          s.lastSeen = now;
          if (a.p_output_changed === true) {
            s.hintAt = now;
          }
        }
        const mein = s?.deviceId === a.p_device_id;
        const test = mein ? s.test : null;
        const offen = test?.playedAt === null && test.requestedAt > now - 10_000 ? test : null;
        const l = this.leitung.get(feld);
        return {
          field: feld,
          status: !s ? 'unassigned' as const : mein ? 'ok' as const : 'superseded' as const,
          test: offen ? { testId: offen.testId, ageMs: now - offen.requestedAt } : null,
          lead: mein && l ? { ageMs: now - l.lastSeen } : null,
        };
      });
      return { status: 'ok', serverNow: now, fields };
    });
    if (this.verzoegerungMs === 0) {
      return lauf;
    }
    return new Promise((resolve) => {
      this.spaeter(() => resolve(lauf), this.verzoegerungMs);
    });
  }

  testtonAnfordern(a: HallArgs<'hall_test_tone_request'>): Promise<HallErgebnis<HallTestRequestAntwort>> {
    return this.antwort('hall_test_tone_request', (): HallTestRequestAntwort => {
      const now = this.jetzt();
      const s = this.lautsprecher.get(a.p_field);
      if (!s) {
        return { status: 'no_speaker', serverNow: now };
      }
      if (s.test && s.test.requestedAt > now - 3000) {
        return { status: 'too_soon', serverNow: now, retryInMs: s.test.requestedAt + 3000 - now };
      }
      this.testZaehler += 1;
      s.test = { testId: `test-${this.testZaehler}`, requestedAt: now, playedAt: null };
      return { status: 'requested', testId: s.test.testId, requestedAt: now, serverNow: now };
    });
  }

  ack(a: HallArgs<'hall_test_tone_ack'>): Promise<HallErgebnis<HallTestAckAntwort>> {
    return this.antwort('hall_test_tone_ack', (): HallTestAckAntwort => {
      const s = this.lautsprecher.get(a.p_field);
      if (s?.deviceId !== a.p_device_id) {
        return { status: 'superseded' };
      }
      if (s.test?.testId !== a.p_test_id) {
        return { status: 'unknown_test' };
      }
      s.test.playedAt ??= this.jetzt();
      this.quittungen.push({ field: a.p_field, testId: a.p_test_id, at: this.jetzt() });
      return { status: 'acked', playedAt: s.test.playedAt };
    });
  }

  leitungHeartbeat(a: HallArgs<'hall_field_lead_heartbeat'>): Promise<HallErgebnis<HallLeadHeartbeatAntwort>> {
    return this.antwort('hall_field_lead_heartbeat', (): HallLeadHeartbeatAntwort => {
      const now = this.jetzt();
      const s = this.lautsprecher.get(a.p_field);
      const speaker = s ? { state: s.state, ageMs: s.lastSeen === null ? null : now - s.lastSeen, outputHint: s.hintAt !== null } : null;
      if (this.steuer.get(a.p_field) !== a.p_device_id) {
        return { status: 'not_controller', serverNow: now, speaker };
      }
      this.leitung.set(a.p_field, { deviceId: a.p_device_id, lastSeen: now });
      return { status: 'ok', serverNow: now, speaker };
    });
  }

  gehoert(a: HallArgs<'hall_output_heard'>): Promise<HallErgebnis<HallHeardAntwort>> {
    return this.antwort('hall_output_heard', (): HallHeardAntwort => {
      const s = this.lautsprecher.get(a.p_field);
      if (!s) {
        return { status: 'no_speaker' };
      }
      s.hintAt = null;
      return { status: 'heard' };
    });
  }

  status(a: HallArgs<'hall_sound_status'>): Promise<HallErgebnis<HallStatusAntwort>> {
    return this.antwort('hall_sound_status', (): HallStatusAntwort => {
      const now = this.jetzt();
      const felder = [...this.lautsprecher.entries()].sort(([x], [y]) => x - y);
      const alter = (s: Lautsprecher): number | null => (s.lastSeen === null ? null : now - s.lastSeen);
      if (!this.vollSicht) {
        return { sicht: 'schmal', serverNow: now, speakers: felder.map(([field, s]) => ({ field, state: s.state, ageMs: alter(s), outputHint: s.hintAt !== null })) };
      }
      return {
        sicht: 'voll', serverNow: now, closed: false,
        speakers: felder.map(([field, s]) => ({
          field, deviceName: s.deviceName, isThisDevice: s.deviceId === a.p_device_id, state: s.state, assignedAt: s.assignedAt,
          outputHint: s.hintAt !== null, hintAt: s.hintAt, lastSeen: s.lastSeen, ageMs: alter(s), test: s.test,
        })),
        leads: [...this.leitung.entries()].map(([field, l]) => ({ field, ageMs: now - l.lastSeen })),
        settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [] },
      };
    });
  }
}
