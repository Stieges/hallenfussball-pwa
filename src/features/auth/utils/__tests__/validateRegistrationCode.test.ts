/**
 * validateRegistrationCode — Client-Seite der Registrierungscode-Prüfung (A-07h, Abdeckung features/auth).
 *
 * Geprüft: nicht konfiguriert, Edge-Function-Fehler, leere Antwort, Ausnahme und der echte Erfolgsweg.
 * Jeder Fall hat ein Gegenbeispiel (ein gültiger Code darf bei Erfolg nicht als Fehler erscheinen).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({
  client: null as null | { functions: { invoke: ReturnType<typeof vi.fn> } },
}));

vi.mock('../../../../lib/supabase', () => ({
  get supabase() {
    return state.client;
  },
  isSupabaseConfigured: true,
}));

import { validateRegistrationCode } from '../validateRegistrationCode';

describe('validateRegistrationCode', () => {
  beforeEach(() => {
    state.client = { functions: { invoke: vi.fn() } };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    state.client = null;
    vi.restoreAllMocks();
  });

  it('meldet ohne konfiguriertes Supabase einen Verbindungs-Hinweis, ohne den Server zu rufen', async () => {
    state.client = null;

    expect(await validateRegistrationCode('ABC123')).toEqual({
      valid: false,
      error: 'Cloud-Validierung nicht verfügbar. Bitte prüfe deine Internetverbindung.',
    });
  });

  it('übergibt den Code im Body an die Edge Function validate-registration-code', async () => {
    state.client!.functions.invoke.mockResolvedValue({ data: { valid: true }, error: null });

    await validateRegistrationCode('ABC123');

    expect(state.client!.functions.invoke).toHaveBeenCalledWith('validate-registration-code', {
      body: { code: 'ABC123' },
    });
  });

  it('gibt die Antwort des Servers unverändert zurück, wenn der Code gültig ist', async () => {
    state.client!.functions.invoke.mockResolvedValue({ data: { valid: true }, error: null });

    expect(await validateRegistrationCode('ABC123')).toEqual({ valid: true });
  });

  it('Gegenbeispiel: ein abgelehnter Code kommt mit dem Grund des Servers zurück', async () => {
    state.client!.functions.invoke.mockResolvedValue({
      data: { valid: false, error: 'Code abgelaufen' },
      error: null,
    });

    expect(await validateRegistrationCode('ABC123')).toEqual({ valid: false, error: 'Code abgelaufen' });
  });

  it('meldet einen Fehler der Edge Function als Validierungsfehler', async () => {
    state.client!.functions.invoke.mockResolvedValue({ data: null, error: new Error('500') });

    expect(await validateRegistrationCode('ABC123')).toEqual({
      valid: false,
      error: 'Validierung fehlgeschlagen. Bitte versuche es erneut.',
    });
  });

  it('meldet eine leere Serverantwort als fehlende Antwort', async () => {
    state.client!.functions.invoke.mockResolvedValue({ data: null, error: null });

    expect(await validateRegistrationCode('ABC123')).toEqual({
      valid: false,
      error: 'Keine Antwort vom Server erhalten.',
    });
  });

  it('fängt eine Ausnahme beim Aufruf ab und meldet einen unerwarteten Fehler', async () => {
    state.client!.functions.invoke.mockRejectedValue(new Error('Netzwerk'));

    expect(await validateRegistrationCode('ABC123')).toEqual({
      valid: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
    });
  });
});
