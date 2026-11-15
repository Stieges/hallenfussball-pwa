/**
 * @RZ-026 @RZ-027 Der Versandweg der Zählung: einfacher POST mit genau den fünf Feldern, ohne Anmeldung, ohne Cookies, ohne
 * Verweis, ohne Speicher; antwortet der Server mit 404 (Funktion noch nicht eingespielt), bleibt alles still.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFetchViewCountTransport, defaultViewCountTransport } from '../viewCountTransport';
import { sendViewCount, type ViewCountArgs } from '../../../core/viewCount/publicViewCount';

const ARGS: ViewCountArgs = { p_share_code: 'NIKO26', p_art: 'lebenszeichen', p_kanal: 'link', p_geraet: 'gross', p_installiert: true };

afterEach(() => { vi.unstubAllGlobals(); });

describe('@RZ-027 Versandweg', () => {
  it('POST an /rest/v1/rpc/count_public_view mit nur den fünf Feldern, ohne Cookies, Verweis oder Zwischenspeicher', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchSpy);
    const signal = new AbortController().signal;
    await createFetchViewCountTransport('https://projekt.example.test/', 'sb_publishable_abc')(ARGS, signal);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://projekt.example.test/rest/v1/rpc/count_public_view');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(ARGS);
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBe(signal);
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', apikey: 'sb_publishable_abc' });
  });

  it('ein JWT-förmiger öffentlicher Schlüssel geht zusätzlich als Bearer mit', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchSpy);
    await createFetchViewCountTransport('https://p.example.test', 'eyJhbGciOi.x.y')(ARGS, new AbortController().signal);
    const init = (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer eyJhbGciOi.x.y' });
  });
});

describe('@RZ-026 Ohne Supabase (lokaler Modus) tut die Zählung nichts', () => {
  it('der Weg dieser App sendet ohne eingerichtetes Projekt nichts und stört nicht', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchSpy);
    await expect(defaultViewCountTransport(ARGS, new AbortController().signal)).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('@RZ-026 Die Funktion fehlt am Server (noch nicht eingespielt)', () => {
  it('404 / PGRST202, Netzfehler und Abbruch: still, genau ein Versuch, kein Wiederholen, keine Fehlerausgabe', async () => {
    const fehlerAusgabe = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnAusgabe = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const antworten = [
      () => Promise.resolve(new Response(JSON.stringify({ code: 'PGRST202', message: 'Could not find the function' }), { status: 404 })),
      () => Promise.reject(new TypeError('Failed to fetch')),
      () => Promise.reject(new DOMException('abgebrochen', 'AbortError')),
    ];
    for (const antwort of antworten) {
      const fetchSpy = vi.fn(antwort);
      vi.stubGlobal('fetch', fetchSpy);
      await expect(sendViewCount(createFetchViewCountTransport('https://p.example.test', 'k'), ARGS)).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    }
    expect(fehlerAusgabe).not.toHaveBeenCalled();
    expect(warnAusgabe).not.toHaveBeenCalled();
    fehlerAusgabe.mockRestore();
    warnAusgabe.mockRestore();
  });
});
