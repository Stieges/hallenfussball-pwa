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

/** Nutzlast für den Server: Version = Basis der Prüfung; das lokale Feld geht nicht mit. */
export function withCheckedVersion(tournament: Tournament): Tournament {
    return { ...tournament, version: checkedVersion(tournament), serverVersion: undefined };
}
