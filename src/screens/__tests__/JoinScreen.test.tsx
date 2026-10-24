/**
 * Beitritt per Helfer-QR-Code, Bildschirm (A-17b): je Zeile der Tabelle § 3.2 ein Test mit Kennung, mit Gegenbeispielen.
 * Der Ablauf selbst (Reducer, Schritte) ist in features/helpers getestet; hier zählt, was der Helfer sieht und was
 * die Tasten auslösen. Server und Sitzung sind Attrappen (`deps`); Texte kommen aus der echten deutschen Übersetzung.
 */
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HelperRpcResult, JoinCodeInfo, RequestHelperAccessResult } from '../../core/repositories/helperAccessRpc';
import type { SessionInfo } from '../../core/auth/deviceSession';
import type { JoinFlowDeps } from '../../features/helpers/joinFlowSteps';
import { initRealDeI18n } from '../../test/realDeI18n';
import { JoinScreen, LegacyInviteScreen } from '../JoinScreen';

vi.unmock('i18next');
vi.unmock('react-i18next');

const authState = vi.hoisted(() => ({ user: null as null | { name: string; isAnonymous?: boolean }, logout: vi.fn() }));
vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: authState.user, isGuest: false, isAnonymous: false, logout: authState.logout }),
}));
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => ({ tournamentRepository: {} }) }));

beforeAll(async () => { await initRealDeI18n(); });

const CUP = { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' };
const ok = <T,>(data: T): HelperRpcResult<T> => ({ ok: true, data });
const OPEN: JoinCodeInfo = { state: 'open', relation: 'none', tournament: CUP, shareCode: 'SHARE1' };

function makeDeps(info: HelperRpcResult<JoinCodeInfo>, o: { session?: SessionInfo; waiting?: number; request?: HelperRpcResult<RequestHelperAccessResult> } = {}): JoinFlowDeps {
  return {
    loadInfo: vi.fn(async () => info),
    readSession: vi.fn(async () => o.session ?? { kind: 'none' as const, userId: null }),
    countWaiting: vi.fn(async () => o.waiting ?? 0),
    signOutLocal: vi.fn(async () => ({ ok: true })),
    ensureDeviceSession: vi.fn(async () => ({ ok: true as const, userId: 'anon-tom', created: true })),
    requestAccess: vi.fn(async () => o.request ?? ok<RequestHelperAccessResult>({ result: 'PENDING', state: 'open', relation: 'pending', tournament: CUP, checkNumber: 47 })),
    deviceLabel: () => 'phone',
    syncEntry: vi.fn(),
    reportError: vi.fn(),
  };
}

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}{loc.search}</div>;
}

function renderJoin(deps: JoinFlowDeps) {
  return render(
    <MemoryRouter initialEntries={['/join/CODE123456']}>
      <Routes>
        <Route path="/join/:code" element={<><JoinScreen code="CODE123456" deps={deps} /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const endTitle = async (text: string) => {
  const card = await screen.findByTestId('join-end-state');
  expect(card.textContent).toContain(text);
  return card;
};

describe('M1 Einstieg', () => {
  it('@HE-033 @HE-004 offener Code: Info, Turnier, Name, Zuschauer-Weg; keine Anfrage vor dem Absenden (S-5)', async () => {
    const deps = makeDeps(ok(OPEN));
    renderJoin(deps);
    expect(await screen.findByTestId('join-info')).toBeTruthy();
    expect(screen.getByTestId('join-info-card').textContent).toContain('Live-Cup');
    expect(screen.getByTestId('join-viewer-link')).toBeTruthy();
    expect(deps.ensureDeviceSession).not.toHaveBeenCalled();
    expect(deps.requestAccess).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel @HE-033: ohne shareCode kein Zuschauer-Weg', async () => {
    renderJoin(makeDeps(ok({ ...OPEN, shareCode: null })));
    await screen.findByTestId('join-info');
    expect(screen.queryByTestId('join-viewer-link')).toBeNull();
  });

  it('@HE-001 Name → Anfrage senden → Warteschirm mit Prüfzahl 47', async () => {
    const deps = makeDeps(ok(OPEN));
    renderJoin(deps);
    await userEvent.type(await screen.findByTestId('join-name'), 'Tom');
    await userEvent.click(screen.getByTestId('join-submit'));
    expect((await screen.findByTestId('check-number')).textContent).toBe('47');
    expect(deps.requestAccess).toHaveBeenCalledWith('CODE123456', 'Tom', 'phone');
    expect(screen.getByTestId('join-pending-notice').textContent).toContain('Wartet auf Freigabe durch die Turnierleitung');
    expect(screen.getByTestId('join-waiting').textContent).toContain('Tom');
  });

  it('Gegenbeispiel: leerer Name → Feldfehler, keine Gerätesitzung, keine Anfrage', async () => {
    const deps = makeDeps(ok(OPEN));
    renderJoin(deps);
    await userEvent.click(await screen.findByTestId('join-submit'));
    expect(await screen.findByTestId('join-name-error')).toBeTruthy();
    expect(deps.ensureDeviceSession).not.toHaveBeenCalled();
    expect(deps.requestAccess).not.toHaveBeenCalled();
  });

  it('Namensfeld: Schrift mindestens 16 px (--font-size-lg), Zähler und Höchstlänge 40', async () => {
    renderJoin(makeDeps(ok(OPEN)));
    const input = await screen.findByTestId('join-name');
    expect(input.getAttribute('maxlength')).toBe('40');
    expect(input.style.fontSize).toBe('var(--font-size-lg)');
    await userEvent.type(input, 'Tom');
    expect(screen.getByTestId('join-name-counter').textContent).toBe('3 / 40');
  });

  it('@HE-015 ohne Netz beim Absenden: „Für den Einstieg brauchst du Netz“, Name bleibt, Taste „Erneut versuchen“', async () => {
    const deps = makeDeps(ok(OPEN), { request: { ok: false, error: { kind: 'network' } } });
    renderJoin(deps);
    await userEvent.type(await screen.findByTestId('join-name'), 'Tom');
    await userEvent.click(screen.getByTestId('join-submit'));
    expect((await screen.findByTestId('join-offline')).textContent).toContain('Für den Einstieg brauchst du Netz');
    expect(screen.getByTestId<HTMLInputElement>('join-name').value).toBe('Tom');
    expect(screen.getByTestId('join-retry')).toBeTruthy();
    expect(screen.queryByText(/nicht gültig/)).toBeNull();
  });

  it('@HE-015 ohne Netz beim Scan: Netz-Hinweis statt „Code ungültig“', async () => {
    renderJoin(makeDeps({ ok: false, error: { kind: 'network' } }));
    expect((await screen.findByTestId('join-offline')).textContent).toContain('Für den Einstieg brauchst du Netz');
    expect(screen.queryByTestId('join-end-state')).toBeNull();
  });
});

describe('M1 Konto', () => {
  const account: SessionInfo = { kind: 'account', userId: 'greta' };

  it('@HE-089 Konto scannt → Rückfrage; „Weiter“ meldet ab und zeigt das Namensfeld', async () => {
    authState.user = { name: 'Greta' };
    const deps = makeDeps(ok(OPEN), { session: account });
    renderJoin(deps);
    expect((await screen.findByTestId('join-account-text')).textContent).toContain('Greta');
    expect(deps.signOutLocal).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('join-account-continue'));
    await waitFor(() => expect(deps.signOutLocal).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('join-submit')).toBeTruthy();
    expect(deps.ensureDeviceSession).not.toHaveBeenCalled();
  });

  it('@HE-090 „Abbrechen“ → kein Abmelden, keine Anfrage, zurück zur Startseite', async () => {
    authState.user = { name: 'Greta' };
    const deps = makeDeps(ok(OPEN), { session: account });
    renderJoin(deps);
    await userEvent.click(await screen.findByTestId('join-account-cancel'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
    expect(deps.signOutLocal).not.toHaveBeenCalled();
    expect(deps.requestAccess).not.toHaveBeenCalled();
  });

  it('@HE-092 Einträge warten: kein „Weiter“, „Erst verbinden – 2 Einträge warten“; N-7 „Erneut versuchen“ prüft neu', async () => {
    authState.user = { name: 'Greta' };
    const deps = makeDeps(ok(OPEN), { session: account, waiting: 2 });
    renderJoin(deps);
    expect((await screen.findByTestId('join-pending-entries')).textContent).toContain('Erst verbinden – 2 Einträge warten');
    expect(screen.queryByTestId('join-account-continue')).toBeNull();
    await userEvent.click(screen.getByTestId('join-retry'));
    await waitFor(() => expect(deps.loadInfo).toHaveBeenCalledTimes(2));
    expect(deps.signOutLocal).not.toHaveBeenCalled();
  });

  it('@HE-092 Zählung scheitert (Zahl unbekannt): Text ohne Zahl, gesperrt', async () => {
    authState.user = { name: 'Greta' };
    const deps = makeDeps(ok(OPEN), { session: account });
    deps.countWaiting = vi.fn(async () => { throw new Error('IndexedDB'); });
    renderJoin(deps);
    expect((await screen.findByTestId('join-pending-entries')).textContent).toContain('Erst verbinden – Einträge warten');
  });

  it('@HE-093 Netz weg beim „Weiter“: nicht abgemeldet, „Du bleibst als Greta angemeldet“, Erneut versuchen', async () => {
    authState.user = { name: 'Greta' };
    const deps = makeDeps(ok(OPEN), { session: account });
    renderJoin(deps);
    await screen.findByTestId('join-account-continue');
    deps.loadInfo = vi.fn(async () => ({ ok: false as const, error: { kind: 'network' as const } }));
    await userEvent.click(screen.getByTestId('join-account-continue'));
    expect((await screen.findByTestId('join-offline')).textContent).toContain('Für den Einstieg brauchst du Netz');
    expect(screen.getByTestId('join-offline-account').textContent).toContain('Greta');
    expect(deps.signOutLocal).not.toHaveBeenCalled();
    expect(screen.getByTestId('join-retry')).toBeTruthy();
  });

  it('@HE-091 Leitung: „Du leitest dieses Turnier bereits“, keine Rückfrage, Turnier öffnen', async () => {
    authState.user = { name: 'Maria' };
    renderJoin(makeDeps(ok({ ...OPEN, relation: 'leader' }), { session: account }));
    expect((await screen.findByTestId('join-leader')).textContent).toContain('Du leitest dieses Turnier bereits');
    expect(screen.queryByTestId('join-account-continue')).toBeNull();
    await userEvent.click(screen.getByTestId('join-open-tournament'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup'));
  });
});

describe('M2 Endzustände (Tabelle § 3.2)', () => {
  it.each([
    ['@HE-103 invalid', { state: 'invalid' }, 'Dieser Code ist nicht gültig'],
    ['@HE-007 @HE-076 rotated', { state: 'rotated' }, 'Dieser Code ist nicht mehr gültig'],
    ['@HE-009 @HE-010 expired', { state: 'expired' }, 'Dieser Code ist abgelaufen'],
    ['@HE-038 @LZ-044 closed', { state: 'closed' }, 'Das Turnier ist abgeschlossen – ein Beitritt ist nicht mehr möglich'],
    ['@HE-008 declined', { ...OPEN, relation: 'declined' }, 'Anfrage abgelehnt'],
    ['@HE-011 Anfrage verfallen', { state: 'expired', relation: 'expired', tournament: CUP }, 'Anfrage verfallen'],
    ['@HE-098 revoked', { ...OPEN, relation: 'revoked' }, 'Du hast keinen Zugriff mehr'],
    ['@HE-055 viewer', { ...OPEN, relation: 'viewer' }, 'Du kannst nur noch zusehen'],
    ['@HE-098 Z.2 Turnier abgeschlossen', { state: 'closed', relation: 'accepted', tournament: CUP, field: 2 }, 'Das Turnier ist abgeschlossen'],
  ] as [string, JoinCodeInfo, string][])('%s → Karte mit Text und „Zur Startseite“ bzw. eigener Taste', async (_n, info, text) => {
    renderJoin(makeDeps(ok(info)));
    const card = await endTitle(text);
    expect(card.querySelector('[data-primary]')).toBeTruthy();
    expect(screen.queryByTestId('join-name')).toBeNull();
  });

  it.each(['invalid', 'rotated', 'expired', 'closed'] as const)('@HE-004 Zustand %s ohne Beziehung zeigt keinen Turniernamen und kein Formular', async (state) => {
    renderJoin(makeDeps(ok({ state })));
    await screen.findByTestId('join-end-state');
    expect(screen.queryByText(/Live-Cup/)).toBeNull();
    expect(screen.queryByTestId('join-submit')).toBeNull();
  });

  it('@HE-008 abgelehnt (einzeln, Code noch offen): keine Turnier-Inhalte, Sperr-Satz und Hinweis auf anderen Browser', async () => {
    renderJoin(makeDeps(ok({ ...OPEN, relation: 'declined' })));
    const card = await endTitle('Anfrage abgelehnt');
    expect(card.textContent).toContain('bis zum Ende des Turniers keine neue Anfrage');
    expect(card.textContent).toContain('anderen Browser');
    expect(screen.queryByTestId('join-info-card')).toBeNull();
  });

  it('@HE-102 abgelehnt mit altem Code (rotated): kein Sperr-Satz, neutral „aktuellen QR-Code“', async () => {
    renderJoin(makeDeps(ok({ state: 'rotated', relation: 'declined', tournament: CUP })));
    const card = await endTitle('Anfrage abgelehnt');
    expect(card.textContent).not.toContain('keine neue Anfrage');
    expect(card.textContent).toContain('aktuellen QR-Code');
  });

  it.each([
    ['declined', { ...OPEN, relation: 'declined' }],
    ['declined (alter Code)', { state: 'rotated', relation: 'declined', tournament: CUP }],
    ['requestExpired', { state: 'expired', relation: 'expired', tournament: CUP }],
    ['revoked', { ...OPEN, relation: 'revoked' }],
    ['viewer', { ...OPEN, relation: 'viewer' }],
    ['accepted + closed', { state: 'closed', relation: 'accepted', tournament: CUP, field: 2 }],
  ] as [string, JoinCodeInfo][])('@HE-004 Endkarte mit Beziehung (%s) nennt den Turniernamen nicht, auch wenn der Server ihn liefert', async (_n, info) => {
    renderJoin(makeDeps(ok(info)));
    await screen.findByTestId('join-end-state');
    expect(screen.queryByText(/Live-Cup/)).toBeNull();
    expect(screen.queryByTestId('join-info-card')).toBeNull();
  });

  it('@HE-004 BUSY und „Bitte noch einmal scannen“ nach dem Formular (Turnier war bekannt) nennen den Turniernamen nicht', async () => {
    for (const request of [ok<RequestHelperAccessResult>({ result: 'BUSY', tournament: CUP }), { ok: false as const, error: { kind: 'noSession' as const } }]) {
      const { unmount } = renderJoin(makeDeps(ok(OPEN), { request }));
      await userEvent.type(await screen.findByTestId('join-name'), 'Tom');
      await userEvent.click(screen.getByTestId('join-submit'));
      await screen.findByTestId('join-end-state');
      expect(screen.queryByText(/Live-Cup/)).toBeNull();
      unmount();
    }
  });

  it('Mockup e5: die Leitung sieht die Turnierkarte, e4: „Erst verbinden“ ebenfalls', async () => {
    authState.user = { name: 'Maria' };
    const leader = renderJoin(makeDeps(ok({ ...OPEN, relation: 'leader' }), { session: { kind: 'account', userId: 'm' } }));
    await screen.findByTestId('join-leader');
    expect(screen.getByTestId('join-info-card').textContent).toContain('Live-Cup');
    leader.unmount();
    renderJoin(makeDeps(ok(OPEN), { session: { kind: 'account', userId: 'm' }, waiting: 1 }));
    await screen.findByTestId('join-pending-entries');
    expect(screen.getByTestId('join-info-card').textContent).toContain('Live-Cup');
  });

  it('@HE-095 @HE-037 zugelassen, Turnier läuft → direkt Feld 2 öffnen, kein Formular, keine Anfrage', async () => {
    const deps = makeDeps(ok({ ...OPEN, relation: 'accepted', field: 2 }));
    renderJoin(deps);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/live?f=2'));
    expect(deps.requestAccess).not.toHaveBeenCalled();
  });

  it('@HE-098 Z.3 zugelassen ohne Feld → Feld 1', async () => {
    renderJoin(makeDeps(ok({ ...OPEN, relation: 'accepted', field: null })));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/live?f=1'));
  });

  it('Taste „Zur Startseite“ führt zur Startseite', async () => {
    renderJoin(makeDeps(ok({ state: 'invalid' })));
    await userEvent.click(await screen.findByTestId('join-home'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
  });

  it('@HE-055 viewer / Endstand: eigene Taste zum Spielplan bzw. Endstand', async () => {
    renderJoin(makeDeps(ok({ ...OPEN, relation: 'viewer' })));
    await userEvent.click(await screen.findByTestId('helper-viewer-open'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/tournament/t-cup/schedule'));
  });

  it('§ 3.2 BUSY → „Zu viele offene Anfragen“', async () => {
    renderJoin(makeDeps(ok(OPEN), { request: ok<RequestHelperAccessResult>({ result: 'BUSY' }) }));
    await userEvent.type(await screen.findByTestId('join-name'), 'Tom');
    await userEvent.click(screen.getByTestId('join-submit'));
    await endTitle('Zu viele offene Anfragen – bitte an die Turnierleitung wenden');
  });

  it('§ 3.2 ACCOUNT_SESSION / NOT_SIGNED_IN → „Bitte noch einmal scannen“', async () => {
    renderJoin(makeDeps(ok(OPEN), { request: { ok: false, error: { kind: 'noSession' } } }));
    await userEvent.type(await screen.findByTestId('join-name'), 'Tom');
    await userEvent.click(screen.getByTestId('join-submit'));
    await endTitle('Bitte noch einmal scannen');
  });

  it('§ 3.2 Auth 429 → Hinweis, Name bleibt', async () => {
    const deps = makeDeps(ok(OPEN));
    deps.ensureDeviceSession = vi.fn(async () => ({ ok: false as const, reason: 'rateLimited' as const }));
    renderJoin(deps);
    await userEvent.type(await screen.findByTestId('join-name'), 'Tom');
    await userEvent.click(screen.getByTestId('join-submit'));
    expect((await screen.findByTestId('join-rate-limit')).textContent).toContain('Zu viele Anmeldungen aus diesem Netz');
    expect(screen.getByTestId<HTMLInputElement>('join-name').value).toBe('Tom');
  });

  it('§ 3.2 noRequest (Konto-Sitzung ohne Anfrage) → Hinweis', async () => {
    renderJoin(makeDeps(ok({ relation: 'none' } as JoinCodeInfo)));
    await endTitle('Für dieses Turnier hast du keinen Zugang');
  });

  it('@HE-063 alter Einladungslink /invite → Hinweis statt Anfrage', () => {
    render(<MemoryRouter><LegacyInviteScreen /></MemoryRouter>);
    expect(screen.getByTestId('join-end-state').textContent).toContain('Dieser Einladungsweg gilt nicht mehr');
    expect(screen.queryByTestId('join-name')).toBeNull();
    expect(screen.getByTestId('join-home')).toBeTruthy();
  });
});
