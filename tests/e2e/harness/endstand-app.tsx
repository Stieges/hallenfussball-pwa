/**
 * Prüfstand R3-5 (Regel T2-UI): der Endstand-Block der App (`FinalStandingsView`, Plätze mit Herkunft, Sieger, Torschützen, Kennzeichen
 * „vorläufig“) – ECHTE Komponenten, echte Design-Tokens, echte i18n, Hell/Dunkel über den echten ThemeProvider; ersetzt ist nur das
 * Lesen der gespeicherten Zeile (feste Werte), weil Konto, Server und ein abgeschlossenes Turnier offline fehlen. Nur Testumgebung,
 * nicht Teil des Builds. Beispiel wie die Mockups Runde 2 (Nikolaus-Turnier, 6 Teams). Adresse: `?szene=<id>` (`&sprache=en`);
 * ids: klar, ps, vor, lang, ko.
 */
import ReactDOM from 'react-dom/client';
import i18n from '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars } from '../../../src/design-tokens';
import type { Tournament } from '../../../src/types/tournament';
import type { FinalStandingRow, ScorerRow } from '../../../src/core/standings/finalStandings';
import { computeFinalStandings } from '../../../src/core/standings/finalStandings';
import { nikolausFertig } from '../../../src/core/services/__tests__/finishKit';
import { NK } from '../../../src/core/standings/__tests__/groupCompletionKit';
import { FinalStandingsView } from '../../../src/features/tournament-finish/components/FinalStandingsView';

const query = new URLSearchParams(window.location.search);
const szene = query.get('szene') ?? 'klar';
void i18n.changeLanguage(query.get('sprache') === 'en' ? 'en' : 'de');

const NAMEN: Record<string, string> = {
  [NK.kammer]: 'FC Nord', [NK.wagingRot]: 'SV Süd', [NK.otting]: 'TSV West', [NK.petting]: 'SG Mitte', [NK.fridolfing]: 'SC Ost', [NK.wagingBlau]: 'FC Berg',
};
const LANG: Record<string, string> = {
  [NK.kammer]: 'Sportgemeinschaft Rot-Weiß Musterstadt Nord 1904 I',
  [NK.wagingRot]: 'Spielvereinigung Grün-Gelb Kleinstadt-Neudorf 1921',
};
const lang = szene === 'lang';
const basis = await nikolausFertig();
const turnier: Tournament = {
  ...basis,
  teams: basis.teams.map((team) => ({ ...team, name: (lang ? LANG[team.id] : undefined) ?? NAMEN[team.id] ?? team.name })),
};
const shootout = szene === 'ps' || lang;
const anzeige: Tournament = shootout ? {
  ...turnier,
  standingDecisions: [...(turnier.standingDecisions ?? []), {
    id: 'ps1', groupId: '', teamIds: [NK.kammer, NK.wagingRot].sort(), order: [NK.kammer, NK.wagingRot], kind: 'shootout', shootout: { winner: 4, loser: 3 }, basis: 'x',
  }],
} : turnier;

const name = (id: string): string => turnier.teams.find((team) => team.id === id)?.name ?? id;
const scorer = (rank: number, id: string, number: number, goals: number): ScorerRow => ({ kind: 'player', rank, teamId: id as never, teamName: name(id), number, goals });
const scorers: ScorerRow[] = [
  scorer(1, NK.kammer, 9, 5), scorer(2, NK.wagingRot, 7, 4), scorer(3, NK.kammer, 10, 3), scorer(3, NK.wagingRot, 4, 3), scorer(3, NK.otting, 11, 3),
  scorer(6, NK.petting, 2, 2), { kind: 'noNumber', rank: null, teamId: NK.kammer as never, teamName: name(NK.kammer), goals: 2 },
];

const ranking: FinalStandingRow[] = szene === 'ko'
  ? [
    { place: 1, teamId: NK.kammer as never, teamName: name(NK.kammer), origin: { kind: 'placementGame', finalType: 'final', role: 'winner' } },
    { place: 2, teamId: NK.wagingRot as never, teamName: name(NK.wagingRot), origin: { kind: 'placementGame', finalType: 'final', role: 'loser' } },
    { place: 3, teamId: NK.otting as never, teamName: name(NK.otting), origin: { kind: 'placementGame', finalType: 'thirdPlace', role: 'winner' } },
    { place: 4, teamId: NK.petting as never, teamName: name(NK.petting), origin: { kind: 'placementGame', finalType: 'thirdPlace', role: 'loser' } },
    { place: 5, teamId: NK.fridolfing as never, teamName: name(NK.fridolfing), origin: { kind: 'groupPlace', group: 'A', place: 3 } },
    { place: 5, teamId: NK.wagingBlau as never, teamName: name(NK.wagingBlau), origin: { kind: 'groupPlace', group: 'B', place: 3 } },
  ]
  : computeFinalStandings(turnier).ranking;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <div style={{ background: cssVars.colors.background, minHeight: '100vh', color: cssVars.colors.textPrimary }}>
      <div style={{ padding: cssVars.spacing.md, maxWidth: '720px', margin: '0 auto', display: 'grid', gap: cssVars.spacing.md }}>
        <h2 style={{ margin: 0 }}>Nikolaus-Turnier 2026</h2>
        <FinalStandingsView
          tournament={anzeige} ranking={ranking} scorers={szene === 'vor' ? scorers.slice(0, 3) : scorers}
          provisional={szene === 'vor'} finishedAt={szene === 'vor' ? undefined : '2026-11-28T13:10:00+01:00'}
        />
      </div>
    </div>
  </ThemeProvider>,
);
