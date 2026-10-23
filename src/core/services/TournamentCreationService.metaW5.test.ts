/**
 * Wizard-Schritt 1 nach dem Festlegen (C-META-NOVALID, Wizard-Teil).
 * @W5-003: Liegt der Turniertag in der Vergangenheit, blockiert das vergangene Datum die Korrektur von Ort oder
 * Schreibweise nicht. Gegenbeispiel: für einen Entwurf bleibt ein vergangenes Datum ein Fehler (F-113).
 * @W5-002: ein leerer Name wird auch bei einem festgelegten Turnier nicht gespeichert.
 * Szenarien aus docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { TournamentCreationService } from './TournamentCreationService';
import type { ITournamentRepository } from '../repositories/ITournamentRepository';

vi.mock('../generators', () => ({ generateFullSchedule: vi.fn() }));

const VERGANGEN = '2020-01-11';
const FEHLER_VERGANGENHEIT = 'Startdatum darf nicht in der Vergangenheit liegen';

function dienst(): TournamentCreationService {
  return new TournamentCreationService({} as ITournamentRepository);
}

describe('Schritt 1 prüft die Stammdaten nach Zustand des Turniers (C-META-NOVALID)', () => {
  it('@W5-003 festgelegtes Turnier mit vergangenem Turniertag: Ort korrigieren wird nicht durch das Datum blockiert', () => {
    const fehler = dienst().validateStep(1, {
      status: 'published', title: 'Hallencup Nord', date: VERGANGEN, location: { name: 'Halle Nord (korrigiert)' },
    });
    expect(fehler).toEqual([]);
  });

  it('@W5-003 Gegenbeispiel: ein Entwurf mit vergangenem Datum wird weiter abgelehnt', () => {
    const fehler = dienst().validateStep(1, {
      status: 'draft', title: 'Hallencup Nord', date: VERGANGEN, location: { name: 'Halle Nord' },
    });
    expect(fehler).toContain(FEHLER_VERGANGENHEIT);
  });

  it('@W5-002 festgelegtes Turnier mit leerem Namen: Fehler, auch wenn der Turniertag vergangen ist', () => {
    const fehler = dienst().validateStep(1, {
      status: 'published', title: '  ', date: VERGANGEN, location: { name: 'Halle Nord' },
    });
    expect(fehler).toContain('Turniername erforderlich');
    expect(fehler).not.toContain(FEHLER_VERGANGENHEIT);
  });
});
