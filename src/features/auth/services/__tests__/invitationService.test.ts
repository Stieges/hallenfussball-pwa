/**
 * invitationService — Einladungen erstellen, prüfen, annehmen, deaktivieren (A-07h, Abdeckung features/auth).
 *
 * Supabase wird durch einen Query-Builder ersetzt, der Ergebnisse in Aufrufreihenfolge liefert.
 * Jeder Fall hat ein Gegenbeispiel (abgelaufen, verbraucht, Gast, Owner-Einladung, ...).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Res {
  data: unknown;
  error: { message: string } | null;
}

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (resolve: (value: Res) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
}

const state = vi.hoisted(() => ({
  configured: true,
  queue: [] as Array<Res | 'throw'>,
  builders: [] as unknown[],
}));

const fromMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/supabase', () => ({
  get supabase() {
    return state.configured ? { from: fromMock } : null;
  },
  get isSupabaseConfigured() {
    return state.configured;
  },
}));

function nextResult(): Res {
  const next = state.queue.shift();
  if (next === 'throw') {
    throw new Error('Netzwerk weg');
  }
  return next ?? { data: null, error: null };
}

function makeBuilder(): Builder {
  const b = {} as Builder;
  for (const m of ['select', 'eq', 'is', 'gt', 'insert', 'update'] as const) {
    b[m] = vi.fn(() => b);
  }
  b.single = vi.fn(async () => nextResult());
  b.then = (resolve, reject) => Promise.resolve().then(() => nextResult()).then(resolve, reject);
  state.builders.push(b);
  return b;
}

import {
  createInvitation,
  validateInvitation,
  acceptInvitation,
  deactivateInvitation,
  getActiveInvitationsForTournament,
  getInvitationByToken,
} from '../invitationService';

const FUTURE = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'inv-1',
    tournament_id: 't-1',
    user_id: null,
    invite_email: null,
    invite_code: 'TOKEN-1',
    role: 'trainer',
    team_ids: ['team-a'],
    label: 'Trainer Nord',
    max_uses: 1,
    use_count: 0,
    expires_at: FUTURE,
    invited_at: '2026-10-10T08:00:00Z',
    invited_by: 'owner-1',
    accepted_at: null,
    declined_at: null,
    created_at: '2026-10-10T08:00:00Z',
    allowed_fields: null,
    allowed_groups: null,
    ...overrides,
  };
}

describe('invitationService', () => {
  beforeEach(() => {
    state.configured = true;
    state.queue = [];
    state.builders = [];
    fromMock.mockReset();
    fromMock.mockImplementation(() => makeBuilder());
  });

  describe('createInvitation', () => {
    const base = { tournamentId: 't-1', role: 'trainer' as const, createdBy: 'owner-1' };

    it('verlangt einen angemeldeten Benutzer', async () => {
      expect(await createInvitation(base, null)).toEqual({ success: false, error: 'Nicht angemeldet' });
    });

    it('Gegenbeispiel: Gäste dürfen keine Einladungen erstellen', async () => {
      expect(await createInvitation(base, { id: 'g', globalRole: 'guest' })).toEqual({
        success: false,
        error: 'Gäste können keine Einladungen erstellen',
      });
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('Gegenbeispiel: eine Owner-Einladung wird abgelehnt', async () => {
      expect(
        await createInvitation({ ...base, role: 'owner' }, { id: 'owner-1', globalRole: 'user' })
      ).toEqual({ success: false, error: 'Owner-Einladungen sind nicht erlaubt' });
    });

    it('meldet ohne Supabase, dass Cloud-Funktionen fehlen', async () => {
      state.configured = false;

      expect(await createInvitation(base, { id: 'owner-1', globalRole: 'user' })).toEqual({
        success: false,
        error: 'Cloud-Funktionen sind nicht verfügbar',
      });
    });

    it('legt eine Einladung mit Code an und liefert den Einladungslink', async () => {
      state.queue = [{ data: row({ invite_code: 'CODE-ABC' }), error: null }];

      const result = await createInvitation({ ...base, label: 'Nord' }, { id: 'owner-1', globalRole: 'user' });

      expect(result.success).toBe(true);
      expect(result.invitation).toMatchObject({ id: 'inv-1', token: 'CODE-ABC', role: 'trainer' });
      expect(result.inviteLink).toMatch(/\/invite\?token=/);
      const code = result.inviteLink!.split('token=')[1];
      expect(code).toHaveLength(32);
    });

    it('Gegenbeispiel: ein Insert-Fehler wird mit der Originalmeldung zurückgegeben und liefert keinen Link', async () => {
      state.queue = [{ data: null, error: { message: 'Limit erreicht' } }];

      expect(await createInvitation(base, { id: 'owner-1', globalRole: 'user' })).toEqual({
        success: false,
        error: 'Limit erreicht',
      });
    });

    it('meldet eine Ausnahme als unerwarteten Fehler', async () => {
      state.queue = ['throw'];

      expect(await createInvitation(base, { id: 'owner-1', globalRole: 'user' })).toEqual({
        success: false,
        error: 'Ein unerwarteter Fehler ist aufgetreten',
      });
    });
  });

  describe('validateInvitation', () => {
    it('meldet not_found ohne Supabase', async () => {
      state.configured = false;

      expect(await validateInvitation('x')).toEqual({ valid: false, error: 'not_found' });
    });

    it('meldet not_found für einen unbekannten Code', async () => {
      state.queue = [{ data: null, error: { message: 'PGRST116' } }];

      expect(await validateInvitation('x')).toEqual({ valid: false, error: 'not_found' });
    });

    it('meldet already_used, wenn die Einladung schon einem Konto gehört', async () => {
      state.queue = [{ data: row({ user_id: 'u-9' }), error: null }];

      expect(await validateInvitation('TOKEN-1')).toEqual({ valid: false, error: 'already_used' });
    });

    it('meldet deactivated für eine zurückgezogene Einladung', async () => {
      state.queue = [{ data: row({ declined_at: '2026-10-11T00:00:00Z' }), error: null }];

      expect(await validateInvitation('TOKEN-1')).toEqual({ valid: false, error: 'deactivated' });
    });

    it('meldet expired für eine abgelaufene Einladung', async () => {
      state.queue = [{ data: row({ expires_at: PAST }), error: null }];

      expect(await validateInvitation('TOKEN-1')).toEqual({ valid: false, error: 'expired' });
    });

    it('meldet max_uses_reached, wenn alle Verwendungen aufgebraucht sind', async () => {
      state.queue = [{ data: row({ max_uses: 2, use_count: 2 }), error: null }];

      expect(await validateInvitation('TOKEN-1')).toEqual({ valid: false, error: 'max_uses_reached' });
    });

    it('liefert Einladung, Turnier und Einlader für eine gültige Einladung', async () => {
      state.queue = [
        { data: { ...row(), tournaments: { id: 't-1', title: 'Hallencup Ost' } }, error: null },
        { data: { id: 'owner-1', display_name: 'Anna' }, error: null },
      ];

      const result = await validateInvitation('TOKEN-1');

      expect(result).toMatchObject({
        valid: true,
        invitation: { id: 'inv-1', token: 'TOKEN-1', isActive: true },
        tournament: { id: 't-1', name: 'Hallencup Ost' },
        inviter: { id: 'owner-1', name: 'Anna' },
      });
    });

    it('Gegenbeispiel: ohne Einlader-Profil fehlt nur der Einlader, die Einladung bleibt gültig', async () => {
      state.queue = [
        { data: row(), error: null },
        { data: null, error: { message: 'nf' } },
      ];

      const result = await validateInvitation('TOKEN-1');

      expect(result.valid).toBe(true);
      expect(result.inviter).toBeUndefined();
      expect(result.tournament).toBeUndefined();
    });

    it('Gegenbeispiel: ohne Anzeigenamen des Einladers wird „Unknown“ eingesetzt', async () => {
      state.queue = [
        { data: row(), error: null },
        { data: { id: 'owner-1', display_name: null }, error: null },
      ];

      expect((await validateInvitation('TOKEN-1')).inviter).toEqual({ id: 'owner-1', name: 'Unknown' });
    });

    it('meldet not_found bei einer Ausnahme', async () => {
      state.queue = ['throw'];

      expect(await validateInvitation('TOKEN-1')).toEqual({ valid: false, error: 'not_found' });
    });
  });

  describe('acceptInvitation', () => {
    it('meldet ohne Supabase, dass Cloud-Funktionen fehlen', async () => {
      state.configured = false;

      expect(await acceptInvitation('TOKEN-1', 'u-2')).toEqual({
        success: false,
        error: 'Cloud-Funktionen sind nicht verfügbar',
      });
    });

    it('übernimmt den Grund der Prüfung, wenn die Einladung ungültig ist', async () => {
      state.queue = [{ data: row({ expires_at: PAST }), error: null }];

      expect(await acceptInvitation('TOKEN-1', 'u-2')).toEqual({ success: false, error: 'expired' });
    });

    it('Gegenbeispiel: wer schon Mitglied ist, wird nicht noch einmal eingetragen', async () => {
      state.queue = [
        { data: row(), error: null },
        { data: null, error: null },
        { data: { id: 'm-x' }, error: null },
      ];

      expect(await acceptInvitation('TOKEN-1', 'u-2')).toEqual({ success: false, error: 'already_member' });
    });

    it('nimmt die Einladung an und erhöht den Verbrauchszähler', async () => {
      state.queue = [
        { data: row({ use_count: 0 }), error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: row({ user_id: 'u-2', accepted_at: '2026-10-15T09:00:00Z', use_count: 1 }), error: null },
      ];

      const result = await acceptInvitation('TOKEN-1', 'u-2');

      expect(result.success).toBe(true);
      expect(result.membership).toMatchObject({ userId: 'u-2', role: 'trainer', tournamentId: 't-1' });
      const updateBuilder = state.builders[3] as Builder;
      expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u-2' }));
    });

    it('reicht die Meldung eines Update-Fehlers weiter', async () => {
      state.queue = [
        { data: row(), error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: { message: 'RLS' } },
      ];

      expect(await acceptInvitation('TOKEN-1', 'u-2')).toEqual({ success: false, error: 'RLS' });
    });

    it('meldet eine Ausnahme als unerwarteten Fehler', async () => {
      state.queue = [
        { data: row(), error: null },
        { data: null, error: null },
        'throw',
      ];

      expect(await acceptInvitation('TOKEN-1', 'u-2')).toEqual({
        success: false,
        error: 'Ein unerwarteter Fehler ist aufgetreten',
      });
    });
  });

  describe('deactivateInvitation', () => {
    it('gibt false ohne Supabase zurück', async () => {
      state.configured = false;

      expect(await deactivateInvitation('inv-1')).toBe(false);
    });

    it('deaktiviert nur offene Einladungen (user_id leer) und meldet Erfolg', async () => {
      state.queue = [{ data: null, error: null }];

      expect(await deactivateInvitation('inv-1')).toBe(true);
      const b = state.builders[0] as Builder;
      expect(b.update).toHaveBeenCalledWith({ declined_at: expect.any(String) });
      expect(b.is).toHaveBeenCalledWith('user_id', null);
    });

    it('Gegenbeispiel: ein Fehler beim Deaktivieren ergibt false', async () => {
      state.queue = [{ data: null, error: { message: 'x' } }];

      expect(await deactivateInvitation('inv-1')).toBe(false);
    });

    it('Gegenbeispiel: eine Ausnahme ergibt false', async () => {
      state.queue = ['throw'];

      expect(await deactivateInvitation('inv-1')).toBe(false);
    });
  });

  describe('getActiveInvitationsForTournament', () => {
    it('liefert leer ohne Supabase', async () => {
      state.configured = false;

      expect(await getActiveInvitationsForTournament('t-1')).toEqual([]);
    });

    it('filtert verbrauchte und unbegrenzt gültige Einladungen korrekt', async () => {
      state.queue = [
        {
          data: [
            row({ id: 'offen', max_uses: 2, use_count: 1 }),
            row({ id: 'verbraucht', max_uses: 1, use_count: 1 }),
            row({ id: 'unbegrenzt', max_uses: 0, use_count: 9 }),
          ],
          error: null,
        },
      ];

      const invitations = await getActiveInvitationsForTournament('t-1');

      expect(invitations.map((i) => i.id)).toEqual(['offen', 'unbegrenzt']);
    });

    it('Gegenbeispiel: eine Abfrage mit Fehler liefert keine Einladungen', async () => {
      state.queue = [{ data: null, error: { message: 'x' } }];

      expect(await getActiveInvitationsForTournament('t-1')).toEqual([]);
    });

    it('filtert Einladungen mit Ablaufdatum in der Vergangenheit über die Abfrage (gt expires_at)', async () => {
      state.queue = [{ data: [], error: null }];

      await getActiveInvitationsForTournament('t-1');

      const b = state.builders[0] as Builder;
      expect(b.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
    });
  });

  describe('getInvitationByToken', () => {
    it('liefert undefined ohne Supabase', async () => {
      state.configured = false;

      expect(await getInvitationByToken('TOKEN-1')).toBeUndefined();
    });

    it('liefert die Einladung zu einem Code', async () => {
      state.queue = [{ data: row(), error: null }];

      expect(await getInvitationByToken('TOKEN-1')).toMatchObject({ id: 'inv-1', token: 'TOKEN-1' });
    });

    it('Gegenbeispiel: ein unbekannter Code liefert undefined', async () => {
      state.queue = [{ data: null, error: { message: 'PGRST116' } }];

      expect(await getInvitationByToken('FALSCH')).toBeUndefined();
    });

    it('Gegenbeispiel: eine Ausnahme liefert undefined', async () => {
      state.queue = ['throw'];

      expect(await getInvitationByToken('TOKEN-1')).toBeUndefined();
    });
  });
});
