/**
 * StrafenSpalte (Plan Cockpit v2 B3): @SL-186 – Zeile „Keine aktiven Zeitstrafen“ bei 0, zwei Karten bei 2, zwei Karten und „+ 1 weitere“ bei 3.
 * Echte deutsche Texte.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { StrafenSpalte } from '../StrafenSpalte';
import { toStrafenModel, KEINE_STRAFEN } from '../../model/toStrafenModel';
import type { PhasePenalty } from '../../engine/phaseView';
import { makeLiveMatch, KASTEN_HEIM, KASTEN_GAST } from '../../__tests__/cockpitFixtures';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const match = makeLiveMatch({ homeTeam: { id: 'tsv-petting', name: 'TSV Petting' }, awayTeam: { id: 'djk-otting', name: 'DJK Otting' } });
const strafe = (id: string, rest: number, nummer = 9): PhasePenalty => ({ id, teamId: 'djk-otting', playerNumber: nummer, remainingMs: rest * 1000, durationMs: 120_000, seitMs: 198_000 });
const modell = (strafen: PhasePenalty[]) => toStrafenModel(strafen, match, { home: KASTEN_HEIM, away: KASTEN_GAST });

describe('@SL-186 Laufende Zeitstrafen stehen als Karten am Laptop', () => {
  it('0 laufende Zeitstrafen: eine Zeile „Keine aktiven Zeitstrafen“, keine Karte', () => {
    render(<StrafenSpalte model={KEINE_STRAFEN} />);
    expect(screen.getByTestId('strafen-keine')).toHaveTextContent('Keine aktiven Zeitstrafen');
    expect(screen.getByTestId('strafen-spalte')).toHaveAttribute('data-anzahl', '0');
    expect(screen.queryByText(/weitere/)).toBeNull();
  });

  it('2 laufende Zeitstrafen: beide als Karte mit großer Restzeit, Spielzeit des Beginns und Balken, ohne „weitere“', () => {
    render(<StrafenSpalte model={modell([strafe('a', 72), strafe('b', 100, 4)])} />);
    expect(screen.getByTestId('strafen-karte-a-rest')).toHaveTextContent('1:12');
    expect(screen.getByTestId('strafen-karte-a-titel')).toHaveTextContent('DJK Otting, Nr. 9');
    expect(screen.getByTestId('strafen-karte-a')).toHaveTextContent('Zeitstrafe 2 Min · seit Spielzeit 3:18');
    expect(screen.getByTestId('strafen-karte-b-titel')).toHaveTextContent('DJK Otting, Nr. 4');
    expect(screen.queryByTestId('strafen-weitere')).toBeNull();
  });

  it('3 laufende Zeitstrafen: zwei als Karte und eine Zeile „+ 1 weitere“', () => {
    render(<StrafenSpalte model={modell([strafe('a', 72), strafe('b', 100, 4), strafe('c', 110, 7)])} />);
    expect(screen.getByTestId('strafen-spalte')).toHaveAttribute('data-anzahl', '2');
    expect(screen.queryByTestId('strafen-karte-c')).toBeNull();
    expect(screen.getByTestId('strafen-weitere')).toHaveTextContent('+ 1 weitere');
  });

  it('ohne Nummer steht „ohne Nr.“, bei einer Strafe aus dem früheren Abschnitt entfällt „seit Spielzeit“', () => {
    render(<StrafenSpalte model={modell([{ ...strafe('o', 50), playerNumber: undefined, seitMs: null }])} />);
    expect(screen.getByTestId('strafen-karte-o-titel')).toHaveTextContent('DJK Otting, ohne Nr.');
    expect(screen.getByTestId('strafen-karte-o')).toHaveTextContent('Zeitstrafe 2 Min');
    expect(screen.getByTestId('strafen-karte-o')).not.toHaveTextContent('seit Spielzeit');
  });
});
