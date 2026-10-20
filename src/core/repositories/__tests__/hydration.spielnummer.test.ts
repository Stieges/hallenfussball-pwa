/**
 * Lokal gespeichertes Turnier ohne Spielnummer (vor dem Fix veröffentlicht, Befund C-SPIELNUMMER-FEHLT): beim Laden
 * gilt dieselbe Zählung wie beim Lesen aus der Cloud, damit Gerät und Cloud dieselbe „Spiel N“ zeigen (@SL-049, @ZM-007).
 */
import { describe, it, expect } from 'vitest';
import { hydrateTournament } from '../hydration';
import { publishHallencup } from '../../view/__fixtures__/hallencupNord';

describe('hydrateTournament: Spielnummer', () => {
  it('@SL-049 C-SPIELNUMMER-FEHLT: ein lokal ohne Nummer gespeichertes Turnier lädt mit den Nummern 1, 2, 3 … in Spielplan-Reihenfolge', async () => {
    const cup = (await publishHallencup()).tournament;
    const gespeichert = JSON.parse(JSON.stringify({ ...cup, matches: [...cup.matches].reverse().map(({ matchNumber: _weg, ...rest }) => rest) })) as unknown;

    const geladen = hydrateTournament(gespeichert);

    expect(new Map(geladen.matches.map((m) => [m.id, m.matchNumber]))).toEqual(new Map(cup.matches.map((m) => [m.id, m.matchNumber])));
  });

  it('Gegenbeispiel: gespeicherte Nummern bleiben beim Laden unverändert', async () => {
    const cup = (await publishHallencup()).tournament;
    const vertauscht = cup.matches.map((m, i) => ({ ...m, matchNumber: cup.matches.length - i }));

    const geladen = hydrateTournament(JSON.parse(JSON.stringify({ ...cup, matches: vertauscht })) as unknown);

    expect(geladen.matches.map((m) => m.matchNumber)).toEqual(vertauscht.map((m) => m.matchNumber));
  });
});
