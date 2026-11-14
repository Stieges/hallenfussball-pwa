/**
 * Testton in der Halle mit Quittung (aus `lautsprecherLebenszeichen.ts`, H4-1; @HT-017): Der Server bietet einen offenen
 * Testton in der Antwort des Lebenszeichens an (Serverzeit + Laufzeit ≤ 10 s, nicht schon gespielt – Speicher und Instanz, K1):
 * nur der tönende Tab spielt ihn einmal, dann `hall_test_tone_ack`; eine verlorene Quittung wird ohne zweiten Ton nachgeholt.
 * Nie aus Kanal-Inhalten (@HT-044).
 */
import type {
  HallArgs, HallErgebnis, HallHeartbeatAntwort, HallTestAckAntwort,
} from '../../../core/repositories/hallentonRpc';
import type { AusgangsSignale } from './ausgangsSignale';
import type { HallTonSpieler } from './hallTonSpieler';
import type { KanalSpeicher } from './lautsprecherKanal';
import { lies, schreib } from './tonEinstellungen';

export const TESTTOENE_SCHLUESSEL = 'hallenton:testtoene';
/** Ein Testton gilt höchstens so lange nach der Anforderung (Serverzeit, Server und Gerät prüfen beide). */
export const TESTTON_MAX_ALTER_MS = 10_000;
const TESTTOENE_MAX = 20;

export interface TesttonDeps {
  turnierId: string;
  deviceId: string;
  spieler: Pick<HallTonSpieler, 'jetztSpielen'>;
  /** Gespielte Testtöne des Geräts (über die Tabs). */
  speicher: KanalSpeicher | null;
  /** Anzeichen eines Ausgangswechsels am Spieler dieses Tabs (kann wechseln, daher als Funktion). */
  ausgang: () => AusgangsSignale | null;
  ack: (args: HallArgs<'hall_test_tone_ack'>) => Promise<HallErgebnis<HallTestAckAntwort>>;
}

export interface Testton {
  /** Offene Testtöne aus der Antwort spielen und quittieren; `unterwegsMs` = Laufzeit der Anfrage. */
  spielen(antwort: HallHeartbeatAntwort, unterwegsMs: number): void;
}

function gespielteTests(speicher: KanalSpeicher | null): string[] {
  try {
    const roh: unknown = JSON.parse(lies(speicher, TESTTOENE_SCHLUESSEL) ?? '[]');
    return Array.isArray(roh) ? roh.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function erzeugeTestton(d: TesttonDeps): Testton {
  const gespieltHier = new Set<string>(); // K1: auch ohne Speicher kein zweiter Ton

  function quittieren(tests: ReadonlyArray<{ feld: number; testId: string }>): void {
    for (const { feld, testId } of tests) {
      void d.ack({ p_tournament_id: d.turnierId, p_field: feld, p_device_id: d.deviceId, p_test_id: testId }).catch(() => undefined);
    }
  }

  return {
    spielen(antwort, unterwegsMs) {
      const gespielt = [...new Set([...gespielteTests(d.speicher), ...gespieltHier])];
      const tests = antwort.fields.flatMap((f) => (f.status === 'ok' && f.test ? [{ feld: f.field, testId: f.test.testId, ageMs: f.test.ageMs }] : []));
      // schon gespielt, aber die Quittung ging verloren (der Server bietet ihn weiter an): nur quittieren, nie ein zweiter Ton
      quittieren(tests.filter((t) => gespielt.includes(t.testId)));
      const offen = tests.filter((t) => !gespielt.includes(t.testId) && t.ageMs + unterwegsMs <= TESTTON_MAX_ALTER_MS);
      if (offen.length === 0 || !d.spieler.jetztSpielen('abpfiff')) {
        return; // 0 %: nicht gespielt, also keine Quittung
      }
      d.ausgang()?.testtonGespielt();
      for (const t of offen) {
        gespieltHier.add(t.testId);
      }
      schreib(d.speicher, TESTTOENE_SCHLUESSEL, JSON.stringify([...gespielt, ...offen.map((t) => t.testId)].slice(-TESTTOENE_MAX)));
      quittieren(offen);
    },
  };
}
