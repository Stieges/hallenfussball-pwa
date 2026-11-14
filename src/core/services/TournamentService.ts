import { ITournamentRepository } from '../repositories/ITournamentRepository';
import { Tournament } from '../models/types';
import { ScheduleService } from './ScheduleService';

/**
 * TournamentService
 * High-level service for full Tournament lifecycle.
 * Composes ScheduleService for match-specific logic.
 */
export class TournamentService {
    private scheduleService: ScheduleService;

    constructor(private repository: ITournamentRepository) {
        this.scheduleService = new ScheduleService(repository);
    }

    /**
     * Lädt ein Turnier und liefert es unverändert. Laden schreibt NIE (@W5-042, Befund C-VERWALTUNG-OEFFNEN-ERZEUGT-SPIELPLAN):
     * Hat die geladene Kopie keine Spiele, erzeugt und speichert die Verwaltung keinen Spielplan -- ein veröffentlichtes Turnier
     * bekommt seine Spiele nur aus `publish()`, und eine ältere lokale Kopie ohne Spiele würde sonst den Stand des Servers
     * mit einem falschen Plan überdecken (Versionsprüfung lehnt ab, die abgelehnte Änderung blockiert die Übernahme des Servers).
     * Die Anzeige weist bei einem Turnier ohne Spiele auf den Assistenten hin (`ScheduleMissingNotice`).
     */
    async loadTournament(id: string, options?: { fresh?: boolean }): Promise<Tournament | null> {
        // A-08f3b: `fresh` (Push/Abfrage-Ausweichen) wartet auf den zusammengeführten Cloud-Stand.
        return this.repository.get(id, options);
    }

    /**
     * Updates tournament metadata (NOT matches).
     * Use ScheduleService for match updates.
     */
    async updateTournament(tournament: Tournament): Promise<void> {
        await this.repository.save(tournament);
    }

    /**
     * Access to underlying ScheduleService for match operations.
     */
    get schedule(): ScheduleService {
        return this.scheduleService;
    }
}
