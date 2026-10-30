/**
 * Gleichlauf der Entscheidungs-Grundlage (C-PUBLIC-ENTSCHEIDUNG-BASIS-LEER, @W2A-059 Z. 3, @ET-055, @ET-044, @ZM-180): Der Fingerabdruck,
 * den Ollis Gerät beim Abschluss der Gruppe speichert, ist derselbe, den Zuschauer-Seite und Monitor aus der Antwort der Server-Funktion
 * rechnen (Punkteschema, Kriterien, Spielkennung, Stand, Status, Nichtantritt). Nur dann genügt es, dass der Server `basis` durchreicht.
 */
import { describe, expect, it } from 'vitest';
import { parsePublicPayload } from '../publicPayload';
import { mapTournamentFromSupabase } from '../supabaseMappers';
import { decisionBasis } from '../../standings/decisions';
import { rankTournamentGroup, tableInput } from '../../standings/tournamentTable';
import type { Tournament } from '../../../types/tournament';
import { id } from '../../standings/__tests__/fixtures';
import { mitStrafstossNord, NORD, serverAntwort, serverZeilen, SUED, turnierNordSued } from './publicEntscheidungKit';

const block = [id('N'), id('S')];
const basisVon = (t: Tournament): string => decisionBasis(tableInput(t.teams, t.matches, t, ''), block);

function oeffentlich(reply: Record<string, unknown>): Tournament {
  const parsed = parsePublicPayload(reply);
  if (parsed.kind !== 'full') { throw new Error(parsed.kind); }
  return parsed.tournament;
}

describe('Entscheidungs-Grundlage: Gerät der Turnierleitung = öffentlicher Stand', () => {
  const olli = mitStrafstossNord(turnierNordSued());
  const gespeichert = olli.standingDecisions?.[0]?.basis ?? '';

  it('der gespeicherte Fingerabdruck ist kein leerer Text und nennt Punkteschema, Kriterien und Spiele', () => {
    expect(JSON.parse(gespeichert)).toMatchObject({ points: [3, 1, 0], criteria: ['points', 'directComparison', 'goalDifference', 'goalsFor'] });
    expect((JSON.parse(gespeichert) as { matches: unknown[] }).matches).toHaveLength(9); // 9 Spiele mit Nord oder Süd
  });

  it('@ZM-180 Zuschauer (public_tournament) rechnet aus der Server-Antwort denselben Fingerabdruck wie Ollis Gerät', () => {
    expect(basisVon(oeffentlich(serverAntwort(olli, { art: 'gespeichert' })))).toBe(gespeichert);
  });

  it('@ZM-180 Monitor (display_tournament) rechnet denselben Fingerabdruck', () => {
    expect(basisVon(oeffentlich(serverAntwort(olli, { art: 'gespeichert' }, 'screen')))).toBe(gespeichert);
  });

  it('ein zweites Gerät der Turnierleitung (volle Zeilen aus der Cloud) rechnet denselben Fingerabdruck', () => {
    const z = serverZeilen(olli);
    const cloud = mapTournamentFromSupabase(z.tournament as never, z.teams as never, z.matches as never);
    expect(basisVon(cloud)).toBe(gespeichert);
  });

  it('@W2A-059 @ET-055 mit gespeicherter Grundlage: FC Nord Platz 1, SV Süd Platz 2, keine Entscheidung offen', () => {
    const rows = rankTournamentGroup(oeffentlich(serverAntwort(olli, { art: 'gespeichert' })), '').rows;
    expect(rows.slice(0, 2).map((r) => [r.place, r.team.name, r.decisionNeeded])).toEqual([[1, NORD, false], [2, SUED, false]]);
  });

  it('Gegenprobe: mit leerer Grundlage (Fassung 20261117_104) bleibt der Gleichstand offen', () => {
    const rows = rankTournamentGroup(oeffentlich(serverAntwort(olli, { art: 'leer' })), '').rows;
    expect(rows.slice(0, 2).map((r) => [r.place, r.decisionNeeded])).toEqual([[1, true], [1, true]]);
  });
});
