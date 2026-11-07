/**
 * Testlage des Feldstands (H3b-2a): „Hallencup Nord“ mit Spiel 11 und Spiel 12 auf Feld 1 (Spiellagen und Engine-Ereignisse
 * aus den Kern-Fixtures), Supabase-Doppel mit echten Filtern, von Hand vorgerückte Serverzeit. `probe` spielt den späteren
 * Einbau nach: alle 250 ms `aktualisieren` und planen (`planeHallToene`), geplante Töne erklingen genau zu `at`.
 */
import type { EngineEvent, MatchContext, MatchState } from '../../../../core/match';
import { LEERES_GEDAECHTNIS, hallTonGespielt, planeHallToene, type GeplanterTon, type HallTonArt, type PlanErgebnis } from '../../../../core/hallenton';
import { CTX_11, CTX_12, T0 } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalscherSupabase } from '../../../../test/hallenton/falscherSupabase';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { erzeugeFeldStand, type FeldStandQuelle } from '../feldStand';

export const TID = '22222222-2222-4222-8222-222222222222';

export function spielZeile(ctx: MatchContext, field: number, matchNumber: number, start: string, extra: Record<string, unknown> = {}) {
  return {
    id: ctx.matchId, tournament_id: TID, field, slot: null, match_number: matchNumber, round: 1, scheduled_start: start,
    match_status: 'scheduled', score_a: null, score_b: null, team_a_id: ctx.teamAId, team_b_id: ctx.teamBId, ...extra,
  };
}

export async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
}

export interface LageOptionen {
  start?: number;
  felder?: number[];
  spiele?: Record<string, unknown>[];
}

export class Lage {
  readonly sb = new FalscherSupabase();
  readonly uhr: ManuelleUhr;
  readonly fs: FeldStandQuelle;
  /** Felder, die dieses Gerät leitet; Stand der eigenen Engine je Spiel. */
  readonly leite = new Set<number>();
  readonly eigene = new Map<string, MatchState>();
  felder: number[];
  private seq = 100;

  constructor({ start = T0, felder = [1], spiele }: LageOptionen = {}) {
    this.uhr = new ManuelleUhr(start);
    this.felder = felder;
    this.sb.tabellen.tournaments = [{ id: TID, date: '2026-11-28', lifecycle_status: 'fixed' }];
    this.sb.tabellen.matches = spiele ?? [spielZeile(CTX_11, 1, 11, '14:12:00'), spielZeile(CTX_12, 1, 12, '14:24:00')];
    this.fs = erzeugeFeldStand({
      client: this.sb.client,
      serverNow: () => this.uhr.jetzt(),
      turnierId: TID,
      lautsprecherFelder: () => this.felder,
      leiteIchFeld: (feld) => this.leite.has(feld),
      eigeneSicht: (matchId) => this.eigene.get(matchId) ?? null,
      zeitgeber: this.uhr.gruppe('haupt'),
    });
  }

  /** Bestätigte Ereignisse am Server (`match_events`), `seq` über alle Spiele steigend. */
  sende(ctx: MatchContext, events: readonly EngineEvent[], extra: Record<string, unknown> = {}): void {
    for (const e of events) {
      this.seq += 1;
      const zeit = new Date(e.at).toISOString();
      this.sb.tabellen.match_events.push({
        id: e.id, match_id: ctx.matchId, type: e.type, client_time: zeit, recorded_at: zeit, section: e.section,
        clock_ms: e.clockMs, team_id: e.teamId ?? null, target_event_id: e.targetId ?? null, payload: e.payload, seq: this.seq,
        event_format: 1, review_state: null, ...extra,
      });
    }
  }

  setzeSpiel(matchId: string, felder: Record<string, unknown>): void {
    this.sb.tabellen.matches = this.sb.tabellen.matches.map((z) => (z.id === matchId ? { ...z, ...felder } : z));
  }

  async runde(planerTaktMs: number | null = null): Promise<void> {
    const lauf = this.fs.aktualisieren(this.uhr.jetzt(), planerTaktMs);
    await flush();
    await lauf;
  }

  vor(ms: number): void {
    this.uhr.vorruecken(ms);
  }

  stand(feldId = 'field-1') {
    return this.fs.staende().find((s) => s.feldId === feldId);
  }
}

export interface ProbeTon {
  at: number;
  art: HallTonArt;
  schluessel: readonly string[];
}

export interface ProbeSchritt {
  um: number;
  tu: () => void;
}

/**
 * Einbau-Nachbau mit dem Planer: alle 250 ms (ab `von + versatzMs`) `aktualisieren` mit dem Takt des Planers, dann planen;
 * ein geplanter Ton erklingt im 10-ms-Raster genau zu `at`. `schritte` ändern zu ihrer Zeit die Lage (Server, Gerät).
 */
export async function probe(lage: Lage, bis: number, schritte: ProbeSchritt[] = [], versatzMs = 0): Promise<{ gespielt: ProbeTon[]; plaene: PlanErgebnis[] }> {
  const von = lage.uhr.jetzt();
  let gedaechtnis = LEERES_GEDAECHTNIS;
  let eingeplant: GeplanterTon[] = [];
  let planerTakt: number | null = null;
  const gespielt: ProbeTon[] = [];
  const plaene: PlanErgebnis[] = [];
  const offen = [...schritte].sort((a, b) => a.um - b.um);
  let naechsterTakt = von + versatzMs;
  for (let jetzt = von; jetzt <= bis; jetzt += 10) {
    lage.uhr.vorruecken(jetzt - lage.uhr.jetzt());
    while (offen.length > 0 && offen[0].um <= jetzt) {
      offen.shift()?.tu();
    }
    if (jetzt >= naechsterTakt) {
      naechsterTakt += 250;
      await lage.runde(planerTakt);
      const plan = planeHallToene({ felder: lage.fs.staende(), serverNow: jetzt }, gedaechtnis);
      plaene.push(plan);
      gedaechtnis = plan.gedaechtnis;
      eingeplant = plan.toene;
      planerTakt = plan.abfrageTaktMs;
    }
    const faellig = eingeplant.filter((ton) => ton.at <= jetzt);
    eingeplant = eingeplant.filter((ton) => ton.at > jetzt);
    for (const ton of faellig) {
      gespielt.push({ at: jetzt, art: ton.art, schluessel: ton.schluessel });
      gedaechtnis = hallTonGespielt(gedaechtnis, ton, jetzt);
    }
  }
  return { gespielt, plaene };
}
