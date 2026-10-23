/**
 * Start der App auf einem Helfer-Gerät (A-17c): @HE-096 (Adresse → Feld), @HE-099 (Auswahl), @HE-098 (Endkarte),
 * @HE-028 (ohne Netz), und die Gegenbeispiele: Geräte ohne Index sehen die Startseite sofort und ohne Netzaufruf.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HelperAccessEntry, HelperAccessStatus, HelperRpcResult } from '../../../core/repositories/helperAccessRpc';
import { createMockMatch, createMockTournament } from '../../../test/factories';
import { initRealDeI18n } from '../../../test/realDeI18n';
import type { Tournament } from '../../../types/tournament';
import { localDateKey } from '../runningState';
import { clearHelperAccessIndex, upsertHelperAccessEntry } from '../helperAccessStore';
import { resetHelperStart } from '../helperStartDeps';
import type { HelperStartContextDeps } from '../helperStartContext';
import { HelperStartGate } from '../components/HelperStartGate';
import { HelperTournamentChooser } from '../components/HelperTournamentChooser';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../lib/supabase', () => ({ supabase: null }));

beforeAll(async () => { await initRealDeI18n(); });

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => memory.get(key) ?? null);
  vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => { memory.set(key, value); });
  vi.mocked(window.localStorage.removeItem).mockImplementation((key: string) => { memory.delete(key); });
  clearHelperAccessIndex();
  resetHelperStart();
});

const TODAY = localDateKey(new Date());
const DAYS = (n: number) => localDateKey(new Date(Date.now() + n * 24 * 60 * 60 * 1000));
const entry = (o: Partial<HelperAccessEntry> = {}): HelperAccessEntry => ({
  tournamentId: 't-cup', title: 'Live-Cup', date: TODAY, code: 'CUPCODE123', field: 2, relation: 'accepted',
  closed: false, checkNumber: null, homeHintDismissed: false, offlineReadyAt: null, updatedAt: new Date().toISOString(), ...o,
});
const NIKOLAUS = entry({ tournamentId: 't-niko', title: 'Nikolaus-Turnier', code: 'NIKOCODE12', field: 1, date: TODAY });

function deps(answers: Record<string, HelperRpcResult<HelperAccessStatus>> = {}, session: 'device' | 'unknown' | 'account' | 'none' = 'device'): HelperStartContextDeps {
  return {
    readSession: async () => ({ kind: session, userId: session === 'device' ? 'anon-tom' : null }),
    fetchStatus: vi.fn(async (id: string): Promise<HelperRpcResult<HelperAccessStatus>> => answers[id] ?? { ok: false, error: { kind: 'network' } }),
  };
}

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}{loc.search}</div>;
}

function renderApp(startDeps: HelperStartContextDeps, tournaments: Tournament[] = []) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<><HelperStartGate active tournaments={tournaments} deps={startDeps}><div data-testid="startseite">Startseite</div></HelperStartGate><Where /></>} />
        <Route path="/helfer" element={<><HelperTournamentChooser deps={startDeps} tournaments={tournaments} /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('@HE-096 Adresse der App → Feld', () => {
  it('Tom hat einen Zugang → die Adresse der App öffnet Feld 2 ohne Eingabe; die Startseite war nie zu sehen', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    const startDeps = deps({ 't-cup': { ok: true, data: { state: 'open', relation: 'accepted', field: 2, closed: false, tournament: { id: 't-cup', title: 'Live-Cup', date: TODAY } } } });
    renderApp(startDeps);
    expect(screen.queryByTestId('startseite')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/live?f=2'));
    expect(screen.queryByTestId('startseite')).toBeNull();
  });

  it('Gegenbeispiel: Gerät ohne Index sieht die Startseite sofort, ohne Netzaufruf', () => {
    const startDeps = deps();
    renderApp(startDeps);
    expect(screen.getByTestId('startseite')).toBeTruthy();
    expect(startDeps.fetchStatus).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Konto angemeldet → Startseite (kein Fremdeingriff in Konto-Rechte)', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    renderApp(deps({}, 'account'));
    expect(await screen.findByTestId('startseite')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/');
  });

  it('@HE-028 ohne Netz (Server nicht erreichbar, Sitzung unlesbar): trotzdem Feld 2 aus dem Index', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    renderApp(deps({}, 'unknown'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/live?f=2'));
  });
});

describe('@HE-098 Wiedereinstieg nach Änderung', () => {
  it('Zugang inzwischen entzogen → Endkarte über /join/:code, nie das Feld', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    renderApp(deps({ 't-cup': { ok: true, data: { state: 'open', relation: 'revoked', tournament: { id: 't-cup', title: 'Live-Cup', date: TODAY } } } }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/join/CUPCODE123'));
  });
});

describe('@HE-099 zwei Turniere → Auswahl', () => {
  it('beide laufen → Auswahl mit Titel und Feld; ein Tipp öffnet das Feld', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    upsertHelperAccessEntry('anon-tom', NIKOLAUS);
    renderApp(deps());
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/helfer'));
    const list = await screen.findByTestId('helper-chooser');
    expect(list.textContent).toContain('Live-Cup');
    expect(list.textContent).toContain('Feld 2');
    expect(list.textContent).toContain('Nikolaus-Turnier');
    expect(list.textContent).toContain('Feld 1');
    await userEvent.click(screen.getByTestId('helper-chooser-t-niko'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-niko/live?f=1'));
  });

  it('Aber: ist eines abgeschlossen, öffnet sich das andere direkt (keine Auswahl)', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    upsertHelperAccessEntry('anon-tom', NIKOLAUS);
    renderApp(deps({ 't-cup': { ok: true, data: { state: 'closed', relation: 'accepted', field: 2, closed: true, tournament: { id: 't-cup', title: 'Live-Cup', date: TODAY } } } }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-niko/live?f=1'));
  });

  it('Auswahl: jede Zeile mindestens 56 px hoch, „Zur Startseite“ bleibt erreichbar', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    upsertHelperAccessEntry('anon-tom', NIKOLAUS);
    renderApp(deps());
    await screen.findByTestId('helper-chooser');
    expect(screen.getByTestId('helper-chooser-t-cup').style.minHeight).toBe('var(--touch-target-primary)');
    await userEvent.click(screen.getByTestId('helper-chooser-home'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
  });
});

const eigenesHeute = (id: string) => createMockTournament({ id, title: `Eigenes ${id}`, status: 'published', startDate: TODAY, date: TODAY, matches: [createMockMatch({ id: `${id}-m` })] });
const eigenesLetzteWoche = (id: string) => createMockTournament({ id, title: `Training ${id}`, status: 'published', startDate: DAYS(-7), date: DAYS(-7), matches: [createMockMatch({ id: `${id}-m` })] });
const OK_CUP = { 't-cup': { ok: true, data: { state: 'open', relation: 'accepted', field: 2, closed: false, tournament: { id: 't-cup', title: 'Live-Cup', date: TODAY } } } } satisfies Record<string, HelperRpcResult<HelperAccessStatus>>;

describe('@HE-096 (präzisiert 23.10.): eigene Turniere auf dem Gerät', () => {
  it('Toms Trainingsturnier von letzter Woche läuft nicht → Feld 2 öffnet sich ohne Zwischenfrage, Auswahl und Startseite bleiben aus', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    renderApp(deps(OK_CUP), [eigenesLetzteWoche('t-training')]);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/live?f=2'));
    expect(screen.queryByTestId('startseite')).toBeNull();
    expect(screen.queryByTestId('helper-chooser')).toBeNull();
  });

  it('das lokal gespeicherte Helfer-Turnier selbst zählt nicht als eigenes Turnier', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    renderApp(deps(OK_CUP), [eigenesHeute('t-cup')]);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/live?f=2'));
  });
});

describe('@HE-099 (präzisiert 23.10.): eigenes laufendes Turnier zählt wie ein Zugang', () => {
  it('Zugang läuft und ein eigenes Turnier findet heute statt → Auswahl, beide stehen drin; Tipp aufs eigene öffnet es', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    renderApp(deps(OK_CUP), [eigenesHeute('t-eigen')]);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/helfer'));
    const list = await screen.findByTestId('helper-chooser');
    expect(list.textContent).toContain('Live-Cup');
    expect(list.textContent).toContain('Eigenes t-eigen');
    await userEvent.click(screen.getByTestId('helper-chooser-t-eigen'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-eigen'));
  });

  it('Gegenbeispiel: das eigene Turnier ist abgeschlossen → zählt nicht, Feld 2 öffnet sich direkt', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    renderApp(deps(OK_CUP), [{ ...eigenesHeute('t-eigen'), manuallyCompleted: true }]);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/live?f=2'));
  });
});

describe('@HE-109 Vor dem Turniertag: Startseite mit Einsatz-Karte', () => {
  const FREITAG = DAYS(4);
  const vorTurniertag = { 't-cup': { ok: true, data: { state: 'open', relation: 'accepted', field: 2, closed: false, tournament: { id: 't-cup', title: 'Live-Cup', date: FREITAG } } } } satisfies Record<string, HelperRpcResult<HelperAccessStatus>>;

  it('Live-Cup erst in vier Tagen, nichts anderes läuft → Startseite mit Karte „Du hilfst beim Live-Cup · Feld 2 · <Wochentag>“; ein Tipp öffnet Feld 2', async () => {
    upsertHelperAccessEntry('anon-tom', entry({ date: FREITAG }));
    renderApp(deps(vorTurniertag));
    expect(await screen.findByTestId('startseite')).toBeTruthy();
    const karte = await screen.findByTestId('helper-assignment-t-cup');
    expect(karte.textContent).toMatch(/^Du hilfst beim Live-Cup · Feld 2 · \p{L}{2}/u);
    expect(screen.getByTestId('where').textContent).toBe('/');
    await userEvent.click(karte);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/live?f=2'));
  });

  it('darunter stehen Toms eigene Turniere (die Startseite selbst), das Trainingsturnier hält die Karte nicht auf', async () => {
    upsertHelperAccessEntry('anon-tom', entry({ date: FREITAG }));
    renderApp(deps(vorTurniertag), [eigenesLetzteWoche('t-training')]);
    expect(await screen.findByTestId('startseite')).toBeTruthy();
    expect(await screen.findByTestId('helper-assignment-t-cup')).toBeTruthy();
    const karte = screen.getByTestId('helper-assignment-cards');
    const start = screen.getByTestId('startseite');
    expect(karte.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Gegenbeispiel: Gerät ohne Index → keine Karte, kein Netzaufruf', async () => {
    const startDeps = deps();
    renderApp(startDeps);
    expect(await screen.findByTestId('startseite')).toBeTruthy();
    expect(screen.queryByTestId('helper-assignment-cards')).toBeNull();
    expect(startDeps.fetchStatus).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: abgeschlossenes Turnier ist kein Einsatz → keine Karte', async () => {
    upsertHelperAccessEntry('anon-tom', entry({ date: FREITAG }));
    renderApp(deps({ 't-cup': { ok: true, data: { state: 'closed', relation: 'accepted', field: 2, closed: true, tournament: { id: 't-cup', title: 'Live-Cup', date: FREITAG } } } }), [eigenesLetzteWoche('t-training')]);
    expect(await screen.findByTestId('startseite')).toBeTruthy();
    expect(screen.queryByTestId('helper-assignment-cards')).toBeNull();
  });

  it('vom Feld über „Zur Startseite“ zurück: die Karte zum laufenden Live-Cup steht ebenfalls oben', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    renderApp(deps(OK_CUP), [eigenesHeute('t-eigen')]);
    await screen.findByTestId('helper-chooser');
    await userEvent.click(screen.getByTestId('helper-chooser-home'));
    expect(await screen.findByTestId('startseite')).toBeTruthy();
    expect(await screen.findByTestId('helper-assignment-t-cup')).toBeTruthy();
  });
});

describe('„Zur Startseite“ führt nicht wieder ans Feld', () => {
  it('nach der ersten Entscheidung bleibt die Startseite stehen', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    upsertHelperAccessEntry('anon-tom', NIKOLAUS);
    renderApp(deps());
    await screen.findByTestId('helper-chooser');
    await userEvent.click(screen.getByTestId('helper-chooser-home'));
    expect(await screen.findByTestId('startseite')).toBeTruthy();
  });
});
