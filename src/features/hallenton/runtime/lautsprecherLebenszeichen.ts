/**
 * Lebenszeichen des Hallen-Lautsprechers (H3b-3): `hall_speaker_heartbeat` alle 5 s mit Zustand und Anzeichen eines
 * Ausgangswechsels (@HT-047), dazu der Testton in der Halle mit Quittung (@HT-017).
 *
 * Genau ein Tab je Gerät meldet, auch ohne aktivierten Tab (@HT-012, @HT-013), über die Melde-Sperre `hallenton-melden`: der tönende
 * Tab immer (aus dem Worker-Takt, @HT-029), ein wartender nur, solange keine fremde Meldung im Kanal steht – nie zwei zugleich.
 * Ein geänderter Zustand meldet sofort (höchstens 1/s), etwa `background` aus der Wache im Hauptthread (@HT-014).
 * Antwort:
 * - `superseded`/`unassigned` (Regel 1): lokal abschalten (`abgeloest`, kein Ton danach); die übrigen Felder bleiben.
 * - Turnierende (Fixrunde 1, W1): Seit `20261123_001_hallenton_torhymne.sql` antwortet der Server nach dem Ende 55000
 *   (`hall_require_open`) → `turnier_beendet` → still abschalten. Zusätzlich prüft jeder Tab die lokale Turnierkopie
 *   (`lebenszeichenTurnierende.ts`).
 * - `kein_recht` dreimal in Folge: still wie ein Gast; jeder Fehlergrund geht an `beiFehler`, ein Erfolg setzt ihn zurück (K2).
 *   Dieses „still“ ist nicht endgültig (H4-1, N2): `wiederAufnehmen()` (Neu-Anmeldung, Taste „erneut versuchen“) startet die
 *   Laufzeit neu und meldet wieder; das „still“ nach Turnierende bleibt.
 * - Offener Testton (`lebenszeichenTestton.ts`): nur der tönende Tab spielt ihn einmal, dann Quittung. Danach liest der tönende Tab
 *   die Tonwahl neu (`nachLebenszeichen`, k-neu-2).
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
import { erzeugeTestton } from './lebenszeichenTestton';
import { erzeugeTurnierendePruefung } from './lebenszeichenTurnierende';
import type { Zeitgeber } from './zeitgeber';

export const LEBENSZEICHEN_MS = 5000;
/** Ein geänderter Zustand meldet sofort, aber höchstens so oft (ms). */
export const LEBENSZEICHEN_MIN_ABSTAND_MS = 1000;
export const MELDE_SPERRE_NAME = 'hallenton-melden';
export { TESTTOENE_SCHLUESSEL, TESTTON_MAX_ALTER_MS } from './lebenszeichenTestton';
export { TURNIERENDE_FRIST_MS, TURNIERENDE_PRUEF_MS } from './lebenszeichenTurnierende';
/** So viele `kein_recht` in Folge schalten still ab. */
export const KEIN_RECHT_GRENZE = 3;
const PRUEF_MS = 1000;

/** Ein Feld, das das Gerät verloren hat: `abgeloest` = von einem anderen Gerät übernommen (`superseded`, @HT-015), `abgemeldet` = keine Zuordnung mehr (`unassigned`). */
export interface FeldVerlust {
  feld: number;
  art: 'abgeloest' | 'abgemeldet';
}

export interface LebenszeichenRpc {
  heartbeat(args: HallArgs<'hall_speaker_heartbeat'>): Promise<HallErgebnis<HallHeartbeatAntwort>>;
  ack(args: HallArgs<'hall_test_tone_ack'>): Promise<HallErgebnis<HallTestAckAntwort>>;
}

export interface LebenszeichenDeps {
  turnierId: string;
  felder: readonly number[];
  deviceId: string;
  laufzeit: Pick<HallLautsprecherLaufzeit, 'getSnapshot' | 'subscribe' | 'beimTakt' | 'stillAbschalten' | 'start' | 'stop'>;
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
  abgeloest: (bleiben: number[], verloren: readonly FeldVerlust[]) => void;
  nachLebenszeichen?: () => void;
  /** Turnier abgeschlossen oder abgebrochen? (lokale Turnierkopie, W1) */
  turnierBeendet?: () => Promise<boolean>;
  /** Fehlergrund des letzten Lebenszeichens; `null` nach einem Erfolg (K2). */
  beiFehler?: (grund: HallFehlerGrund | null) => void;
}

export interface Lebenszeichen {
  start(): void;
  stop(): void;
  /** Nach „still“ wegen `kein_recht` neu anfangen; `false`, wenn das Gerät nicht deswegen still ist (z. B. Turnierende). */
  wiederAufnehmen(): boolean;
}

/** `zurueck`: ein anderer Tab tönt, keine Anforderung, bis seine Meldung verschwindet. */
type Phase = 'aus' | 'zurueck' | 'angefordert' | 'haelt';

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
  let keinRechtInFolge = 0;
  let stillWegenRecht = false;
  const testton = erzeugeTestton({
    turnierId: d.turnierId, deviceId: d.deviceId, spieler: d.spieler, speicher: d.speicher, ausgang: () => ausgang, ack: (args) => d.rpc.ack(args),
  });

  const turnierende = erzeugeTurnierendePruefung({
    zeitgeber: d.zeitgeber,
    turnierBeendet: d.turnierBeendet,
    fertig: (beendet) => {
      if (beendet && gestartet) {
        d.laufzeit.stillAbschalten();
      } else {
        pruefen();
      }
    },
  });

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
    if (turnierende.offen()) {
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
        stillWegenRecht = antwort.grund === 'kein_recht';
        d.laufzeit.stillAbschalten(); // 55000 nach dem Turnierende; kein Recht mehr wie ein Gast (endet, N2)
      }
      return;
    }
    if (mitAnzeichen) {
      anzeichenOffen = false;
    }
    const verloren: FeldVerlust[] = antwort.fields.flatMap((f) => (f.status === 'ok' ? [] : [{ feld: f.field, art: f.status === 'superseded' ? 'abgeloest' as const : 'abgemeldet' as const }]));
    const weg = new Set(verloren.map((v) => v.feld));
    if (weg.size > 0) {
      stop();
      d.abgeloest(d.felder.filter((feld) => !weg.has(feld)), verloren);
      return;
    }
    if (snapshot().rolle !== 'toent' || phase !== 'haelt') {
      return; // Testton nur im tönenden Tab (@HT-017: ohne aktivierten Tab kein Ton, keine Quittung)
    }
    testton.spielen(antwort, d.zeitgeber.jetzt() - gesendetUm);
    d.nachLebenszeichen?.();
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
    wiederAufnehmen() {
      if (!gestartet || !stillWegenRecht) {
        return false;
      }
      stillWegenRecht = false;
      keinRechtInFolge = 0;
      letzteSendung = null; // das nächste Lebenszeichen sofort, nicht erst nach 5 s
      d.laufzeit.stop(); // Rolle `still` → `aus`, dann wie beim ersten Start; „Ton aktivieren“ bleibt erhalten
      d.laufzeit.start();
      return true;
    },
  };
}
