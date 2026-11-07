/**
 * Stammdaten-Formular im Reiter Einstellungen: angefangene Eingaben überstehen einen neuen Stand des Turniers
 * (Befund C-GERAET-FOLGT-WACKELT, @FU-105, @FU-089, @FU-108).
 *
 * Ein neues Turnier-Objekt kommt nicht nur nach dem eigenen Speichern, sondern auch, wenn ein anderes Gerät etwas ändert
 * (Realtime-Anstoß, 5-s-Abruf). Das Formular zieht dann nur die Angaben nach, die die Person NICHT angefasst hat; ihre
 * angefangenen Eingaben bleiben stehen. Angefasst heißt: der Wert im Formular weicht vom Stand ab, auf dem das Formular
 * zuletzt beruhte. Objekte (Ort, Kontakt) werden je Angabe geprüft, ein fehlender Stand gilt dort als leeres Objekt.
 * Leere Werte ('', null, undefined) gelten als gleich – wie beim Vergleich „ungespeichert“ im Formular.
 *
 * Konflikt (@FU-108): eine Angabe hat die Person angefasst UND das andere Gerät geändert, und beide Werte unterscheiden
 * sich. Dann darf ihr Speichern nicht auf dem neuen Stand beruhen, sonst überschriebe es die fremde Änderung still.
 */
import type { Tournament } from '../../../types/tournament';

export type MetaForm = Pick<Partial<Tournament>, 'title' | 'organizer' | 'ageClass' | 'location' | 'contactInfo' | 'startDate' | 'startTime'>;

const META_KEYS = ['title', 'organizer', 'ageClass', 'location', 'contactInfo', 'startDate', 'startTime'] as const;

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

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === '';

/** Vergleich mit leeren Werten als gleich, auch tief in Objekten. */
export function sameMetaValue(a: unknown, b: unknown): boolean {
  const normalize = (value: unknown): unknown => JSON.stringify(value, (_key, v: unknown) => (isEmpty(v) ? undefined : v));
  return normalize(a) === normalize(b);
}

/** Bei Objekten fehlt der bisherige Stand oft ganz (noch kein Kontakt) – dann zählt er als leeres Objekt. */
function objectBase(current: unknown, base: unknown, incoming: unknown): Record<string, unknown> | null {
  if (!isPlainObject(current) || !isPlainObject(incoming)) { return null; }
  if (isPlainObject(base)) { return base; }
  return isEmpty(base) ? {} : null;
}

function keysOf(...objects: Array<Record<string, unknown>>): string[] {
  return [...new Set(objects.flatMap((object) => Object.keys(object)))];
}

/** Unangefasst (`current` gleich `base`) → `incoming`; bei Objekten je Angabe; sonst bleibt die Eingabe. */
function rebaseValue(current: unknown, base: unknown, incoming: unknown): unknown {
  if (sameMetaValue(current, base)) { return incoming; }
  const objBase = objectBase(current, base, incoming);
  if (objBase !== null && isPlainObject(current) && isPlainObject(incoming)) {
    const merged: Record<string, unknown> = {};
    for (const key of keysOf(current, objBase, incoming)) {
      const value = rebaseValue(current[key], objBase[key], incoming[key]);
      if (value !== undefined) { merged[key] = value; }
    }
    return merged;
  }
  return current;
}

/** Angefasst, fremd geändert und verschieden – je Angabe, Objekte je Feld. */
function conflictsValue(current: unknown, base: unknown, incoming: unknown): boolean {
  if (sameMetaValue(current, base) || sameMetaValue(incoming, base) || sameMetaValue(current, incoming)) { return false; }
  const objBase = objectBase(current, base, incoming);
  if (objBase !== null && isPlainObject(current) && isPlainObject(incoming)) {
    return keysOf(current, objBase, incoming).some((key) => conflictsValue(current[key], objBase[key], incoming[key]));
  }
  return true;
}

/** Formular auf einen neuen Stand setzen, ohne angefangene Eingaben zu verlieren. */
export function rebaseMetaForm(current: MetaForm, base: MetaForm, incoming: MetaForm): MetaForm {
  const pick = <K extends keyof MetaForm>(key: K): MetaForm[K] => rebaseValue(current[key], base[key], incoming[key]) as MetaForm[K];
  return {
    title: pick('title'), organizer: pick('organizer'), ageClass: pick('ageClass'), location: pick('location'),
    contactInfo: pick('contactInfo'), startDate: pick('startDate'), startTime: pick('startTime'),
  };
}

/** @FU-108: überschneidet sich eine angefangene Eingabe mit der Änderung des anderen Geräts? */
export function metaFormConflicts(current: MetaForm, base: MetaForm, incoming: MetaForm): boolean {
  return META_KEYS.some((key) => conflictsValue(current[key], base[key], incoming[key]));
}

/** Gleicher Inhalt (leere Werte gleich) – etwa: das Formular zeigt genau den Stand. */
export function sameMetaForm(a: MetaForm, b: MetaForm): boolean {
  return META_KEYS.every((key) => sameMetaValue(a[key], b[key]));
}
