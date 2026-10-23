/**
 * A-17c, Helfer-Seite nach „Anfrage senden“: der Warteschirm wechselt ohne neuen Scan auf „Du bist zugelassen“ (@HE-001),
 * Hinweis „Zum Startbildschirm hinzufügen“ einmal (@HE-097), „Offline bereit“ (@HE-028), Endzustände während des Wartens
 * (@OB-053, @HE-055). Server, Sitzung und Zeit sind Attrappen; Texte kommen aus der echten deutschen Übersetzung.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HelperAccessStatus, HelperRpcResult, JoinCodeInfo, RequestHelperAccessResult } from '../../core/repositories/helperAccessRpc';
import type { JoinFlowDeps } from '../../features/helpers/joinFlowSteps';
import { clearHelperAccessIndex, findHelperAccessEntry, syncHelperAccessEntry } from '../../features/helpers/helperAccessStore';
import type { HelperStatusDeps } from '../../features/helpers/useHelperAccessStatus';
import { initRealDeI18n } from '../../test/realDeI18n';
import { AddToHomeHint } from '../../features/helpers/components/AddToHomeHint';
import { JoinScreen } from '../JoinScreen';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, isGuest: false, isAnonymous: false, logout: vi.fn() }),
}));
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => ({ tournamentRepository: { get: vi.fn(async () => null) } }) }));
vi.mock('../../lib/supabase', () => ({ supabase: null }));

beforeAll(async () => { await initRealDeI18n(); });
// Der DOM-Test-Aufbau ersetzt `localStorage` durch Attrappen ohne Speicher; hier ein echter Speicher dahinter.
const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => memory.get(key) ?? null);
  vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => { memory.set(key, value); });
  vi.mocked(window.localStorage.removeItem).mockImplementation((key: string) => { memory.delete(key); });
  clearHelperAccessIndex();
});
const originalMatchMedia = window.matchMedia;
afterEach(() => { Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: originalMatchMedia }); });

const CUP = { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' };
const OPEN: JoinCodeInfo = { state: 'open', relation: 'none', tournament: CUP, shareCode: 'SHARE1' };
const PENDING: RequestHelperAccessResult = { result: 'PENDING', state: 'open', relation: 'pending', tournament: CUP, checkNumber: 47 };
const ok = <T,>(data: T): HelperRpcResult<T> => ({ ok: true, data });
const status = (s: Partial<HelperAccessStatus>): HelperRpcResult<HelperAccessStatus> => ok({ state: 'open', tournament: CUP, ...s });

function makeDeps(): JoinFlowDeps {
  return {
    loadInfo: vi.fn(async () => ok(OPEN)),
    readSession: vi.fn(async () => ({ kind: 'none' as const, userId: null })),
    countWaiting: vi.fn(async () => 0),
    signOutLocal: vi.fn(async () => ({ ok: true })),
    ensureDeviceSession: vi.fn(async () => ({ ok: true as const, userId: 'anon-tom', created: true })),
    requestAccess: vi.fn(async () => ok(PENDING)),
    deviceLabel: () => 'phone',
    // wie in der App: der Index wird wirklich geschrieben
    syncEntry: (userId, tournamentId, info, code) => { syncHelperAccessEntry(userId, tournamentId, info, code); },
    reportError: vi.fn(),
  };
}

function makeStatus(answers: Array<HelperRpcResult<HelperAccessStatus>>): HelperStatusDeps {
  let i = 0;
  return {
    fetchStatus: vi.fn(async () => answers[Math.min(i++, answers.length - 1)]),
    onStatus: (id, info) => { syncHelperAccessEntry('anon-tom', id, info, null); },
    isVisible: () => true,
    onBecameVisible: () => () => undefined,
  };
}

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}{loc.search}</div>;
}

function renderJoin(statusDeps: HelperStatusDeps, loadOfflineCopy: (id: string) => Promise<boolean> = async () => true) {
  return render(
    <MemoryRouter initialEntries={['/join/CODE123456']}>
      <Routes>
        <Route path="/join/:code" element={<><JoinScreen code="CODE123456" deps={makeDeps()} statusDeps={statusDeps} loadOfflineCopy={loadOfflineCopy} /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function sendRequest() {
  await userEvent.type(await screen.findByTestId('join-name'), 'Tom');
  await userEvent.click(screen.getByTestId('join-submit'));
  await screen.findByTestId('join-waiting');
}

describe('@HE-001 Warteschirm → „Du bist zugelassen“ ohne neuen Scan', () => {
  it('nach der Zulassung wechselt der Schirm von allein; die Haupttaste öffnet Feld 2', async () => {
    const statusDeps = makeStatus([status({ relation: 'pending', checkNumber: 47 }), status({ relation: 'accepted', field: 2, closed: false })]);
    renderJoin(statusDeps);
    await sendRequest();
    expect((await screen.findByTestId('helper-approved', {}, { timeout: 5000 })).textContent).toContain('Du bist zugelassen');
    expect(screen.getByTestId('helper-approved').textContent).toContain('Feld 2');
    expect(screen.queryByTestId('join-waiting')).toBeNull();
    await userEvent.click(screen.getByTestId('helper-open-field'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/live?f=2'));
  }, 10_000);

  it('Gegenbeispiel: solange die Anfrage offen ist, bleibt der Warteschirm mit der Prüfzahl', async () => {
    const statusDeps = makeStatus([status({ relation: 'pending', checkNumber: 47 })]);
    renderJoin(statusDeps);
    await sendRequest();
    await waitFor(() => expect(statusDeps.fetchStatus).toHaveBeenCalled());
    expect(screen.getByTestId('check-number').textContent).toBe('47');
    expect(screen.queryByTestId('helper-approved')).toBeNull();
    expect(screen.queryByTestId('helper-open-field')).toBeNull();
  });

  it('@OB-053 abgelehnt während des Wartens: „Anfrage abgelehnt“, keine Turnier-Inhalte', async () => {
    renderJoin(makeStatus([status({ relation: 'declined' })]));
    await sendRequest().catch(() => undefined);
    const card = await screen.findByTestId('join-end-state');
    expect(card.textContent).toContain('Anfrage abgelehnt');
    expect(screen.queryByTestId('helper-approved')).toBeNull();
  });

  it('@HE-055 Zugang entzogen, während der Schirm offen ist: „Du hast keinen Zugriff mehr“', async () => {
    renderJoin(makeStatus([status({ relation: 'pending', checkNumber: 47 }), status({ relation: 'revoked' })]));
    await sendRequest();
    expect((await screen.findByTestId('join-end-state', {}, { timeout: 5000 })).textContent).toContain('Du hast keinen Zugriff mehr');
  }, 10_000);
});

describe('@HE-097 Hinweis „Zum Startbildschirm hinzufügen“', () => {
  const approved = () => makeStatus([status({ relation: 'accepted', field: 2, closed: false })]);

  it('erscheint nach der Zulassung; wegklicken merkt das im Index; nach erneutem Öffnen nicht mehr', async () => {
    const first = renderJoin(approved());
    await sendRequest().catch(() => undefined);
    expect((await screen.findByTestId('home-hint')).textContent).toContain('Zum Startbildschirm hinzufügen');
    await userEvent.click(screen.getByTestId('home-hint-dismiss'));
    expect(screen.queryByTestId('home-hint')).toBeNull();
    expect(findHelperAccessEntry('anon-tom', 't-cup')?.homeHintDismissed).toBe(true);
    first.unmount();

    // Wiederöffnen (neuer Tab, nichts im Arbeitsspeicher): der Merker kommt aus dem Index, der Hinweis bleibt weg
    render(<AddToHomeHint deviceUserId="anon-tom" tournamentId="t-cup" field={2} />);
    expect(screen.queryByTestId('home-hint')).toBeNull();
  });

  it('Gegenbeispiel: wer die App schon vom Startbildschirm aus geöffnet hat, sieht den Hinweis nicht', async () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })) });
    renderJoin(approved());
    await sendRequest().catch(() => undefined);
    await screen.findByTestId('helper-approved');
    expect(screen.queryByTestId('home-hint')).toBeNull();
  });
});

describe('@HE-028 „Offline bereit“', () => {
  it('erscheint, sobald Spielplan und Feld auf dem Gerät liegen; der Index merkt den Zeitpunkt', async () => {
    renderJoin(makeStatus([status({ relation: 'accepted', field: 2, closed: false })]), async () => true);
    await sendRequest().catch(() => undefined);
    expect((await screen.findByTestId('offline-ready')).textContent).toContain('Offline bereit');
    expect(screen.getByTestId('offline-ready').textContent).toContain('Feld 2');
    expect(findHelperAccessEntry('anon-tom', 't-cup')?.offlineReadyAt).toEqual(expect.any(String));
  });

  it('Gegenbeispiel: liegt noch kein Spielplan vor, gibt es keine Zusage und keinen Merker', async () => {
    renderJoin(makeStatus([status({ relation: 'accepted', field: 2, closed: false })]), async () => false);
    await sendRequest().catch(() => undefined);
    await screen.findByTestId('helper-approved');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByTestId('offline-ready')).toBeNull();
    expect(findHelperAccessEntry('anon-tom', 't-cup')?.offlineReadyAt).toBeNull();
  });
});
