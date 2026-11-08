/**
 * @DR-052 Die Torschützen des gespeicherten Endstands (@ET-045) kommen bis in das Endstand-PDF: Quelle der Turnierleitung, Quelle der
 * Zuschauer-Seite und `buildChoice`. Ohne Torschützen (auch nicht gezeigte der Zuschauer-Seite) gibt es keine Liste.
 */
import { describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { generateFullSchedule } from '../../../../core/generators';
import type { FinalStandingsSnapshot, ScorerRow } from '../../../../core/standings/finalStandings/types';
import type { TeamId } from '../../../../core/models/schemas/MatchSlotSchema';
import { HALLENCUP_ID, HALLENCUP_TEAMS, hallencupTournament } from '../../../../lib/pdf/__tests__/pdfFixture';
import { extractPdfText } from '../../../../lib/pdf/__tests__/pdfjsText';

await initRealDeI18n();
const { buildChoice } = await import('../buildChoice');
const { publicFinalSource, storedFinalSource } = await import('../finalPdfSource');

const CLOSED_AT = new Date(2026, 10, 14, 17, 40);
const TOR: ScorerRow = { kind: 'player', rank: 1, teamId: HALLENCUP_ID.nord as TeamId, teamName: 'FC Nord', number: 10, goals: 3 };
const snapshot = (scorers: ScorerRow[]): FinalStandingsSnapshot => ({
  format: 1, appVersion: 'test', computedAt: CLOSED_AT.toISOString(), scorers,
  ranking: HALLENCUP_TEAMS.map((team, i) => ({ place: i + 1, teamId: team.id as TeamId, teamName: team.name, origin: { kind: 'groupPlace', group: '', place: i + 1 } })),
});
const tournament = hallencupTournament({ lifecycleStatus: 'finished', finishedAt: CLOSED_AT.toISOString() });

async function texte(scorers: ScorerRow[] | undefined): Promise<string[]> {
  const result = await buildChoice('final', {
    tournament, schedule: generateFullSchedule(tournament, 'de'), standings: [], audience: 'organizer', online: true, now: CLOSED_AT,
    final: { ranking: HALLENCUP_TEAMS.map((team, i) => ({ place: i + 1, team })), closedAt: CLOSED_AT, ...(scorers === undefined ? {} : { scorers }) },
  });
  if (!result.ok) { throw new Error('nicht gebaut'); }
  const { pages } = await extractPdfText(new Uint8Array(result.pdf.doc.output('arraybuffer')));
  return pages.flat().map(s => s.trim()).filter(s => s !== '');
}

describe('@DR-052 Torschützen aus dem gespeicherten Endstand', () => {
  it('Turnierleitung: die Quelle trägt die Torschützen des gespeicherten Endstands', () => {
    const source = storedFinalSource(tournament, { status: 'ok', snapshot: snapshot([TOR]), finishedAt: CLOSED_AT.toISOString() });

    expect(source).toMatchObject({ kind: 'ready', scorers: [TOR] });
  });

  it('Zuschauer: die Quelle trägt die gezeigten Torschützen; ohne Freigabe (leere Liste) bleibt sie leer', () => {
    const shown = { results: true, tables: true, finalShown: true };

    expect(publicFinalSource(tournament, shown, { status: 'final', finishedAt: CLOSED_AT.toISOString(), snapshot: snapshot([TOR]) })).toMatchObject({ scorers: [TOR] });
    expect(publicFinalSource(tournament, shown, { status: 'final', finishedAt: CLOSED_AT.toISOString(), snapshot: snapshot([]) })).toMatchObject({ scorers: [] });
  });

  it('das Endstand-PDF nennt die Torschützen auf der Seite „Siegerehrung“', async () => {
    const lines = await texte([TOR]);

    expect(lines).toEqual(expect.arrayContaining(['Torschützen', 'Rang', '#10']));
  });

  it('ohne Torschützen oder ohne Angabe keine Liste und keine Überschrift', async () => {
    for (const scorers of [[], undefined]) {
      const lines = await texte(scorers);
      expect(lines).not.toContain('Torschützen');
      expect(lines).not.toContain('Rang');
      expect(lines).toContain('Platzierung');
    }
  });
});
