/**
 * Lebenszeichen des Hallen-Lautsprechers (H3b-3): `hall_speaker_heartbeat` alle 5 s mit Zustand und Anzeichen eines
 * Ausgangswechsels (@HT-047), dazu der Testton in der Halle mit Quittung (@HT-017).
 *
 * Genau ein Tab je Gerät meldet, auch ohne aktivierten Tab (@HT-012, @HT-013), über die Melde-Sperre `hallenton-melden`:
 * - Der tönende Tab meldet immer, aus dem Worker-Takt (`beimTakt`, minimiert weiter, @HT-029). Ein wartender Tab nur, solange
 *   keine fremde Meldung im Kanal steht; sonst gibt er die Sperre nach seiner laufenden Anfrage frei – nie zwei Melder zugleich.
 * - Ein geänderter Zustand meldet sofort (höchstens 1/s), etwa `background` aus der Wache im Hauptthread (@HT-014).
 * Antwort:
 * - `superseded`/`unassigned` (Regel 1): lokal abschalten (`abgeloest`, kein Ton danach); die übrigen Felder bleiben.
 * - Turnierende (Fixrunde 1, W1): Der Server antwortet auch danach `ok` (kein `hall_require_open` – die Brief-Annahme „55000“
 *   traf nicht zu). Jeder Tab prüft höchstens alle 30 s die lokale Turnierkopie (`turnierBeendet`) und schaltet still ab,
 *   auch der wartende; das erste Lebenszeichen wartet auf die erste Prüfung, höchstens 2 s (N1 aus H3b-3: kehrt das Lesen
 *   nicht zurück, gilt „nicht beendet“). 55000 bleibt als Schutz.
 * - `kein_recht` dreimal in Folge: still wie ein Gast; jeder Fehlergrund geht an `beiFehler`, ein Erfolg setzt ihn zurück (K2).
 * - Offener Testton (Serverzeit + Laufzeit ≤ 10 s, nicht schon gespielt – Speicher und Instanz, K1): nur der tönende Tab spielt
 *   ihn einmal, dann `hall_test_tone_ack`; eine verlorene Quittung wird ohne zweiten Ton nachgeholt. Nie aus Kanal-Inhalten
 *   (@HT-044). Danach liest der tönende Tab die Tonwahl neu (`nachLebenszeichen`, k-neu-2).
 * Anzeichen bleiben offen, bis ein Lebenszeichen mit ihnen angekommen ist.
 */
import type {
  HallArgs, HallErgebnis, HallFehlerGrund, HallHeartbeatAntwort, HallSpeakerState, HallTestAckAntwort,
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
/** Turnierende aus der lokalen Kopie höchstens so oft prüfen (ms). */
export const TURNIERENDE_PRUEF_MS = 30_000;
/** Frist der Prüfung auf Turnierende (N1): danach gilt „nicht beendet“, das Lebenszeichen geht raus. */
export const TURNIERENDE_FRIST_MS = 2000;
/** So viele `kein_recht` in Folge schalten still ab. */
export const KEIN_RECHT_GRENZE = 3;
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
  /** Turnier abgeschlossen oder abgebrochen? (lokale Turnierkopie, W1) */
  turnierBeendet?: () => Promise<boolean>;
  /** Fehlergrund des letzten Lebenszeichens; `null` nach einem Erfolg (K2). */
  beiFehler?: (grund: HallFehlerGrund | null) => void;
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
  const gespieltHier = new Set<string>(); // K1: auch ohne Speicher kein zweiter Ton
  let endeGeprueftUm: number | null = null;
  let endePruefungLaeuft = false;
  let keinRechtInFolge = 0;

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

  /** N1: Ein Fehler oder eine Prüfung ohne Rückkehr binnen 2 s gilt als „nicht beendet“. */
  function mitFrist(pruefung: Promise<boolean>): Promise<boolean> {
    return new Promise((fertig) => {
      const abbrechen = d.zeitgeber.spaeter(() => fertig(false), TURNIERENDE_FRIST_MS);
      void pruefung.catch(() => false).then((beendet) => {
        abbrechen();
        fertig(beendet);
      });
    });
  }

  /** W1: höchstens alle 30 s; `true` = noch keine Prüfung abgeschlossen (dann wird nicht gemeldet). */
  function turnierendeOffen(): boolean {
    const pruef = d.turnierBeendet;
    if (!pruef) {
      return false;
    }
    const jetzt = d.zeitgeber.jetzt();
    if (!endePruefungLaeuft && (endeGeprueftUm === null || jetzt - endeGeprueftUm >= TURNIERENDE_PRUEF_MS)) {
      endePruefungLaeuft = true;
      void mitFrist(pruef()).then((beendet) => {
        endePruefungLaeuft = false;
        endeGeprueftUm = d.zeitgeber.jetzt();
        if (beendet && gestartet) {
          d.laufzeit.stillAbschalten();
        } else {
          pruefen();
        }
      });
    }
    return endeGeprueftUm === null;
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
    if (turnierendeOffen()) {
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
    d.beiFehler?.(antwort.ok ? null : antwort.grund);
    keinRechtInFolge = !antwort.ok && antwort.grund === 'kein_recht' ? keinRechtInFolge + 1 : 0;
    if (!antwort.ok) {
      if (antwort.grund === 'turnier_beendet' || keinRechtInFolge >= KEIN_RECHT_GRENZE) {
        d.laufzeit.stillAbschalten(); // 55000 als Schutz; kein Recht mehr wie ein Gast
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
    const gespielt = [...new Set([...gespielteTests(d.speicher), ...gespieltHier])];
    const tests = antwort.fields.flatMap((f) => (f.status === 'ok' && f.test ? [{ feld: f.field, testId: f.test.testId, ageMs: f.test.ageMs }] : []));
    // schon gespielt, aber die Quittung ging verloren (der Server bietet ihn weiter an): nur quittieren, nie ein zweiter Ton
    quittieren(tests.filter((t) => gespielt.includes(t.testId)));
    const offen = tests.filter((t) => !gespielt.includes(t.testId) && t.ageMs + unterwegsMs <= TESTTON_MAX_ALTER_MS);
    if (offen.length === 0 || !d.spieler.jetztSpielen('abpfiff')) {
      return; // stumm oder 0 %: nicht gespielt, also keine Quittung
    }
    ausgang?.testtonGespielt();
    for (const t of offen) {
      gespieltHier.add(t.testId);
    }
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
