/**
 * @W5-041 (Befund C-ENTWURF-WIEDEROEFFNEN-LOESCHT-TEAMS): Sperre gegen das Speichern eines Listen-Eintrags als ganzes Turnier.
 *
 * Die Startseiten-Liste aus der Cloud (`accountTournamentList.ts`) kennt nur Kopfdaten und trägt `listEntryOnly`. Der
 * Voll-Ersatz (`SupabaseRepository.save`) löscht am Server jedes Team und jedes nicht angepfiffene Spiel, das dem übergebenen
 * Stand fehlt. Ein Listen-Eintrag darf deshalb nie dorthin gelangen: die Datenschicht wirft, bevor etwas lokal oder am Server
 * geändert wird. Wer nur den Papierkorb ändern will, nimmt `setTrashed`, wer ein Turnier ändern will, lädt es voll (`get`).
 */
import type { Tournament } from '../../types/tournament';
import { RepositoryError } from '../errors';

export class ListEntrySaveRejectedError extends RepositoryError {
    constructor(tournamentId: string) {
        super('save', `Turnier ${tournamentId} ist nur ein Listen-Eintrag ohne Teams und Spiele und wird nicht als ganzes Turnier gespeichert`);
        this.name = 'ListEntrySaveRejectedError';
    }
}

export function isListEntryOnly(tournament: Pick<Tournament, 'listEntryOnly'>): boolean {
    return tournament.listEntryOnly === true;
}

/** Wirft `ListEntrySaveRejectedError`, wenn der Stand nur ein Listen-Eintrag ist. */
export function assertWholeTournament(tournament: Tournament): void {
    if (isListEntryOnly(tournament)) {
        throw new ListEntrySaveRejectedError(tournament.id);
    }
}
