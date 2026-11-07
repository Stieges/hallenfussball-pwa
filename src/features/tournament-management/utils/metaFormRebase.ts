/**
 * Stammdaten-Formular im Reiter Einstellungen: angefangene Eingaben überstehen einen neuen Stand des Turniers
 * (Befund C-GERAET-FOLGT-WACKELT, @FU-105, @FU-089).
 *
 * Ein neues Turnier-Objekt kommt nicht nur nach dem eigenen Speichern, sondern auch, wenn ein anderes Gerät etwas ändert
 * (Realtime-Anstoß, 5-s-Abruf). Das Formular darf dann nur die Angaben nachziehen, die die Person NICHT angefasst hat;
 * ihre angefangenen Eingaben bleiben stehen. Angefasst heißt: der Wert im Formular weicht vom Stand ab, auf dem das
 * Formular zuletzt beruhte. Objekte (Ort, Kontakt) werden je Angabe geprüft.
 */
import type { Tournament } from '../../../types/tournament';

export type MetaForm = Pick<Partial<Tournament>, 'title' | 'organizer' | 'ageClass' | 'location' | 'contactInfo' | 'startDate' | 'startTime'>;

/** Die Formularwerte, die ein Turnier-Stand vorgibt. */
export function metaFormOf(tournament: Tournament): MetaForm {
  return {
    title: tournament.title,
    organizer: tournament.organizer,
    ageClass: tournament.ageClass,
    location: tournament.location,
    contactInfo: tournament.contactInfo,
    startDate: tournament.startDate ?? tournament.date,
    startTime: tournament.startTime ?? tournament.timeSlot,
  };
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Unangefasst (`current` gleich `base`) → `incoming`; bei Objekten je Angabe; sonst bleibt die Eingabe. */
function rebaseValue(current: unknown, base: unknown, incoming: unknown): unknown {
  if (same(current, base)) { return incoming; }
  if (isPlainObject(current) && isPlainObject(base) && isPlainObject(incoming)) {
    const keys = new Set([...Object.keys(current), ...Object.keys(base), ...Object.keys(incoming)]);
    const merged: Record<string, unknown> = {};
    for (const key of keys) {
      const value = rebaseValue(current[key], base[key], incoming[key]);
      if (value !== undefined) { merged[key] = value; }
    }
    return merged;
  }
  return current;
}

/** Formular auf einen neuen Stand setzen, ohne angefangene Eingaben zu verlieren. */
export function rebaseMetaForm(current: MetaForm, base: MetaForm, incoming: MetaForm): MetaForm {
  const pick = <K extends keyof MetaForm>(key: K): MetaForm[K] => rebaseValue(current[key], base[key], incoming[key]) as MetaForm[K];
  return {
    title: pick('title'), organizer: pick('organizer'), ageClass: pick('ageClass'), location: pick('location'),
    contactInfo: pick('contactInfo'), startDate: pick('startDate'), startTime: pick('startTime'),
  };
}
