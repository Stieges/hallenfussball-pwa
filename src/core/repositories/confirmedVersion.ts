/**
 * Befund C-VERSION-MEHRDEUTIG (@FU-106, Regel „nichts still überschreiben“, `plattform/2026-09-24_fundament-gemeinsamer-stand.md`):
 * Gegen welche Server-Version prüft ein Voll-Speichern oder Metadaten-Speichern?
 *
 * Gegen die zuletzt vom Server bestätigte Version, auf der der Inhalt beruht (`Tournament.serverVersion`), nie gegen die
 * lokal gestempelte Version („Nutzlast + 1“): die kann nach einem Konflikt dieselbe Zahl tragen wie ein fremder Stand.
 * Trägt ein Objekt das Feld nicht, ist es ein Cloud-Objekt oder ein neues Turnier – dann ist seine Version die Basis.
 */
import type { Tournament } from '../models/types';

/** Basis der Versionsprüfung (undefined = neues Turnier ohne Version). */
export function checkedVersion(tournament: Pick<Tournament, 'serverVersion' | 'version'>): number | undefined {
    return tournament.serverVersion ?? tournament.version;
}

/**
 * Befund C-ZWEITES-SPEICHERN-EIGENE-VORVERSION (@FU-110): Beruht `base` auf einer Version, die seitdem nur durch eigene,
 * bestätigte Uploads dieses Geräts weitergezählt wurde (`ownUploadsFrom` bis `serverVersion` der lokalen Kopie), gilt die
 * aktuelle bestätigte Version als Basis – die zweite eigene Änderung kurz nach der ersten ist kein Konflikt. Ein fremder
 * Stand dazwischen beendet die Kette (Übernahme aus der Cloud), dann bleibt `base` und der Server lehnt ab.
 */
export function ownChainBase(base: number | undefined, local: Pick<Tournament, 'serverVersion' | 'ownUploadsFrom'> | null | undefined): number | undefined {
    if (base === undefined || local?.serverVersion === undefined || local.ownUploadsFrom === undefined) { return base; }
    return base >= local.ownUploadsFrom && base <= local.serverVersion ? local.serverVersion : base;
}

/** Nutzlast für den Server: Version = Basis der Prüfung; die lokalen Felder gehen nicht mit. */
export function withCheckedVersion(tournament: Tournament, base: number | undefined = checkedVersion(tournament)): Tournament {
    return { ...tournament, version: base, serverVersion: undefined, ownUploadsFrom: undefined };
}
