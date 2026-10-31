/**
 * Usability E (Prüfbericht 2026-10-30, „Gesperrtes nach Anpfiff“): E-01 Spielzeit/Pause, E-02 Struktur-Info, E-03 Löschen im
 * Strafstoßschießen. Szenarien: @W5-036 (gesperrtes Feld nennt den Grund und nur einen Weg, den es gibt), @OB-043 (Pause
 * schreibgeschützt wie die Spielzeit), @OB-071 (kein Hinweis schickt zu einer Funktion, die es nicht gibt), @SL-110.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Tournament } from '../../../../types/tournament';
import type { MatchStartState } from '../../../../utils/matchStartState';
import { hallencupOstGespielt } from '../../../../core/models/__fixtures__/hallencupOstGespielt';
import { initRealDeI18n } from '../../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const zustand = vi.hoisted((): { start: MatchStartState; restructure: boolean } => ({ start: 'not-started', restructure: true }));
vi.mock('../../../../hooks', () => ({ useTournaments: () => ({ saveTournament: vi.fn() }) }));
vi.mock('../../../../hooks/useRepository', () => ({ useRepository: () => ({ get: () => Promise.resolve(null) }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../../tournament-management/FieldManagement', () => ({ FieldManagement: () => null }));
vi.mock('../../../../components/LocationForm', () => ({ LocationForm: () => null }));
vi.mock('../../../../hooks/useTournamentStartState', () => ({ useTournamentStartState: () => ({ state: zustand.start }) }));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: (a: string) => (a === 'restructure' ? zustand.restructure : true) }));

import { SettingsCategory } from '../Settings';
import { MetadataCategory } from '../Metadata';

beforeEach(() => { zustand.start = 'not-started'; zustand.restructure = true; });

describe('E-01 Spielzeit und Pause: Grund und Weg am Feld', () => {
  const offen = (turnier: Tournament) => {
    render(<SettingsCategory tournamentId={turnier.id} tournament={turnier} onTournamentUpdate={vi.fn()} />);
    fireEvent.click(screen.getByText('Spielzeiten'));
  };

  it('@W5-036 @OB-043 festgelegtes Turnier: der Text am Feld nennt den Grund und den Weg „Zeiten verschieben“', () => {
    offen({ ...hallencupOstGespielt(), lifecycleStatus: 'fixed' as const, finishedAt: undefined });
    for (const key of ['game', 'break']) {
      const text = screen.getByTestId(`settings-locked-${key}-grund`);
      expect(text).toHaveTextContent('weil der Spielplan auf ihr aufbaut');
      expect(text).toHaveTextContent('„Zeiten verschieben“');
    }
  });

  it('@W5-036 Screenreader: das gesperrte Feld verweist per aria-describedby auf diesen Text', () => {
    offen({ ...hallencupOstGespielt(), lifecycleStatus: 'fixed' as const, finishedAt: undefined });
    const feld = screen.getByTestId('settings-locked-game');
    const id = feld.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).toBe(screen.getByTestId('settings-locked-game-grund'));
  });

  it('@W5-036 Gegenbeispiel: nach dem Abschluss steht der Grund, aber kein Weg (es gibt keinen)', () => {
    offen({ ...hallencupOstGespielt(), lifecycleStatus: 'finished' as const, finishedAt: '2026-11-14T18:00:00.000Z' });
    const text = screen.getByTestId('settings-locked-break-grund');
    expect(text).toHaveTextContent('weil der Spielplan auf ihr aufbaut');
    expect(text).not.toHaveTextContent('Zeiten verschieben');
  });
});

describe('E-02 Struktur-Info: der Text folgt dem Zustand', () => {
  const turnier = { id: 't1', title: 'Hallencup Nord', status: 'published', ageClass: 'E-Jugend', teams: [], matches: [], numberOfTeams: 6, numberOfGroups: 2, numberOfFields: 1,
    startDate: '2026-11-21', startTime: '13:00', location: { name: 'Halle' }, placementLogic: [] } as unknown as Tournament;
  const struktur = () => {
    render(<MetadataCategory tournamentId="t1" tournament={turnier} onTournamentUpdate={vi.fn()} />);
    fireEvent.click(screen.getByText('Struktur-Info (gesperrt)'));
  };

  it('@W5-036 @W5-005 vor dem ersten Anpfiff mit Recht: der Weg „Erweiterte Bearbeitung“ wird genannt', () => {
    struktur();
    expect(screen.getByText(/Vor dem ersten Anpfiff änderst du sie über „Erweiterte Bearbeitung“/)).toBeInTheDocument();
    expect(screen.queryByText(/nicht mehr geändert werden/)).toBeNull();
  });

  it('@W5-036 nach dem ersten Anpfiff: Grund „seit dem ersten Anpfiff fest“, kein Weg', () => {
    zustand.start = 'started';
    struktur();
    expect(screen.getByText(/seit dem ersten Anpfiff fest/)).toBeInTheDocument();
    expect(screen.queryByText(/Erweiterte Bearbeitung/)).toBeNull();
  });

  it('@W5-036 Gegenbeispiel: ohne Recht oder bei unbekanntem Zustand neutral, ohne Weg und ohne „Anpfiff“', () => {
    zustand.restructure = false;
    struktur();
    expect(screen.getAllByText(/lassen sich hier nicht ändern/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Diese Einstellungen bestimmen den Spielplan\. Vor/)).toBeNull();
    expect(screen.queryByText(/Erweiterte Bearbeitung/)).toBeNull();
  });
});

describe('E-03 Löschen im Strafstoßschießen', () => {
  const lies = (l: string): string => readFileSync(join(process.cwd(), 'src/i18n/locales', l, 'cockpit.json'), 'utf8');

  it('@OB-071 @SL-110 der Sperrtext verweist nicht auf das Protokoll (dort ist man schon), sondern auf „Rückgängig“', () => {
    for (const l of ['de', 'en']) {
      const block = lies(l).match(/"shootout": "([^"]*)"/)![1];
      expect(block, l).not.toMatch(/Protokoll|log/i);
    }
    expect(lies('de')).toContain('nimmt „Rückgängig“ den letzten Schuss zurück');
  });
});
