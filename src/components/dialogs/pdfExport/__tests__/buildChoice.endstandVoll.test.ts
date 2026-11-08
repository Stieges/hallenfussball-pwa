/**
 * Endstand-PDF und Spielplan nach dem Abschluss mit ECHTEN Turnierdaten (@DR-011, @DR-009; Daniel 07.11.: im Beispiel-PDF waren die
 * Gruppentabellen und die Finalrunde leer). Gebaut wie in der App: Spiele aus dem Turnier (Gruppenspiele beendet, Finalrunde besetzt
 * und beendet), Tabellen wie `useTournamentManager` (`calculateStandingsPerGroup`), Spielplan über `generateFullSchedule` (Lesepfad).
 * Gelesen mit pdfjs. Zwei Fälle: (a) eine Gruppe jeder gegen jeden ohne Finalrunde (Nikolaus), (b) 2 Gruppen + Finalrunde.
 */
import { describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { generateFullSchedule } from '../../../../core/generators';
import { calculateStandingsPerGroup } from '../../../../utils/calculations';
import { createMockTournament } from '../../../../test/factories';
import { testUuid } from '../../../../test/testIds';
import { HALLENCUP_TEAMS, hallencupTournament } from '../../../../lib/pdf/__tests__/pdfFixture';
import { storedMatches } from '../../../../lib/pdf/__tests__/storedSchedule';
import { extractPdfText } from '../../../../lib/pdf/__tests__/pdfjsText';
import type { RankEntry } from '../../../../lib/pdf/placement';
import type { TeamId } from '../../../../core/models/schemas/MatchSlotSchema';
import type { Match, Team, Tournament } from '../../../../types/tournament';
import type { PdfAudience } from '../../../../lib/pdf/visibility';

await initRealDeI18n();
const { buildChoice } = await import('../buildChoice');

const NOW = new Date(2026, 10, 28, 12, 45);
const CLOSED_AT = new Date(2026, 10, 28, 12, 30);
const ABSCHLUSS = 'Endstand – abgeschlossen am 28.11.2026 um 12:30';

/** Textstücke ohne Leerstücke, Seiten hintereinander. */
async function lese(tournament: Tournament, choice: 'final' | 'schedule', ranking: RankEntry[], audience: PdfAudience = 'organizer'): Promise<string[]> {
  const result = await buildChoice(choice, {
    tournament, schedule: generateFullSchedule(tournament, 'de'), standings: calculateStandingsPerGroup(tournament), audience, online: true, now: NOW,
    final: { ranking, closedAt: CLOSED_AT },
  });
  if (!result.ok) { throw new Error('nicht gebaut'); }
  const { pages } = await extractPdfText(new Uint8Array(result.pdf.doc.output('arraybuffer')));
  return pages.flat().map((s) => s.trim()).filter((s) => s !== '');
}

/** Zeile einer gedruckten Tabelle: Platzziffer, Team, Sp, S, U, N, Tore, Diff, Pkt. */
function tabellenZeile(texte: string[], team: string, ab: number): string[] {
  const i = texte.indexOf(team, ab);
  return i < 0 ? [] : texte.slice(i, i + 8);
}

// --- (a) Nikolaus: eine Gruppe, jeder gegen jeden, keine Finalrunde ---
const NIKOLAUS_NAMEN = ['DJK Kammer', 'TSV Waging rot', 'DJK Otting', 'TSV Petting', 'TSV 1921 Fridolfing', 'TSV Waging blau'];
const nikoTeams: Team[] = NIKOLAUS_NAMEN.map((name, i) => ({ id: testUuid(200 + i), name }));
function nikolaus(): Tournament {
  const base = createMockTournament({
    id: 'nikolaus-voll', title: 'Nikolausturnier', ageClass: 'F2-Junioren', date: '2026-11-28', timeSlot: '08:30', groupSystem: 'roundRobin',
    numberOfGroups: 1, numberOfFields: 1, numberOfTeams: 6, groupPhaseGameDuration: 9, teams: nikoTeams, matches: [],
    finalsConfig: { preset: 'none' }, isPublic: true, shareCode: 'NIKO26', lifecycleStatus: 'finished', finishedAt: CLOSED_AT.toISOString(),
  });
  const plan = generateFullSchedule(base, 'de').allMatches;
  // Ergebnisse so, dass die Reihenfolge der Namen die Tabelle ist: das Team mit dem kleineren Index gewinnt
  const matches: Match[] = plan.map((m, index) => {
    const { slotA, slotB } = m;
    const a = slotA.kind === 'team' ? nikoTeams.findIndex((t) => t.id === slotA.teamId) : 0;
    const b = slotB.kind === 'team' ? nikoTeams.findIndex((t) => t.id === slotB.teamId) : 0;
    return {
      id: m.id, round: index + 1, field: m.field, slot: m.slot, slotA: m.slotA, slotB: m.slotB, phase: 'groupStage', matchNumber: m.matchNumber,
      scheduledTime: m.startTime, scoreA: a < b ? 2 : 0, scoreB: a < b ? 0 : 1, matchStatus: 'finished',
    };
  });
  return { ...base, matches };
}
const nikoRanking: RankEntry[] = nikoTeams.map((team, i) => ({ place: i + 1, team }));

describe('@DR-011 @DR-009 (a) eine Gruppe ohne Finalrunde: die Abschlusstabelle ist gefüllt', () => {
  for (const [name, choice, audience] of [['Endstand-PDF', 'final', 'organizer'], ['Spielplan nach dem Abschluss', 'schedule', 'organizer'], ['Endstand-PDF der Zuschauer-Seite', 'final', 'viewer']] as const) {
    it(`${name}: „Abschlusstabelle“ mit allen 6 Teams in Endstand-Reihenfolge, je Sp. 5 und Tore, Diff., Pkt.`, async () => {
      const texte = await lese(nikolaus(), choice, nikoRanking, audience);
      const start = texte.indexOf('Abschlusstabelle');
      expect(start, 'Überschrift „Abschlusstabelle“').toBeGreaterThan(-1);
      // Die Tabelle steht vor der Seite „Siegerehrung“ (@DR-052), die dieselben Plätze noch einmal als Liste nennt
      const reihenfolge = texte.slice(start).filter((s) => NIKOLAUS_NAMEN.includes(s));
      expect(reihenfolge.slice(0, NIKOLAUS_NAMEN.length)).toEqual(NIKOLAUS_NAMEN);
      expect(reihenfolge.slice(NIKOLAUS_NAMEN.length)).toEqual(choice === 'final' ? NIKOLAUS_NAMEN : []);
      for (const team of NIKOLAUS_NAMEN) {
        const zeile = tabellenZeile(texte, team, start);
        expect(zeile[1], `${team}: Spiele`).toBe('5');
        expect(zeile[5], `${team}: Tore`).toMatch(/^\d+:\d+$/);
        expect(zeile[7], `${team}: Punkte`).toMatch(/^\d+$/);
      }
      expect(texte.join(' ')).toContain('1 DJK Kammer 5 5 0 0 7:0 +7 15');
      if (choice === 'final') { expect(texte.join(' ')).toContain(ABSCHLUSS); }
    });
  }
});

// --- (b) Hallencup: 2 Gruppen + Halbfinale, Spiel um Platz 3, Finale ---
const id = (name: string): TeamId => HALLENCUP_TEAMS.find((t) => t.name === name)!.id as TeamId;
const team = (name: string) => ({ kind: 'team' as const, teamId: id(name) });
function hallencupVoll(): Tournament {
  const base = hallencupTournament({ lifecycleStatus: 'finished', finishedAt: CLOSED_AT.toISOString() });
  const alle = storedMatches(base);
  const gruppe = alle.filter((m) => m.phase === 'groupStage').map((m, k) => ({ ...m, scoreA: k % 3, scoreB: (k + 1) % 2, matchStatus: 'finished' as const }));
  const [hf1, hf2, platz3, finale] = alle.filter((m) => m.phase !== 'groupStage');
  const finalrunde: Match[] = [
    { ...hf1, slotA: team('FC Nord'), slotB: team('SC Ost'), scoreA: 1, scoreB: 1, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty', matchStatus: 'finished' },
    { ...hf2, slotA: team('TSV West'), slotB: team('SV Süd'), scoreA: 2, scoreB: 0, matchStatus: 'finished' },
    { ...platz3, slotA: team('SC Ost'), slotB: team('SV Süd'), scoreA: 3, scoreB: 1, matchStatus: 'finished' },
    { ...finale, slotA: team('FC Nord'), slotB: team('TSV West'), scoreA: 1, scoreB: 1, overtimeScoreA: 1, overtimeScoreB: 0, decidedBy: 'overtime', matchStatus: 'finished' },
  ] as Match[];
  return { ...base, matches: [...gruppe, ...finalrunde] };
}
const cupRanking: RankEntry[] = ['FC Nord', 'TSV West', 'SC Ost', 'SV Süd', 'DJK Berg', 'FC Mitte', 'TuS Tal', 'SV Hof']
  .map((name, i) => ({ place: i + 1, team: HALLENCUP_TEAMS.find((t) => t.name === name)! }));

describe('@DR-011 @DR-009 (b) 2 Gruppen + Finalrunde: Gruppentabellen und Finalrunde sind gefüllt', () => {
  for (const [name, choice, audience] of [['Endstand-PDF', 'final', 'organizer'], ['Spielplan nach dem Abschluss', 'schedule', 'organizer'], ['Endstand-PDF der Zuschauer-Seite', 'final', 'viewer']] as const) {
    it(`${name}: Gruppe A und B mit je 4 Teams und Werten; Finalrunde mit Teamnamen, Ergebnissen, „Strafstoßschießen“ und „Verlängerung“ (Spielplan: „nach Verlängerung“)`, async () => {
      const texte = await lese(hallencupVoll(), choice, cupRanking, audience);
      for (const [gruppe, namen] of [['Gruppe A', ['FC Nord', 'SV Süd', 'DJK Berg', 'TuS Tal']], ['Gruppe B', ['TSV West', 'SV Hof', 'SC Ost', 'FC Mitte']]] as const) {
        const start = texte.indexOf(gruppe);
        expect(start, `Tabelle ${gruppe}`).toBeGreaterThan(-1);
        for (const n of namen) {
          const zeile = tabellenZeile(texte, n, start);
          expect(zeile[1], `${gruppe} ${n}: Spiele`).toBe('3');
          expect(zeile[5], `${gruppe} ${n}: Tore`).toMatch(/^\d+:\d+$/);
        }
      }
      // Endstand (@DR-054): Raster mit Rundennamen in Normalschrift und Zusatzzeile „Wort Zahl“; Spielplan: Zebra, Versalien, Zahl vor dem Wort
      const endstand = choice === 'final';
      const finalrunde = texte.slice(texte.indexOf(endstand ? 'Halbfinale' : 'HALBFINALE')).join(' ');
      expect(finalrunde).toContain(endstand ? 'FC Nord 1 : 1 Strafstoßschießen 4 : 3 SC Ost' : 'FC Nord 1 : 1 4 : 3 Strafstoßschießen SC Ost');
      expect(finalrunde).toContain('TSV West 2 : 0 SV Süd');
      expect(finalrunde).toContain('SC Ost 3 : 1 SV Süd');
      expect(finalrunde).toContain(endstand ? 'FC Nord 1 : 1 Verlängerung 1 : 0 TSV West' : 'FC Nord 1 : 1 1 : 0 nach Verlängerung TSV West');
      expect(finalrunde, 'keine offene Herkunft mehr').not.toMatch(/Gruppe [AB] .*Gruppe [AB]|Sieger Spiel|Verlierer Spiel/);
      if (choice === 'final') { expect(texte.join(' ')).toContain(ABSCHLUSS); }
    });
  }
});
