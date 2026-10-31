/**
 * Usability E (Prüfbericht 2026-10-30, „Gesperrtes nach Anpfiff“): E-01 Spielzeit/Pause, E-02 Struktur-Info, E-03 Löschen im
 * Strafstoßschießen. Szenarien: @W5-036 (gesperrtes Feld nennt den Grund und nur einen Weg, den es gibt), @OB-043 (Pause
 * schreibgeschützt wie die Spielzeit), @OB-071 (kein Hinweis schickt zu einer Funktion, die es nicht gibt), @SL-110.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Tournament } from '../../../../types/tournament';
import type { MatchStartState } from '../../../../utils/matchStartState';
import { hallencupOstGespielt } from '../../../../core/models/__fixtures__/hallencupOstGespielt';
import i18n from 'i18next';
import enCockpit from '../../../../i18n/locales/en/cockpit.json';
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

describe('E-01 Spielzeit und Pause: Grund und Weg am Feld, je Zustand', () => {
  const fest = { ...hallencupOstGespielt(), lifecycleStatus: 'fixed' as const, finishedAt: undefined };
  const offen = (turnier: Tournament) => {
    render(<SettingsCategory tournamentId={turnier.id} tournament={turnier} onTournamentUpdate={vi.fn()} />);
    fireEvent.click(screen.getByText('Spielzeiten'));
  };
  const text = (key: string) => screen.getByTestId(`settings-locked-${key}-grund`);

  it('@W5-036 @OB-043 vor dem ersten Anpfiff mit Recht: Grund und der echte Weg (Einstellungen › Erweiterte Bearbeitung › Spielmodus ändern)', () => {
    offen(fest);
    for (const key of ['game', 'break']) {
      expect(text(key)).toHaveTextContent('weil der Spielplan auf ihr aufbaut');
      expect(text(key)).toHaveTextContent('Einstellungen › „Erweiterte Bearbeitung“ › „Spielmodus ändern“');
      expect(text(key)).toHaveTextContent('Anstoßzeiten änderst du über „Zeiten verschieben“');
    }
  });

  it('@W5-036 Screenreader: das gesperrte Feld verweist per aria-describedby auf diesen Text', () => {
    offen(fest);
    const id = screen.getByTestId('settings-locked-game').getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).toBe(text('game'));
  });

  it('@W5-036 Gegenbeispiel: nach dem Anpfiff nur Grund, kein Weg zur Dauer (nur Anstoßzeiten über „Zeiten verschieben“)', () => {
    zustand.start = 'started';
    offen(fest);
    expect(text('game')).toHaveTextContent('weil der Spielplan auf ihr aufbaut');
    expect(text('game')).not.toHaveTextContent('Erweiterte Bearbeitung');
    expect(text('game')).toHaveTextContent('Anstoßzeiten');
  });

  it('@W5-036 Gegenbeispiel: ohne Recht oder bei unbekanntem Zustand kein Weg zur Dauer', () => {
    zustand.restructure = false;
    offen(fest);
    expect(text('break')).not.toHaveTextContent('Erweiterte Bearbeitung');
    cleanup();
    zustand.restructure = true; zustand.start = 'unknown';
    offen(fest);
    expect(text('break')).not.toHaveTextContent('Erweiterte Bearbeitung');
  });

  it('@W5-036 Gegenbeispiel: nach dem Abschluss steht der Grund, aber kein Weg (es gibt keinen)', () => {
    offen({ ...hallencupOstGespielt(), lifecycleStatus: 'finished' as const, finishedAt: '2026-11-14T18:00:00.000Z' });
    expect(text('break')).toHaveTextContent('weil der Spielplan auf ihr aufbaut');
    expect(text('break')).not.toHaveTextContent('Zeiten verschieben');
    expect(text('break')).not.toHaveTextContent('Erweiterte Bearbeitung');
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
    expect(screen.getByText(i18n.t('admin:metadata.structureInfoBeforeStart'))).toBeInTheDocument();
    expect(i18n.t('admin:metadata.structureInfoBeforeStart')).toContain('Turnierseite unter Einstellungen › „Erweiterte Bearbeitung“'); // Ort des Wegs
    expect(screen.queryByText(/nicht mehr geändert werden/)).toBeNull();
  });

  it('@W5-036 nach dem ersten Anpfiff: Grund „seit dem ersten Anpfiff fest“, kein Weg', () => {
    zustand.start = 'started';
    struktur();
    expect(screen.getByText(i18n.t('tournament:settings.immutableSettings.descriptionAfterStart'))).toBeInTheDocument();
    expect(screen.queryByText(/Erweiterte Bearbeitung/)).toBeNull();
  });

  it('@W5-036 Gegenbeispiel: bei unbekanntem Zustand (offline, lädt) auch mit Recht neutral, ohne Weg und ohne „Anpfiff“', () => {
    zustand.start = 'unknown';
    struktur();
    expect(screen.queryByText(/Erweiterte Bearbeitung/)).toBeNull();
    expect(screen.queryByText(/seit dem ersten Anpfiff/)).toBeNull();
  });

  it('@W5-036 Gegenbeispiel: ohne Recht neutral, ohne Weg', () => {
    zustand.restructure = false;
    struktur();
    expect(screen.getAllByText(/lassen sich hier nicht ändern/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Diese Einstellungen bestimmen den Spielplan\. Vor/)).toBeNull();
    expect(screen.queryByText(/Erweiterte Bearbeitung/)).toBeNull();
  });
});

describe('E-03 Löschen im Strafstoßschießen (bis zum L-01-Fix neutral)', () => {
  it('@OB-071 Abweichung von @SL-110: der Sperrtext verweist weder aufs Protokoll noch auf „Rückgängig“ (im Strafstoßschießen gesperrt), DE und EN', () => {
    const de = i18n.t('cockpit:engine.retract.hint.shootout');
    const en = enCockpit.engine.retract.hint.shootout;
    expect(de).toContain('nicht zurücknehmbar');
    for (const text of [de, en]) { expect(text).not.toMatch(/Protokoll|log\b|Rückgängig|Undo/i); }
    expect(en).toContain('Not reversible');
  });
});
