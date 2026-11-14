/**
 * hallAnzeige – die EINE Quelle der Anzeige zum Hallen-Lautsprecher (H4-5, G7; @HT-011, @HT-012, @HT-035, @HT-037, @HT-039, @HT-041,
 * @HT-042). Reine Funktion, ohne React und ohne Zeit: sie ordnet je Feld ein, was Kopfzeile, Streifen und (später) Unterpunkt und
 * Feldkarte zeigen. Die Wortlaute und Symbole baut der Adapter (`ui/HallStatusZeile.tsx`).
 *
 * - Am eigenen Gerät (Laufzeit dieses Geräts für das Turnier) gilt der lokale Zustand sofort, auch ohne Netz; sonst gilt der Stand am
 *   Server. Das Alter rechnet der Server (`hallStatusAuswertung.ts`), die Uhr des Geräts zählt nie (@HT-042).
 * - Nur am eigenen Gerät gibt es Gründe: „Ton nicht aktiv“ (@HT-012), „keine Verbindung“ (@HT-011), „schlafen gelegt“ (@HT-037). Auf
 *   anderen Geräten steht nur die Pille „nicht bereit“ ohne Grund (@HT-039), der Grund steht im Unterpunkt.
 * - `custom_sound_failed` ist bereit, mit dem ruhigen Hinweis „Hupe 1 statt eigener Ton“ (@HT-028), nie eine Störung.
 * - Ein Zustand, den dieser App-Stand nicht kennt (`zustandUnbekannt`), ist „nicht bereit“ ohne Wortgrund. „Status unbekannt“
 *   (@HT-041, die Verwaltung hat selbst kein Netz) ist davon getrennt: nur, wenn schon einmal ein Lautsprecher bekannt war.
 * - „Handy ohne Netz“ (@HT-035) nur auf Feldern mit angepfiffenem Spiel: ist Spiel 11 beendet, meldet das Handy nichts mehr, und das ist kein Ausfall.
 * - Ohne Lautsprecher im Turnier: nichts (nie „bereit“, @HT-016, @HT-038).
 */
import type { HallStatusAntwort } from '../../core/repositories/hallentonRpc';
import type { LaufzeitRolle, FeldZustand } from './runtime/laufzeitZustand';
import { leitungOhneNetz, type LautsprecherLage } from './runtime/hallStatusAuswertung';
import type { HallStatusStand } from './runtime/hallStatusAbfrage';

export type FeldAnzeigeArt =
  | { art: 'bereit'; pruefen: boolean; hupeStattEigenerTon: boolean }
  | { art: 'tonNichtAktiv' }
  | { art: 'schlafenGelegt' }
  | { art: 'keineVerbindung' }
  | { art: 'anderesFenster' }
  | { art: 'nichtBereit' };

export interface FeldAnzeige {
  feld: number;
  anzeige: FeldAnzeigeArt;
  /** Gilt für das eigene Gerät (lokaler Zustand): nur dann gibt es die Gründe und die Aktion „Ton aktivieren“. */
  eigenesGeraet: boolean;
}

export interface HallAnzeige {
  /** Nach Feldnummer sortiert; nur Felder mit Lautsprecher. */
  felder: readonly FeldAnzeige[];
  /** Felder, auf denen das leitende Handy kein Netz hat (@HT-035). */
  handyOhneNetz: readonly number[];
  /** Die Verwaltung hat selbst kein Netz und kannte vorher einen Lautsprecher (@HT-041). */
  statusUnbekannt: boolean;
}

/** Die Laufzeit dieses Geräts für das Turnier (aus `useHallLautsprecher`); `null` = dieses Gerät ist hier kein Lautsprecher. */
export interface LokaleLage {
  felder: readonly number[];
  rolle: LaufzeitRolle;
  zustandJeFeld: Readonly<Record<string, FeldZustand>>;
}

export interface HallAnzeigeEingabe {
  server: {
    stand: HallStatusStand;
    felder: Readonly<Record<number, LautsprecherLage>>;
    antwort: HallStatusAntwort | null;
  };
  lokal: LokaleLage | null;
  /** Felder mit angepfiffenem Spiel (aus dem Spielstand, `angepfiffeneFelder.ts`): nur dort ist ein stilles Handy ein Ausfall (@HT-035). */
  angepfiffen: ReadonlySet<number>;
  /** Es war in dieser Sitzung schon ein Lautsprecher im Turnier bekannt (sonst bleibt „Status unbekannt“ aus, @HT-038). */
  lautsprecherBekannt: boolean;
  /**
   * Ein anderes Fenster dieses Geräts hält die Sperre `hallenton` (`navigator.locks.query`, H4-8, @HT-033 Zeile 8, Nachtrag 13.11.): dieses
   * Fenster zeigt dann gleich den ruhigen Hinweis „läuft schon in einem anderen Fenster“ statt „Ton nicht aktiv – hier klicken“.
   */
  anderesFensterTont?: boolean;
}

/** Dieses Gerät steht auf „Ton nicht aktiv“ (die einzige Lage, in der ein anderes Fenster gefragt werden muss). */
export function tonNichtAktivLokal(lokal: LokaleLage | null): boolean {
  return lokal !== null && lokal.rolle === 'wartet' && lokal.felder.some((feld) => lokal.zustandJeFeld[`field-${feld}`] === 'not_activated');
}

function lokaleAnzeige(zustand: FeldZustand | undefined, rolle: LaufzeitRolle, pruefen: boolean, anderesFenster: boolean): FeldAnzeigeArt {
  switch (zustand) {
    case 'not_activated': return anderesFenster ? { art: 'anderesFenster' } : { art: 'tonNichtAktiv' };
    case 'slept': return { art: 'schlafenGelegt' };
    case 'keineVerbindung': return { art: 'keineVerbindung' };
    case 'ready':
    case 'custom_sound_failed':
      // Hält ein anderes Fenster der Sperre, tönt dieses nicht (@HT-033 Zeile 8)
      return rolle === 'andererTab'
        ? { art: 'anderesFenster' }
        : { art: 'bereit', pruefen, hupeStattEigenerTon: zustand === 'custom_sound_failed' };
    default: return { art: 'nichtBereit' }; // background, volume_zero, noch kein Zustand: nur die Pille (@HT-039)
  }
}

function serverAnzeige(lage: LautsprecherLage): FeldAnzeigeArt | null {
  switch (lage.art) {
    case 'keiner': return null;
    case 'bereit': return { art: 'bereit', pruefen: lage.pruefen, hupeStattEigenerTon: lage.eigenerTonFehlt === true };
    case 'nichtBereit':
    case 'meldetSichNicht': return { art: 'nichtBereit' };
  }
}

export function hallAnzeige({ server, lokal, angepfiffen, lautsprecherBekannt, anderesFensterTont = false }: HallAnzeigeEingabe): HallAnzeige {
  const jeFeld = new Map<number, FeldAnzeige>();
  for (const [schluessel, lage] of Object.entries(server.felder)) {
    const anzeige = serverAnzeige(lage);
    if (anzeige !== null) {
      jeFeld.set(Number(schluessel), { feld: Number(schluessel), anzeige, eigenesGeraet: false });
    }
  }
  // Am eigenen Gerät gilt der lokale Zustand sofort, ohne auf den Server zu warten (G7); „Prüfen“ kennt nur der Server
  if (lokal !== null && lokal.rolle !== 'aus' && lokal.rolle !== 'still') {
    for (const feld of lokal.felder) {
      const amServer = server.felder[feld];
      const pruefen = amServer?.art === 'bereit' && amServer.pruefen;
      jeFeld.set(feld, { feld, anzeige: lokaleAnzeige(lokal.zustandJeFeld[`field-${feld}`], lokal.rolle, pruefen, anderesFensterTont), eigenesGeraet: true });
    }
  }
  const handyOhneNetz: number[] = [];
  const leads = server.antwort?.sicht === 'voll' ? server.antwort.leads : [];
  for (const l of leads) {
    if (jeFeld.has(l.field) && leitungOhneNetz(l.ageMs, angepfiffen.has(l.field))) {
      handyOhneNetz.push(l.field);
    }
  }
  return {
    felder: [...jeFeld.values()].sort((a, b) => a.feld - b.feld),
    handyOhneNetz: handyOhneNetz.sort((a, b) => a - b),
    statusUnbekannt: server.stand === 'unbekannt' && lautsprecherBekannt,
  };
}
