/**
 * Lebenszeichen des Hallen-Lautsprechers (H3b-3, Plan „Lebenszeichen“): `hall_speaker_heartbeat` alle 5 s mit dem Zustand des
 * Geräts und den Anzeichen eines Ausgangswechsels (@HT-047), dazu der Testton in der Halle mit Quittung (@HT-017).
 *
 * Genau ein Tab je Gerät meldet – auch ohne aktivierten Tab, sonst sähe die Verwaltung „meldet sich nicht“ statt „Ton nicht
 * aktiviert“ (@HT-012, @HT-013). Weg: eine zweite Web-Lock-Sperre nur fürs Melden (`hallenton-melden`):
 * - Melden darf nur, wer sie hält. Der tönende Tab (Ton-Sperre `hallenton`) meldet immer, aus dem Worker-Takt (`beimTakt`),
 *   damit ein minimierter Lautsprecher weiter meldet (@HT-029).
 * - Ein wartender Tab meldet nur, solange kein anderer Tab tönt (keine fremde Meldung im Kanal, `lautsprecherKanal.ts`).
 *   Tönt ein anderer Tab, gibt er die Melde-Sperre frei und stellt sich zurück, bis die fremde Meldung verschwindet; der
 *   tönende Tab steht dann schon in der Warteschlange und übernimmt. Eine laufende Anfrage endet vor der Freigabe – so
 *   melden nie zwei Tabs zugleich, und die letzte Meldung ist die des tönenden Tabs.
 * - Zwischen den 5-s-Meldungen meldet ein geänderter Zustand sofort (höchstens einmal je Sekunde), etwa `background`, sobald
 *   die Wache im Hauptthread einen Aussetzer des Takts meldet (@HT-014).
 *
 * Antwort:
 * - `superseded`/`unassigned` für ein Feld (Regel 1): lokal abschalten (`abgeloest`, die Laufzeit stoppt vor dem Speichern,
 *   kein Ton danach); die übrigen Felder bleiben eingeschaltet.
 * - `turnier_beendet` (55000): still abschalten.
 * - Offener Testton (Serverzeit ≤ 10 s, nicht schon von diesem Gerät gespielt): nur der tönende Tab spielt ihn einmal
 *   (`jetztSpielen('abpfiff')`), dann `hall_test_tone_ack` (@HT-017). Ging die Quittung verloren, quittiert er beim nächsten
 *   Lebenszeichen erneut, ohne den Ton zu wiederholen. Ohne aktivierten Tab kein Ton und keine Quittung. Ein
 *   Ton entsteht nie aus dem Inhalt einer Kanal-Nachricht, nur aus der Antwort des Servers (@HT-044).
 * - Danach liest der tönende Tab die Tonwahl neu (`nachLebenszeichen`, k-neu-2).
 * Kein `p_output_changed` geht verloren: Anzeichen bleiben offen, bis ein Lebenszeichen mit ihnen angekommen ist.
 */
import type {
  HallArgs, HallErgebnis, HallHeartbeatAntwort, HallSpeakerState, HallTestAckAntwort,
} from '../../../core/repositories/hallentonRpc';
import type { AusgangsSignale } from './ausgangsSignale';
import type { GeraeteSperre } from './geraeteSperre';
import type { HallTonSpieler } from './hallTonSpieler';
import type { HallLautsprecherLaufzeit } from './laufzeitZustand';
import type { KanalSpeicher, LautsprecherKanal } from './lautsprecherKanal';
import { lies, schreib } from './tonEinstellungen';
import type { Zeitgeber } from './zeitgeber';

export const LEBENSZEICHEN_MS = 5000;
/** Ein geänderter Zustand meldet sofort, aber höchstens so oft (ms). */
export const LEBENSZEICHEN_MIN_ABSTAND_MS = 1000;
/** Ein Testton gilt höchstens so lange nach der Anforderung (Serverzeit, Server und Gerät prüfen beide). */
export const TESTTON_MAX_ALTER_MS = 10_000;
export const MELDE_SPERRE_NAME = 'hallenton-melden';
export const TESTTOENE_SCHLUESSEL = 'hallenton:testtoene';
const TESTTOENE_MAX = 20;
const PRUEF_MS = 1000;

export interface LebenszeichenRpc {
  heartbeat(args: HallArgs<'hall_speaker_heartbeat'>): Promise<HallErgebnis<HallHeartbeatAntwort>>;
  ack(args: HallArgs<'hall_test_tone_ack'>): Promise<HallErgebnis<HallTestAckAntwort>>;
}

export interface LebenszeichenDeps {
  turnierId: string;
  felder: readonly number[];
  deviceId: string;
  laufzeit: Pick<HallLautsprecherLaufzeit, 'getSnapshot' | 'subscribe' | 'beimTakt' | 'stillAbschalten'>;
  spieler: Pick<HallTonSpieler, 'jetztSpielen'>;
  /** Anzeichen eines Ausgangswechsels am Spieler dieses Tabs; erst im tönenden Tab erzeugt. */
  erzeugeAusgang: () => AusgangsSignale | null;
  /** Melde-Sperre (`hallenton-melden`). */
  sperre: GeraeteSperre;
  kanal: Pick<LautsprecherKanal, 'lesen' | 'eigenesAlter' | 'beobachten'>;
  /** Hauptthread: monotone Zeit und Prüf-Takt (1 s). */
  zeitgeber: Zeitgeber;
  rpc: LebenszeichenRpc;
  /** Gespielte Testtöne des Geräts (über die Tabs). */
  speicher: KanalSpeicher | null;
  /** Regel 1: abgelöst oder abgemeldet; `bleiben` = Felder, die das Gerät noch hat (leer = ganz aus). */
  abgeloest: (bleiben: number[]) => void;
  nachLebenszeichen?: () => void;
}

export interface Lebenszeichen {
  start(): void;
  stop(): void;
}

/** `zurueck`: ein anderer Tab tönt, keine Anforderung, bis seine Meldung verschwindet. */
type Phase = 'aus' | 'zurueck' | 'angefordert' | 'haelt';

function gespielteTests(speicher: KanalSpeicher | null): string[] {
  try {
    const roh: unknown = JSON.parse(lies(speicher, TESTTOENE_SCHLUESSEL) ?? '[]');
    return Array.isArray(roh) ? roh.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function erzeugeLebenszeichen(d: LebenszeichenDeps): Lebenszeichen {
  let gestartet = false;
  let phase: Phase = 'aus';
  let anforderung = 0;
  let freigeben: (() => void) | null = null;
  let laeuft = false;
  let letzteSendung: number | null = null;
  let gesendeterZustand: HallSpeakerState | null = null;
  let anzeichenOffen = false;
  let ausgang: AusgangsSignale | null = null;
  const ab: Array<() => void> = [];

  const snapshot = () => d.laufzeit.getSnapshot();
  const fremdeMeldung = (): boolean => d.kanal.lesen() !== null && d.kanal.eigenesAlter() === null;
  const sollMelden = (): boolean => snapshot().rolle === 'toent' || (snapshot().rolle === 'wartet' && !fremdeMeldung());
  const seit = (): number => (letzteSendung === null ? Number.POSITIVE_INFINITY : d.zeitgeber.jetzt() - letzteSendung);
  const faellig = (): boolean => seit() >= LEBENSZEICHEN_MS
    || (gesendeterZustand !== snapshot().geraeteZustand && seit() >= LEBENSZEICHEN_MIN_ABSTAND_MS);

  function loslassen(naechste: Phase): void {
    anforderung += 1; // eine noch ausstehende Zusage zählt nicht mehr
    freigeben?.();
    freigeben = null;
    phase = naechste;
  }

  function anfordern(): void {
    phase = 'angefordert';
    const meine = ++anforderung;
    const loesen = d.sperre.anfordern((meldung) => {
      if (meine === anforderung && meldung === 'erhalten') {
        phase = 'haelt';
        pruefen();
      }
    });
    if (meine === anforderung) {
      freigeben = loesen;
    } else {
      loesen(); // schon in der Zusage wieder losgelassen (Rückfall ohne Web Locks)
    }
  }

  function pruefen(): void {
    if (!gestartet) {
      return;
    }
    const { rolle } = snapshot();
    if (rolle === 'aus' || rolle === 'still') {
      loslassen('aus');
      return;
    }
    if (!sollMelden()) {
      if (!laeuft) {
        loslassen('zurueck'); // erst nach der laufenden Anfrage: nie zwei Melder zugleich
      }
      return;
    }
    if (phase === 'aus' || phase === 'zurueck') {
      anfordern();
    } else if (phase === 'haelt' && faellig()) {
      senden();
    }
  }

  function imTakt(): void {
    if (snapshot().rolle !== 'toent') {
      return;
    }
    ausgang ??= d.erzeugeAusgang();
    ausgang?.messen(); // kurze Sprünge zwischen zwei Lebenszeichen nicht verlieren
    pruefen();
  }

  function senden(): void {
    if (laeuft) {
      return;
    }
    const snap = snapshot();
    if (snap.rolle === 'toent') {
      ausgang ??= d.erzeugeAusgang();
      anzeichenOffen = (ausgang?.abholen().length ?? 0) > 0 || anzeichenOffen;
    }
    const mitAnzeichen = anzeichenOffen;
    const gesendetUm = d.zeitgeber.jetzt();
    laeuft = true;
    letzteSendung = gesendetUm;
    gesendeterZustand = snap.geraeteZustand;
    void d.rpc.heartbeat({
      p_tournament_id: d.turnierId, p_device_id: d.deviceId, p_fields: [...d.felder],
      p_state: snap.geraeteZustand, p_output_changed: mitAnzeichen,
    }).catch((): HallErgebnis<HallHeartbeatAntwort> => ({ ok: false, grund: 'netz' })).then((antwort) => {
      laeuft = false;
      if (gestartet) {
        verarbeiten(antwort, gesendetUm, mitAnzeichen);
        pruefen();
      }
    });
  }

  function verarbeiten(antwort: HallErgebnis<HallHeartbeatAntwort>, gesendetUm: number, mitAnzeichen: boolean): void {
    if (!antwort.ok) {
      if (antwort.grund === 'turnier_beendet') {
        d.laufzeit.stillAbschalten();
      }
      return;
    }
    if (mitAnzeichen) {
      anzeichenOffen = false;
    }
    const weg = new Set(antwort.fields.filter((f) => f.status !== 'ok').map((f) => f.field));
    if (weg.size > 0) {
      stop();
      d.abgeloest(d.felder.filter((feld) => !weg.has(feld)));
      return;
    }
    if (snapshot().rolle !== 'toent' || phase !== 'haelt') {
      return; // Testton nur im tönenden Tab (@HT-017: ohne aktivierten Tab kein Ton, keine Quittung)
    }
    spieleTestton(antwort, d.zeitgeber.jetzt() - gesendetUm);
    d.nachLebenszeichen?.();
  }

  function quittieren(tests: ReadonlyArray<{ feld: number; testId: string }>): void {
    for (const { feld, testId } of tests) {
      void d.rpc.ack({ p_tournament_id: d.turnierId, p_field: feld, p_device_id: d.deviceId, p_test_id: testId }).catch(() => undefined);
    }
  }

  function spieleTestton(antwort: HallHeartbeatAntwort, unterwegsMs: number): void {
    const gespielt = gespielteTests(d.speicher);
    const tests = antwort.fields.flatMap((f) => (f.status === 'ok' && f.test ? [{ feld: f.field, testId: f.test.testId, ageMs: f.test.ageMs }] : []));
    // schon gespielt, aber die Quittung ging verloren (der Server bietet ihn weiter an): nur quittieren, nie ein zweiter Ton
    quittieren(tests.filter((t) => gespielt.includes(t.testId)));
    const offen = tests.filter((t) => !gespielt.includes(t.testId) && t.ageMs + unterwegsMs <= TESTTON_MAX_ALTER_MS);
    if (offen.length === 0 || !d.spieler.jetztSpielen('abpfiff')) {
      return; // stumm oder 0 %: nicht gespielt, also keine Quittung
    }
    ausgang?.testtonGespielt();
    schreib(d.speicher, TESTTOENE_SCHLUESSEL, JSON.stringify([...gespielt, ...offen.map((t) => t.testId)].slice(-TESTTOENE_MAX)));
    quittieren(offen);
  }

  function stop(): void {
    if (!gestartet) {
      return;
    }
    gestartet = false;
    loslassen('aus');
    for (const fn of ab.splice(0)) {
      fn();
    }
    ausgang?.beenden();
    ausgang = null;
  }

  return {
    start() {
      if (gestartet) {
        return;
      }
      gestartet = true;
      ab.push(
        d.laufzeit.subscribe(pruefen),
        d.laufzeit.beimTakt(imTakt),
        d.kanal.beobachten(pruefen),
        d.zeitgeber.wiederholen(pruefen, PRUEF_MS),
      );
      pruefen();
    },
    stop,
  };
}
