/**
 * H3b-3 Fixrunde 1 – der Client gegen die echten RPCs der Migration 20261121_001_hallenton.sql (Wegwerf-Container aus
 * `scripts/hallenton-client-check.sh`; ohne `HALLENTON_ECHT_CONTAINER` übersprungen). Jede RPC läuft per `docker exec … psql`
 * als Rolle authenticated mit JWT-Claims; die jsonb-Antwort geht unverändert durch die zod-Prüfung von `hallentonRpc.ts`.
 * Nachweise: Lebenszeichen nach Turnierende (@HT-046, W1), `getDeviceId()` als UUID, volle/schmale Sicht (@HT-039, @HT-040),
 * Lebenszeichen → Testton → Quittung (@HT-017).
 */
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { getDeviceId } from '../../../core/device/deviceId';
import {
  hallSoundStatus, hallSpeakerAssign, hallSpeakerHeartbeat, hallTestToneAck, hallTestToneRequest,
} from '../../../core/repositories/hallentonRpc';
import { FalscherSpeicher } from '../../../test/hallenton/falschesGeraet';
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

  it('W1 nach dem Turnierende antwortet das Lebenszeichen weiter „ok“ (kein 55000); Testton anfordern ist gesperrt', async () => {
    psql(`BEGIN;\nSET LOCAL app.lifecycle_write = 'on';\nUPDATE public.tournaments SET lifecycle_status = 'finished', finished_at = now() WHERE id = '${TID}';\nCOMMIT;\n`);
    const hb = await hallSpeakerHeartbeat(olli(), { p_tournament_id: TID, p_device_id: geraet, p_fields: [1], p_state: 'not_activated', p_output_changed: false });
    protokoll(`[echt] heartbeat nach Turnierende ${JSON.stringify(hb)}`);
    expect(hb).toMatchObject({ ok: true, status: 'ok', fields: [{ field: 1, status: 'ok' }] });
    const test = await hallTestToneRequest(olli(), { p_tournament_id: TID, p_field: 1 });
    expect(test).toEqual({ ok: false, grund: 'turnier_beendet' });
    const voll = await hallSoundStatus(olli(), { p_tournament_id: TID, p_device_id: geraet });
    expect(voll).toMatchObject({ ok: true, sicht: 'voll', closed: true });
  });
});
