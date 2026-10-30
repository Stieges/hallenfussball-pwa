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
import { ERGEBNISSE_NORD_SUED, mitStrafstossNord, NORD, serverAntwort, serverZeilen, SUED, turnierNordSued } from './publicEntscheidungKit';

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

/**
 * Nichtantritt (A-25c, Review #413 M2): Wertungen gehen über `decided_by` und `forfeit_absent` in den Fingerabdruck, eine
 * Wertung beider Seiten zusätzlich über die Einstellung `forfeitScore`. FC Nord und SV Süd bleiben in beiden Lagen nach allen
 * Kriterien gleich auf Platz 1.
 */
describe('Entscheidungs-Grundlage bei Nichtantritt: Gerät der Turnierleitung = öffentlicher Stand', () => {
  /** Wertung in den Spielen `ids` (Kennungen der Fixture `m-<n>` in Ergebnis-Reihenfolge). */
  const mitWertung = (t: Tournament, ids: string[], forfeitAbsent: 'A' | 'B' | 'both'): Tournament => ({
    ...t,
    matches: t.matches.map((m) => (ids.includes(m.id) ? { ...m, decidedBy: 'forfeit' as const, forfeitAbsent } : m)),
  });
  /** SG Mitte (Heimseite A) tritt gegen Nord und Süd nicht an: gewertet 0:2 (m-2 „M–N“, m-6 „M–S“). */
  const lageA = (): Tournament => mitWertung(turnierNordSued(
    ERGEBNISSE_NORD_SUED.replace('N–M 1:0', 'M–N 0:2').replace('S–M 1:0', 'M–S 0:2'),
  ), ['m-2', 'm-6'], 'A');
  /** Nord und Süd treten beide nicht an (m-1, 0:0); Wertung des Turniers 3:0 (beide verlieren 0:3). */
  const lageBeide = (): Tournament => ({
    ...mitWertung(turnierNordSued(ERGEBNISSE_NORD_SUED.replace('N–S 2:2', 'N–S 0:0')), ['m-1'], 'both'),
    forfeitScore: { winner: 3, loser: 0 },
  });

  for (const [name, lage, erwartet] of [
    ['eine Seite fehlt (A)', lageA, (fp: Record<string, unknown>) => expect(fp).not.toHaveProperty('forfeit')],
    ['beide fehlen (both, Wertung 3:0)', lageBeide, (fp: Record<string, unknown>) => expect(fp).toMatchObject({ forfeit: [3, 0] })],
  ] as const) {
    it(`@ZM-180 ${name}: Ollis Fingerabdruck = Zuschauer = Monitor = zweites Leitungsgerät`, () => {
      const olli = mitStrafstossNord(lage());
      const gespeichert = olli.standingDecisions?.[0]?.basis ?? '';
      const fp = JSON.parse(gespeichert) as Record<string, unknown> & { matches: unknown[][] };
      erwartet(fp);
      expect(fp.matches.filter((m) => m[4] !== null).length, 'Wertungen tragen die fehlende Seite').toBeGreaterThan(0);
      const z = serverZeilen(olli);
      const cloud = mapTournamentFromSupabase(z.tournament as never, z.teams as never, z.matches as never);
      expect([
        basisVon(oeffentlich(serverAntwort(olli, { art: 'gespeichert' }))),
        basisVon(oeffentlich(serverAntwort(olli, { art: 'gespeichert' }, 'screen'))),
        basisVon(cloud),
      ]).toEqual([gespeichert, gespeichert, gespeichert]);
    });

    it(`@W2A-059 ${name}: öffentlich FC Nord Platz 1, SV Süd Platz 2, keine Entscheidung offen`, () => {
      const vorher = rankTournamentGroup(oeffentlich(serverAntwort(lage(), { art: 'gespeichert' })), '').rows;
      expect(vorher.slice(0, 2).map((r) => [r.place, r.decisionNeeded])).toEqual([[1, true], [1, true]]);
      const rows = rankTournamentGroup(oeffentlich(serverAntwort(mitStrafstossNord(lage()), { art: 'gespeichert' })), '').rows;
      expect(rows.slice(0, 2).map((r) => [r.place, r.team.name, r.decisionNeeded])).toEqual([[1, NORD, false], [2, SUED, false]]);
    });
  }
});
