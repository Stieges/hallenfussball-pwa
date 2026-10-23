/**
 * Start der App auf einem Helfer-Gerät (A-17c): @HE-096 (Adresse → Feld), @HE-099 (Auswahl), @HE-098 (Endkarte),
 * @HE-028 (ohne Netz), und die Gegenbeispiele: Geräte ohne Index sehen die Startseite sofort und ohne Netzaufruf.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HelperAccessEntry, HelperAccessStatus, HelperRpcResult } from '../../../core/repositories/helperAccessRpc';
import { initRealDeI18n } from '../../../test/realDeI18n';
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

const entry = (o: Partial<HelperAccessEntry> = {}): HelperAccessEntry => ({
  tournamentId: 't-cup', title: 'Live-Cup', date: '2026-11-28', code: 'CUPCODE123', field: 2, relation: 'accepted',
  closed: false, checkNumber: null, homeHintDismissed: false, offlineReadyAt: null, updatedAt: new Date().toISOString(), ...o,
});
const NIKOLAUS = entry({ tournamentId: 't-niko', title: 'Nikolaus-Turnier', code: 'NIKOCODE12', field: 1, date: '2026-12-05' });

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

function renderApp(startDeps: HelperStartContextDeps, tournaments: Array<{ id: string }> = []) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<><HelperStartGate active tournaments={tournaments} deps={startDeps}><div data-testid="startseite">Startseite</div></HelperStartGate><Where /></>} />
        <Route path="/helfer" element={<><HelperTournamentChooser deps={startDeps} /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('@HE-096 Adresse der App → Feld', () => {
  it('Tom hat einen Zugang → die Adresse der App öffnet Feld 2 ohne Eingabe; die Startseite war nie zu sehen', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    const startDeps = deps({ 't-cup': { ok: true, data: { state: 'open', relation: 'accepted', field: 2, closed: false, tournament: { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' } } } });
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
    renderApp(deps({ 't-cup': { ok: true, data: { state: 'open', relation: 'revoked', tournament: { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' } } } }));
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
    renderApp(deps({ 't-cup': { ok: true, data: { state: 'closed', relation: 'accepted', field: 2, closed: true, tournament: { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' } } } }));
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

describe('Pflichtzeile GA5: Gast-Turniere bleiben sichtbar', () => {
  it('ein Zugang neben einem eigenen lokalen Turnier → Auswahl statt direkt ins Feld', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    renderApp(deps(), [{ id: 't-gast' }]);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/helfer'));
  });

  it('das lokal gespeicherte Helfer-Turnier selbst zählt nicht als Gast-Turnier', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    renderApp(deps(), [{ id: 't-cup' }]);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/live?f=2'));
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
