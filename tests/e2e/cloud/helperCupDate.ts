/**
 * Turniertag der Cups, über die die Cloud-Specs per Helfer-QR beitreten (`helfer-beitritt`, `helfer-team`).
 *
 * Der Helfer-Code gilt bis zum Ende des Turniertags in deutscher Zeit (@HE-010, `helper_code_cutoff` in
 * `20261110_008_helper_join.sql`). Mit dem Turniertag „heute“ läuft er ab, sobald ein Lauf über Mitternacht geht: Lauf
 * 42308242655 säte um 23:58, die Helfer-Tests liefen ab 0:00 und sahen „Dieser Code ist abgelaufen“. Darum liegt der
 * Turniertag dieser Cups auf dem Folgetag (@HE-010: vor dem Turniertag kann ein Helfer schon anfragen); das gilt zu jeder
 * Uhrzeit des Säens gleich. Reine Funktionen, damit Vitest sie ohne Stack prüft (`__tests__/helperCupDate.test.ts`).
 */
import { localDateIso, toTournamentLocal, TOURNAMENT_TIME_ZONE } from '../../../src/core/view/time';

/** Längste Dauer eines Cloud-E2E-Laufs nach dem Säen: Job-Grenze `timeout-minutes: 40` in `.github/workflows/e2e-cloud.yml`. */
export const CLOUD_RUN_MAX_MS = 40 * 60 * 1000;

/** Zeitpunkt (ms), an dem der Helfer-Code eines Turniers am `date` abläuft: 0:00 des Folgetags in deutscher Zeit. */
export function helperCodeCutoffMs(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day + 1);
  // Versatz der Ortszeit zu UTC an diesem Zeitpunkt; zweimal, damit ein Wechsel der Sommerzeit dazwischen mitzählt.
  let instant = wallAsUtc;
  for (let i = 0; i < 2; i += 1) {
    const local = toTournamentLocal(new Date(instant), TOURNAMENT_TIME_ZONE);
    const [lh, lm] = local.time.split(':').map(Number);
    const [ly, lmo, ld] = local.date.split('-').map(Number);
    const offset = Date.UTC(ly, lmo - 1, ld, lh, lm) - instant;
    instant = wallAsUtc - offset;
  }
  return instant;
}

/** Turniertag der Helfer-Cups: der Folgetag des Säens in deutscher Zeit (`seedNow` = Serverzeit des Seeds). */
export function helperJoinCupDate(seedNowMs: number): string {
  const [year, month, day] = localDateIso(new Date(seedNowMs)).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}
