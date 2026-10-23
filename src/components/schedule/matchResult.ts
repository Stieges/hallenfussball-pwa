/**
 * Ergebnis-Darstellung des Spielplans (@OB-064, Paket SK): „Tore folgen der Anordnung der Mannschaften“.
 *
 * Eine Quelle für Spielkarte (Teams untereinander: Tore je Zeile) und Tabellenzeile (Heim und Gast nebeneinander:
 * waagerechtes Ergebnis). Tore, Sieger und Entscheidungsart kommen aus dem Endstand der Ansicht (`MatchView.score`,
 * A-36b/A-36c, gerechnet in `matchFinalScore`) – hier wird nichts neu abgeleitet.
 */
import type { FinalScore, MatchView } from '../../core/view';
import type { Match } from '../../types/tournament';

export type ResultStatus = 'scheduled' | 'waiting' | 'running' | 'finished' | 'skipped';

/** Entscheidung über das reguläre Ergebnis hinaus (ohne Zusatz: regulär). */
export type ResultDecision = 'overtime' | 'penalty' | null;

export interface ResultFigures {
  goalsA: number;
  goalsB: number;
  /** Strafstoßergebnis: nur nach entschiedenem Strafstoßschießen oder während es läuft. */
  penaltyA?: number;
  penaltyB?: number;
  /** Nur bei beendetem Spiel. */
  winner: 'a' | 'b' | null;
  decision: ResultDecision;
}

/**
 * Ergebnis-Darstellung aus dem Endstand der Ansicht (`MatchView.score`). Fehlt der Stand (ausgefallen, geplant oder für
 * die Zielgruppe ausgeblendet), gibt es keine Zahlen – nie ein erfundenes 0:0. Gerechnet wird ausschließlich in
 * `matchFinalScore` (A-36b); hier wird nur umgeformt.
 */
export function resultFigures(score: FinalScore | undefined, status: ResultStatus): ResultFigures | null {
  if (score === undefined || status === 'scheduled' || status === 'waiting' || status === 'skipped') {
    return null;
  }
  const running = status === 'running';
  const decision: ResultDecision =
    score.decidedBy === 'penalty' ? 'penalty' : score.decidedBy === 'overtime' || score.decidedBy === 'goldenGoal' ? 'overtime' : null;
  return {
    goalsA: score.a,
    goalsB: score.b,
    ...(score.penalty === undefined ? {} : { penaltyA: score.penalty.a, penaltyB: score.penalty.b }),
    winner: running ? null : score.winner,
    decision: running ? null : decision,
  };
}

/**
 * Status der Karte aus der Ansicht (eine Quelle, A-36c): läuft ODER unterbrochen = läuft (@ZM-039), ausgefallen =
 * `skipped`, gewertet = beendet. Ohne Ansicht gilt das Spiel als geplant – nie „hat Stand ⇒ beendet“.
 */
export function cardStatusOf(match: Pick<MatchView, 'status' | 'isLive'> | undefined): ResultStatus {
  if (match === undefined) {
    return 'scheduled';
  }
  if (match.isLive) {
    return 'running';
  }
  switch (match.status) {
    case 'finished':
    case 'awarded':
      return 'finished';
    case 'cancelled':
      return 'skipped';
    default:
      return 'scheduled';
  }
}

/** Übersetzungsfunktion, soweit die Formatierung sie braucht (react-i18next `t` passt). */
export type ResultTranslate = (key: 'matchResult.penaltyShort' | 'matchResult.overtimeShort') => string;

/** Zusatz hinter dem Ergebnis: „(4:3 i. E.)“ nach Strafstoßschießen, „n. V.“ nach Verlängerung, sonst keiner. */
export function tableResultExtra(figures: ResultFigures, t: ResultTranslate): string | undefined {
  if (figures.decision === 'penalty' && figures.penaltyA !== undefined && figures.penaltyB !== undefined) {
    return `(${figures.penaltyA}:${figures.penaltyB} ${t('matchResult.penaltyShort')})`;
  }
  return figures.decision === 'overtime' ? t('matchResult.overtimeShort') : undefined;
}

/**
 * Tabellenzeile: „2:2 (4:3 i. E.)“, „3:2 n. V.“, „1:0“. Der Zusatz steht nur, wenn die Entscheidung ihn trägt.
 */
export function formatTableResult(figures: ResultFigures, t: ResultTranslate): string {
  const base = `${figures.goalsA}:${figures.goalsB}`;
  const extra = tableResultExtra(figures, t);
  return extra === undefined ? base : `${base} ${extra}`;
}

/** Spielzeit „07:30“ aus gespielten Sekunden. */
export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const rest = String(total % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

/**
 * Spielzeit eines laufenden Spiels aus den Zeitfeldern des Spiels (Zwischenspeicher des Servers):
 * bei laufender Uhr `timerElapsedSeconds` + Zeit seit `timerStartTime`, sonst der gespeicherte Stand.
 * `undefined`, wenn das Spiel keine Zeit trägt.
 */
export function cachedElapsedSeconds(
  match: Pick<Match, 'timerStartTime' | 'timerElapsedSeconds'> | undefined,
  nowMs: number,
): number | undefined {
  if (match === undefined || (match.timerElapsedSeconds === undefined && match.timerStartTime === undefined)) {
    return undefined;
  }
  const base = match.timerElapsedSeconds ?? 0;
  if (match.timerStartTime === undefined) {
    return base;
  }
  const startedMs = Date.parse(match.timerStartTime);
  return Number.isNaN(startedMs) ? base : base + Math.max(0, Math.floor((nowMs - startedMs) / 1000));
}
