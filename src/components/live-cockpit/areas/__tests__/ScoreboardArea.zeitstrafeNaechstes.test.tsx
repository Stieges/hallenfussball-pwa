/**
 * Tafel am Handy (Cockpit-Paket K7, K12): laufende Zeitstrafen mit Restzeit im ersten Bild (@SL-029, @SL-031, @SL-086) und die Zeile
 * „Nächstes“ im Platz der Meldezeile (@SL-155: erst ab der Vorwarnung, die Tasten springen nie; eine Meldung hat Vorrang).
 * Gherkin: docs/anforderungen/2026-10-02_spiel-leiten.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { ScoreboardArea, type ScoreboardAreaProps } from '../ScoreboardArea';
import { cockpitPhaseOf } from '../../model/cockpitPhase';
import { makeLiveMatch, makePhaseView } from '../../__tests__/cockpitFixtures';
import type { CockpitNotice } from '../../hooks/useCockpitNotices';
import type { PhasePenalty } from '../../engine/phaseView';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const match = makeLiveMatch({ homeTeam: { id: 'sv-sued', name: 'SV Süd' }, awayTeam: { id: 'fc-nord', name: 'FC Nord' } });

function area(p: { penalties?: PhasePenalty[]; status?: 'running' | 'paused'; aktuell?: CockpitNotice | null; naechstes?: boolean }): ScoreboardAreaProps {
  const view = makePhaseView({ status: p.status ?? 'running', penalties: p.penalties ?? [] });
  return {
    match, phase: cockpitPhaseOf({ view, matchStatus: p.status === 'paused' ? 'PAUSED' : 'RUNNING', leer: null }), view,
    settings: { clockMode: 'durchlaufend-letzte-minute-angehalten', finalPhaseMinutes: 1 },
    order: { links: 'home', rechts: 'away' }, size: 'compact', notices: { aktuell: p.aktuell ?? null, schliesse: vi.fn() }, eintraegeWarten: 0,
    naechstes: p.naechstes ? <div data-testid="naechstes-zeile">Nächstes: Spiel 12</div> : null,
  };
}

describe('@SL-029/@SL-031 laufende Zeitstrafen stehen in der Tafel', () => {
  it('@SL-029 Zeitstrafe der Nummer 5 von SV Süd mit Restzeit 1:58 unter dem Kasten von SV Süd', () => {
    render(<ScoreboardArea {...area({ penalties: [{ id: 'p1', teamId: 'sv-sued', playerNumber: 5, remainingMs: 118_000 }] })} />);
    const strafe = screen.getByTestId('scoreboard-strafe-p1');
    expect(strafe).toHaveTextContent('#5 1:58');
    expect(strafe).toHaveAccessibleName('Zeitstrafe #5, noch 1:58');
    expect(strafe).toHaveAttribute('data-steht', 'false');
  });

  it('@SL-031 zwei Zeitstrafen desselben Teams stehen beide da, die des Gegners auf seiner Seite', () => {
    render(<ScoreboardArea {...area({ penalties: [
      { id: 'p1', teamId: 'fc-nord', playerNumber: 7, remainingMs: 72_000 },
      { id: 'p2', teamId: 'fc-nord', remainingMs: 40_000 },
      { id: 'p3', teamId: 'sv-sued', playerNumber: 4, remainingMs: 100_000 },
    ] })} />);
    expect(screen.getByTestId('scoreboard-strafe-p1')).toHaveTextContent('#7 1:12');
    expect(screen.getByTestId('scoreboard-strafe-p2')).toHaveAccessibleName('Zeitstrafe ohne Nummer, noch 0:40');
    // Seiten: Strafen von FC Nord (rechts) stehen rechts, die von SV Süd (links) links
    const rechts = screen.getByTestId('scoreboard-strafe-p1').closest('[style*="right"]');
    expect(rechts).toContainElement(screen.getByTestId('scoreboard-strafe-p2'));
    expect(rechts).not.toContainElement(screen.getByTestId('scoreboard-strafe-p3'));
  });

  it('@SL-086 steht die Uhr, steht auch die Restzeit (gedämpft markiert)', () => {
    render(<ScoreboardArea {...area({ status: 'paused', penalties: [{ id: 'p1', teamId: 'sv-sued', playerNumber: 5, remainingMs: 118_000 }] })} />);
    expect(screen.getByTestId('scoreboard-strafe-p1')).toHaveAttribute('data-steht', 'true');
  });

  it('Gegenbeispiel: ohne laufende Zeitstrafe keine Zeitstrafe in der Tafel', () => {
    render(<ScoreboardArea {...area({})} />);
    expect(screen.queryByTestId(/scoreboard-strafe-/)).toBeNull();
  });
});

describe('@SL-155 Zeile „Nächstes“ am Handy im Platz der Meldezeile', () => {
  it('@SL-155 ohne Meldung steht die Zeile in der Meldezeile der Tafel', () => {
    render(<ScoreboardArea {...area({ naechstes: true })} />);
    expect(screen.getByTestId('scoreboard')).toContainElement(screen.getByTestId('naechstes-zeile'));
  });

  it('@SL-155 eine Meldung hat Vorrang, die Zeile weicht für ihre Dauer', () => {
    render(<ScoreboardArea {...area({ naechstes: true, aktuell: { id: 1, stufe: 3, text: 'Tor für SV Süd', dauerMs: 3000 } })} />);
    expect(screen.queryByTestId('naechstes-zeile')).toBeNull();
    expect(screen.getByTestId('notice-line')).toHaveTextContent('Tor für SV Süd');
  });
});
