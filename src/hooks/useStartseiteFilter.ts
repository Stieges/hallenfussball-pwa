/**
 * Suche und Filter der Startseite stehen in der Adresse (@OB-030, URL-ROUTING): `?q=F1&s=running,draft`.
 * Neu laden oder ein geteilter Link stellt beides wieder her. Tippen in der Suche ersetzt den Eintrag, damit die Zurück-Taste nicht
 * jeden Buchstaben einzeln zurückgeht; das Umschalten eines Filters ist ein eigener Verlaufseintrag (Zurück geht einen Filter zurück, @OB-031).
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseFilterChips, type FilterChip } from '../utils/startseiteAbschnitte';

export interface StartseiteFilter {
  searchQuery: string;
  activeFilters: FilterChip[];
  setSearchQuery: (query: string) => void;
  toggleFilter: (filter: FilterChip) => void;
}

export function useStartseiteFilter(): StartseiteFilter {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const filterParam = searchParams.get('s');
  const activeFilters = useMemo(() => parseFilterChips(filterParam), [filterParam]);

  const setSearchQuery = useCallback((query: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (query === '') { next.delete('q'); } else { next.set('q', query); }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const toggleFilter = useCallback((filter: FilterChip) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const current = parseFilterChips(next.get('s'));
      const updated = current.includes(filter) ? current.filter((f) => f !== filter) : [...current, filter];
      if (updated.length === 0) { next.delete('s'); } else { next.set('s', updated.join(',')); }
      return next;
    });
  }, [setSearchParams]);

  return { searchQuery, activeFilters, setSearchQuery, toggleFilter };
}
