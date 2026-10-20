/**
 * Suche im Dashboard: passt ein Turnier zum Suchtext (Titel, Veranstalter, Altersklasse, Ort)?
 *
 * Robust gegen fehlende Felder: der lokale Speicher gibt ein Turnier, das die Zod-Prüfung nicht besteht, bewusst roh
 * zurück (`LocalStorageRepository.loadList`, „kein Datenverlust“) – etwa ohne Altersklasse oder Ort. Die Suche darf
 * daran nicht abstürzen (sonst ersetzt die Fehlergrenze das ganze Dashboard).
 */
import type { Tournament } from '../types/tournament';

type SearchFields = Pick<Tournament, 'title' | 'organizer' | 'ageClass' | 'location'>;

export function matchesTournamentSearch(tournament: SearchFields, searchQuery: string): boolean {
  const query = searchQuery.trim().toLowerCase();
  if (query === '') {
    return true;
  }
  const location = tournament.location as SearchFields['location'] | undefined;
  const fields: Array<string | undefined> = [
    tournament.title,
    tournament.organizer,
    tournament.ageClass,
    location?.city,
    location?.name,
  ];
  return fields.some((field) => typeof field === 'string' && field.toLowerCase().includes(query));
}
