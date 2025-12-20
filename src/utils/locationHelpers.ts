import { Tournament, LocationDetails } from '../types/tournament';

/**
 * Gibt den Hallen-Namen zurück
 */
export function getLocationName(tournament: { location?: LocationDetails }): string {
  return tournament.location?.name || '';
}

/**
 * Gibt vollständige Adresse als formatierter String zurück
 * Format: "Sporthalle Waging, Mozartstraße 9, 83329 Waging am See, Deutschland"
 */
export function getFullLocationAddress(tournament: { location?: LocationDetails }): string {
  const { location } = tournament;

  if (!location) {return '';}

  const parts: string[] = [];

  if (location.name) {
    parts.push(location.name);
  }

  if (location.street) {
    parts.push(location.street);
  }

  if (location.postalCode && location.city) {
    parts.push(`${location.postalCode} ${location.city}`);
  } else if (location.city) {
    parts.push(location.city);
  }

  if (location.country) {
    parts.push(location.country);
  }

  return parts.join(', ');
}

/**
 * Formatiert Adresse für PDF/Export (mehrzeilig)
 * Gibt Array von Zeilen zurück
 */
export function formatLocationForPrint(tournament: { location?: LocationDetails }): string[] {
  const { location } = tournament;

  if (!location) {return [];}

  const lines: string[] = [];

  if (location.name) {
    lines.push(location.name);
  }

  if (location.street) {
    lines.push(location.street);
  }

  if (location.postalCode && location.city) {
    lines.push(`${location.postalCode} ${location.city}`);
  } else if (location.city) {
    lines.push(location.city);
  }

  if (location.country) {
    lines.push(location.country);
  }

  return lines;
}

/**
 * Prüft ob erweiterte Adressdaten vorhanden sind
 */
export function hasExtendedLocationData(tournament: { location?: LocationDetails }): boolean {
  const { location } = tournament;

  if (!location) {return false;}

  return !!(
    location.street ||
    location.postalCode ||
    location.city ||
    location.country ||
    location.coordinates
  );
}

/**
 * Extrahiert einzigartige Locations aus Turnieren (für Autocomplete)
 */
export function getUniqueLocations(tournaments: Tournament[]): LocationDetails[] {
  const seen = new Map<string, LocationDetails>();

  tournaments.forEach(tournament => {
    const { location } = tournament;

    if (!location) {return;}

    const key = location.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, location);
    }
  });

  return Array.from(seen.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'de')
  );
}

/**
 * Sucht Location nach Namen (für Autocomplete-Auswahl)
 */
export function findLocationByName(
  tournaments: Tournament[],
  name: string
): LocationDetails | undefined {
  const locations = getUniqueLocations(tournaments);
  return locations.find(loc =>
    loc.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Gibt Adresszeile im Format "Straße, Stadt" zurück (für PDF/Vorschau)
 * Format: "Mozartstraße 9, Waging am See"
 */
export function getLocationAddressLine(tournament: { location?: LocationDetails }): string {
  const { location } = tournament;

  if (!location) {return '';}

  const parts: string[] = [];

  if (location.street) {
    parts.push(location.street);
  }

  if (location.city) {
    parts.push(location.city);
  }

  return parts.join(', ');
}

/**
 * Migriert alte String-Locations zu LocationDetails-Format
 * Wird einmalig beim App-Start ausgeführt
 */
export function migrateLocationsToStructured(tournaments: Tournament[]): Tournament[] {
  return tournaments.map(tournament => {
    const { location } = tournament;

    // Bereits neues Format? → Skip
    if (typeof location === 'object' && location !== null) {
      return tournament;
    }

    // String zu LocationDetails konvertieren
    if (typeof location === 'string' && (location as string).length > 0) {
      const locationDetails: LocationDetails = {
        name: location as string,
        // Andere Felder bleiben leer (Nutzer kann später ergänzen)
      };

      return {
        ...tournament,
        location: locationDetails,
      };
    }

    // Leere Location
    return tournament;
  });
}
