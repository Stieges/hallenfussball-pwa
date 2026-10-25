/**
 * Prüfstand R3-4 (Regel T2-UI): der Dialog „Turnier abschließen“ in allen Zuständen, die Karten der Verwaltung und Zustand C
 * „abgeschlossen“ – ECHTE Komponenten, echte Design-Tokens, echte i18n, Hell/Dunkel über den echten ThemeProvider; ersetzt ist nur
 * der Abschluss-Dienst (ein fester Zustand), weil Konto, Server und ein abgeschlossenes Turnier offline fehlen. Nur Testumgebung,
 * nicht Teil des Builds. Beispiel wie in den abgenommenen Mockups (Nikolaus-Turnier, 6 Teams, Strafstoßschießen 4:3 um Platz 1).
 * Adresse: `?szene=<id>` (`&sprache=en`); ids: dlg-a, dlg-alang, dlg-b, dlg-blang, dlg-bw, dlg-bt, dlg-nonet, dlg-busy, dlg-unconf,
 * dlg-err, dlg-stale, dlg-done-by, vw-vorschlag, vw-ohne, vw-spaet, c, c-leer.
 */
import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import i18n from '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars } from '../../../src/design-tokens';
import type { Tournament } from '../../../src/types/tournament';
import type { FinishState, FinishTournamentApi } from '../../../src/hooks/useFinishTournament';
import type { FinishWarning } from '../../../src/core/repositories/lifecycleRpc';
import { prepareFinish } from '../../../src/core/services/finishPreparation';
import { nikolausFertig, preflightFor } from '../../../src/core/services/__tests__/finishKit';
import { NK } from '../../../src/core/standings/__tests__/groupCompletionKit';
import { FinishTournamentDialog } from '../../../src/features/tournament-finish/components/FinishTournamentDialog';
import { FinishSectionCards } from '../../../src/features/tournament-finish/components/FinishSectionCards';
import { FinishedStateView } from '../../../src/features/tournament-finish/components/FinishedStateView';
import { finishFacts } from '../../../src/features/tournament-finish/model/finishSummary';

const query = new URLSearchParams(window.location.search);
const szene = query.get('szene') ?? 'dlg-b';
void i18n.changeLanguage(query.get('sprache') === 'en' ? 'en' : 'de');

const LANG = {
  [NK.kammer]: 'Sportgemeinschaft Rot-Weiß Musterstadt Nord 1904 I',
  [NK.wagingRot]: 'Spielvereinigung Grün-Gelb Kleinstadt-Neudorf 1921',
};
const NAMEN: Record<string, string> = {
  [NK.kammer]: 'FC Nord', [NK.wagingRot]: 'SV Süd', [NK.otting]: 'TSV West', [NK.petting]: 'SG Mitte', [NK.fridolfing]: 'SC Ost', [NK.wagingBlau]: 'FC Berg',
};

const lang = szene.endsWith('lang');
const basis = await nikolausFertig();
const turnier: Tournament = {
  ...basis,
  title: 'Nikolaus-Turnier 2026',
  isPublic: true,
  shareCode: 'ABC123',
  finishedAt: '2026-11-28T13:10:00+01:00',
  teams: basis.teams.map((team) => ({ ...team, name: (lang ? (LANG as Record<string, string>)[team.id] : undefined) ?? NAMEN[team.id] ?? team.name })),
};
// Strafstoßschießen um Platz 1: 4:3 für den Sieger gegen den Zweiten (wie im Mockup) – nur für die Anzeige der Siegerzeile; die
// Rechnung des Endstands (prepareFinish) läuft auf dem echt erzeugten Stand
const anzeige: Tournament = {
  ...turnier,
  standingDecisions: [...(turnier.standingDecisions ?? []), {
    id: 'ps1', groupId: '', teamIds: [NK.kammer, NK.wagingRot].sort(), order: [NK.kammer, NK.wagingRot], kind: 'shootout', shootout: { winner: 4, loser: 3 }, basis: 'x',
  }],
};

const warnungen: FinishWarning[] = szene === 'dlg-bw' || szene === 'dlg-blang'
  ? [{ kind: 'outbox_pending', field: 1, pending: 2, reportedAt: '2026-11-28T12:05:00+01:00', deviceId: 'd1' }]
  : szene === 'dlg-silent' ? [{ kind: 'device_silent', field: 2, deviceId: 'd2', since: '2026-11-28T11:50:00+01:00' }] : [];

const prepared = prepareFinish({
  tournament: turnier, preflight: preflightFor(turnier, { warnings: warnungen }), reviews: [], ownPending: 0,
  appVersion: 'harness', computedAt: '2026-11-28T12:00:00.000+01:00',
});
if (!prepared.ok) { throw new Error(`Prüfstand: ${JSON.stringify(prepared.blocker)}`); }
const ready = prepared.ready;

const offene = [
  { kind: 'match_undecided' as const, matchId: turnier.matches[13].id, matchNumber: 14, field: 1 },
  { kind: 'tie_open' as const, groupId: '', places: [1], teamIds: [NK.kammer, NK.wagingRot] },
  { kind: 'review_open' as const, eventId: 'e1', matchId: turnier.matches[2].id, matchNumber: 3, field: 1 },
];

const STATES: Record<string, FinishState> = {
  'dlg-a': { phase: 'rejected', reason: { code: 'OPEN_ITEMS', items: offene } },
  'dlg-alang': { phase: 'rejected', reason: { code: 'OPEN_ITEMS', items: offene } },
  'dlg-b': { phase: 'confirming', ready },
  'dlg-blang': { phase: 'confirming', ready },
  'dlg-bw': { phase: 'confirming', ready },
  'dlg-silent': { phase: 'confirming', ready },
  'dlg-bt': { phase: 'confirming', ready },
  'dlg-nonet': { phase: 'confirming', ready },
  'dlg-busy': { phase: 'sending' },
  'dlg-unconf': { phase: 'unconfirmed', serverLifecycle: 'running' },
  'dlg-err': { phase: 'rejected', reason: { code: 'UNEXPECTED' } },
  'dlg-stale': { phase: 'rejected', reason: { code: 'STALE_STATE' } },
  'dlg-done-by': { phase: 'rejected', reason: { code: 'ALREADY_FINISHED', at: '2026-11-28T13:10:00+01:00', by: 'Maria' } },
};

const ZIEL: FinishState = STATES[szene] ?? { phase: 'confirming', ready };
// „Speichern läuft“ und „nicht bestätigt“ zeigen den bereiten Stand (der Dialog merkt sich ihn): erst bereit, dann der Zielzustand
const ERST_BEREIT = ZIEL.phase === 'sending' || ZIEL.phase === 'unconfirmed';

const turnierMitSchalter = szene === 'dlg-bt' ? { ...anzeige, publicScorers: true } : anzeige;
const facts = finishFacts(turnier);

const stored = {
  status: 'ok' as const, finishedAt: turnier.finishedAt ?? '', snapshot: ready.snapshot,
};
const late = {
  status: 'ready' as const,
  entries: [
    { id: 1, matchId: turnier.matches[14].id, eventId: 'l1', type: 'GOAL', teamId: NK.fridolfing, playerNumber: 7, recordedAt: Date.parse('2026-11-28T13:04:00+01:00'), actor: 'tom', actorName: 'Tom', receivedAt: '2026-11-28T13:21:00+01:00' },
    { id: 2, matchId: turnier.matches[14].id, eventId: 'l2', type: 'YELLOW_CARD', teamId: NK.petting, playerNumber: 4, recordedAt: Date.parse('2026-11-28T13:14:00+01:00'), actor: 'tom', actorName: 'Tom', receivedAt: '2026-11-28T13:21:00+01:00' },
  ],
};

// eslint-disable-next-line react-refresh/only-export-components -- Prüfstand, kein Teil der App (keine Schnellaktualisierung nötig)
function Seite() {
  const noop = (): void => undefined;
  const [state, setState] = useState<FinishState>(ERST_BEREIT ? { phase: 'confirming', ready } : ZIEL);
  useEffect(() => { if (ERST_BEREIT) { setState(ZIEL); } }, []);
  const finish: FinishTournamentApi = { state, start: () => Promise.resolve(), confirm: () => Promise.resolve(), retry: () => Promise.resolve(), reset: () => undefined };
  const hintergrund = (
    <div style={{ padding: cssVars.spacing.md, display: 'grid', gap: cssVars.spacing.md, maxWidth: '1040px', margin: '0 auto' }}>
      <h2 style={{ margin: 0 }}>Verwaltung</h2>
      <FinishSectionCards suggest={szene !== 'vw-ohne' && !szene.startsWith('dlg-a')} facts={facts} openReviews={szene === 'vw-ohne' || szene.startsWith('dlg-a') ? 2 : 0} lateSince={szene === 'vw-spaet' ? '2026-10-12T16:00:00.000Z' : null} onOpen={noop} />
    </div>
  );
  if (szene.startsWith('vw-')) {
    return hintergrund;
  }
  if (szene === 'c' || szene === 'c-leer') {
    return (
      <div style={{ padding: cssVars.spacing.md, maxWidth: '1040px', margin: '0 auto', display: 'grid', gap: cssVars.spacing.md }}>
        <h2 style={{ margin: 0 }}>Verwaltung</h2>
        <FinishedStateView tournament={anzeige} stored={stored} late={szene === 'c' ? late : { status: 'ready', entries: [] }} />
      </div>
    );
  }
  return (
    <>
      {hintergrund}
      <FinishTournamentDialog isOpen tournament={turnierMitSchalter} finish={finish} onClose={noop} onJump={noop} onReloadState={() => Promise.resolve()} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <div style={{ background: cssVars.colors.background, minHeight: '100vh', color: cssVars.colors.textPrimary }}>
      <Seite />
    </div>
  </ThemeProvider>,
);
