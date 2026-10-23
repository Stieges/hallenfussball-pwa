/**
 * Sentry-Einbau der Adress-Kürzung (A-17b, Review #335 M-2 / Nachblick F-2): `initSentry` übergibt `Sentry.init` ein
 * `beforeSend` und ein `beforeBreadcrumb`, die `/join/<code>` und `token=` wirklich kürzen. `sentryScrub.test.ts` prüft nur die
 * Funktionen; dieser Test prüft, dass sie eingebaut sind (Mutation: `beforeSend` gibt das Ereignis ungekürzt zurück → rot).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Breadcrumb, ErrorEvent, EventHint } from '@sentry/react';

const { init } = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock('@sentry/react', () => ({
  init,
  replayIntegration: vi.fn(() => ({ name: 'Replay' })),
  close: vi.fn(),
}));
vi.mock('../consent', () => ({
  getConsentStatus: () => ({ errorTracking: true, sessionReplay: false, timestamp: 0, version: 1 }),
}));

interface InitOptionen {
  beforeSend: (event: ErrorEvent, hint: EventHint) => ErrorEvent | null;
  beforeBreadcrumb: (breadcrumb: Breadcrumb) => Breadcrumb | null;
}

async function initOptionen(): Promise<InitOptionen> {
  vi.resetModules();
  init.mockClear();
  vi.stubEnv('PROD', true);
  vi.stubEnv('DEV', false);
  vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o0.ingest.example/1');
  const { initSentry } = await import('../sentry');
  initSentry();
  expect(init).toHaveBeenCalledTimes(1);
  return init.mock.calls[0][0] as InitOptionen;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('initSentry: Adress-Kürzung ist eingebaut', () => {
  it('beforeSend kürzt Adresse, Transaktion und Breadcrumbs (Helfer-Code und token=) und entfernt IP, Cookies, Header', async () => {
    const { beforeSend } = await initOptionen();
    const event = {
      user: { id: 'u-1', ip_address: '203.0.113.7' },
      request: {
        url: 'https://app.example/#/join/ABCDEFGH23',
        cookies: { a: 'b' },
        headers: { 'user-agent': 'x' },
      },
      transaction: '/invite?token=geheim123',
      breadcrumbs: [
        { category: 'navigation', data: { from: '/', to: '/join/ABCDEFGH23' } },
        { category: 'console', message: 'öffne https://app.example/#/invite?token=geheim123' },
      ],
    } as unknown as ErrorEvent;

    const out = beforeSend(event, {});

    expect(out?.request?.url).toBe('https://app.example/#/join/***');
    expect(out?.transaction).toBe('/invite?token=***');
    expect(out?.breadcrumbs?.[0]?.data).toEqual({ from: '/', to: '/join/***' });
    expect(out?.breadcrumbs?.[1]?.message).toBe('öffne https://app.example/#/invite?token=***');
    expect(out?.user).toEqual({ id: 'u-1' });
    expect(out?.request?.cookies).toBeUndefined();
    expect(out?.request?.headers).toBeUndefined();
    expect(JSON.stringify(out)).not.toMatch(/ABCDEFGH23|geheim123/);
  });

  it('beforeBreadcrumb kürzt Navigation und Nachricht', async () => {
    const { beforeBreadcrumb } = await initOptionen();
    const out = beforeBreadcrumb({
      category: 'navigation',
      message: '/join/ABCDEFGH23',
      data: { from: '/join/ABCDEFGH23', to: '/invite?token=geheim123' },
    });
    expect(out).toEqual({
      category: 'navigation',
      message: '/join/***',
      data: { from: '/join/***', to: '/invite?token=***' },
    });
  });

  it('Gegenbeispiel: andere Adressen bleiben unverändert', async () => {
    const { beforeSend, beforeBreadcrumb } = await initOptionen();
    const event = {
      request: { url: 'https://app.example/#/live/ABC123' },
      transaction: '/tournament/t-1/live',
      breadcrumbs: [{ category: 'navigation', data: { from: '/', to: '/joint/ABCDEFGH23' } }],
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    expect(out?.request?.url).toBe('https://app.example/#/live/ABC123');
    expect(out?.transaction).toBe('/tournament/t-1/live');
    expect(out?.breadcrumbs?.[0]?.data).toEqual({ from: '/', to: '/joint/ABCDEFGH23' });
    expect(beforeBreadcrumb({ category: 'navigation', data: { to: '/login?tokenless=1' } })).toEqual({
      category: 'navigation',
      data: { to: '/login?tokenless=1' },
    });
  });
});
