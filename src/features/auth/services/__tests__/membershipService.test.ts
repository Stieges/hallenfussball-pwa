/**
 * membershipService — Mitglieder, Rollen, Trainer-Teams, Entfernen, Ownership (A-07h, Abdeckung features/auth).
 *
 * Supabase wird durch einen Query-Builder ersetzt, der die Ergebnisse in Aufrufreihenfolge liefert.
 * Jeder Fall hat ein Gegenbeispiel (was NICHT erlaubt sein darf bzw. kein Erfolg sein darf).
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
  not: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (resolve: (value: Res) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
}

const state = vi.hoisted(() => ({
  configured: true,
  queue: [] as Array<{ data: unknown; error: { message: string } | null } | 'throw'>,
  builders: [] as unknown[],
}));

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
  for (const m of ['select', 'eq', 'is', 'not', 'insert', 'update', 'delete'] as const) {
    b[m] = vi.fn(() => b);
  }
  b.single = vi.fn(async () => nextResult());
  b.then = (resolve, reject) => Promise.resolve().then(() => nextResult()).then(resolve, reject);
  state.builders.push(b);
  return b;
}

const fromMock = vi.fn(() => makeBuilder());

import {
  createOwnerMembership,
  getTournamentMembers,
  getUserMembership,
  changeRole,
  updateTrainerTeams,
  removeMember,
  transferOwnership,
  getCoAdmins,
  MembersUnknownError,
} from '../membershipService';

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'm-1',
    tournament_id: 't-1',
    user_id: 'u-1',
    invite_email: null,
    invite_code: null,
    role: 'trainer',
    team_ids: ['team-a'],
    label: null,
    max_uses: null,
    use_count: null,
    expires_at: null,
    invited_at: null,
    invited_by: null,
    accepted_at: '2026-10-01T10:00:00Z',
    declined_at: null,
    created_at: '2026-10-01T09:00:00Z',
    allowed_fields: null,
    allowed_groups: null,
    ...overrides,
  };
}

const OWNER = row({ id: 'm-owner', user_id: 'me', role: 'owner', team_ids: [] });

describe('membershipService', () => {
  beforeEach(() => {
    state.configured = true;
    state.queue = [];
    state.builders = [];
    fromMock.mockClear();
  });

  describe('createOwnerMembership', () => {
    it('liefert undefined ohne konfiguriertes Supabase, ohne eine Abfrage abzusetzen', async () => {
      state.configured = false;

      expect(await createOwnerMembership('t-1', 'me')).toBeUndefined();
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('legt den Owner als sofort angenommene Mitgliedschaft an', async () => {
      state.queue = [{ data: row({ id: 'new', user_id: 'me', role: 'owner', team_ids: [] }), error: null }];

      const membership = await createOwnerMembership('t-1', 'me');

      expect(membership).toMatchObject({ id: 'new', userId: 'me', role: 'owner', tournamentId: 't-1' });
    });

    it('Gegenbeispiel: ein Insert-Fehler ergibt keine Mitgliedschaft', async () => {
      state.queue = [{ data: null, error: { message: 'duplicate' } }];

      expect(await createOwnerMembership('t-1', 'me')).toBeUndefined();
    });

    it('Gegenbeispiel: eine Ausnahme beim Insert ergibt keine Mitgliedschaft', async () => {
      state.queue = ['throw'];

      expect(await createOwnerMembership('t-1', 'me')).toBeUndefined();
    });
  });

  describe('getTournamentMembers', () => {
    it('liefert eine leere Liste ohne Supabase', async () => {
      state.configured = false;

      expect(await getTournamentMembers('t-1')).toEqual([]);
    });

    it('liefert nur die übergebenen Mitglieder zugeordnet', async () => {
      state.queue = [{ data: [row(), row({ id: 'm-2', user_id: 'u-2', role: 'co-admin' })], error: null }];

      const members = await getTournamentMembers('t-1');

      expect(members.map((m) => [m.id, m.role])).toEqual([
        ['m-1', 'trainer'],
        ['m-2', 'co-admin'],
      ]);
    });

    // Gegenteil-Pin umgeschrieben (Review A-11 A4, @FU-100): früher „Fehler → leere Liste“. Eine leere Liste hieße
    // „kein Mitglied“ – eine gescheiterte Abfrage ist aber „unbekannt“, nicht „kein Recht“.
    it('@FU-100 Gegenbeispiel: ein Fehler der Abfrage meldet „unbekannt“ statt einer leeren Liste oder eines Teilergebnisses', async () => {
      state.queue = [{ data: null, error: { message: 'boom' } }];

      await expect(getTournamentMembers('t-1')).rejects.toBeInstanceOf(MembersUnknownError);
    });

    it('@FU-100 Gegenbeispiel: eine Ausnahme (kein Netz) meldet „unbekannt“ statt einer leeren Liste', async () => {
      state.queue = ['throw'];

      await expect(getTournamentMembers('t-1')).rejects.toBeInstanceOf(MembersUnknownError);
    });
  });

  describe('getUserMembership', () => {
    it('liefert die Mitgliedschaft des Users im Turnier', async () => {
      state.queue = [{ data: row({ user_id: 'me', role: 'co-admin' }), error: null }];

      expect(await getUserMembership('t-1', 'me')).toMatchObject({ userId: 'me', role: 'co-admin' });
    });

    it('Gegenbeispiel: ohne Treffer (Fehler oder keine Zeile) ist die Antwort undefined', async () => {
      state.queue = [{ data: null, error: { message: 'PGRST116' } }];

      expect(await getUserMembership('t-1', 'fremd')).toBeUndefined();
    });

    it('Gegenbeispiel: ohne Supabase ist die Antwort undefined', async () => {
      state.configured = false;

      expect(await getUserMembership('t-1', 'me')).toBeUndefined();
    });

    it('Gegenbeispiel: eine Ausnahme ist undefined', async () => {
      state.queue = ['throw'];

      expect(await getUserMembership('t-1', 'me')).toBeUndefined();
    });
  });

  describe('changeRole', () => {
    it('verlangt einen angemeldeten Benutzer', async () => {
      expect(await changeRole('m-1', 'trainer', '')).toEqual({ success: false, error: 'Nicht angemeldet' });
    });

    it('meldet ohne Supabase, dass Cloud-Funktionen fehlen', async () => {
      state.configured = false;

      expect(await changeRole('m-1', 'trainer', 'me')).toEqual({
        success: false,
        error: 'Cloud-Funktionen sind nicht verfügbar',
      });
    });

    it('meldet ein unbekanntes Mitglied', async () => {
      state.queue = [{ data: null, error: { message: 'not found' } }];

      expect(await changeRole('m-x', 'trainer', 'me')).toEqual({ success: false, error: 'Mitglied nicht gefunden' });
    });

    it('verweigert, wenn der Aufrufer nicht Mitglied des Turniers ist', async () => {
      state.queue = [
        { data: row({ role: 'viewer' }), error: null },
        { data: null, error: { message: 'PGRST116' } },
      ];

      expect(await changeRole('m-1', 'trainer', 'me')).toEqual({ success: false, error: 'Keine Berechtigung' });
    });

    it('Gegenbeispiel: ein Trainer darf keine Rollen ändern', async () => {
      state.queue = [
        { data: row({ role: 'viewer' }), error: null },
        { data: row({ id: 'm-me', user_id: 'me', role: 'trainer' }), error: null },
      ];

      expect(await changeRole('m-1', 'trainer', 'me')).toEqual({
        success: false,
        error: 'Keine Berechtigung für diese Aktion',
      });
    });

    it('Gegenbeispiel: der Owner selbst kann nicht geändert werden', async () => {
      state.queue = [
        { data: row({ id: 'm-owner', role: 'owner' }), error: null },
        { data: OWNER, error: null },
      ];

      expect(await changeRole('m-owner', 'trainer', 'me')).toEqual({
        success: false,
        error: 'Keine Berechtigung für diese Aktion',
      });
    });

    it('verweigert die Vergabe der Owner-Rolle', async () => {
      state.queue = [
        { data: row({ role: 'viewer' }), error: null },
        { data: OWNER, error: null },
      ];

      expect(await changeRole('m-1', 'owner', 'me')).toEqual({
        success: false,
        error: 'Diese Rolle kann nicht vergeben werden',
      });
    });

    it('ändert die Rolle eines Mitglieds als Owner und liefert die aktualisierte Mitgliedschaft', async () => {
      state.queue = [
        { data: row({ role: 'viewer', team_ids: [] }), error: null },
        { data: OWNER, error: null },
        { data: row({ role: 'trainer', team_ids: ['team-b'] }), error: null },
      ];

      const result = await changeRole('m-1', 'trainer', 'me', ['team-b']);

      expect(result.success).toBe(true);
      expect(result.membership).toMatchObject({ role: 'trainer', teamIds: ['team-b'] });
      const updateBuilder = state.builders[2] as Builder;
      expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ role: 'trainer' }));
    });

    it('Gegenbeispiel: ein Nicht-Trainer-Ziel bekommt keine Teams zugeordnet', async () => {
      state.queue = [
        { data: row({ role: 'trainer', team_ids: ['team-a'] }), error: null },
        { data: OWNER, error: null },
        { data: row({ role: 'viewer', team_ids: [] }), error: null },
      ];

      await changeRole('m-1', 'viewer', 'me', ['team-b']);

      const updateBuilder = state.builders[2] as Builder;
      expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ role: 'viewer' }));
      expect(JSON.stringify(updateBuilder.update.mock.calls[0])).not.toContain('team-b');
    });

    it('reicht einen Update-Fehler mit der Originalmeldung weiter', async () => {
      state.queue = [
        { data: row({ role: 'viewer' }), error: null },
        { data: OWNER, error: null },
        { data: null, error: { message: 'RLS verweigert' } },
      ];

      expect(await changeRole('m-1', 'trainer', 'me')).toEqual({ success: false, error: 'RLS verweigert' });
    });

    it('meldet eine Ausnahme als unerwarteten Fehler', async () => {
      state.queue = ['throw'];

      expect(await changeRole('m-1', 'trainer', 'me')).toEqual({
        success: false,
        error: 'Ein unerwarteter Fehler ist aufgetreten',
      });
    });
  });

  describe('updateTrainerTeams', () => {
    it('verlangt einen angemeldeten Benutzer', async () => {
      expect(await updateTrainerTeams('m-1', ['a'], '')).toEqual({ success: false, error: 'Nicht angemeldet' });
    });

    it('lehnt Team-Zuordnungen für Nicht-Trainer ab', async () => {
      state.queue = [{ data: row({ role: 'co-admin' }), error: null }];

      expect(await updateTrainerTeams('m-1', ['a'], 'me')).toEqual({
        success: false,
        error: 'Nur Trainer haben Team-Zuordnungen',
      });
    });

    it('Gegenbeispiel: ein Trainer darf die Teams eines Trainers nicht ändern', async () => {
      state.queue = [
        { data: row({ role: 'trainer' }), error: null },
        { data: row({ id: 'm-me', user_id: 'me', role: 'trainer' }), error: null },
      ];

      expect(await updateTrainerTeams('m-1', ['a'], 'me')).toEqual({ success: false, error: 'Keine Berechtigung' });
    });

    it('erlaubt dem Co-Admin das Setzen der Teams und liefert die Mitgliedschaft', async () => {
      state.queue = [
        { data: row({ role: 'trainer' }), error: null },
        { data: row({ id: 'm-me', user_id: 'me', role: 'co-admin' }), error: null },
        { data: row({ role: 'trainer', team_ids: ['team-c'] }), error: null },
      ];

      const result = await updateTrainerTeams('m-1', ['team-c'], 'me');

      expect(result.success).toBe(true);
      expect(result.membership?.teamIds).toEqual(['team-c']);
    });

    it('reicht einen Update-Fehler weiter', async () => {
      state.queue = [
        { data: row({ role: 'trainer' }), error: null },
        { data: OWNER, error: null },
        { data: null, error: { message: 'Constraint' } },
      ];

      expect(await updateTrainerTeams('m-1', ['a'], 'me')).toEqual({ success: false, error: 'Constraint' });
    });
  });

  describe('removeMember', () => {
    it('gibt false ohne Benutzer oder ohne Supabase zurück', async () => {
      expect(await removeMember('m-1', '')).toBe(false);
      state.configured = false;
      expect(await removeMember('m-1', 'me')).toBe(false);
    });

    it('gibt false für unbekannte Mitglieder zurück', async () => {
      state.queue = [{ data: null, error: { message: 'nf' } }];

      expect(await removeMember('m-x', 'me')).toBe(false);
    });

    it('Gegenbeispiel: der Owner kann nie entfernt werden', async () => {
      state.queue = [{ data: row({ id: 'm-owner', role: 'owner' }), error: null }];

      expect(await removeMember('m-owner', 'me')).toBe(false);
      expect(fromMock).toHaveBeenCalledTimes(1);
    });

    it('gibt false, wenn der Aufrufer nicht Mitglied ist', async () => {
      state.queue = [
        { data: row({ role: 'trainer' }), error: null },
        { data: null, error: { message: 'nf' } },
      ];

      expect(await removeMember('m-1', 'fremd')).toBe(false);
    });

    it('Gegenbeispiel: ein Trainer darf niemanden entfernen', async () => {
      state.queue = [
        { data: row({ role: 'viewer' }), error: null },
        { data: row({ id: 'm-me', user_id: 'me', role: 'trainer' }), error: null },
      ];

      expect(await removeMember('m-1', 'me')).toBe(false);
    });

    it('entfernt das Mitglied als Owner und meldet Erfolg', async () => {
      state.queue = [
        { data: row({ role: 'viewer' }), error: null },
        { data: OWNER, error: null },
        { data: null, error: null },
      ];

      expect(await removeMember('m-1', 'me')).toBe(true);
      const deleteBuilder = state.builders[2] as Builder;
      expect(deleteBuilder.delete).toHaveBeenCalled();
    });

    it('gibt false bei einem Löschfehler', async () => {
      state.queue = [
        { data: row({ role: 'viewer' }), error: null },
        { data: OWNER, error: null },
        { data: null, error: { message: 'RLS' } },
      ];

      expect(await removeMember('m-1', 'me')).toBe(false);
    });

    it('gibt false bei einer Ausnahme', async () => {
      state.queue = ['throw'];

      expect(await removeMember('m-1', 'me')).toBe(false);
    });
  });

  describe('transferOwnership', () => {
    it('verlangt einen angemeldeten Benutzer und Supabase', async () => {
      expect(await transferOwnership('t-1', 'u-2', '')).toEqual({ success: false, error: 'Nicht angemeldet' });
      state.configured = false;
      expect(await transferOwnership('t-1', 'u-2', 'me')).toEqual({
        success: false,
        error: 'Cloud-Funktionen sind nicht verfügbar',
      });
    });

    it('verweigert, wenn der Aufrufer nicht Mitglied ist', async () => {
      state.queue = [{ data: null, error: { message: 'nf' } }];

      expect(await transferOwnership('t-1', 'u-2', 'fremd')).toEqual({
        success: false,
        error: 'Nicht Mitglied dieses Turniers',
      });
    });

    it('Gegenbeispiel: nur der Owner darf Ownership übertragen', async () => {
      state.queue = [{ data: row({ user_id: 'me', role: 'co-admin' }), error: null }];

      expect(await transferOwnership('t-1', 'u-2', 'me')).toEqual({
        success: false,
        error: 'Nur der Owner kann Ownership übertragen',
      });
    });

    it('verweigert, wenn der Zielnutzer nicht Mitglied ist', async () => {
      state.queue = [
        { data: OWNER, error: null },
        { data: null, error: { message: 'nf' } },
      ];

      expect(await transferOwnership('t-1', 'u-2', 'me')).toEqual({
        success: false,
        error: 'Ziel-User ist nicht Mitglied',
      });
    });

    it('Gegenbeispiel: ein Trainer ist kein gültiges Ziel für Ownership', async () => {
      state.queue = [
        { data: OWNER, error: null },
        { data: row({ user_id: 'u-2', role: 'trainer' }), error: null },
      ];

      expect(await transferOwnership('t-1', 'u-2', 'me')).toEqual({
        success: false,
        error: 'Ownership kann nur an Co-Admins übertragen werden',
      });
    });

    it('überträgt Ownership: alter Owner wird Co-Admin, Ziel wird Owner', async () => {
      state.queue = [
        { data: OWNER, error: null },
        { data: row({ id: 'm-2', user_id: 'u-2', role: 'co-admin' }), error: null },
        { data: row({ id: 'm-owner', role: 'co-admin' }), error: null },
        { data: row({ id: 'm-2', user_id: 'u-2', role: 'owner' }), error: null },
      ];

      const result = await transferOwnership('t-1', 'u-2', 'me');

      expect(result.success).toBe(true);
      expect(result.oldOwnerMembership?.role).toBe('co-admin');
      expect(result.newOwnerMembership?.role).toBe('owner');
      expect((state.builders[2] as Builder).update).toHaveBeenCalledWith({ role: 'co-admin' });
      expect((state.builders[3] as Builder).update).toHaveBeenCalledWith({ role: 'owner' });
    });

    it('Gegenbeispiel: schlägt das Setzen des neuen Owners fehl, wird der alte Owner zurückgesetzt', async () => {
      state.queue = [
        { data: OWNER, error: null },
        { data: row({ id: 'm-2', user_id: 'u-2', role: 'co-admin' }), error: null },
        { data: row({ id: 'm-owner', role: 'co-admin' }), error: null },
        { data: null, error: { message: 'Zielzeile gesperrt' } },
        { data: null, error: null },
      ];

      const result = await transferOwnership('t-1', 'u-2', 'me');

      expect(result).toEqual({ success: false, error: 'Zielzeile gesperrt' });
      const rollback = state.builders[4] as Builder;
      expect(rollback.update).toHaveBeenCalledWith({ role: 'owner' });
    });

    it('meldet einen Fehler beim Setzen des alten Owners und ändert den neuen Owner nicht', async () => {
      state.queue = [
        { data: OWNER, error: null },
        { data: row({ id: 'm-2', user_id: 'u-2', role: 'co-admin' }), error: null },
        { data: null, error: { message: 'alt gesperrt' } },
      ];

      expect(await transferOwnership('t-1', 'u-2', 'me')).toEqual({ success: false, error: 'alt gesperrt' });
      expect(state.builders).toHaveLength(3);
    });
  });

  describe('getCoAdmins', () => {
    it('liefert nur Co-Admins', async () => {
      state.queue = [{ data: [row({ role: 'co-admin' })], error: null }];

      const admins = await getCoAdmins('t-1');

      expect(admins.map((a) => a.role)).toEqual(['co-admin']);
    });

    it('Gegenbeispiel: ein Fehler ergibt eine leere Liste', async () => {
      state.queue = [{ data: null, error: { message: 'x' } }];

      expect(await getCoAdmins('t-1')).toEqual([]);
    });

    it('Gegenbeispiel: ohne Supabase ist die Liste leer', async () => {
      state.configured = false;

      expect(await getCoAdmins('t-1')).toEqual([]);
    });
  });
});
