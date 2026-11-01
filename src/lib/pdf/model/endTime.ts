/**
 * „Ende ca.“ im Kopf des Spielplans (@DR-031): die Endzeit auf ein Vielfaches von `endRoundMinutes` gerundet.
 * Nie über Mitternacht (Spiele über Mitternacht sind MVP+): Würde die Rundung den Tag verlassen, wird abgerundet.
 */
import { printSchedule } from '../../../design-tokens/print';

const HHMM = /^(\d{2}):(\d{2})$/;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Rundet "HH:MM" auf `printSchedule.endRoundMinutes` Minuten. Wirft bei allem, was keine gültige Uhrzeit "HH:MM" ist. */
export function roundEndTime(hhmm: string): string {
  const match = HHMM.exec(hhmm);
  const hours = match ? Number(match[1]) : NaN;
  const minutes = match ? Number(match[2]) : NaN;
  if (!match || hours > 23 || minutes > 59) {
    throw new Error(`Ungültige Uhrzeit: "${hhmm}" (erwartet HH:MM)`);
  }
  const step = printSchedule.endRoundMinutes;
  const total = hours * MINUTES_PER_HOUR + minutes;
  const rounded = Math.round(total / step) * step;
  const result = rounded >= MINUTES_PER_DAY ? Math.floor(total / step) * step : rounded;
  return `${pad(Math.floor(result / MINUTES_PER_HOUR))}:${pad(result % MINUTES_PER_HOUR)}`;
}
