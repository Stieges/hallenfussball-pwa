/**
 * H3b-3 Fixrunde 1 – der Client gegen die echten RPCs der Migration 20261121_001_hallenton.sql (Wegwerf-Container aus
 * `scripts/hallenton-client-check.sh`; ohne `HALLENTON_ECHT_CONTAINER` übersprungen). Jede RPC läuft per `docker exec … psql`
 * als Rolle authenticated mit JWT-Claims; die jsonb-Antwort geht unverändert durch die zod-Prüfung von `hallentonRpc.ts`.
 * Nachweise: Lebenszeichen nach Turnierende (@HT-046, 55000 seit 20261123_001), `getDeviceId()` als UUID, volle/schmale Sicht (@HT-039, @HT-040),
 * Lebenszeichen → Testton → Quittung (@HT-017); H4-6: das echte Lebenszeichen sendet `output_lost` und `output_unconfirmed`
 * (@HT-054, @HT-055), der Server nimmt sie an, sie sind in `hall_sound_status` (voll und schmal) und in der Antwort der Leitung
 * lesbar, und Name und Kennung des Ausgangs stehen nirgends am Server.
 */
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { getDeviceId } from '../../../core/device/deviceId';
import {
  hallFieldLeadHeartbeat, hallSoundStatus, hallSpeakerAssign, hallSpeakerHeartbeat, hallSpeakerUnassign, hallTestToneAck, hallTestToneRequest,
} from '../../../core/repositories/hallentonRpc';
import { FalscheMedienGeraete, AUSGAENGE } from '../../../test/hallenton/falscheMedienGeraete';
import { FalscherSpeicher } from '../../../test/hallenton/falschesGeraet';
import { AUSGANG_SCHLUESSEL } from '../runtime/ausgang/ausgangWahl';
import { erzeugeGeraeteSperre } from '../runtime/geraeteSperre';
import { erzeugeLebenszeichen, MELDE_SPERRE_NAME } from '../runtime/lautsprecherLebenszeichen';
import { Tab } from '../runtime/__tests__/laufzeitTestlage';

const C = process.env.HALLENTON_ECHT_CONTAINER ?? '';
const TID = process.env.HALLENTON_ECHT_TURNIER ?? '';
const OLLI = process.env.HALLENTON_ECHT_OLLI ?? '';
const MIA = process.env.HALLENTON_ECHT_MIA ?? '';
/** Ausgaben für den Bericht (stdout des Prüfskripts). */
const protokoll = (text: string): void => { process.stdout.write(`${text}\n`); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Client = Parameters<typeof hallSoundStatus>[0];

function psql(sql: string): string {
  return execFileSync('docker', ['exec', '-i', C, 'psql', '-U', 'postgres', '-X', '-q', '-tA', '-v', 'ON_ERROR_STOP=1'], { input: sql, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
}

function sqlWert(v: unknown): string {
  if (v === null || v === undefined) {
    return 'NULL';
  }
  if (typeof v === 'boolean' || typeof v === 'number') {
    return String(v);
  }
  if (Array.isArray(v)) {
    return `ARRAY[${v.map(sqlWert).join(',')}]::int[]`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Ausschnitt `rpc` wie supabase-js: `{ data, error: { code } }`. */
function client(uid: string): Client {
  const rpc = (fn: string, args: Record<string, unknown>) => {
    const benannt = Object.entries(args).map(([k, v]) => `${k} => ${sqlWert(v)}`).join(', ');
    const sql = `\\set VERBOSITY verbose\nBEGIN;\nSET LOCAL ROLE authenticated;\nSET LOCAL request.jwt.claim.sub = '${uid}';\n`
      + `SET LOCAL request.jwt.claims = '{"sub":"${uid}","role":"authenticated","is_anonymous":false}';\n`
      + `SELECT 'j:' || public.${fn}(${benannt})::text;\nCOMMIT;\n`;
    try {
      const zeile = psql(sql).split('\n').find((z) => z.startsWith('j:')) ?? 'j:null';
      return Promise.resolve({ data: JSON.parse(zeile.slice(2)) as unknown, error: null });
    } catch (fehler) {
      const text = String((fehler as { stderr?: Buffer }).stderr ?? fehler);
      const code = /ERROR:\s+([0-9A-Z]{5}):/.exec(text)?.[1] ?? 'XX000';
      protokoll(`[echt] ${fn} → ${code}`);
      return Promise.resolve({ data: null, error: { code, message: text } });
    }
  };
  return { rpc } as unknown as Client;
}

const olli = (): Client => client(OLLI);
const geraet = getDeviceId(new FalscherSpeicher());

describe.skipIf(C === '')('Hallenton-Client gegen die echten RPCs (Wegwerf-Container)', () => {
  it('getDeviceId() ist eine UUID und passt zu p_device_id: Zuordnen klappt; eine Nicht-UUID scheitert sichtbar (22P02 → antwort_unbekannt)', async () => {
    expect(geraet).toMatch(UUID);
    const ok = await hallSpeakerAssign(olli(), { p_tournament_id: TID, p_fields: [1], p_device_id: geraet, p_device_name: 'Rechner der Turnierleitung', p_replace: false });
    protokoll(`[echt] assign ${JSON.stringify(ok)}`);
    expect(ok).toMatchObject({ ok: true, status: 'assigned', fields: [1] });
    const falsch = await hallSpeakerHeartbeat(olli(), { p_tournament_id: TID, p_device_id: 'laptop', p_fields: [1], p_state: 'ready', p_output_changed: false });
    expect(falsch).toEqual({ ok: false, grund: 'antwort_unbekannt' });
  });

  it('@HT-017 Lebenszeichen → Testton → Quittung einmal komplett (echtes Lebenszeichen-Modul, echter Spieler)', async () => {
    const tab = new Tab({ start: Date.now() });
    const speicher = new FalscherSpeicher();
    const lz = erzeugeLebenszeichen({
      turnierId: TID, felder: [1], deviceId: geraet, laufzeit: tab.laufzeit, spieler: tab.spieler, erzeugeAusgang: () => null,
      sperre: erzeugeGeraeteSperre(tab.geraet.sperren, MELDE_SPERRE_NAME), kanal: tab.kanal, zeitgeber: tab.uhr.gruppe('lz'),
      rpc: { heartbeat: (a) => hallSpeakerHeartbeat(olli(), a), ack: (a) => hallTestToneAck(olli(), a) },
      speicher, abgeloest: () => undefined,
    });
    tab.laufzeit.start();
    lz.start();
    await tab.laufzeit.tonAktivieren();
    await tab.vor(1500);
    const bereit = await hallSoundStatus(olli(), { p_tournament_id: TID, p_device_id: geraet });
    expect(bereit.ok && bereit.speakers[0]).toMatchObject({ field: 1, state: 'ready' });
    const anforderung = await hallTestToneRequest(olli(), { p_tournament_id: TID, p_field: 1 });
    protokoll(`[echt] test_tone_request ${JSON.stringify(anforderung)}`);
    expect(anforderung).toMatchObject({ ok: true, status: 'requested' });
    await tab.vor(6000);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    const danach = await hallSoundStatus(olli(), { p_tournament_id: TID, p_device_id: geraet });
    protokoll(`[echt] status nach Quittung ${JSON.stringify(danach)}`);
    expect(danach.ok && danach.sicht === 'voll' && danach.speakers[0].test?.playedAt).toEqual(expect.any(Number));
    await tab.vor(6000);
    expect(tab.toene()).toHaveLength(1);
    lz.stop();
    tab.laufzeit.stop();
  });

  it('hall_sound_status: volle Sicht (Turnierleitung) und schmale Sicht (Mitarbeiterin, nur writeMatchData) bestehen die zod-Schemata', async () => {
    const voll = await hallSoundStatus(olli(), { p_tournament_id: TID, p_device_id: geraet });
    const schmal = await hallSoundStatus(client(MIA), { p_tournament_id: TID, p_device_id: geraet });
    protokoll(`[echt] voll ${JSON.stringify(voll)}`);
    protokoll(`[echt] schmal ${JSON.stringify(schmal)}`);
    expect(voll).toMatchObject({ ok: true, sicht: 'voll', closed: false, speakers: [{ field: 1, isThisDevice: true }] });
    expect(schmal).toMatchObject({ ok: true, sicht: 'schmal', speakers: [{ field: 1, state: 'ready' }] });
  });

  it('H4-3 @HT-054 @HT-055 Rückwärtsverträglichkeit: neue Zustände vom echten Server werden gelesen (volle und schmale Sicht), das alte Lebenszeichen „ready“ gilt weiter', async () => {
    for (const zustand of ['output_lost', 'output_unconfirmed'] as const) {
      const hb = await hallSpeakerHeartbeat(olli(), { p_tournament_id: TID, p_device_id: geraet, p_fields: [1], p_state: zustand, p_output_changed: false });
      expect(hb).toMatchObject({ ok: true, status: 'ok', fields: [{ field: 1, status: 'ok' }] });
      const voll = await hallSoundStatus(olli(), { p_tournament_id: TID, p_device_id: geraet });
      const schmal = await hallSoundStatus(client(MIA), { p_tournament_id: TID, p_device_id: geraet });
      expect(voll.ok && voll.speakers[0]).toMatchObject({ field: 1, state: zustand });
      expect(schmal.ok && schmal.speakers[0]).toMatchObject({ field: 1, state: zustand });
    }
    const alt = await hallSpeakerHeartbeat(olli(), { p_tournament_id: TID, p_device_id: geraet, p_fields: [1], p_state: 'ready', p_output_changed: false });
    expect(alt).toMatchObject({ ok: true, status: 'ok', fields: [{ field: 1, status: 'ok' }] });
    const unbekannt = await hallSpeakerHeartbeat(olli(), { p_tournament_id: TID, p_device_id: geraet, p_fields: [1], p_state: 'fast_bereit', p_output_changed: false });
    expect(unbekannt).toEqual({ ok: false, grund: 'ungueltig' });
  });

  it('H4-11b @HT-057 der Client-Aufruf hallSpeakerUnassign: mit Recht löscht er, die Antwort kennt keine Kennung, das Gerät sieht „unassigned“ beim nächsten Lebenszeichen; ohne Recht 42501, unbekanntes Feld 22023', async () => {
    const mia = await hallSpeakerUnassign(client(MIA), { p_tournament_id: TID, p_fields: [1] });
    protokoll(`[echt] unassign ohne Recht ${JSON.stringify(mia)}`);
    expect(mia).toEqual({ ok: false, grund: 'kein_recht' });
    const nochDa = await hallSoundStatus(olli(), { p_tournament_id: TID, p_device_id: geraet });
    expect(nochDa.ok && nochDa.speakers[0]).toMatchObject({ field: 1, isThisDevice: true }); // ohne Recht nichts verändert
    const unbekannt = await hallSpeakerUnassign(olli(), { p_tournament_id: TID, p_fields: [99] });
    expect(unbekannt).toEqual({ ok: false, grund: 'ungueltig' });
    const aus = await hallSpeakerUnassign(olli(), { p_tournament_id: TID, p_fields: [1] });
    protokoll(`[echt] unassign ${JSON.stringify(aus)}`);
    expect(aus).toEqual({ ok: true, status: 'unassigned', fields: [1] });
    expect(JSON.stringify(aus)).not.toContain(geraet);
    const danach = await hallSpeakerHeartbeat(olli(), { p_tournament_id: TID, p_device_id: geraet, p_fields: [1], p_state: 'ready', p_output_changed: false });
    expect(danach).toMatchObject({ ok: true, status: 'ok', fields: [{ field: 1, status: 'unassigned' }] });
    const leer = await hallSoundStatus(olli(), { p_tournament_id: TID, p_device_id: geraet });
    expect(leer.ok && leer.speakers).toEqual([]); // @HT-016: die Karte zeigt gleich „kein Hallen-Lautsprecher“
    const wieder = await hallSpeakerUnassign(olli(), { p_tournament_id: TID, p_fields: [1] });
    expect(wieder).toEqual({ ok: true, status: 'unassigned', fields: [] }); // schon ohne Lautsprecher: nichts zu tun, kein Fehler
    const neu = await hallSpeakerAssign(olli(), { p_tournament_id: TID, p_fields: [1], p_device_id: geraet, p_device_name: 'Rechner der Turnierleitung', p_replace: false });
    expect(neu).toMatchObject({ ok: true, status: 'assigned', fields: [1] });
  });

  it('H4-6 @HT-054 @HT-055 das echte Lebenszeichen sendet output_unconfirmed und output_lost: angenommen, in hall_sound_status (voll, schmal) und in der Antwort der Leitung lesbar, ohne Name und Kennung', async () => {
    const dock = AUSGAENGE.find((a) => a.id === 'dock') ?? AUSGAENGE[0];
    const medien = new FalscheMedienGeraete();
    medien.dauerhaft = false;
    const tab = new Tab({ start: Date.now(), medien });
    tab.geraet.speicher.setItem(AUSGANG_SCHLUESSEL, JSON.stringify({ id: dock.id, name: dock.name, gruppe: dock.gruppe }));
    tab.wahl.pruefenAnstossen(); // der Wächter liest die gespeicherte Wahl (Mikrofon nicht erlaubt: unbestätigt)
    const lz = erzeugeLebenszeichen({
      turnierId: TID, felder: [1], deviceId: geraet, laufzeit: tab.laufzeit, spieler: tab.spieler, erzeugeAusgang: () => null,
      sperre: erzeugeGeraeteSperre(tab.geraet.sperren, MELDE_SPERRE_NAME), kanal: tab.kanal, zeitgeber: tab.uhr.gruppe('lz'),
      rpc: { heartbeat: (a) => hallSpeakerHeartbeat(olli(), a), ack: (a) => hallTestToneAck(olli(), a) },
      speicher: new FalscherSpeicher(), abgeloest: () => undefined,
    });
    tab.laufzeit.start();
    lz.start();
    await tab.vor(1500);
    const unbestaetigt = await hallSoundStatus(olli(), { p_tournament_id: TID, p_device_id: geraet });
    expect(unbestaetigt.ok && unbestaetigt.speakers[0]).toMatchObject({ field: 1, state: 'output_unconfirmed' });
    // Mikrofon erlaubt (Kennungen lesbar), Dock steckt → bereit; dann abgezogen → output_lost
    medien.erlaubt = true;
    tab.wahl.pruefenAnstossen();
    await tab.vor(6000);
    tab.kontext.ausgangVerschwindet(dock.id);
    medien.abziehen(dock.id);
    await tab.vor(6000);
    const verloren = await hallSoundStatus(olli(), { p_tournament_id: TID, p_device_id: geraet });
    const schmal = await hallSoundStatus(client(MIA), { p_tournament_id: TID, p_device_id: geraet });
    protokoll(`[echt] voll ${JSON.stringify(verloren)}`);
    protokoll(`[echt] schmal ${JSON.stringify(schmal)}`);
    expect(verloren.ok && verloren.speakers[0]).toMatchObject({ field: 1, state: 'output_lost' });
    expect(schmal.ok && schmal.speakers[0]).toMatchObject({ field: 1, state: 'output_lost' });
    // Antwort der Leitung (das Gerät, das Feld 1 leitet): Zustand des Lautsprechers lesbar
    const leitung = '00000000-0000-4000-8000-000000000099';
    psql(`INSERT INTO public.field_control (tournament_id, field, epoch, holder_user_id, holder_device_id, holder_device_label)\nVALUES ('${TID}', 1, 1, '${OLLI}', '${leitung}', 'Handy') ON CONFLICT (tournament_id, field) DO UPDATE SET holder_user_id = EXCLUDED.holder_user_id, holder_device_id = EXCLUDED.holder_device_id;\n`);
    const lead = await hallFieldLeadHeartbeat(olli(), { p_tournament_id: TID, p_field: 1, p_device_id: leitung });
    protokoll(`[echt] Leitung ${JSON.stringify(lead)}`);
    expect(lead).toMatchObject({ ok: true, status: 'ok', speaker: { state: 'output_lost' } });
    // Name und Kennung des Ausgangs stehen nirgends in dem, was der Server liefert
    for (const antwort of [unbestaetigt, verloren, schmal, lead]) {
      for (const geheim of [dock.id, dock.name, dock.gruppe]) {
        expect(JSON.stringify(antwort)).not.toContain(geheim);
      }
    }
    const inTabellen = psql("SELECT coalesce(string_agg(t::text, ' '), '') FROM public.hall_speakers t;");
    expect(inTabellen).not.toContain(dock.name);
    expect(inTabellen).not.toContain(dock.gruppe);
    lz.stop();
    tab.laufzeit.stop();
  });

  it('@HT-046 nach dem Turnierende antwortet das Lebenszeichen mit „turnier_beendet“ (55000, seit 20261123_001, Ruling W1); Testton anfordern ist gesperrt', async () => {
    psql(`BEGIN;\nSET LOCAL app.lifecycle_write = 'on';\nUPDATE public.tournaments SET lifecycle_status = 'finished', finished_at = now() WHERE id = '${TID}';\nCOMMIT;\n`);
    const hb = await hallSpeakerHeartbeat(olli(), { p_tournament_id: TID, p_device_id: geraet, p_fields: [1], p_state: 'not_activated', p_output_changed: false });
    protokoll(`[echt] heartbeat nach Turnierende ${JSON.stringify(hb)}`);
    expect(hb).toEqual({ ok: false, grund: 'turnier_beendet' });
    const test = await hallTestToneRequest(olli(), { p_tournament_id: TID, p_field: 1 });
    expect(test).toEqual({ ok: false, grund: 'turnier_beendet' });
    const abmelden = await hallSpeakerUnassign(olli(), { p_tournament_id: TID, p_fields: [1] });
    expect(abmelden).toEqual({ ok: false, grund: 'turnier_beendet' }); // @HT-046: nach dem Turnierende lässt sich der Lautsprecher nicht mehr abmelden
    const voll = await hallSoundStatus(olli(), { p_tournament_id: TID, p_device_id: geraet });
    expect(voll).toMatchObject({ ok: true, sicht: 'voll', closed: true });
  });
});
