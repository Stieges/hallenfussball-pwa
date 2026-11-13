/**
 * feldKarten – baut aus der `HallAnzeige` (H4-5) und dem Stand am Server die Karten je Feld im Unterpunkt „Hallenton“ (H4-8; @HT-016,
 * @HT-039, @HT-041, @HT-042). Rein, ohne React und ohne Zeit: Alter und „zuletzt“ rechnet der Server (`lautsprecherLage`), die Uhr des
 * Geräts zählt nie.
 * - Feld ohne Lautsprecher: neutral „kein Hallen-Lautsprecher“, keine Warnung (@HT-016).
 * - Hat die Verwaltung selbst kein Netz (`statusUnbekannt`), steht bei fremden Feldern „Status unbekannt“ statt eines alten „bereit“
 *   (@HT-041); am eigenen Gerät gilt der lokale Zustand weiter (G7).
 * - Im Unterpunkt stehen die Gründe (@HT-039: auf anderen Geräten nur die Pille, hier der Grund); die Gründe „Ausgang verloren“ und
 *   „Ausgang bestätigen“ kennt die Karte schon, ihre Quelle liefert H4-6.
 * - Das Gerät des Lautsprechers kennt nur die volle Sicht; die Art des Geräts (Laptop/Monitor/Handy) meldet der Server nicht, die Karte
 *   zeigt das Laptop-Symbol.
 */
import type { FeldAnzeige, HallAnzeige } from '../hallAnzeige';
import type { LautsprecherLage } from '../runtime/hallStatusAuswertung';
import type { FeldZustand as LokalerZustand } from '../runtime/laufzeitZustand';
import type { FeldGeraet, FeldGrund, FeldZustand } from './LautsprecherFeldKarte';

export interface SprecherInfo {
  field: number;
  deviceName: string;
}

export interface FeldKarte {
  feld: number;
  zustand: FeldZustand;
  geraet?: FeldGeraet;
  /** Ruhige Pille „🔈? Prüfen“ (@HT-047) neben dem Zustand. */
  pruefen: boolean;
  /** „Hupe 1 statt eigener Ton“ (@HT-028): bereit, aber die Halle hört die Hupe. */
  hupeStattEigenerTon: boolean;
  /** Ein anderes Fenster dieses Geräts tönt (@HT-033 Zeile 8). */
  anderesFenster: boolean;
}

export interface FeldKartenEingabe {
  /** Alle Felder des Turniers (1…n). */
  felder: readonly number[];
  anzeige: HallAnzeige;
  /** Lage je Feld am Server (`useHallStatus().felder`). */
  serverLagen: Readonly<Record<number, LautsprecherLage>>;
  /** Zuletzt bekannte Lautsprecher mit Gerätename (bleibt bei „Status unbekannt“ stehen). */
  sprecher: readonly SprecherInfo[];
  /** Name dieses Geräts, falls es Lautsprecher ist (bis der Server ihn kennt). */
  eigenerName: string | null;
  /** Lokaler Zustand je `field-N` dieses Geräts. */
  lokalerZustand: Readonly<Record<string, LokalerZustand>>;
  /** Uhrzeit aus Serverzeit (ms) → „14:02“. */
  uhrzeit: (ms: number) => string;
}

const SERVER_GRUND: Record<string, FeldGrund | undefined> = {
  not_activated: 'tonNichtAktiviert',
  background: 'hintergrund',
  slept: 'schlafenGelegt',
  volume_zero: 'lautstaerkeNull',
};

const LOKAL_GRUND: Partial<Record<LokalerZustand, FeldGrund>> = {
  not_activated: 'tonNichtAktiviert',
  background: 'hintergrund',
  slept: 'schlafenGelegt',
  volume_zero: 'lautstaerkeNull',
  keineVerbindung: 'keineVerbindung',
};

function nichtBereit(fa: FeldAnzeige, lage: LautsprecherLage | undefined, e: FeldKartenEingabe): FeldZustand {
  const art = fa.anzeige.art;
  if (art === 'tonNichtAktiv') { return { art: 'nichtBereit', grund: 'tonNichtAktiviert' }; }
  if (art === 'schlafenGelegt') { return { art: 'nichtBereit', grund: 'schlafenGelegt' }; }
  if (art === 'keineVerbindung') { return { art: 'nichtBereit', grund: 'keineVerbindung' }; }
  if (fa.eigenesGeraet) {
    const grund = LOKAL_GRUND[e.lokalerZustand[`field-${fa.feld}`] ?? 'not_activated'];
    return grund === undefined ? { art: 'zustandUnbekannt' } : { art: 'nichtBereit', grund };
  }
  if (lage?.art === 'meldetSichNicht') {
    return { art: 'meldetSichNicht', zuletzt: lage.zuletztServerMs === null ? '–' : e.uhrzeit(lage.zuletztServerMs) };
  }
  if (lage?.art === 'nichtBereit') {
    const grund = SERVER_GRUND[lage.grund];
    return grund === undefined ? { art: 'zustandUnbekannt' } : { art: 'nichtBereit', grund };
  }
  return { art: 'zustandUnbekannt' };
}

export function baueFeldKarten(e: FeldKartenEingabe): FeldKarte[] {
  return e.felder.map((feld): FeldKarte => {
    const fa = e.anzeige.felder.find((f) => f.feld === feld);
    const bekannt = e.sprecher.find((s) => s.field === feld);
    const name = bekannt?.deviceName ?? (fa?.eigenesGeraet === true ? e.eigenerName : null);
    const geraet: FeldGeraet | undefined = name === null || name === undefined ? undefined : { name, art: 'laptop' };
    const leer = { pruefen: false, hupeStattEigenerTon: false, anderesFenster: false };
    if (fa === undefined) {
      // Ohne eigenes Netz kennt die Verwaltung nur den zuletzt bekannten Lautsprecher (@HT-041); sonst hat das Feld keinen
      return e.anzeige.statusUnbekannt && bekannt !== undefined
        ? { feld, zustand: { art: 'statusUnbekannt' }, geraet, ...leer }
        : { feld, zustand: { art: 'keinLautsprecher' }, ...leer };
    }
    if (e.anzeige.statusUnbekannt && !fa.eigenesGeraet) {
      return { feld, zustand: { art: 'statusUnbekannt' }, geraet, ...leer };
    }
    const lage = e.serverLagen[feld];
    switch (fa.anzeige.art) {
      case 'bereit':
        return { feld, zustand: { art: 'bereit' }, geraet, ...leer, pruefen: fa.anzeige.pruefen, hupeStattEigenerTon: fa.anzeige.hupeStattEigenerTon };
      case 'anderesFenster':
        return { feld, zustand: { art: 'bereit' }, geraet, ...leer, anderesFenster: true };
      default:
        return { feld, zustand: nichtBereit(fa, lage, e), geraet, ...leer };
    }
  });
}
