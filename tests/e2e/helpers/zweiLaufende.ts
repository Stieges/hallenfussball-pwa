/**
 * Saat-Umbau im Speicher für @ZM-196 „Gegeben …, Spiel 7 und Spiel 8 laufen“: aus einer Saat der visuellen Prüfung entsteht eine Kopie, in der
 * die Spiele 7 und 8 laufen (Spiel 8 auf Feld 2, bei Nikolaus kommt das zweite Feld dazu); alle späteren Spiele sind wieder geplant.
 * Kein Code in `src/`, die Dateien der Saat bleiben unverändert (Testumgebung ≠ Produktivcode).
 */
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

type Rec = Record<string, unknown>;

/** Standard-Feinstatus eines laufenden Spiels, wenn die Saat selbst kein laufendes Spiel trägt (Nikolaus). */
const LAUFENDER_FEINSTATUS: Rec = {
  engine: true, status: 'running', phase: 'regular', section: 1, running: true, elapsedMs: 0, anchorAt: '@jetzt-ms-320000', elapsedSeconds: 0,
  durationSeconds: 600, playPhase: 'regular', tiebreakerMode: 'overtime-then-shootout', overtimeDurationSeconds: 300, awaitingTiebreakerChoice: false,
  sections: 1, sectionSeconds: 600, breakSeconds: 60, overtimeSeconds: 300, sectionStartMs: 0, breakStartedAt: null,
};

export function mitZweiLaufenden(saatName: string, turnierId: string): unknown {
  const saat = JSON.parse(JSON.stringify(leseSaat(saatName))) as Rec;
  const dbs = saat.datenbanken as Array<{ eintraege: { tournaments: Rec[] } }>;
  const turnier = dbs[0].eintraege.tournaments.find((t) => t.id === turnierId);
  if (turnier === undefined) { throw new Error(`Saat ${saatName}: Turnier ${turnierId} fehlt`); }
  const matches = turnier.matches as Rec[];
  const feinstatus = (matches.find((m) => m.liveState !== undefined)?.liveState ?? LAUFENDER_FEINSTATUS) as Rec;
  turnier.numberOfFields = Math.max(2, Number(turnier.numberOfFields ?? 1));
  turnier.groupCompletions = [];
  for (const m of matches) {
    const nummer = Number(m.matchNumber);
    if (nummer === 8) { m.field = 2; }
    if (nummer === 7 || nummer === 8) {
      Object.assign(m, { matchStatus: 'running', scoreA: 1, scoreB: 0, timerElapsedSeconds: 0, timerStartTime: '@jetzt-320s', liveState: { ...feinstatus } });
      delete m.decidedBy; delete m.finishedAt;
    } else if (nummer > 8) {
      delete m.decidedBy; delete m.finishedAt; delete m.timerStartTime; delete m.liveState; delete m.scoreA; delete m.scoreB;
      Object.assign(m, { matchStatus: 'scheduled', timerElapsedSeconds: 0 });
    }
  }
  return saat;
}
