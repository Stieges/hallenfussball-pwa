/**
 * tests/e2e/cloud/zuschauer-zaehlung.cloud.spec.ts — Zuschauer-Seite zählen, intern, Stufe 1 (@RZ-024, @RZ-028, @RZ-030): die echte App
 * öffnet `/#/live/CODE?k=q`, der lokale Stack zählt eine Summe (Service-Rolle liest sie), die Zählung läuft nur für öffentliche Turniere,
 * anon liest die Tabelle nicht, und mit dem endgültigen Löschen des Turniers sind die Zahlen weg.
 * Läuft nur in der CI (lokaler Stack aus den Migrationsdateien, also auch mit 20261124_003, bevor sie in Produktion eingespielt ist).
 * Der gleiche Inhalt steht als Container-Beweis in scripts/zuschauer-zaehlung-check.sh. Nur auf cloud-desktop.
 */
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { getLocalServiceRoleClient } from './helpers';
import { cloneReleaseCup, deleteCup, svc } from './coadminEinsatz';
import { serviceRest } from './restAsRole';

interface CountRow { channel: string; device_class: string; installed: boolean; views: number; heartbeats: number }

const countRows = async (tournamentId: string): Promise<CountRow[]> =>
  (await serviceRest('GET', `public_view_counts?tournament_id=eq.${tournamentId}&select=channel,device_class,installed,views,heartbeats`)).json as CountRow[];

async function anonRest(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; text: string }> {
  const { url, anonKey } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

async function shareCopy(label: string, isPublic: boolean): Promise<{ id: string; code: string }> {
  const cup = await cloneReleaseCup(label, { withCoAdmin: false });
  const code = randomUUID().replace(/[^0-9a-f]/g, '').slice(0, 6).toUpperCase();
  await svc('PATCH', `/rest/v1/tournaments?id=eq.${cup.id}`, { is_public: isPublic, share_code: code, share_code_created_at: new Date().toISOString() });
  return { id: cup.id, code };
}

test.describe('Zuschauer-Zählung am lokalen Stack', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Eigene Turnierkopien je Fall, nur auf cloud-desktop.');
  });

  test('@RZ-024 @RZ-030 Öffnen über /#/live/CODE?k=q zählt eine Summe (Kanal QR, großer Bildschirm); anon liest nichts; endgültiges Löschen nimmt die Zahlen mit', async ({ page }) => {
    const cup = await shareCopy('rz024', true);
    try {
      await page.goto(`/#/live/${cup.code}?k=q`);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => (await countRows(cup.id)).reduce((s, r) => s + r.views, 0), { timeout: 20_000 }).toBe(1);
      const rows = await countRows(cup.id);
      expect(rows).toEqual([{ channel: 'qr', device_class: 'gross', installed: false, views: 1, heartbeats: 0 }]);
      expect(new URL(page.url()).hash, 'der Zusatz steht nicht mehr in der Adresszeile').toBe(`#/live/${cup.code}`);

      // @RZ-030 niemand liest oder schreibt über die Schnittstelle
      const lesen = await anonRest('GET', `public_view_counts?tournament_id=eq.${cup.id}&select=*`);
      expect(lesen.status, 'anon liest die Tabelle nicht').toBeGreaterThanOrEqual(400);
      expect(lesen.text).not.toContain('"views"');
      const schreiben = await anonRest('POST', 'public_view_counts', { tournament_id: cup.id, window_start: new Date().toISOString(), channel: 'qr', device_class: 'handy', installed: false, views: 99, heartbeats: 0 });
      expect(schreiben.status, 'anon schreibt nicht direkt').toBeGreaterThanOrEqual(400);
      expect((await countRows(cup.id)).reduce((s, r) => s + r.views, 0)).toBe(1);
    } finally {
      await deleteCup(cup.id);
    }
    expect(await countRows(cup.id), 'die Zahlen sind mit dem Turnier gelöscht').toEqual([]);
  });

  test('@RZ-028 nicht öffentliches Turnier und unbekannter Code zählen nichts, die Funktion antwortet trotzdem ohne Fehler', async ({ page }) => {
    const privat = await shareCopy('rz028', false);
    try {
      await page.goto(`/#/live/${privat.code}?k=l`);
      await page.waitForLoadState('networkidle');
      const direkt = await anonRest('POST', 'rpc/count_public_view', { p_share_code: privat.code, p_art: 'aufruf', p_kanal: 'link', p_geraet: 'handy', p_installiert: false });
      expect(direkt.status).toBeLessThan(300);
      const unbekannt = await anonRest('POST', 'rpc/count_public_view', { p_share_code: 'ZZZZZ9', p_art: 'aufruf', p_kanal: 'link', p_geraet: 'handy', p_installiert: false });
      expect(unbekannt.status).toBeLessThan(300);
      expect(await countRows(privat.id)).toEqual([]);
    } finally {
      await deleteCup(privat.id);
    }
  });
});
