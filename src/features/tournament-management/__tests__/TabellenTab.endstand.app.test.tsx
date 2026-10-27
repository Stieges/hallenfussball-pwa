/**
 * R3-5 Reiter Tabellen: „Endstand“ als Ansicht (`?ansicht=endstand`). Szenarien @HE-070 Z. 2 und @HE-098 Z. 2 (Helfer lesen nach dem
 * Abschluss den Endstand: der Weg `/tournament/:id/standings` zeigt ihn von allein), @ET-045 (nach dem Abschluss keine errechnete
 * Gesamtplatzierung), @ET-042 (davor jederzeit erreichbar, „vorläufig“).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import type { TeamId } from '../../../core/models/schemas/MatchSlotSchema';
import type { StoredFinalStandingsResult } from '../../../core/repositories/storedFinalStandingsRead';

vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {} }));
const read = vi.hoisted(() => vi.fn<(client: unknown, id: string) => Promise<StoredFinalStandingsResult>>());
vi.mock('../../../core/repositories/storedFinalStandingsRead', () => ({ readStoredFinalStandings: read }));
await initRealDeI18n();

import { generateFullSchedule } from '../../../core/generators';
import { calculateStandings, calculateStandingsPerGroup } from '../../../utils/calculations';
import { NK } from '../../../core/standings/__tests__/groupCompletionKit';
import { nikolausFertig } from '../../../core/services/__tests__/finishKit';
import { TABELLEN_ANSICHT_VORGABE, tabellenAnsichtAusAdresse, tabellenAnsichtInAdresse, tabellenAnsichtVorgabe } from '../tabellenAnsicht';
const { TabellenTabMitAdresse } = await import('../TabellenTabMitAdresse');

function zeige(tournament: Tournament, adresse = '/tournament/t/standings') {
  return render(
    <MemoryRouter initialEntries={[adresse]}>
      <TabellenTabMitAdresse
        tournament={tournament}
        schedule={generateFullSchedule(tournament)}
        currentStandings={calculateStandingsPerGroup(tournament)}
        overallStandings={calculateStandings(tournament.teams, tournament.matches, tournament)}
      />
    </MemoryRouter>,
  );
}

let fertig: Tournament;
beforeEach(async () => {
  fertig = await nikolausFertig();
  read.mockReset();
  read.mockResolvedValue({
    status: 'ok', finishedAt: '2026-11-28T12:10:00.000Z',
    snapshot: { format: 1, appVersion: 't', computedAt: '2026-11-28T12:10:00.000+00:00', scorers: [], ranking: [
      { place: 1, teamId: NK.kammer as TeamId, teamName: 'DJK Kammer', origin: { kind: 'groupPlace', group: '', place: 1 } },
    ] },
  });
});

describe('Ansicht „Endstand“ in der Adresse', () => {
  it('Wert „endstand“ ↔ Ansicht; Vorgabe je Turnier: abgeschlossen → Endstand, sonst Tabelle', () => {
    expect(tabellenAnsichtInAdresse('final')).toBe('endstand');
    expect(tabellenAnsichtAusAdresse('endstand')).toBe('final');
    expect(tabellenAnsichtAusAdresse(null)).toBe(TABELLEN_ANSICHT_VORGABE);
    expect(tabellenAnsichtVorgabe({ lifecycleStatus: 'finished' })).toBe('final');
    expect(tabellenAnsichtVorgabe({ lifecycleStatus: 'fixed' })).toBe('groups');
    expect(tabellenAnsichtAusAdresse('unsinn', 'final')).toBe('final');
  });
});

describe('@HE-070 Z. 2 / @HE-098 Z. 2 nach dem Abschluss zeigt der Reiter Tabellen den gespeicherten Endstand', () => {
  it('abgeschlossen: der Weg „/standings“ öffnet von allein den gespeicherten Endstand', async () => {
    zeige({ ...fertig, lifecycleStatus: 'finished', finishedAt: '2026-11-28T12:10:00.000Z' });
    expect(await screen.findByTestId('final-standings')).toHaveAttribute('data-state', 'stored');
    expect(read).toHaveBeenCalledWith(expect.anything(), fertig.id);
  });

  it('@ET-045 Gegenbeispiel: nach dem Abschluss gibt es keine errechnete „Gesamtplatzierung“ mehr, auch nicht über die alte Adresse', async () => {
    zeige({ ...fertig, lifecycleStatus: 'finished', finishedAt: '2026-11-28T12:10:00.000Z' }, '/tournament/t/standings?ansicht=platzierung');
    expect(await screen.findByTestId('final-standings')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gesamtplatzierung' })).toBeNull();
  });
});

describe('@ET-042 vor dem Abschluss', () => {
  it('der Reiter „Endstand“ zeigt den vorläufigen Stand; die Tabelle bleibt die Vorgabe', async () => {
    zeige(fertig);
    expect(screen.queryByTestId('final-standings')).toBeNull();
    await userEvent.click(screen.getByTestId('tabellen-view-final'));
    expect(await screen.findByTestId('final-standings')).toHaveAttribute('data-state', 'provisional');
    expect(screen.getByRole('button', { name: 'Gesamtplatzierung' })).toBeTruthy();
    expect(read).not.toHaveBeenCalled();
  });
});
