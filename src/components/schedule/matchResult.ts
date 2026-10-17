/**
 * Ergebnis-Darstellung des Spielplans (@OB-064, Paket SK): „Tore folgen der Anordnung der Mannschaften“.
 *
 * Eine Quelle für Spielkarte (Teams untereinander: Tore je Zeile) und Tabellenzeile (Heim und Gast nebeneinander:
 * waagerechtes Ergebnis). Tore, Sieger und Entscheidungsart kommen aus dem zentralen Endstand `matchFinalScore`
 * (A-36b, `decided_by`) – hier wird nichts neu abgeleitet.
 */
import { matchFinalScore, type FinalScoreSource } from '../../core/view/finalScore';

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
 * Was die Darstellung vom Spiel liest: ein Spiel (Tore, Verlängerung, Strafstoß, Entscheidung) oder – im Spielplan –
 * ein `ScheduledMatch` mit dem aktuellen Spiel als `finalSource`. Die Felder werden nur durchgereicht; gerechnet wird
 * ausschließlich in `matchFinalScore`.
 */
export type ResultSource = FinalScoreSource & { finalSource?: FinalScoreSource };

/** `null` für ein geplantes, wartendes oder ausgefallenes Spiel: dort stehen keine Tore. */
export function resultFigures(source: ResultSource, status: ResultStatus): ResultFigures | null {
  if (status === 'scheduled' || status === 'waiting' || status === 'skipped') {
    return null;
  }
  const running = status === 'running';
  const score = matchFinalScore({ ...(source.finalSource ?? source), matchStatus: running ? 'running' : 'finished' });
  if (score === null) {
    return running ? { goalsA: 0, goalsB: 0, winner: null, decision: null } : null;
  }
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

/** Übersetzungsfunktion, soweit die Formatierung sie braucht (react-i18next `t` passt). */
export type ResultTranslate = (key: 'matchResult.penaltyShort' | 'matchResult.overtimeShort') => string;

/**
 * Tabellenzeile: „2:2 (4:3 i. E.)“, „3:2 n. V.“, „1:0“. Der Zusatz steht nur, wenn die Entscheidung ihn trägt.
 */
export function formatTableResult(figures: ResultFigures, t: ResultTranslate): string {
  const base = `${figures.goalsA}:${figures.goalsB}`;
  if (figures.decision === 'penalty' && figures.penaltyA !== undefined && figures.penaltyB !== undefined) {
    return `${base} (${figures.penaltyA}:${figures.penaltyB} ${t('matchResult.penaltyShort')})`;
  }
  if (figures.decision === 'overtime') {
    return `${base} ${t('matchResult.overtimeShort')}`;
  }
  return base;
}

/** Spielzeit „07:30“ aus gespielten Sekunden. */
export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const rest = String(total % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

/** Status eines Spielplan-Spiels wie in der Gruppenphase: läuft, beendet (auch mit eingetragenem Stand) oder geplant. */
export function scheduleStatusOf(
  match: Pick<FinalScoreSource, 'scoreA' | 'scoreB'> & { id: string },
  running: ReadonlySet<string> | undefined,
  finished: ReadonlySet<string> | undefined,
): ResultStatus {
  if (running?.has(match.id)) {
    return 'running';
  }
  if (finished?.has(match.id) || (match.scoreA !== undefined && match.scoreB !== undefined)) {
    return 'finished';
  }
  return 'scheduled';
}
