/**
 * Wächter um das Turnier-Fenster (A-17c): @HE-055 (entzogen / nur zusehen), @HE-070 (nach Abschluss), @OB-053 (Anfrage-Stand),
 * @HE-098. Jedes Beispiel mit Gegenbeispiel: eigenes Turnier, Konto und Leitung bleiben unberührt.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HelperAccessEntry, HelperAccessStatus, HelperRpcResult } from '../../../core/repositories/helperAccessRpc';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { AuthContext } from '../../auth/context/authContextInstance';
import type { AuthContextValue } from '../../auth/context/authContextValue';
import { clearHelperAccessIndex, upsertHelperAccessEntry } from '../helperAccessStore';
import { resetHelperStart } from '../helperStartDeps';
import type { HelperStartContextDeps } from '../helperStartContext';
import { localDateKey } from '../runningState';
import { HelperStartGate } from '../components/HelperStartGate';
import type { HelperStatusDeps } from '../useHelperAccessStatus';
import { HelperAccessGuard } from '../components/HelperAccessGuard';

vi.unmock('i18next');
vi.unmock('react-i18next');

const authState: { user: null | { id: string; name: string; isAnonymous?: boolean } } = { user: null };
vi.mock('../../../lib/supabase', () => ({ supabase: null }));

beforeAll(async () => { await initRealDeI18n(); });

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => memory.get(key) ?? null);
  vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => { memory.set(key, value); });
  vi.mocked(window.localStorage.removeItem).mockImplementation((key: string) => { memory.delete(key); });
  clearHelperAccessIndex();
  authState.user = { id: 'anon-tom', name: 'Gast', isAnonymous: true };
});

const CUP = { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' };
const entry = (o: Partial<HelperAccessEntry> = {}): HelperAccessEntry => ({
  tournamentId: 't-cup', title: 'Live-Cup', date: '2026-11-28', code: 'CUPCODE123', field: 2, relation: 'accepted',
  closed: false, checkNumber: null, homeHintDismissed: false, offlineReadyAt: null, updatedAt: '2026-11-28T10:00:00Z', ...o,
});
const status = (s: Partial<HelperAccessStatus>): HelperRpcResult<HelperAccessStatus> => ({ ok: true, data: { state: 'open', tournament: CUP, ...s } });

function makeStatus(answers: Array<HelperRpcResult<HelperAccessStatus>>) {
  let i = 0;
  const listeners = new Set<() => void>();
  const deps: HelperStatusDeps = {
    fetchStatus: vi.fn(async () => answers[Math.min(i++, answers.length - 1)]),
    onStatus: vi.fn(),
    isVisible: () => true,
    onBecameVisible: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
  // erzwingt die nächste Abfrage sofort (wie das Zurückkehren auf die Seite), ohne 2 s zu warten
  return { deps, pollNow: () => act(async () => { listeners.forEach((l) => l()); await Promise.resolve(); }) };
}

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
}

function renderGuard(deps: HelperStatusDeps, activeTab = 'management') {
  return render(
    <AuthContext.Provider value={{ user: authState.user } as unknown as AuthContextValue}>
      <MemoryRouter initialEntries={['/tournament/t-cup/live']}>
        <Routes>
          <Route path="*" element={<><HelperAccessGuard tournamentId="t-cup" activeTab={activeTab} statusDeps={deps}><div data-testid="inhalt">Cockpit</div></HelperAccessGuard><Where /></>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('@HE-055 Entzug / nur zusehen', () => {
  it('Zeile 1: zugelassen → Inhalt; nach dem Entzug „Du hast keinen Zugriff mehr“, Inhalt weg, nichts einzutragen', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    const { deps, pollNow } = makeStatus([status({ relation: 'accepted', field: 2, closed: false }), status({ relation: 'revoked' })]);
    renderGuard(deps);
    expect(await screen.findByTestId('inhalt')).toBeTruthy();
    await pollNow();
    expect((await screen.findByTestId('join-end-state')).textContent).toContain('Du hast keinen Zugriff mehr');
    expect(screen.queryByTestId('inhalt')).toBeNull();
  });

  it('Zeile 2: zum Zuschauer gemacht → im Reiter „Live“ „Du kannst nur noch zusehen“ mit Weg zum Spielplan', async () => {
    upsertHelperAccessEntry('anon-tom', entry({ relation: 'viewer' }));
    renderGuard(makeStatus([status({ relation: 'viewer' })]).deps);
    expect((await screen.findByTestId('join-end-state')).textContent).toContain('Du kannst nur noch zusehen');
    expect(screen.queryByTestId('inhalt')).toBeNull();
    await userEvent.click(screen.getByTestId('helper-viewer-open'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/schedule'));
  });

  it('Gegenbeispiel: zum Zuschauer gemacht, Reiter Spielplan → Inhalt bleibt lesbar, mit Hinweis', async () => {
    upsertHelperAccessEntry('anon-tom', entry({ relation: 'viewer' }));
    renderGuard(makeStatus([status({ relation: 'viewer' })]).deps, 'schedule');
    expect(await screen.findByTestId('inhalt')).toBeTruthy();
    expect(screen.getByTestId('helper-guard-notice').textContent).toContain('Du kannst nur noch zusehen');
  });

  it('Gegenbeispiel: ein zugelassener Helfer sieht den Inhalt ohne Hinweis', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    renderGuard(makeStatus([status({ relation: 'accepted', field: 2, closed: false })]).deps);
    expect(await screen.findByTestId('inhalt')).toBeTruthy();
    expect(screen.queryByTestId('helper-guard-notice')).toBeNull();
    expect(screen.queryByTestId('join-end-state')).toBeNull();
  });
});

describe('@HE-070 / @HE-098 nach dem Abschluss', () => {
  it('Reiter „Live“: „Das Turnier ist abgeschlossen“, kein Eintrag möglich, Weg zum Endstand', async () => {
    upsertHelperAccessEntry('anon-tom', entry({ closed: true }));
    renderGuard(makeStatus([status({ relation: 'accepted', field: 2, state: 'closed', closed: true })]).deps);
    expect((await screen.findByTestId('join-end-state')).textContent).toContain('Das Turnier ist abgeschlossen');
    expect(screen.queryByTestId('inhalt')).toBeNull();
    await userEvent.click(screen.getByTestId('helper-final-open'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/standings'));
  });

  it('Endstand und Torschützen bleiben lesbar (Reiter Tabelle): Inhalt plus Hinweis', async () => {
    upsertHelperAccessEntry('anon-tom', entry({ closed: true }));
    renderGuard(makeStatus([status({ relation: 'accepted', field: 2, state: 'closed', closed: true })]).deps, 'tabellen');
    expect(await screen.findByTestId('inhalt')).toBeTruthy();
    expect(screen.getByTestId('helper-guard-notice').textContent).toContain('Das Turnier ist abgeschlossen');
  });
});

describe('@OB-053 Anfrage-Stand per Link zum Cockpit', () => {
  it('offen: „Wartet auf Freigabe durch die Turnierleitung“, ohne Inhalt und nicht die Seite für fehlendes Recht', async () => {
    upsertHelperAccessEntry('anon-tom', entry({ relation: 'pending', checkNumber: 47 }));
    renderGuard(makeStatus([status({ relation: 'pending', checkNumber: 47 })]).deps);
    const card = await screen.findByTestId('helper-guard-pending');
    expect(card.textContent).toContain('Wartet auf Freigabe durch die Turnierleitung');
    expect(screen.queryByTestId('inhalt')).toBeNull();
    expect(document.body.textContent).not.toContain('Nicht gefunden');
  });

  it('abgelehnt: „Anfrage abgelehnt“, ohne Inhalte des Turniers', async () => {
    upsertHelperAccessEntry('anon-tom', entry({ relation: 'declined' }));
    renderGuard(makeStatus([status({ relation: 'declined' })]).deps);
    expect((await screen.findByTestId('join-end-state')).textContent).toContain('Anfrage abgelehnt');
    expect(screen.queryByTestId('inhalt')).toBeNull();
    expect(document.body.textContent).not.toContain('Cockpit');
  });

  it('der Stand kommt sofort aus dem Index, auch wenn die Abfrage nichts liefert (kein Netz)', async () => {
    upsertHelperAccessEntry('anon-tom', entry({ relation: 'pending', checkNumber: 47 }));
    renderGuard(makeStatus([{ ok: false, error: { kind: 'network' } }]).deps);
    expect(await screen.findByTestId('helper-guard-pending')).toBeTruthy();
  });
});

describe('Gegenbeispiele: wer kein Helfer dieses Turniers ist, bleibt unberührt', () => {
  it('Gerät ohne Eintrag für dieses Turnier (eigenes Gast-Turnier): Inhalt, keine Abfrage', async () => {
    upsertHelperAccessEntry('anon-tom', entry({ tournamentId: 't-anderes' }));
    const { deps } = makeStatus([status({ relation: 'revoked' })]);
    renderGuard(deps);
    expect(await screen.findByTestId('inhalt')).toBeTruthy();
    expect(deps.fetchStatus).not.toHaveBeenCalled();
  });

  it('angemeldetes Konto (auch mit altem Eintrag): Inhalt, keine Abfrage', async () => {
    authState.user = { id: 'greta', name: 'Greta', isAnonymous: false };
    upsertHelperAccessEntry('greta', entry({ relation: 'revoked' }));
    const { deps } = makeStatus([status({ relation: 'revoked' })]);
    renderGuard(deps);
    expect(await screen.findByTestId('inhalt')).toBeTruthy();
    expect(deps.fetchStatus).not.toHaveBeenCalled();
  });

  it('Antwort „keine Beziehung“ (z. B. Leitung) sperrt nicht', async () => {
    upsertHelperAccessEntry('anon-tom', entry());
    renderGuard(makeStatus([status({ relation: 'leader' })]).deps);
    expect(await screen.findByTestId('inhalt')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByTestId('inhalt')).toBeTruthy();
  });
});

describe('@HE-110 „Zur Startseite“ auf der Endkarte', () => {
  it('Zugang entzogen, Gerät hat daneben ein laufendes Turnier → „Zur Startseite“ bleibt auf „/“, die Start-Weiche leitet nicht zurück', async () => {
    resetHelperStart(); // wie beim Start direkt an der Endkarte: die Weiche auf „/“ ist nie gelaufen
    const today = localDateKey(new Date());
    upsertHelperAccessEntry('anon-tom', entry({ relation: 'revoked' }));
    upsertHelperAccessEntry('anon-tom', entry({ tournamentId: 't-niko', title: 'Nikolaus-Turnier', code: 'NIKOCODE12', field: 1, date: today }));
    const { deps } = makeStatus([status({ relation: 'revoked' })]);
    const startDeps: HelperStartContextDeps = {
      readSession: async () => ({ kind: 'device', userId: 'anon-tom' }),
      fetchStatus: vi.fn(async (id: string): Promise<HelperRpcResult<HelperAccessStatus>> => (
        id === 't-niko' ? { ok: true, data: { state: 'open', relation: 'accepted', field: 1, closed: false, tournament: { id: 't-niko', title: 'Nikolaus-Turnier', date: today } } } : status({ relation: 'revoked' })
      )),
    };
    render(
      <AuthContext.Provider value={{ user: authState.user } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={['/tournament/t-cup/live']}>
          <Routes>
            <Route path="/" element={<><HelperStartGate active tournaments={[]} deps={startDeps}><div data-testid="startseite">Startseite</div></HelperStartGate><Where /></>} />
            <Route path="*" element={<><HelperAccessGuard tournamentId="t-cup" activeTab="management" statusDeps={deps}><div data-testid="inhalt">Cockpit</div></HelperAccessGuard><Where /></>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect((await screen.findByTestId('join-end-state')).textContent).toContain('Du hast keinen Zugriff mehr');
    await userEvent.click(screen.getByText('Zur Startseite'));
    expect(await screen.findByTestId('startseite')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.getByTestId('where').textContent).toBe('/');
    expect(screen.getByTestId('startseite')).toBeTruthy();
  });
});

describe('ohne Anmelde-Kontext', () => {
  it('Gegenbeispiel: ohne AuthProvider (Einbettung, ältere Tests) wird durchgelassen statt zu werfen', () => {
    upsertHelperAccessEntry('anon-tom', entry({ relation: 'revoked' }));
    render(
      <MemoryRouter>
        <HelperAccessGuard tournamentId="t-cup" activeTab="management"><div data-testid="inhalt">Cockpit</div></HelperAccessGuard>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('inhalt')).toBeTruthy();
  });
});
