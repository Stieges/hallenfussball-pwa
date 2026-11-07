/**
 * H3b-1: Client der Hallenton-Funktionen gegen den Vertrag aus `supabase/migrations/20261121_001_hallenton.sql`.
 * Werte aus dem Gherkin (`docs/anforderungen/2026-10-15_hallenton.md`): Olli bestimmt den Rechner der Turnierleitung als
 * Hallen-Lautsprecher für Feld 1 im „Hallencup Nord“, Tom leitet Feld 1 am Handy, ein Fremder kennt die Adresse (@HT-044).
 * Fehlerbild als Ergebnisart, nie ein Wurf: 42501 → kein_recht, 22023 → ungueltig, 55000 → turnier_beendet,
 * Netz/Zeitlimit → netz, unerwartete Antwort → antwort_unbekannt.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hallFieldLeadHeartbeat,
  hallOutputHeard,
  hallSoundSettingsSet,
  hallSoundStatus,
  hallSpeakerAssign,
  hallSpeakerHeartbeat,
  hallSpeakerRelease,
  hallTestToneAck,
  hallTestToneRequest,
} from '../hallentonRpc';
import { CLOUD_READ_TIMEOUT_MS } from '../cloudAdoption';

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function clientWith(result: RpcResult | (() => Promise<RpcResult>)) {
  const rpc = vi.fn(() => (typeof result === 'function' ? result() : Promise.resolve(result)));
  return { client: { rpc } as never, rpc };
}

const TID = '22222222-2222-4222-8222-222222222222';
const RECHNER = '11111111-1111-4111-8111-111111111111';
const TEST_ID = '33333333-3333-4333-8333-333333333333';
const JETZT = 1_794_000_000_000;

afterEach(() => {
  vi.useRealTimers();
});

describe('hallSpeakerAssign (hall_speaker_assign)', () => {
  const args = { p_tournament_id: TID, p_fields: [1], p_device_id: RECHNER, p_device_name: 'Rechner Turnierleitung' };

  it('@HT-001 der Rechner wird Hallen-Lautsprecher für Feld 1: sendet Felder, Gerät und Namen, liefert „assigned“', async () => {
    const { client, rpc } = clientWith({ data: { status: 'assigned', fields: [1], replaced: [] }, error: null });
    expect(await hallSpeakerAssign(client, args)).toEqual({ ok: true, status: 'assigned', fields: [1], replaced: [] });
    expect(rpc).toHaveBeenCalledWith('hall_speaker_assign', args);
  });

  it('@HT-015 Feld 1 hat schon einen Lautsprecher: ohne Ablösen „occupied“ mit dem Namen des anderen Geräts', async () => {
    const { client } = clientWith({ data: { status: 'occupied', fields: [{ field: 1, deviceName: 'Rechner Turnierleitung' }] }, error: null });
    expect(await hallSpeakerAssign(client, { ...args, p_device_name: 'Zweiter Rechner' })).toEqual({
      ok: true, status: 'occupied', fields: [{ field: 1, deviceName: 'Rechner Turnierleitung' }],
    });
  });

  it('@HT-015 mit Ablösen: das neue Gerät löst das alte ab, die Antwort nennt das abgelöste Gerät', async () => {
    const { client, rpc } = clientWith({ data: { status: 'assigned', fields: [1], replaced: [{ field: 1, deviceName: 'Rechner Turnierleitung' }] }, error: null });
    const ergebnis = await hallSpeakerAssign(client, { ...args, p_replace: true });
    expect(ergebnis).toEqual({ ok: true, status: 'assigned', fields: [1], replaced: [{ field: 1, deviceName: 'Rechner Turnierleitung' }] });
    expect(rpc).toHaveBeenCalledWith('hall_speaker_assign', { ...args, p_replace: true });
  });

  it('@HT-022 Helfer Tom kann am Server kein Gerät bestimmen (42501) → kein_recht', async () => {
    const { client } = clientWith({ data: null, error: { code: '42501', message: 'hallenton: not allowed' } });
    expect(await hallSpeakerAssign(client, args)).toEqual({ ok: false, grund: 'kein_recht' });
  });

  it('@HT-046 nach dem Turnierende lehnt der Server das Bestimmen ab (55000) → turnier_beendet', async () => {
    const { client } = clientWith({ data: null, error: { code: '55000', message: 'TOURNAMENT_FINISHED: Turnier ist abgeschlossen (hallenton, Turnier x).' } });
    expect(await hallSpeakerAssign(client, args)).toEqual({ ok: false, grund: 'turnier_beendet' });
  });

  it('Gegenbeispiel: ungültige Felder (22023) → ungueltig', async () => {
    const { client } = clientWith({ data: null, error: { code: '22023', message: 'hallenton: field out of range' } });
    expect(await hallSpeakerAssign(client, { ...args, p_fields: [7] })).toEqual({ ok: false, grund: 'ungueltig' });
  });
});

describe('hallSpeakerRelease (hall_speaker_release)', () => {
  it('@HT-038 Schalter wieder aus: nur die eigenen Felder entfallen, die Antwort nennt sie', async () => {
    const { client, rpc } = clientWith({ data: { status: 'released', fields: [1] }, error: null });
    const args = { p_tournament_id: TID, p_fields: [1, 2], p_device_id: RECHNER };
    expect(await hallSpeakerRelease(client, args)).toEqual({ ok: true, status: 'released', fields: [1] });
    expect(rpc).toHaveBeenCalledWith('hall_speaker_release', args);
  });
});

describe('hallSpeakerHeartbeat (hall_speaker_heartbeat)', () => {
  const args = { p_tournament_id: TID, p_device_id: RECHNER, p_fields: [1], p_state: 'ready' };

  it('@HT-047 ein starkes Anzeichen geht als p_output_changed mit dem Lebenszeichen an den Server', async () => {
    const { client, rpc } = clientWith({ data: { status: 'ok', serverNow: JETZT, fields: [{ field: 1, status: 'ok', test: null, lead: null }] }, error: null });
    await hallSpeakerHeartbeat(client, { ...args, p_output_changed: true });
    expect(rpc).toHaveBeenCalledWith('hall_speaker_heartbeat', { ...args, p_output_changed: true });
  });

  it('@HT-017 die Antwort trägt Serverzeit, offenen Testton und das Alter der Leitung je Feld', async () => {
    const data = {
      status: 'ok', serverNow: JETZT,
      fields: [{ field: 1, status: 'ok', test: { testId: TEST_ID, ageMs: 1200 }, lead: { ageMs: 3000 } }],
    };
    const { client } = clientWith({ data, error: null });
    expect(await hallSpeakerHeartbeat(client, args)).toEqual({ ok: true, ...data });
  });

  it('@HT-015 das abgelöste Gerät erfährt „superseded“, ein Feld ohne Lautsprecher „unassigned“', async () => {
    const data = {
      status: 'ok', serverNow: JETZT,
      fields: [
        { field: 1, status: 'superseded', test: null, lead: null },
        { field: 2, status: 'unassigned', test: null, lead: null },
      ],
    };
    const { client } = clientWith({ data, error: null });
    expect(await hallSpeakerHeartbeat(client, { ...args, p_fields: [1, 2] })).toEqual({ ok: true, ...data });
  });

  it('@HT-044 ein Fremder kann kein „bereit“ melden (42501) → kein_recht', async () => {
    const { client } = clientWith({ data: null, error: { code: '42501', message: 'hallenton: not allowed' } });
    expect(await hallSpeakerHeartbeat(client, args)).toEqual({ ok: false, grund: 'kein_recht' });
  });

  it('Gegenbeispiel: unbekannter Feldstatus in der Antwort → antwort_unbekannt (kein Ton nach geratener Antwort)', async () => {
    const { client } = clientWith({ data: { status: 'ok', serverNow: JETZT, fields: [{ field: 1, status: 'vielleicht', test: null, lead: null }] }, error: null });
    expect(await hallSpeakerHeartbeat(client, args)).toEqual({ ok: false, grund: 'antwort_unbekannt' });
  });

  it('Gegenbeispiel: Netzfehler → netz, nie ein Wurf', async () => {
    const { client } = clientWith(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await hallSpeakerHeartbeat(client, args)).toEqual({ ok: false, grund: 'netz' });
    expect(await hallSpeakerHeartbeat(null, args)).toEqual({ ok: false, grund: 'netz' });
  });

  it('Gegenbeispiel: Netzfehler ohne Wurf, wie supabase-js ihn liefert (code leer, „Failed to fetch“) → netz', async () => {
    const { client } = clientWith({ data: null, error: { code: '', message: 'TypeError: Failed to fetch' } });
    expect(await hallSpeakerHeartbeat(client, args)).toEqual({ ok: false, grund: 'netz' });
  });

  it('Gegenbeispiel: unbekannter Server-Code (Funktion fehlt, PGRST202) oder Prototyp-Schlüssel → antwort_unbekannt', async () => {
    expect(await hallSpeakerHeartbeat(clientWith({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }).client, args)).toEqual({ ok: false, grund: 'antwort_unbekannt' });
    expect(await hallSpeakerHeartbeat(clientWith({ data: null, error: { code: 'constructor', message: 'x' } }).client, args)).toEqual({ ok: false, grund: 'antwort_unbekannt' });
  });

  it('Gegenbeispiel: die Antwort hängt → nach dem Zeitlimit netz', async () => {
    vi.useFakeTimers();
    const { client } = clientWith(() => new Promise<RpcResult>(() => undefined));
    const laufend = hallSpeakerHeartbeat(client, args);
    await vi.advanceTimersByTimeAsync(CLOUD_READ_TIMEOUT_MS + 1);
    expect(await laufend).toEqual({ ok: false, grund: 'netz' });
  });
});

describe('hallFieldLeadHeartbeat (hall_field_lead_heartbeat)', () => {
  const args = { p_tournament_id: TID, p_field: 1, p_device_id: RECHNER };

  it('@HT-035 Toms Handy leitet Feld 1: Antwort mit Zustand, Alter und Hinweis des Lautsprechers', async () => {
    const data = { status: 'ok', serverNow: JETZT, speaker: { state: 'ready', ageMs: 2000, outputHint: true } };
    const { client, rpc } = clientWith({ data, error: null });
    expect(await hallFieldLeadHeartbeat(client, args)).toEqual({ ok: true, ...data });
    expect(rpc).toHaveBeenCalledWith('hall_field_lead_heartbeat', args);
  });

  it('@HT-016 Feld ohne Lautsprecher und Gerät ohne Steuer: „not_controller“ mit speaker null', async () => {
    const data = { status: 'not_controller', serverNow: JETZT, speaker: null };
    const { client } = clientWith({ data, error: null });
    expect(await hallFieldLeadHeartbeat(client, args)).toEqual({ ok: true, ...data });
  });

  it('@HT-040 Lautsprecher ohne Lebenszeichen: state und ageMs null', async () => {
    const data = { status: 'ok', serverNow: JETZT, speaker: { state: null, ageMs: null, outputHint: false } };
    const { client } = clientWith({ data, error: null });
    expect(await hallFieldLeadHeartbeat(client, args)).toEqual({ ok: true, ...data });
  });
});

describe('hallTestToneRequest / hallTestToneAck (Testton mit Quittung)', () => {
  it('@HT-017 Testton anfordern: Kennung und Serverzeit der Anforderung', async () => {
    const data = { status: 'requested', testId: TEST_ID, requestedAt: JETZT, serverNow: JETZT };
    const { client, rpc } = clientWith({ data, error: null });
    expect(await hallTestToneRequest(client, { p_tournament_id: TID, p_field: 1 })).toEqual({ ok: true, ...data });
    expect(rpc).toHaveBeenCalledWith('hall_test_tone_request', { p_tournament_id: TID, p_field: 1 });
  });

  it('@HT-017 zu schnell hintereinander: „too_soon“ mit Wartezeit; ohne Lautsprecher „no_speaker“', async () => {
    const zuFrueh = { status: 'too_soon', serverNow: JETZT, retryInMs: 1800 };
    expect(await hallTestToneRequest(clientWith({ data: zuFrueh, error: null }).client, { p_tournament_id: TID, p_field: 1 })).toEqual({ ok: true, ...zuFrueh });
    const ohne = { status: 'no_speaker', serverNow: JETZT };
    expect(await hallTestToneRequest(clientWith({ data: ohne, error: null }).client, { p_tournament_id: TID, p_field: 1 })).toEqual({ ok: true, ...ohne });
  });

  it('@HT-044 ein Fremder kann keinen Testton auslösen (42501) → kein_recht', async () => {
    const { client } = clientWith({ data: null, error: { code: '42501', message: 'hallenton: not allowed' } });
    expect(await hallTestToneRequest(client, { p_tournament_id: TID, p_field: 1 })).toEqual({ ok: false, grund: 'kein_recht' });
  });

  it('@HT-017 Quittung nach dem Abspielen: „acked“ mit Serverzeit; fremde Kennung „unknown_test“; abgelöst „superseded“', async () => {
    const args = { p_tournament_id: TID, p_field: 1, p_device_id: RECHNER, p_test_id: TEST_ID };
    const { client, rpc } = clientWith({ data: { status: 'acked', playedAt: JETZT }, error: null });
    expect(await hallTestToneAck(client, args)).toEqual({ ok: true, status: 'acked', playedAt: JETZT });
    expect(rpc).toHaveBeenCalledWith('hall_test_tone_ack', args);
    expect(await hallTestToneAck(clientWith({ data: { status: 'unknown_test' }, error: null }).client, args)).toEqual({ ok: true, status: 'unknown_test' });
    expect(await hallTestToneAck(clientWith({ data: { status: 'superseded' }, error: null }).client, args)).toEqual({ ok: true, status: 'superseded' });
  });
});

describe('hallOutputHeard (hall_output_heard)', () => {
  it('@HT-049 „✓ Gehört“ nimmt den Hinweis weg: „heard“; ohne Lautsprecher „no_speaker“', async () => {
    const { client, rpc } = clientWith({ data: { status: 'heard' }, error: null });
    expect(await hallOutputHeard(client, { p_tournament_id: TID, p_field: 1 })).toEqual({ ok: true, status: 'heard' });
    expect(rpc).toHaveBeenCalledWith('hall_output_heard', { p_tournament_id: TID, p_field: 1 });
    expect(await hallOutputHeard(clientWith({ data: { status: 'no_speaker' }, error: null }).client, { p_tournament_id: TID, p_field: 1 })).toEqual({ ok: true, status: 'no_speaker' });
  });
});

describe('hallSoundSettingsSet (hall_sound_settings_set)', () => {
  it('@HT-025 Halbzeit „Hupe 1“ ohne eigenen Ton: sendet die Pfade ausdrücklich als null', async () => {
    const { client, rpc } = clientWith({ data: { status: 'saved' }, error: null });
    const args = { p_tournament_id: TID, p_halftime_sound: 'horn-1', p_halftime_custom_path: null, p_end_custom_path: null, p_goal_tone_fields: [] };
    expect(await hallSoundSettingsSet(client, args)).toEqual({ ok: true, status: 'saved' });
    expect(rpc).toHaveBeenCalledWith('hall_sound_settings_set', args);
  });

  it('@HT-028 ungeeigneter Pfad (22023) → ungueltig', async () => {
    const { client } = clientWith({ data: null, error: { code: '22023', message: 'hallenton: settings invalid' } });
    const args = { p_tournament_id: TID, p_halftime_sound: 'custom', p_halftime_custom_path: 'x.ogg', p_end_custom_path: null, p_goal_tone_fields: [] };
    expect(await hallSoundSettingsSet(client, args)).toEqual({ ok: false, grund: 'ungueltig' });
  });
});

describe('hallSoundStatus (hall_sound_status)', () => {
  const voll = {
    serverNow: JETZT,
    closed: false,
    speakers: [{
      field: 1, deviceName: 'Rechner Turnierleitung', isThisDevice: true, state: 'ready', assignedAt: JETZT - 60_000,
      outputHint: true, hintAt: JETZT - 5000, lastSeen: JETZT - 2000, ageMs: 2000,
      test: { testId: TEST_ID, requestedAt: JETZT - 9000, playedAt: null },
    }, {
      field: 2, deviceName: 'Zweiter Rechner', isThisDevice: false, state: null, assignedAt: JETZT - 1000,
      outputHint: false, hintAt: null, lastSeen: null, ageMs: null, test: null,
    }],
    leads: [{ field: 1, ageMs: 4000 }],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [] },
  };

  it('@HT-039 Turnierleitung: volle Sicht mit Gerätename, Zustand, Alter, Hinweis, Testton, Leitung und Tonwahl', async () => {
    const { client, rpc } = clientWith({ data: voll, error: null });
    expect(await hallSoundStatus(client, { p_tournament_id: TID, p_device_id: RECHNER })).toEqual({ ok: true, sicht: 'voll', ...voll });
    expect(rpc).toHaveBeenCalledWith('hall_sound_status', { p_tournament_id: TID, p_device_id: RECHNER });
  });

  it('@HT-050 Helfer Tom: schmale Sicht ohne Gerätename, Testton und Tonwahl', async () => {
    const schmal = { serverNow: JETZT, speakers: [{ field: 1, state: 'ready', ageMs: 2000, outputHint: true }] };
    const { client } = clientWith({ data: schmal, error: null });
    expect(await hallSoundStatus(client, { p_tournament_id: TID })).toEqual({ ok: true, sicht: 'schmal', ...schmal });
  });

  it('@HT-041 ohne Netz: netz (die Oberfläche zeigt „Status unbekannt“, nie einen alten Stand als frisch)', async () => {
    const { client } = clientWith(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await hallSoundStatus(client, { p_tournament_id: TID })).toEqual({ ok: false, grund: 'netz' });
  });

  it('@HT-022 ohne Recht (42501) → kein_recht', async () => {
    const { client } = clientWith({ data: null, error: { code: '42501', message: 'hallenton: not allowed' } });
    expect(await hallSoundStatus(client, { p_tournament_id: TID })).toEqual({ ok: false, grund: 'kein_recht' });
  });

  it('Gegenbeispiel: Zustand außerhalb der festen Liste → antwort_unbekannt', async () => {
    const kaputt = { serverNow: JETZT, speakers: [{ field: 1, state: 'fast_bereit', ageMs: 1, outputHint: false }] };
    expect(await hallSoundStatus(clientWith({ data: kaputt, error: null }).client, { p_tournament_id: TID })).toEqual({ ok: false, grund: 'antwort_unbekannt' });
  });
});
