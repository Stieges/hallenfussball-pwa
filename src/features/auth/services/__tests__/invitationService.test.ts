/**
 * invitationService — Einladungen erstellen, deaktivieren, auflisten (Annehmen/Prüfen entfällt seit A-17b) (A-07h, Abdeckung features/auth).
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
  deactivateInvitation,
  getActiveInvitationsForTournament,
} from '../invitationService';

const FUTURE = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

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
      // Der gespeicherte Code ist genau der Token im Link (sonst liefe der Link ins Leere).
      const insertBuilder = state.builders[0] as Builder;
      expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ invite_code: code }));
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
});
