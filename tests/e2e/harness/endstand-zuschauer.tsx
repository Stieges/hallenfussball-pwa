/**
 * Prüfstand R3-6 (Regel T2-UI): Endstand-Block der Zuschauer-Seite (`PublicFinalStandingsBlock`, Abzeichen „Turnier abgeschlossen“) – ECHTE
 * Komponenten, Design-Tokens, i18n (feste Anzeigesprache), Hell/Dunkel über den echten ThemeProvider und die echte Ansicht
 * (`buildTournamentView` mit Zielgruppe Zuschauer); ersetzt ist nur die Antwort von `public_final_standings` (feste Werte), weil Server
 * und ein abgeschlossenes Turnier offline fehlen. Nur Testumgebung, nicht Teil des Builds. Beispiel wie die Mockups Runde 2.
 * Adresse: `?szene=<id>`; ids: klar, ps, lang, ohnetor (Torschützen-Schalter aus), ohnetab (Tabellen für Zuschauer aus), kinder (Kindermodus),
 * vor (vor dem Abschluss: nichts).
 */
import ReactDOM from 'react-dom/client';
import '../../../src/i18n';
import { I18nextProvider } from 'react-i18next';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars } from '../../../src/design-tokens';
import { anzeigeI18n } from '../../../src/i18n/anzeigeSprache';
import { buildTournamentView } from '../../../src/core/view';
import type { Tournament } from '../../../src/types/tournament';
import type { ScorerRow } from '../../../src/core/standings/finalStandings';
import { computeFinalStandings } from '../../../src/core/standings/finalStandings';
import type { PublicFinalStandings } from '../../../src/core/repositories/publicFinalStandings';
import { decisionBasis } from '../../../src/core/standings/decisions';
import { tableInput } from '../../../src/core/standings/tournamentTable';
import { gleichstandUmPlatz1, nikolausFertig } from '../../../src/core/services/__tests__/finishKit';
import { NK } from '../../../src/core/standings/__tests__/groupCompletionKit';
import { completeGroup } from '../../../src/core/standings/finalStandings/__tests__/finalStandingsKit';
import { showsFinalStandings, showsKidsEnded } from '../../../src/features/public-view/showsFinalStandings';
import { PublicEndedBadge, PublicFinalStandingsBlock } from '../../../src/features/public-view/components/PublicFinalStandings';

const szene = new URLSearchParams(window.location.search).get('szene') ?? 'klar';

const NAMEN: Record<string, string> = {
  [NK.kammer]: 'FC Nord', [NK.wagingRot]: 'SV Süd', [NK.otting]: 'TSV West', [NK.petting]: 'SG Mitte', [NK.fridolfing]: 'SC Ost', [NK.wagingBlau]: 'FC Berg',
};
const LANG: Record<string, string> = {
  [NK.kammer]: 'Sportgemeinschaft Rot-Weiß Musterstadt Nord 1904 I',
  [NK.wagingRot]: 'Spielvereinigung Grün-Gelb Kleinstadt-Neudorf 1921',
};
const lang = szene === 'lang';
const shootout = szene === 'ps' || lang;
const basis = shootout ? { ...gleichstandUmPlatz1(false), status: 'published' as const, lifecycleStatus: 'fixed' as const } : await nikolausFertig();
const turnier: Tournament = {
  ...basis,
  isPublic: true, shareCode: 'ABC123', lifecycleStatus: 'finished' as const,
  hideScoresForPublic: szene === 'kinder', hideRankingsForPublic: szene === 'ohnetab',
  teams: basis.teams.map((team) => ({ ...team, name: (lang ? LANG[team.id] : undefined) ?? NAMEN[team.id] ?? team.name })),
};
const anzeige: Tournament = shootout ? completeGroup({
  ...turnier,
  standingDecisions: [...(turnier.standingDecisions ?? []), {
    id: 'ps1', groupId: '', teamIds: [NK.kammer, NK.wagingRot].sort(), order: [NK.kammer, NK.wagingRot], kind: 'shootout', shootout: { winner: 4, loser: 3 },
    basis: decisionBasis(tableInput(turnier.teams, turnier.matches, turnier, ''), [NK.kammer, NK.wagingRot]),
  }],
}) : turnier;

const name = (id: string): string => turnier.teams.find((team) => team.id === id)?.name ?? id;
const scorer = (rank: number, id: string, number: number, goals: number): ScorerRow => ({ kind: 'player', rank, teamId: id as never, teamName: name(id), number, goals });
const scorers: ScorerRow[] = [
  scorer(1, NK.kammer, 9, 5), scorer(2, NK.wagingRot, 7, 4), scorer(3, NK.kammer, 10, 3), scorer(3, NK.wagingRot, 4, 3), scorer(3, NK.otting, 11, 3),
  scorer(6, NK.petting, 2, 2), { kind: 'noNumber', rank: null, teamId: NK.kammer as never, teamName: name(NK.kammer), goals: 2 },
];

const final: PublicFinalStandings = szene === 'vor' || szene === 'kinder' ? { status: 'none' } : {
  status: 'final', finishedAt: '2026-11-28T13:10:00+01:00', scorersPublic: szene !== 'ohnetor',
  snapshot: { format: 1, ranking: computeFinalStandings(anzeige).ranking, scorers, appVersion: 'harness', computedAt: '2026-11-28T13:10:00+01:00' },
};
const view = buildTournamentView({
  ...anzeige,
  ...(final.status === 'final'
    ? { closed: true, finalRanking: final.snapshot.ranking.map((row) => ({ place: row.place, team: { id: row.teamId, name: row.teamName } })) }
    : {}),
}, { audience: 'viewer', medium: 'app', locale: 'de', now: { date: '2026-11-28', time: '13:20' } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <I18nextProvider i18n={anzeigeI18n()}>
      <div style={{ background: cssVars.colors.background, minHeight: '100vh', color: cssVars.colors.textPrimary }}>
        <div style={{ padding: cssVars.spacing.md, maxWidth: '720px', margin: '0 auto', display: 'grid', gap: cssVars.spacing.md }}>
          <h1 style={{ margin: 0 }}>Nikolaus-Turnier 2026</h1>
          {(showsFinalStandings(view, final) || showsKidsEnded(anzeige, view)) && <div><PublicEndedBadge /></div>}
          <PublicFinalStandingsBlock tournament={anzeige} view={view} finalStandings={final} />
          <div data-testid="spielplan-platzhalter" style={{ color: cssVars.colors.textSecondary }}>Spielplan</div>
        </div>
      </div>
    </I18nextProvider>
  </ThemeProvider>,
);
