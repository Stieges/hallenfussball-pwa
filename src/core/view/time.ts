/**
 * Uhrzeiten in Turnier-Ortszeit (A-36b, W14, @ZM-111): Anstoß als Wanduhr „wie gespeichert“, `now` über Intl in
 * der Zeitzone des Turniers – nie in Gerätezeit umgerechnet.
 */
import type { LocalClock } from './types';

/**
 * Zeitzone des Turniers. Das Turnier hat noch kein Zeitzonen-Feld (Brief A-36b: kein `timeZone` in `src/`);
 * bis dahin gilt diese benannte Konstante (Teilplan § 2.2).
 */
export const TOURNAMENT_TIME_ZONE = 'Europe/Berlin';

const HH_MM = /^(\d{2}):(\d{2})/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Wanduhr eines Zeitpunkts in der Zeitzone des Turniers (Intl, unabhängig von der Gerätezeit). */
export function toTournamentLocal(instant: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

/**
 * Anstoß = Turnierdatum + „HH:MM“, so wie gespeichert. Der Mapper baut `scheduledTime` als Wanduhr
 * (Turnierdatum + Zeit, Ortszeit des Geräts), deshalb liest diese Funktion die Wanduhr-Felder, nie UTC/ISO.
 */
export function kickoffLocal(date: string, scheduledTime: Date | string | undefined): LocalClock | undefined {
  if (scheduledTime === undefined) {
    return undefined;
  }
  const day = date.slice(0, 10);
  if (typeof scheduledTime === 'string') {
    const found = HH_MM.exec(scheduledTime);
    if (found !== null) {
      return { date: day, time: `${found[1]}:${found[2]}` };
    }
  }
  const instant = scheduledTime instanceof Date ? scheduledTime : new Date(scheduledTime);
  if (Number.isNaN(instant.getTime())) {
    return undefined;
  }
  return { date: day, time: `${pad(instant.getHours())}:${pad(instant.getMinutes())}` };
}

/** Sortierschlüssel einer Wanduhr; fehlende Zeit ans Ende. */
export function clockKey(clock: LocalClock | undefined): string {
  return clock === undefined ? '9999-99-99 99:99' : `${clock.date} ${clock.time}`;
}

/**
 * Minuten von `from` bis `to` (negativ, wenn `to` früher liegt), beide als Wanduhr in Turnier-Ortszeit.
 * Rechnet nur mit den Wanduhr-Feldern (Datum + HH:MM), nie mit einer Geräte-Zeitzone.
 */
export function minutesBetween(from: LocalClock, to: LocalClock): number {
  return wallMinutes(to) - wallMinutes(from);
}

function wallMinutes(clock: LocalClock): number {
  const [year, month, day] = clock.date.split('-').map(Number);
  const [hour, minute] = clock.time.split(':').map(Number);
  return Date.UTC(year, month - 1, day, hour, minute) / 60_000;
}
