/**
 * Torhymne am Hallen-Lautsprecher (Record `2026-10-15_hallenton.md`, @HT-024; Regeln 1–4, Regel 2 seit 07.11.). Rein, ohne
 * React und ohne Uhr: Stand am Server je Feld + Serverzeit + Gedächtnis → welches Tor eine Hymne auslöst, ob die laufende
 * abbricht, welche Hymne als nächste spielt. Den Einbau (Spieler, Laden) macht die Laufzeit (`torhymnenSteuerung.ts`). Eigenes
 * Modul: der Planer der Enden (`planer.ts`) bleibt unverändert.
 *
 * Welches Tor zählt: ein wirksames Tor-Ereignis (GOAL/OWN_GOAL, nicht zurückgenommen) im aktuellen Spiel eines Felds aus
 * `torFelder` („Ton bei Tor“), im Stand am Server mit Antwort höchstens 5 s alt (Regel 2, @HT-011), das in diesem Stand
 * erstmals sichtbar wird (Schlüssel = Ereignis-Kennung). Kein Ton, wenn …
 * - das Tor schon im ersten bekannten Stand des Spiels steht (Start, Neuladen, Spielwechsel, Tab-Wechsel) – kein Nachholen;
 * - es erst später als 5 s nach seiner Serverzeit bekannt wird (wie die Enden, @HT-013);
 * - das Spiel nicht mehr läuft: Golden Goal (das Tor beendet das Spiel → nur der Abpfiff-Ton), Strafstoßschießen (dort gibt
 *   es keine Tore, nur Strafstöße), ein Ende ist schon eingetreten (eine Hymne nach dem Ende gibt es nicht);
 * - auf diesem Gerät schon eine Hymne läuft (auch für ein anderes Feld); das zweite Tor wird nicht nachgeholt.
 * Abbruch der laufenden Hymne: das Tor verschwindet aus dem Stand (Rücknahme), das Spiel wechselt, oder ein Ende ihres Spiels
 * ist eingetreten (Halbzeit, Abschnittsende, Abpfiff, von selbst oder von Hand). Das Abbrechen genau zum Beginn eines
 * End-Tons übernimmt der Spieler; hier fällt der Abbruch spätestens im nächsten Takt.
 */
import type { MatchState } from '../match';
import { feldEndeOf } from './enden';
import { ANTWORT_MAX_ALTER_MS, NACHHOLEN_MAX_MS } from './planer';
import type { FeldStand } from './types';

/** Harte Grenze einer Hymne (@HT-024: „höchstens 10 Sekunden“); alle übrigen Töne 5 s. */
export const TORHYMNE_MAX_MS = 10_000;

export interface WirksamesTor {
  id: string;
  /** Serverzeit des Tors. */
  at: number;
}

/** Je Feld: das Spiel und die Tore, die dieses Gerät dort schon kennt. */
export interface TorGedaechtnis {
  jeFeld: Readonly<Record<string, { matchId: string; bekannt: readonly string[] }>>;
}

export const LEERES_TOR_GEDAECHTNIS: TorGedaechtnis = { jeFeld: {} };

export interface LaufendeHymne {
  feldId: string;
  matchId: string;
  torId: string;
}

export interface TorEingabe {
  felder: readonly FeldStand[];
  /** Felder mit „Ton bei Tor“, für die dieses Gerät Lautsprecher ist (`feldId` wie in `felder`). */
  torFelder: readonly string[];
  serverNow: number;
  /** Die Hymne, die auf diesem Gerät gerade klingt; `null` = keine. */
  laufend: LaufendeHymne | null;
}

export interface TorErgebnis {
  starten: LaufendeHymne | null;
  abbrechen: boolean;
  gedaechtnis: TorGedaechtnis;
}

/** Tore, die im Stand zählen: angenommen und nicht zurückgenommen, in der Reihenfolge des Spiels. */
export function wirksameTore(state: MatchState): WirksamesTor[] {
  return state.goals.flatMap((goal) => {
    const event = Object.hasOwn(state.accepted, goal.id) ? state.accepted[goal.id] : undefined;
    return event && !state.retracted.includes(goal.id) ? [{ id: goal.id, at: event.at }] : [];
  });
}

/** Das Spiel läuft noch (Uhr läuft oder steht), und kein Ende ist eingetreten. */
function imSpiel(feld: FeldStand, serverNow: number): boolean {
  const { state } = feld;
  if ((state.status !== 'running' && state.status !== 'paused') || (state.phase !== 'regular' && state.phase !== 'overtime')) {
    return false;
  }
  const ende = feldEndeOf(state, feld.ctx, serverNow);
  return ende === null || ende.at > serverNow;
}

function hymneEndet(laufend: LaufendeHymne, felder: readonly FeldStand[], serverNow: number): boolean {
  const feld = felder.find((f) => f.feldId === laufend.feldId);
  if (!feld) {
    return false; // kein Stand für das Feld: nichts entscheiden (Abschalten regelt die Laufzeit)
  }
  return feld.ctx.matchId !== laufend.matchId
    || !wirksameTore(feld.state).some((tor) => tor.id === laufend.torId)
    || !imSpiel(feld, serverNow);
}

export function planeTorhymne(eingabe: TorEingabe, gedaechtnis: TorGedaechtnis): TorErgebnis {
  const { serverNow, laufend } = eingabe;
  const jeFeld = { ...gedaechtnis.jeFeld };
  let starten: LaufendeHymne | null = null;
  for (const feld of eingabe.felder) {
    const tore = wirksameTore(feld.state);
    const alt = gedaechtnis.jeFeld[feld.feldId];
    if (alt?.matchId !== feld.ctx.matchId) {
      jeFeld[feld.feldId] = { matchId: feld.ctx.matchId, bekannt: tore.map((t) => t.id) }; // erster bekannter Stand
      continue;
    }
    const neu = tore.filter((t) => !alt.bekannt.includes(t.id));
    if (neu.length === 0) {
      continue;
    }
    jeFeld[feld.feldId] = { matchId: alt.matchId, bekannt: [...alt.bekannt, ...neu.map((t) => t.id)] };
    const darf: boolean = laufend === null && starten === null && eingabe.torFelder.includes(feld.feldId)
      && feld.antwortAlterMs <= ANTWORT_MAX_ALTER_MS && imSpiel(feld, serverNow);
    const tor: WirksamesTor | undefined = darf ? neu.find((t) => serverNow - t.at <= NACHHOLEN_MAX_MS) : undefined;
    if (tor) {
      starten = { feldId: feld.feldId, matchId: feld.ctx.matchId, torId: tor.id };
    }
  }
  return {
    starten,
    abbrechen: laufend !== null && hymneEndet(laufend, eingabe.felder, serverNow),
    gedaechtnis: { jeFeld },
  };
}

/**
 * Nächste Hymne (@HT-024 Zeile 2): der Reihe nach über das Gerät, nie zweimal hintereinander dieselbe – nur wenn sie die
 * einzige spielbare ist. Übersprungen wird, was nicht spielbar ist (nicht geladen). `zuletzt` ist die Adresse der zuletzt
 * gespielten; steht sie nicht (mehr) in der Liste, beginnt die Reihe vorn. `null` = keine spielbar.
 */
export function naechsteHymne(hymnen: readonly string[], spielbar: readonly boolean[], zuletzt: string | null): number | null {
  const n = hymnen.length;
  const start = zuletzt === null ? -1 : hymnen.indexOf(zuletzt);
  for (let schritt = 1; schritt <= n; schritt += 1) {
    const i = (((start + schritt) % n) + n) % n;
    if (spielbar[i]) {
      return i;
    }
  }
  return null;
}
