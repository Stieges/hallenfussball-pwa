/**
 * Legal Configuration
 *
 * Central configuration for legal pages (Impressum, Datenschutz).
 * All placeholders must be replaced before production launch!
 *
 * Search for "[PLATZHALTER:" to find all values that need to be filled.
 */

export interface LegalConfig {
  company: {
    name: string;
    street: string;
    city: string;
    country: string;
  };
  contact: {
    email: string;
    phone?: string;
  };
  tax?: {
    vatId?: string;
  };
  register?: {
    court?: string;
    number?: string;
  };
  responsible: {
    name: string;
    address: string;
  };
  supervisoryAuthority: {
    name: string;
    address: string;
    url: string;
  };
  lastUpdated: string;
}

/**
 * Legal configuration with placeholders.
 *
 * BEFORE LAUNCH: Replace all [PLATZHALTER: ...] values with real data!
 */
export const LEGAL_CONFIG: LegalConfig = {
  company: {
    name: '[PLATZHALTER: Name / Firma]',
    street: '[PLATZHALTER: Straße und Hausnummer]',
    city: '[PLATZHALTER: PLZ und Ort]',
    country: '[PLATZHALTER: Land]',
  },
  contact: {
    email: '[PLATZHALTER: E-Mail-Adresse]',
    phone: '[PLATZHALTER: Telefonnummer]', // optional - can be removed
  },
  tax: {
    vatId: '[PLATZHALTER: USt-IdNr.]', // optional - remove section if not applicable
  },
  register: {
    court: '[PLATZHALTER: Registergericht]', // optional - remove section if not applicable
    number: '[PLATZHALTER: Registernummer]',
  },
  responsible: {
    name: '[PLATZHALTER: Name]',
    address: '[PLATZHALTER: Anschrift]',
  },
  supervisoryAuthority: {
    // Choose based on company location (see RECHTLICHE-SEITEN-KONZEPT.md Anhang A)
    name: '[PLATZHALTER: Name der Behörde]',
    address: '[PLATZHALTER: Anschrift]',
    url: '[PLATZHALTER: URL]',
  },
  lastUpdated: '[PLATZHALTER: Datum]', // e.g., "Januar 2025"
};

/**
 * Helper to check if a value is still a placeholder
 */
export function isPlaceholder(value: string): boolean {
  return value.startsWith('[PLATZHALTER:');
}

/**
 * Helper to get all unfilled placeholders
 * Useful for validation before launch
 */
export function getUnfilledPlaceholders(): string[] {
  const unfilled: string[] = [];

  const checkObject = (obj: Record<string, unknown>, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string' && isPlaceholder(value)) {
        unfilled.push(path);
      } else if (typeof value === 'object' && value !== null) {
        checkObject(value as Record<string, unknown>, path);
      }
    }
  };

  checkObject(LEGAL_CONFIG as unknown as Record<string, unknown>);
  return unfilled;
}
