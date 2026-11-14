/**
 * Kleine reine Helfer des Feldstands (H3b-2a): Spielplan-Zeile → Spiel des Felds, `MatchContext` wie `buildValidMatches`,
 * „angepfiffen“, ein Fingerabdruck des Stands (ändert er sich, ändert sich `bekanntSeit`, @HT-051) und die
 * Wahl des aktuellen Spiels je Feld mit Halten.
 */
import type { MatchContext, MatchState } from '../../../core/match';
import { aktuellesSpielJeFeld, feldKennung, type FeldKennung, type FeldSpiel, type FeldSpielStatus } from './aktuellesSpielJeFeld';
import type { SpielplanZeile } from './feldStandAbfragen';

export interface PlanSpiel extends FeldSpiel {
  /** `null`: keine zwei bekannten, verschiedenen Teams – kein Engine-Spiel, kein Ton. */
  ctx: MatchContext | null;
}

/** Wie `buildValidMatches` (`hooks/engineMatchModel.ts`): `matchId` klein, beide Teams gesetzt und verschieden. */
export function ctxAus(zeile: Pick<SpielplanZeile, 'id' | 'team_a_id' | 'team_b_id'>): MatchContext | null {
  const teamAId = zeile.team_a_id?.toLowerCase();
  const teamBId = zeile.team_b_id?.toLowerCase();
  if (teamAId === undefined || teamBId === undefined || teamAId === teamBId) {
    return null;
  }
  return { matchId: zeile.id.toLowerCase(), teamAId, teamBId };
}

const STATUS_AUS_SPALTE: Readonly<Record<string, FeldSpielStatus>> = { running: 'RUNNING', paused: 'PAUSED', finished: 'FINISHED', skipped: 'FINISHED' };

/** Anstoß = Turnierdatum + Uhrzeit (Ortszeit wie `supabaseMappers.kickoffOf`); zählt nur für die Spielfolge. */
function anstoss(datum: string, uhrzeit: string | null): Date | undefined {
  if (!uhrzeit) {
    return undefined;
  }
  const at = new Date(`${datum.slice(0, 10)}T${uhrzeit}`);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

/**
 * Status aus der Turnierkopie. Ein eingetragenes Ergebnis ohne angepfiffenes Spiel (z. B. Schnelleingabe im Spielplan) zählt
 * wie „beendet“: `aktuellesSpielJeFeld` überspringt es genauso wie ein Spiel mit Ergebnis. Der Feldstand setzt dafür keine
 * Spielstand-Felder (Architektur-Wächter A-08e), er liest sie nur.
 */
function statusAus(zeile: SpielplanZeile): FeldSpielStatus | undefined {
  const status = zeile.match_status === null ? undefined : STATUS_AUS_SPALTE[zeile.match_status];
  if (status === 'RUNNING' || status === 'PAUSED') {
    return status;
  }
  return zeile.score_a !== null && zeile.score_b !== null ? 'FINISHED' : status;
}

export function planSpielAus(zeile: SpielplanZeile, datum: string): PlanSpiel {
  return {
    id: zeile.id.toLowerCase(),
    field: zeile.field,
    slot: zeile.slot ?? undefined,
    matchNumber: zeile.match_number ?? zeile.round,
    startTime: anstoss(datum, zeile.scheduled_start),
    status: statusAus(zeile),
    ctx: ctxAus(zeile),
  };
}

/**
 * Angepfiffen im Sinne des Takts: die Uhr läuft oder ist angehalten (@HT-005, @HT-007) – und auch in den Pausen des Spiels
 * (Halbzeit, Pause vor der Verlängerung, offene Entscheidung, Strafstoßschießen), damit das Lebenszeichen der Leitung und der Kasten
 * im Cockpit dort nicht aussetzen (@HT-040 „im Spiel“, @HT-050). Dieselbe Lesart wie `types/tournament.ts` (`paused` = angepfiffen, aber
 * unterbrochen) und `cacheColumns.ts` (`section_break`/`decision_pending`/`shootout` werden als `paused` gespeichert).
 */
export function istAngepfiffen(status: MatchState['status'] | FeldSpielStatus | undefined): boolean {
  return status === 'running' || status === 'paused' || status === 'section_break' || status === 'decision_pending' || status === 'shootout'
    || status === 'RUNNING' || status === 'PAUSED';
}

/** Ändert sich, sobald der Stand ein Ereignis mehr kennt, eines zurückgenommen ist oder der Zustand wechselt. */
export function standKennung(state: MatchState): string {
  return [state.status, state.phase, state.section, Object.keys(state.accepted).sort().join(','), state.retracted.join(',')].join('|');
}

/** So lange bleibt ein Spiel, das vom Feld geht, das aktuelle (länger als die 5-s-Grenze des Planers). */
export const HALTEN_NACH_WECHSEL_MS = 10_000;

/**
 * Aktuelles Spiel je Feld (`aktuellesSpielJeFeld`) mit Halten: Geht ein Spiel vom Feld, ohne dass ein anderes angepfiffen
 * ist (z. B. der Spielplan meldet „beendet“ vor dem Ende im Stand), bleibt es 10 s das aktuelle, damit sein Ende (von Hand,
 * @HT-007) noch ankommt und tönt. Ein angepfiffenes Spiel übernimmt das Feld sofort.
 */
export function erzeugeFeldWahl(): (spiele: readonly PlanSpiel[], felder: readonly number[], now: number) => Map<FeldKennung, PlanSpiel> {
  const gehalten = new Map<FeldKennung, { matchId: string; bis: number }>();
  const vorige = new Map<FeldKennung, string>();
  return (spiele, felder, now) => {
    for (const [kennung, halt] of gehalten) {
      if (halt.bis <= now) {
        gehalten.delete(kennung);
        vorige.delete(kennung); // abgelaufen: ab jetzt gilt die Wahl, kein neues Halten
      }
    }
    const gehaltenJeFeld = new Map([...gehalten].map(([kennung, halt]) => [kennung, halt.matchId] as const));
    const wahl = aktuellesSpielJeFeld(spiele, { anzahlFelder: Math.max(...felder), gehaltenJeFeld });
    const ergebnis = new Map<FeldKennung, PlanSpiel>();
    for (const feld of felder) {
      const kennung = feldKennung(feld);
      let spiel = wahl.get(kennung) ?? null;
      const vorher = vorige.get(kennung);
      const vorherSpiel = spiele.find((s) => s.id === vorher);
      if (vorherSpiel && spiel?.id !== vorher && !istAngepfiffen(spiel?.status) && !gehalten.has(kennung)) {
        gehalten.set(kennung, { matchId: vorherSpiel.id, bis: now + HALTEN_NACH_WECHSEL_MS });
        spiel = vorherSpiel;
      }
      if (gehalten.get(kennung)?.matchId !== spiel?.id) {
        gehalten.delete(kennung); // ein anderes Spiel hat das Feld übernommen (angepfiffen)
      }
      if (spiel) {
        vorige.set(kennung, spiel.id);
        ergebnis.set(kennung, spiel);
      } else {
        vorige.delete(kennung);
      }
    }
    return ergebnis;
  };
}
