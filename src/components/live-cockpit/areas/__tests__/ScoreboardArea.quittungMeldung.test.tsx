/**
 * ScoreboardArea: Solange die Quittung nach dem Abpfiff steht (@SL-152), entfällt die Meldung „Spiel abgepfiffen“ in der
 * Meldezeile (dieselbe Aussage mit demselben Häkchen, Gestaltungsentscheidung „gilt nach Vorschlag“ 2026-10-20). Nur diese
 * eine Meldung entfällt: andere Meldungen bleiben, ohne Engine-Ansicht (keine Quittung) bleibt auch sie.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { ScoreboardArea, type ScoreboardAreaProps } from '../ScoreboardArea';
import { cockpitPhaseOf } from '../../model/cockpitPhase';
import { makeLiveMatch, makePhaseView } from '../../__tests__/cockpitFixtures';
import type { CockpitNotice } from '../../hooks/useCockpitNotices';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const abgepfiffen: CockpitNotice = { id: 1, stufe: 3, text: 'Spiel abgepfiffen', dauerMs: 3000, kennung: 'abgepfiffen' };
const fehler: CockpitNotice = { id: 2, stufe: 2, text: 'Senden fehlgeschlagen', dauerMs: 5000 };

function area(aktuell: CockpitNotice | null, view: { quittungRestMs: number | null } | 'ohne'): ScoreboardAreaProps {
  const v = view === 'ohne' ? null : makePhaseView({ status: 'finished', sectionElapsedMs: 360_000, quittungRestMs: view.quittungRestMs });
  const match = makeLiveMatch({ status: 'FINISHED', homeScore: 2, awayScore: 1 });
  return {
    match, phase: cockpitPhaseOf({ view: v, matchStatus: 'FINISHED', leer: null }), view: v,
    settings: { clockMode: 'durchlaufend-letzte-minute-angehalten', finalPhaseMinutes: 1 },
    order: { links: 'home', rechts: 'away' }, size: 'regular', notices: { aktuell, schliesse: vi.fn() }, eintraegeWarten: 0,
  };
}

describe('ScoreboardArea: Meldezeile in der Quittung (@SL-152)', () => {
  it('@SL-152 solange die Quittung steht, entfällt „Spiel abgepfiffen“ in der Meldezeile; die Quittung steht', () => {
    render(<ScoreboardArea {...area(abgepfiffen, { quittungRestMs: 18_000 })} />);
    expect(screen.getByTestId('scoreboard-quittung')).toHaveTextContent('Abgepfiffen · 2:1 gespeichert');
    expect(screen.getByTestId('notice-line')).not.toHaveTextContent('Spiel abgepfiffen');
  });

  it('@SL-152 Gegenbeispiel: eine andere Meldung (Fehler) bleibt in der Quittung sichtbar', () => {
    render(<ScoreboardArea {...area(fehler, { quittungRestMs: 18_000 })} />);
    expect(screen.getByTestId('scoreboard-quittung')).toBeInTheDocument();
    expect(screen.getByTestId('notice-line')).toHaveTextContent('Senden fehlgeschlagen');
  });

  it('@SL-152 Gegenbeispiel: ohne Engine-Ansicht (keine Quittung) bleibt „Spiel abgepfiffen“ in der Meldezeile', () => {
    render(<ScoreboardArea {...area(abgepfiffen, 'ohne')} />);
    expect(screen.queryByTestId('scoreboard-quittung')).toBeNull();
    expect(screen.getByTestId('notice-line')).toHaveTextContent('Spiel abgepfiffen');
  });

  it('@SL-152 Gegenbeispiel: ohne laufende Quittung (nach den 30 Sekunden) wird die Meldung nicht verschluckt', () => {
    render(<ScoreboardArea {...area(abgepfiffen, { quittungRestMs: 0 })} />);
    expect(screen.getByTestId('notice-line')).toHaveTextContent('Spiel abgepfiffen');
  });
});
