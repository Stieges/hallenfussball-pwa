/**
 * useHallLautsprecher(tid) – Schnittstelle für H4 (Plan „Schnittstelle für H4“, H3b-2b): Rolle und Felder dieses Geräts,
 * Zustand je Feld mit Grund, nächster Ton, Aktionen, Lautstärke und Stumm. Keine Oberfläche.
 *
 * - `einschalten(felder, name, abloesen?)` über `hall_speaker_assign` (@HT-001, @HT-002, @HT-015): bei `assigned` merkt sich das
 *   Gerät die Einschaltung, der Baustein in `App.tsx` startet die Laufzeit; `occupied` geht an H4 für die Rückfrage
 *   „Ablösen?“. Ein Gerät ist für höchstens ein Turnier Lautsprecher (`anderesTurnier`).
 * - `tonAktivieren()` aus der Nutzergeste (@HT-012, @HT-013, @HT-037): `spieler.aktivieren()` ohne vorheriges `await`.
 * - `ausschalten()` über `hall_speaker_release` (@HT-038); die Laufzeit stoppt auch ohne Netz (Wunsch des Nutzers). Ohne Netz
 *   holt das Gerät die Abmeldung später nach (`ausstehendeAbmeldung.ts`, H3b-3); ein neues Einschalten verwirft sie.
 * - `hierAnhoeren(ton)` spielt den Ton nur auf diesem Gerät (@HT-023, „Anhören“) – mit der Tonwahl des Turniers, auch vor der
 *   Aktivierung und ohne Lautsprecher-Funktion (k4-neu-2, H3b-3).
 */
import { useCallback, useMemo, useReducer, useSyncExternalStore } from 'react';
import { getDeviceId } from '../../core/device/deviceId';
import {
  hallSpeakerAssign, hallSpeakerRelease, type HallAssignAntwort, type HallErgebnis, type HallFehlerGrund, type HallReleaseAntwort,
} from '../../core/repositories/hallentonRpc';
import { supabase } from '../../lib/supabase';
import { merkeAbmeldung, vergissAbmeldung, vergissAbmeldungWenn } from './ausstehendeAbmeldung';
import { leseTonWahlSofort } from './browserLaufzeit';
import { ladeTurnierLokal } from './lokalesTurnier';
import { abonniereGeraet, geraetSpieler, geraetStand, schlafenQuittiert, setzeEinschaltung } from './lautsprecherGeraet';
import type { LaufzeitSnapshot } from './runtime/HallLautsprecherLaufzeit';
import type { TonArt } from './runtime/hallTonSpieler';

export type HallLautsprecherRolle = 'keiner' | 'diesesTurnier' | 'anderesTurnier';

export interface HallLautsprecher {
  rolle: HallLautsprecherRolle;
  /** Felder dieses Geräts im Turnier `tid` (leer bei `keiner`/`anderesTurnier`). */
  felder: readonly number[];
  name: string | null;
  /** Zustand der Laufzeit (`zustandJeFeld`, `naechsterTon`, `rolle` toent/andererTab …); `null`, solange keine läuft. */
  laufzeit: LaufzeitSnapshot | null;
  einschalten(felder: readonly number[], name: string, abloesen?: boolean): Promise<HallErgebnis<HallAssignAntwort>>;
  tonAktivieren(): Promise<boolean>;
  ausschalten(): Promise<HallErgebnis<HallReleaseAntwort> | null>;
  hierAnhoeren(ton: TonArt): Promise<boolean>;
  lautstaerke: Readonly<Record<TonArt, number>>;
  setzeLautstaerke(ton: TonArt, prozent: number): void;
  stumm: boolean;
  setzeStumm(stumm: boolean): void;
  /** Fehlergrund des letzten Lebenszeichens (z. B. `ungueltig`); `null` = angekommen (H3b-3 K2). */
  lebenszeichenFehler: HallFehlerGrund | null;
}

const nieAbonniert = (): (() => void) => () => undefined;

export function useHallLautsprecher(tid: string): HallLautsprecher {
  const { einschaltung, laufzeit, lebenszeichenFehler } = useSyncExternalStore(abonniereGeraet, geraetStand, geraetStand);
  const snapshot = useSyncExternalStore(laufzeit?.subscribe ?? nieAbonniert, () => laufzeit?.getSnapshot() ?? null, () => null);
  const [, neuZeichnen] = useReducer((n: number) => n + 1, 0);
  const rolle: HallLautsprecherRolle = einschaltung === null ? 'keiner' : einschaltung.turnierId === tid ? 'diesesTurnier' : 'anderesTurnier';

  const einschalten = useCallback(async (felder: readonly number[], name: string, abloesen = false) => {
    const ergebnis = await hallSpeakerAssign(supabase, {
      p_tournament_id: tid, p_fields: [...felder], p_device_id: getDeviceId(), p_device_name: name, p_replace: abloesen,
    });
    if (ergebnis.ok && ergebnis.status === 'assigned') {
      vergissAbmeldung(); // K6: erst jetzt – eine offene Abmeldung nähme die neue Zuordnung sonst wieder weg
      setzeEinschaltung({ turnierId: tid, felder: ergebnis.fields, name });
    }
    return ergebnis;
  }, [tid]);

  const tonAktivieren = useCallback(async () => {
    const aktuell = geraetStand().laufzeit;
    const ok = aktuell ? await aktuell.tonAktivieren() : await geraetSpieler().aktivieren();
    if (ok) {
      schlafenQuittiert();
    }
    return ok;
  }, []);

  const ausschalten = useCallback(async () => {
    const aktuell = geraetStand().einschaltung;
    if (aktuell?.turnierId !== tid) {
      return null;
    }
    // W3: „Aus“ wirkt sofort lokal – erst merken, dann stoppen, dann erst den Server fragen (Netz kann hängen)
    const abmeldung = { turnierId: tid, felder: [...aktuell.felder] };
    merkeAbmeldung(abmeldung);
    geraetStand().laufzeit?.stop(); // kein Ton mehr, auch bevor der Baustein die Laufzeit abräumt
    setzeEinschaltung(null);
    const ergebnis = await hallSpeakerRelease(supabase, { p_tournament_id: tid, p_fields: abmeldung.felder, p_device_id: getDeviceId() });
    if (ergebnis.ok || ergebnis.grund !== 'netz') {
      vergissAbmeldungWenn(abmeldung); // nur, wenn inzwischen nichts Neues gemerkt oder verworfen wurde
    }
    return ergebnis;
  }, [tid]);

  const hierAnhoeren = useCallback(async (ton: TonArt) => {
    const spieler = geraetSpieler();
    await spieler.aktivieren(); // der Klick ist selbst eine Geste: `resume()` läuft vor jedem await
    // k4-neu-2: die Tonwahl des Turniers – mit Laufzeit über deren Wahl (lädt nur, solange der Tab nicht aktiviert ist, ohne
    // ihn zu aktivieren, W2-neu-1), sonst selbst gelesen; K5: sofort mit der lokal bekannten Wahl, ohne aufs Netz zu warten
    const laufzeit = geraetStand().laufzeit;
    await (laufzeit ? laufzeit.ladeToeneZumAnhoeren() : spieler.laden(await leseTonWahlSofort(tid, ladeTurnierLokal)));
    return spieler.jetztSpielen(ton);
  }, [tid]);

  const setzeLautstaerke = useCallback((ton: TonArt, prozent: number) => {
    geraetSpieler().setzeLautstaerke(ton, prozent);
    neuZeichnen();
  }, []);
  const setzeStumm = useCallback((stumm: boolean) => {
    geraetSpieler().setzeStumm(stumm);
    neuZeichnen();
  }, []);

  const spieler = geraetSpieler(); // ohne `AudioContext`: der entsteht erst beim Abspielen oder Aktivieren
  const abpfiff = spieler.lautstaerke('abpfiff');
  const halbzeit = spieler.lautstaerke('halbzeit');
  const lautstaerke = useMemo(() => ({ abpfiff, halbzeit }), [abpfiff, halbzeit]);

  return {
    rolle,
    felder: rolle === 'diesesTurnier' && einschaltung ? einschaltung.felder : [],
    name: rolle === 'diesesTurnier' && einschaltung ? einschaltung.name : null,
    laufzeit: rolle === 'diesesTurnier' ? snapshot : null,
    einschalten, tonAktivieren, ausschalten, hierAnhoeren,
    lautstaerke, setzeLautstaerke,
    stumm: spieler.stumm(), setzeStumm,
    lebenszeichenFehler: rolle === 'diesesTurnier' ? lebenszeichenFehler : null,
  };
}
