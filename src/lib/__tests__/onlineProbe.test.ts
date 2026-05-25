import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { probeSupabaseReachable } from '../onlineProbe';

describe('probeSupabaseReachable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "online" when fetch resolves', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const outcome = await probeSupabaseReachable({
      url: 'https://example.supabase.co',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome).toBe('online');
  });

  it('returns "online" even on non-2xx — connectivity, not auth, is the signal', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const outcome = await probeSupabaseReachable({
      url: 'https://example.supabase.co',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome).toBe('online');
  });

  it('returns "offline" when fetch rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const outcome = await probeSupabaseReachable({
      url: 'https://example.supabase.co',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome).toBe('offline');
  });

  it('aborts after the configured timeout and returns "offline"', async () => {
    const fetchImpl = vi.fn().mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );

    const promise = probeSupabaseReachable({
      url: 'https://example.supabase.co',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 100,
    });

    await vi.advanceTimersByTimeAsync(150);
    await expect(promise).resolves.toBe('offline');
  });

  it('returns "unknown" when no Supabase URL is configured', async () => {
    const outcome = await probeSupabaseReachable({ url: undefined });
    expect(outcome).toBe('unknown');
  });

  it('sends the request to /auth/v1/health with method=HEAD', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await probeSupabaseReachable({
      url: 'https://example.supabase.co',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/auth/v1/health');
    expect((init as RequestInit).method).toBe('HEAD');
  });
});
