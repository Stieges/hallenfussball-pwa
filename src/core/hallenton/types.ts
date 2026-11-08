/**
 * Typen des Hallen-Lautsprechers (Record `2026-10-15_hallenton.md`, „Im Einzelnen“ und vier Regeln). Rein, ohne React.
 * Alle Zeiten sind Serverzeit in ms (abgeglichene Uhr des Geräts, `ClockSync.serverNow`).
 */
import type { MatchContext, MatchState } from '../match';

/** Abpfiff-Ton am Spielende, kürzerer Halbzeit-Ton an jedem Abschnittsende und vor der Verlängerung (@HT-003, @HT-031). */
export type HallTonArt = 'abpfiff' | 'halbzeit';

/** Eingabe je Feld, für das dieses Gerät Hallen-Lautsprecher ist. */
export interface FeldStand {
  feldId: string;
  /** Das Spiel, das gerade auf dem Feld steht. */
  ctx: MatchContext;
  /**
   * Engine-Stand des Spiels am Server. Regel 2 („Hupe und Anzeige sagen dasselbe“, 07.11.): immer der Stand am Server wie am
   * Monitor, auch wenn dieses Gerät das Feld selbst leitet.
   */
  state: MatchState;
  /** Alter der letzten Antwort des Servers für dieses Feld (ms); `Infinity` = noch keine (@HT-011). */
  antwortAlterMs: number;
  /** Serverzeit, zu der dieser Stand auf dem Gerät bekannt wurde (5-s-Grenze, @HT-013). */
  bekanntSeit: number;
}

export interface PlanEingabe {
  felder: readonly FeldStand[];
  serverNow: number;
}

export interface GeplanterTon {
  /** Serverzeit, zu der der Ton erklingen soll; liegt sie nicht in der Zukunft, sofort. */
  at: number;
  art: HallTonArt;
  /** Schlüssel aller Enden, die dieser eine Ton meldet (Regel 4: Enden innerhalb 1 s ergeben einen Ton). */
  schluessel: readonly string[];
  felder: readonly string[];
  /** Die Enden des Tons mit ihrem Zeitpunkt; erledigt wird beim Abspielen nur, was schon eingetreten ist. */
  enden: readonly { schluessel: string; feldId: string; at: number }[];
  /**
   * @HT-011: Der Ton darf nur erklingen, wenn die letzte Antwort des Servers nicht vor diesem Zeitpunkt liegt (5 s vor dem Ton).
   */
  antwortNoetigAb: number;
}

/** Warnung je Feld (@HT-011, @HT-033 Zeile 4): ohne frische Antwort kein Ton nach altem Stand. */
export interface HallTonWarnung {
  feldId: string;
  grund: 'keineVerbindung';
}

/** Gedächtnis des Geräts (Regel 4): erledigte Enden und die Zeitpunkte der zuletzt gespielten Töne. */
export interface TonGedaechtnis {
  erledigt: readonly string[];
  gespieltUm: readonly number[];
}

export interface PlanErgebnis {
  toene: GeplanterTon[];
  warnungen: HallTonWarnung[];
  /** Gedächtnis inklusive der Enden, die ohne eigenen Ton erledigt sind (zu spät bekannt oder in einem Ton aufgegangen). */
  gedaechtnis: TonGedaechtnis;
  /** 1000, solange ein Ende nach Stand am Server höchstens 15 s entfernt ist (jede Sekunde nachfragen); sonst `null`. */
  abfrageTaktMs: number | null;
}
