/**
 * „Team & Helfer“ (A-18a, GA5, Mockup M4) gegen die Szenarien des Records helfer-am-turniertag: die Seite wird mit den echten
 * Hooks gerendert, nur die Server-Anbindung (`helperAccessRpc`) und die Rechte sind gestellt. Geprüft wird, was Olli sieht
 * und was zum Server geht – nie, was im Quelltext steht.
 *
 * Szenarien: @HE-001 @HE-006 @HE-007 @HE-008 @HE-021 @HE-040 @HE-047 @HE-052 @HE-055 @HE-062 @HE-075 @HE-077 @HE-102
 * @HE-104 @HE-105 @HE-106 @OB-005 @LZ-044.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');

const rpc = vi.hoisted(() => ({ ensure: vi.fn(), rotate: vi.fn(), list: vi.fn(), decide: vi.fn(), change: vi.fn() }));
const env = vi.hoisted(() => ({ online: true, canManage: true, roleLoading: false }));

vi.mock('../../../../../core/repositories/helperAccessRpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../../core/repositories/helperAccessRpc')>()),
  callEnsureHelperCode: rpc.ensure,
  callRotateHelperCode: rpc.rotate,
  callListHelperAccess: rpc.list,
  callDecideJoinRequest: rpc.decide,
  callChangeHelperAccess: rpc.change,
}));
vi.mock('../../../../../lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../../../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: env.online, wasOffline: false }) }));
vi.mock('../../../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'u1', name: 'Olli' } }) }));
vi.mock('../../../../auth/hooks/useCan', () => ({ useCanState: () => ({ allowed: env.canManage, isLoading: env.roleLoading }) }));

import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { TeamHelpersCategory } from '../index';
import type { Tournament } from '../../../../../types/tournament';

await initRealDeI18n();

const tournament = { id: 't1', title: 'Live-Cup', numberOfFields: 2, teams: [], matches: [] } as unknown as Tournament;
const CODE = { ok: true, data: { result: 'OK', code: 'K7MQ4X9R2P', validUntil: '2026-11-28T23:00:00Z', openRequests: 1 } };

const req = (id: string, name: string, checkNumber: number, over: Record<string, unknown> = {}) => ({
  id, name, deviceLabel: 'phone', checkNumber, createdAt: '2026-11-28T13:02:00Z',
  sameName: 1, sameNamePending: 1, sameNameMember: null, sameNameDeclinedAt: null, ...over,
});
const member = (over: Record<string, unknown>) => ({
  memberId: 'm1', name: 'Tom', deviceLabel: 'phone', field: 2, mode: 'helper', revokedAt: null,
  acceptedAt: '2026-11-28T10:00:00Z', lastSeenAt: null, controls: [], ...over,
});
const listOf = (requests: unknown[], members: unknown[]) => ({ ok: true, data: { requests, members } });

async function open(requests: unknown[] = [req('r1', 'Tom', 47)], members: unknown[] = []) {
  rpc.list.mockResolvedValue(listOf(requests, members));
  const user = userEvent.setup();
  render(<TeamHelpersCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />);
  await screen.findByTestId('helper-code-card');
  await waitFor(() => expect(screen.getByTestId('join-requests')).toBeInTheDocument());
  return user;
}

describe('Team & Helfer', () => {
  beforeEach(() => {
    env.online = true;
    env.canManage = true;
    env.roleLoading = false;
    Object.values(rpc).forEach((m) => m.mockReset());
    rpc.ensure.mockResolvedValue(CODE);
    rpc.decide.mockResolvedValue({ ok: true, data: { result: 'OK', memberId: 'm9' } });
    rpc.change.mockResolvedValue({ ok: true, data: { result: 'OK' } });
  });

  describe('Helfer-QR-Code (@HE-001, @HE-007)', () => {
    it('zeigt QR, Code und die Gültigkeit; der QR trägt die Beitrittsadresse /join/<Code>', async () => {
      await open();
      expect(screen.getByTestId('helper-code')).toHaveTextContent('K7MQ4X9R2P');
      expect(screen.getByTestId('helper-qr').dataset.url).toMatch(/#\/join\/K7MQ4X9R2P$/);
      expect(screen.getByText(/gilt bis .*28\.11\..*23:59 Uhr/)).toBeInTheDocument();
    });

    it('@LZ-044 (Leitungs-Sicht): nach dem Abschluss gibt es keinen Code, die Seite sagt es', async () => {
      rpc.ensure.mockResolvedValue({ ok: true, data: { result: 'CLOSED' } });
      await open([], []);
      expect(screen.getByTestId('helper-code-closed')).toHaveTextContent(/abgeschlossen/);
      expect(screen.queryByTestId('helper-code')).not.toBeInTheDocument();
      expect(screen.queryByTestId('helper-qr')).not.toBeInTheDocument();
    });

    it('@HE-008 Code erneuern mit 2 offenen Anfragen: fragt „2 offene Anfragen behalten oder ablehnen?“, „ablehnen“ geht als decline an den Server', async () => {
      const user = await open([req('r1', 'Tom', 47), req('r2', 'Lena', 19)]);
      rpc.rotate.mockResolvedValue({ ok: true, data: { result: 'OK', code: 'NEWCODE234', validUntil: '2026-11-28T23:00:00Z', openRequests: 0, declined: 2 } });
      await user.click(screen.getByTestId('helper-code-renew'));
      const dialog = await screen.findByTestId('renew-dialog');
      expect(dialog).toHaveTextContent('2 offene Anfragen behalten oder ablehnen?');
      expect(dialog).toHaveTextContent(/Zugelassene Helfer bleiben Helfer/);
      await user.click(screen.getByTestId('renew-decline'));
      await waitFor(() => expect(rpc.rotate).toHaveBeenCalledTimes(1));
      expect(rpc.rotate.mock.calls[0]?.slice(1)).toEqual(['t1', 'decline']);
      await waitFor(() => expect(screen.getByTestId('helper-code')).toHaveTextContent('NEWCODE234'));
    });

    it('@HE-007 Gegenbeispiel: „Abbrechen“ erneuert nichts', async () => {
      const user = await open();
      await user.click(screen.getByTestId('helper-code-renew'));
      await user.click(await screen.findByTestId('renew-cancel'));
      expect(rpc.rotate).not.toHaveBeenCalled();
      expect(screen.getByTestId('helper-code')).toHaveTextContent('K7MQ4X9R2P');
    });
  });

  describe('Anfragen (@HE-021, @HE-106)', () => {
    it('@HE-021 Die Anfrage-Zeile zeigt Name und Uhrzeit, aber nie die Prüfzahl', async () => {
      await open([req('r1', 'Tom', 47)]);
      const row = screen.getByTestId('join-request');
      expect(row).toHaveTextContent('Tom');
      expect(row).toHaveTextContent(/gestellt 14:02 Uhr/);
      expect(row.textContent).not.toMatch(/47/);
      expect(screen.queryByTestId('check-number')).not.toBeInTheDocument();
    });

    it('@HE-021 Zwei Anfragen „Tom“: Hinweis „2 Anfragen mit dem Namen Tom“, beide mit Uhrzeit, keine Zahl', async () => {
      await open([
        req('r1', 'Tom', 47, { sameName: 2, sameNamePending: 2 }),
        req('r2', 'Tom', 82, { sameName: 2, sameNamePending: 2, createdAt: '2026-11-28T13:03:00Z' }),
      ]);
      expect(screen.getByTestId('dup-name-hint')).toHaveTextContent('2 Anfragen mit dem Namen Tom');
      const rows = screen.getAllByTestId('join-request');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('14:02');
      expect(rows[1]).toHaveTextContent('14:03');
      rows.forEach((r) => expect(r.textContent).not.toMatch(/47|82/));
    });

    it('@HE-021 Gegenbeispiel: verschiedene Namen lösen keinen Hinweis aus', async () => {
      await open([req('r1', 'Tom', 47), req('r2', 'Lena', 19)]);
      expect(screen.queryByTestId('dup-name-hint')).not.toBeInTheDocument();
    });

    it('@HE-106 Zeile 1: Tom ist schon zugelassen (Handy)', async () => {
      await open([req('r1', 'Tom', 47, { sameName: 2, sameNameMember: { deviceLabel: 'phone', acceptedAt: '2026-11-28T10:00:00Z' } })]);
      expect(screen.getByTestId('same-name-mark')).toHaveTextContent('Tom ist schon zugelassen (Handy)');
    });

    it('@HE-106 Zeile 2: Name „Tom“ um 12:03 abgelehnt', async () => {
      await open([req('r1', 'Tom', 47, { sameName: 2, sameNameDeclinedAt: '2026-11-28T11:03:00Z' })]);
      expect(screen.getByTestId('same-name-mark')).toHaveTextContent('Name „Tom“ um 12:03 abgelehnt');
    });

    it('@HE-106 Gegenbeispiel: ohne Vorgeschichte kein Hinweis', async () => {
      await open([req('r1', 'Tom', 47)]);
      expect(screen.queryByTestId('same-name-mark')).not.toBeInTheDocument();
    });

    it('@HE-052 Leerer Zustand: „keine offenen“ und der Satz, was zu tun ist', async () => {
      await open([], []);
      expect(screen.getByTestId('join-requests-count')).toHaveTextContent('keine offenen');
      expect(screen.getByText(/Sobald jemand den QR-Code scannt/)).toBeInTheDocument();
      expect(screen.getByTestId('helper-list-count')).toHaveTextContent('keine Zugänge');
    });

    it('Ablehnen: ein Tipp, accept:false ohne Prüfzahl', async () => {
      const user = await open();
      await user.click(screen.getByTestId('request-decline'));
      await waitFor(() => expect(rpc.decide).toHaveBeenCalledTimes(1));
      expect(rpc.decide.mock.calls[0]?.slice(1)).toEqual(['r1', { accept: false }]);
    });

    it('@HE-006 Zwei Entscheidungen zugleich: Maria sieht „Bereits von Olli entschieden“', async () => {
      const user = await open();
      rpc.decide.mockResolvedValue({ ok: true, data: { result: 'ALREADY_DECIDED', status: 'accepted', decidedBy: 'Olli' } });
      await user.click(screen.getByTestId('request-decline'));
      expect(await screen.findByTestId('action-notice')).toHaveTextContent('Bereits von Olli entschieden');
    });
  });

  describe('Zulassen-Blatt (S-1, @HE-105, @HE-040)', () => {
    it('Tipp 1 öffnet das Blatt: Feld wählen, dann vier Zahlknöpfe; keine grüne Haupttaste, kein „Zulassen“-Knopf im Blatt', async () => {
      const user = await open();
      await user.click(screen.getByTestId('request-approve'));
      const sheet = await screen.findByTestId('approve-sheet');
      expect(within(sheet).getByText('Welche Zahl zeigt das Handy?')).toBeInTheDocument();
      const buttons = within(screen.getByTestId('approve-number')).getAllByRole('button');
      expect(buttons).toHaveLength(4);
      const values = buttons.map((b) => Number(b.textContent));
      expect(values).toContain(47);
      expect(new Set(values).size).toBe(4);
      expect(values).toEqual([...values].sort((a, b) => a - b));
      expect(within(sheet).queryByRole('button', { name: 'Zulassen' })).not.toBeInTheDocument();
      expect(sheet.querySelector('[data-primary]')).toBeNull();
      // Felder des Turniers + „Ohne Feld“
      expect(within(screen.getByTestId('approve-field')).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Feld 1', 'Feld 2', 'Ohne Feld']);
    });

    it('@HE-001 Feld 2 + richtige Zahl: ≤ 3 Tipps (Zulassen, Feld, Zahl), der Server bekommt Anfrage, Zahl und Feld', async () => {
      const user = await open();
      await user.click(screen.getByTestId('request-approve')); // Tipp 1
      await user.click(await screen.findByTestId('approve-field-2')); // Tipp 2
      await user.click(screen.getByTestId('approve-number-47')); // Tipp 3
      await waitFor(() => expect(rpc.decide).toHaveBeenCalledTimes(1));
      expect(rpc.decide.mock.calls[0]?.slice(1)).toEqual(['r1', { accept: true, checkNumber: 47, field: 2 }]);
      await waitFor(() => expect(screen.queryByTestId('approve-sheet')).not.toBeInTheDocument());
    });

    it('@HE-040 ohne Feld: field null; die letzte Feldwahl bleibt für die nächste Anfrage stehen', async () => {
      const user = await open([req('r1', 'Tom', 47), req('r2', 'Lena', 19)]);
      await user.click(screen.getAllByTestId('request-approve')[0]);
      await user.click(await screen.findByTestId('approve-field-2'));
      await user.click(screen.getByTestId('approve-cancel'));
      await user.click(screen.getAllByTestId('request-approve')[1]);
      expect(await screen.findByTestId('approve-field-2')).toHaveAttribute('aria-checked', 'true');
    });

    it('@HE-105 Gegenbeispiel: falsche Zahl – „Zahl stimmt nicht – frag nach der Zahl auf dem Handy“, die Anfrage bleibt offen, Blatt bleibt', async () => {
      const user = await open();
      rpc.decide.mockResolvedValue({ ok: true, data: { result: 'CHECK_MISMATCH' } });
      await user.click(screen.getByTestId('request-approve'));
      const numbers = within(await screen.findByTestId('approve-number')).getAllByRole('button');
      const wrong = numbers.find((b) => Number(b.textContent) !== 47)!;
      await user.click(wrong);
      expect(await screen.findByTestId('check-number-mismatch')).toHaveTextContent('Zahl stimmt nicht – frag nach der Zahl auf dem Handy');
      expect(screen.getByTestId('approve-sheet')).toBeInTheDocument();
      // nichts hat sich geändert: die Anfrage steht weiter in der Liste, keine neue Liste vom Server nötig
      expect(screen.getByTestId('join-request')).toBeInTheDocument();
      expect(rpc.decide).toHaveBeenCalledTimes(1);
      // die Zahlknöpfe sind wieder frei
      numbers.forEach((b) => expect(b).toBeEnabled());
    });

    it('@HE-107 Gegenbeispiel: ungültiges Feld (22023) – „Das hat nicht geklappt“, nichts geändert', async () => {
      const user = await open();
      rpc.decide.mockResolvedValue({ ok: false, error: { kind: 'invalidInput', reason: 'INVALID_FIELD' } });
      await user.click(screen.getByTestId('request-approve'));
      await user.click(await screen.findByTestId('approve-number-47'));
      expect(await screen.findByTestId('action-notice')).toHaveTextContent('Das hat nicht geklappt – bitte noch einmal.');
      expect(screen.getByTestId('join-request')).toBeInTheDocument();
    });
  });

  describe('Helfer-Übersicht (@HE-052, @HE-075, @HE-077, @HE-049)', () => {
    it('@HE-052 „Tom – Feld 2 – steuert“ und „Clara – ohne Feld – zuletzt 12:03“, je mit Gerät; „1 offene Anfrage“', async () => {
      await open([req('r1', 'Lena', 19)], [
        member({ memberId: 'm1', name: 'Tom', field: 2, controls: [2] }),
        member({ memberId: 'm2', name: 'Clara', field: null, deviceLabel: 'tablet', lastSeenAt: '2026-11-28T11:03:00Z' }),
      ]);
      const rows = screen.getAllByTestId('helper-row');
      expect(rows[0]).toHaveTextContent('Tom – Feld 2 – steuert');
      expect(rows[0]).toHaveTextContent('Gerät: Handy');
      expect(rows[1]).toHaveTextContent('Clara – ohne Feld – zuletzt 12:03');
      expect(rows[1]).toHaveTextContent('Gerät: Tablet');
      expect(screen.getByTestId('join-requests-count')).toHaveTextContent('1 offene Anfrage');
      expect(screen.getByTestId('helper-list-count')).toHaveTextContent('2 Zugänge');
    });

    it('@HE-077 Zwei Zugänge von Tom (Handy, Tablet) stehen als zwei Zeilen mit je ihrem Gerät', async () => {
      await open([], [
        member({ memberId: 'm1', name: 'Tom', deviceLabel: 'phone', field: 2, controls: [2] }),
        member({ memberId: 'm2', name: 'Tom', deviceLabel: 'tablet', field: null }),
      ]);
      const rows = screen.getAllByTestId('helper-row');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('Gerät: Handy');
      expect(rows[1]).toHaveTextContent('Gerät: Tablet');
    });

    it('@HE-075 Der alte Zugang des ausgefallenen Handys bleibt sichtbar und lässt sich entziehen', async () => {
      await open([], [
        member({ memberId: 'm1', name: 'Tom', deviceLabel: 'phone', lastSeenAt: '2026-11-28T11:41:00Z' }),
        member({ memberId: 'm3', name: 'Tom', deviceLabel: 'phone', field: 2, controls: [2] }),
      ]);
      const first = screen.getAllByTestId('helper-row')[0];
      expect(first).toHaveTextContent('zuletzt 12:41');
      expect(within(first).getByTestId('helper-revoke')).toBeEnabled();
    });

    it('@HE-104 Entzogene Zugänge bleiben als „Zugang entzogen“ stehen (nie gelöscht), ohne Tasten, nach den aktiven', async () => {
      await open([], [
        member({ memberId: 'm1', name: 'Tom', revokedAt: '2026-11-28T11:30:00Z' }),
        member({ memberId: 'm2', name: 'Clara', field: null }),
      ]);
      const rows = screen.getAllByTestId('helper-row');
      expect(rows[0]).toHaveTextContent('Clara');
      expect(rows[1]).toHaveTextContent('Tom');
      expect(rows[1].dataset.state).toBe('revoked');
      expect(within(rows[1]).getByTestId('helper-revoked-tag')).toHaveTextContent('Zugang entzogen');
      expect(within(rows[1]).queryByTestId('helper-revoke')).not.toBeInTheDocument();
      expect(screen.getByTestId('helper-list-count')).toHaveTextContent('1 Zugang');
      expect(screen.getByText(/nur entzogen, nie gelöscht/)).toBeInTheDocument();
    });

    it('@HE-084 Kein Rollenwechsel für Geräte außer „Nur zusehen“: es gibt weder „Co-Admin“ noch „Rolle ändern“', async () => {
      await open([], [member({})]);
      const row = screen.getByTestId('helper-row');
      const labels = within(row).getAllByRole('button').map((b) => b.textContent);
      expect(labels).toEqual(['Entziehen', 'Nur zusehen']);
    });
  });

  describe('Entziehen und Zuschauer (@HE-055, @HE-080)', () => {
    it('Entziehen: Rückfrage nennt Wirkung (3 Sekunden, bleibt im Verlauf, nicht gelöscht); „Zugang entziehen“ geht als revoke an den Server', async () => {
      const user = await open([], [member({ memberId: 'm1', name: 'Tom' })]);
      await user.click(screen.getByTestId('helper-revoke'));
      const dialog = await screen.findByTestId('access-dialog');
      expect(dialog).toHaveTextContent('Tom (Feld 2, Gerät Handy) kann danach nichts mehr eintragen.');
      expect(dialog).toHaveTextContent('innerhalb von 3 Sekunden „Du hast keinen Zugriff mehr“');
      expect(dialog).toHaveTextContent(/bleibt im Verlauf/);
      expect(dialog).toHaveTextContent(/entzogen, nicht gelöscht/);
      // Der Server entzieht; erst seine Liste (sofort neu geladen, nicht erst beim nächsten 2-s-Abruf) zeigt den Zugang als entzogen.
      rpc.list.mockResolvedValue(listOf([], [member({ memberId: 'm1', name: 'Tom', revokedAt: '2026-11-28T11:30:00Z' })]));
      await user.click(screen.getByTestId('helper-revoke-confirm'));
      await waitFor(() => expect(rpc.change).toHaveBeenCalledTimes(1));
      expect(rpc.change.mock.calls[0]?.slice(1)).toEqual(['m1', 'revoke']);
      expect(await screen.findByTestId('helper-revoked-tag')).toHaveTextContent('Zugang entzogen');
    });

    it('Entzug nur im Client gibt es nicht: lehnt der Server ab, bleibt die Zeile unverändert mit „Entziehen“', async () => {
      const user = await open([], [member({ memberId: 'm1', name: 'Tom' })]);
      rpc.change.mockResolvedValue({ ok: false, error: { kind: 'notAuthorized' } });
      await user.click(screen.getByTestId('helper-revoke'));
      await user.click(await screen.findByTestId('helper-revoke-confirm'));
      await waitFor(() => expect(rpc.change).toHaveBeenCalled());
      const row = await screen.findByTestId('helper-row');
      expect(row.dataset.state).toBe('helper');
      expect(within(row).getByTestId('helper-revoke')).toBeInTheDocument();
      expect(screen.queryByTestId('helper-revoked-tag')).not.toBeInTheDocument();
    });

    it('keine optimistische Anzeige: solange der Server nicht geantwortet hat, bleibt die Zeile unverändert; erst seine Liste zeigt „entzogen“', async () => {
      const user = await open([], [member({ memberId: 'm1', name: 'Tom' })]);
      let answer: (value: unknown) => void = () => undefined;
      rpc.change.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
      await user.click(screen.getByTestId('helper-revoke'));
      await user.click(await screen.findByTestId('helper-revoke-confirm'));
      await waitFor(() => expect(rpc.change).toHaveBeenCalledTimes(1));
      // Antwort ausstehend: nichts darf sich ändern (auch nicht „vorläufig“)
      await new Promise((r) => setTimeout(r, 50));
      const row = screen.getByTestId('helper-row');
      expect(row.dataset.state).toBe('helper');
      expect(screen.queryByTestId('helper-revoked-tag')).not.toBeInTheDocument();
      expect(within(row).getByTestId('helper-revoke')).toBeInTheDocument();
      // Server entzieht, seine Liste kommt
      rpc.list.mockResolvedValue(listOf([], [member({ memberId: 'm1', name: 'Tom', revokedAt: '2026-11-28T11:30:00Z' })]));
      answer({ ok: true, data: { result: 'OK' } });
      expect(await screen.findByTestId('helper-revoked-tag')).toBeInTheDocument();
    });

    it('keine optimistische Anzeige beim Zulassen: die Anfrage bleibt in der Liste, bis der Server geantwortet hat und seine Liste sie nicht mehr enthält', async () => {
      const user = await open([req('r1', 'Tom', 47)], []);
      let answer: (value: unknown) => void = () => undefined;
      rpc.decide.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
      await user.click(screen.getByTestId('request-approve'));
      await user.click(await screen.findByTestId('approve-number-47'));
      await waitFor(() => expect(rpc.decide).toHaveBeenCalledTimes(1));
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.getByTestId('join-request')).toBeInTheDocument();
      expect(screen.queryByTestId('helper-row')).not.toBeInTheDocument();
      rpc.list.mockResolvedValue(listOf([], [member({ memberId: 'm9', name: 'Tom', field: null })]));
      answer({ ok: true, data: { result: 'OK', memberId: 'm9' } });
      await waitFor(() => expect(screen.queryByTestId('join-request')).not.toBeInTheDocument());
      expect(screen.getByTestId('helper-row')).toHaveTextContent('Tom');
    });

    it('Gegenbeispiel: „Abbrechen“ im Entziehen-Dialog ruft den Server nicht an', async () => {
      const user = await open([], [member({})]);
      await user.click(screen.getByTestId('helper-revoke'));
      await user.click(await screen.findByTestId('access-cancel'));
      expect(rpc.change).not.toHaveBeenCalled();
    });

    it('@HE-055 Zeile 2: „Nur zusehen“ geht als watch_only an den Server', async () => {
      const user = await open([], [member({ memberId: 'm2', name: 'Clara', field: null, deviceLabel: 'tablet' })]);
      await user.click(screen.getByTestId('helper-viewer'));
      const dialog = await screen.findByTestId('access-dialog');
      expect(dialog).toHaveTextContent('Clara (ohne Feld, Gerät Tablet) kann danach nichts mehr eintragen.');
      expect(dialog).toHaveTextContent('„Du kannst nur noch zusehen“');
      await user.click(screen.getByTestId('helper-viewer-confirm'));
      await waitFor(() => expect(rpc.change).toHaveBeenCalled());
      expect(rpc.change.mock.calls[0]?.slice(1)).toEqual(['m2', 'watch_only']);
    });

    it('ein zum Zuschauer gemachtes Gerät trägt die Marke „Nur zusehen“ und bietet nicht noch einmal „Nur zusehen“ an', async () => {
      await open([], [member({ mode: 'viewer' })]);
      const row = screen.getByTestId('helper-row');
      expect(within(row).getByTestId('helper-viewer-tag')).toBeInTheDocument();
      expect(within(row).queryByTestId('helper-viewer')).not.toBeInTheDocument();
    });
  });

  describe('Ohne Netz (@HE-047)', () => {
    it('„Geht nur mit Netz“: Zulassen, Ablehnen, Entziehen, Nur zusehen und Code erneuern sind gesperrt, nichts wird vorgemerkt', async () => {
      rpc.list.mockResolvedValue(listOf([req('r1', 'Tom', 47)], [member({})]));
      const user = userEvent.setup();
      const view = render(<TeamHelpersCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />);
      await screen.findByTestId('helper-qr');
      await screen.findByTestId('request-approve');
      env.online = false; // das Gerät verliert das Netz, die Seite war schon geladen
      view.rerender(<TeamHelpersCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />);
      expect(screen.getByTestId('needs-network')).toHaveTextContent('Geht nur mit Netz');
      expect(screen.getByTestId('needs-network')).toHaveTextContent(/Nichts wird vorgemerkt/);
      expect(screen.getByTestId('needs-network')).toHaveTextContent(/Notübernahme/);
      for (const id of ['request-approve', 'request-decline', 'helper-revoke', 'helper-viewer', 'helper-code-renew']) {
        const button = screen.getByTestId(id);
        expect(button).toBeDisabled();
        await user.click(button);
      }
      expect(rpc.decide).not.toHaveBeenCalled();
      expect(rpc.change).not.toHaveBeenCalled();
      expect(rpc.rotate).not.toHaveBeenCalled();
      expect(screen.queryByTestId('approve-sheet')).not.toBeInTheDocument();
    });

    it('Ollis Gerät verliert das Netz: QR und Code bleiben sichtbar, dazu der Hinweis (Mockup r9)', async () => {
      rpc.list.mockResolvedValue(listOf([], []));
      const view = render(<TeamHelpersCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />);
      await screen.findByTestId('helper-qr');
      env.online = false;
      view.rerender(<TeamHelpersCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />);
      expect(await screen.findByTestId('needs-network')).toBeInTheDocument();
      expect(screen.getByTestId('helper-qr')).toBeInTheDocument();
      expect(screen.getByTestId('helper-code')).toHaveTextContent('K7MQ4X9R2P');
      expect(rpc.ensure).toHaveBeenCalledTimes(1);
    });

    it('Gegenbeispiel: erstes Laden ohne Netz und ohne Code – kein Code, aber der Hinweis „Geht nur mit Netz“; der Server wird für den Code nicht gefragt', async () => {
      env.online = false;
      rpc.list.mockResolvedValue(listOf([], []));
      render(<TeamHelpersCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />);
      expect(await screen.findByTestId('needs-network')).toHaveTextContent('Geht nur mit Netz');
      expect(screen.queryByTestId('helper-qr')).not.toBeInTheDocument();
      expect(rpc.ensure).not.toHaveBeenCalled();
    });

    it('Gegenbeispiel: mit Netz kein Hinweis „Geht nur mit Netz“', async () => {
      await open();
      expect(screen.queryByTestId('needs-network')).not.toBeInTheDocument();
    });
  });

  describe('Rechte (@HE-062)', () => {
    it('Gegenbeispiel: wer das Recht „Helfer verwalten“ nicht hat, sieht „Nur die Turnierleitung kann Helfer verwalten“ und weder Code noch Tasten; der Server wird nicht gefragt', async () => {
      env.canManage = false;
      render(<TeamHelpersCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />);
      expect(await screen.findByTestId('no-right')).toHaveTextContent('Nur die Turnierleitung kann Helfer verwalten');
      expect(screen.getByTestId('no-right')).toHaveTextContent('Dir fehlt das Recht „Helfer verwalten“.');
      expect(screen.queryByTestId('helper-code-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('request-approve')).not.toBeInTheDocument();
      expect(screen.queryByTestId('helper-revoke')).not.toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 30));
      expect(rpc.ensure).not.toHaveBeenCalled();
      expect(rpc.list).not.toHaveBeenCalled();
    });

    it('Solange die Rolle noch lädt, steht „Wird geladen“ statt „kein Recht“; der Server wird noch nicht gefragt', async () => {
      env.canManage = false;
      env.roleLoading = true;
      render(<TeamHelpersCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />);
      expect(await screen.findByTestId('role-loading')).toHaveTextContent('Wird geladen');
      expect(screen.queryByTestId('no-right')).not.toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 30));
      expect(rpc.ensure).not.toHaveBeenCalled();
      expect(rpc.list).not.toHaveBeenCalled();
    });

    it('Gegenbeispiel: antwortet der Server mit 42501 (Recht fehlt dort), erscheint derselbe Hinweis statt der Tasten', async () => {
      rpc.list.mockResolvedValue({ ok: false, error: { kind: 'notAuthorized' } });
      rpc.ensure.mockResolvedValue({ ok: false, error: { kind: 'notAuthorized' } });
      render(<TeamHelpersCategory tournamentId="t1" tournament={tournament} onTournamentUpdate={vi.fn()} />);
      expect(await screen.findByTestId('no-right')).toBeInTheDocument();
      expect(screen.queryByTestId('request-approve')).not.toBeInTheDocument();
    });
  });

  describe('Alte Einladungswege (@OB-005, @HE-063)', () => {
    it('die Seite bietet keinen Einladungslink an, nur den QR-Code', async () => {
      await open();
      expect(screen.queryByText(/Einladung/i)).not.toBeInTheDocument();
      expect(screen.getByTestId('helper-qr')).toBeInTheDocument();
    });
  });
});
