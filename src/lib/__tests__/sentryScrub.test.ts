/**
 * Sentry-Adressen (A-17b, Review #335 M-2): `/join/<code>` und `token=` werden unkenntlich, jede andere Adresse bleibt.
 */
import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { scrubBreadcrumb, scrubEventUrls, scrubUrl } from '../sentryScrub';

describe('scrubUrl', () => {
  it('Helfer-Code in der Hash-Adresse', () => {
    expect(scrubUrl('https://app.example/#/join/ABCDEFGH23')).toBe('https://app.example/#/join/***');
    expect(scrubUrl('/join/abcd1234?x=1')).toBe('/join/***?x=1');
  });
  it('token= in Adresse und Hash', () => {
    expect(scrubUrl('https://app.example/#/invite?token=geheim123&a=1')).toBe('https://app.example/#/invite?token=***&a=1');
    expect(scrubUrl('https://app.example/?token=abc#/x')).toBe('https://app.example/?token=***#/x');
  });
  it.each([
    'https://app.example/#/live/ABC123',
    'https://app.example/#/tournament/t-1/live?f=2',
    'https://app.example/#/joint/ABCDEFGH23',
    'https://app.example/#/login?tokenless=1',
    '/',
  ])('Gegenbeispiel: %s bleibt unverändert', (url) => {
    expect(scrubUrl(url)).toBe(url);
  });
});

describe('Ereignis und Breadcrumbs', () => {
  it('kürzt Adresse, Transaktion und Navigations-Breadcrumbs', () => {
    const event = {
      request: { url: 'https://app.example/#/join/ABCDEFGH23' },
      transaction: '/join/ABCDEFGH23',
      breadcrumbs: [{ category: 'navigation', data: { from: '/', to: '/join/ABCDEFGH23' } }],
    } as unknown as ErrorEvent;
    const out = scrubEventUrls(event);
    expect(out.request?.url).toBe('https://app.example/#/join/***');
    expect(out.transaction).toBe('/join/***');
    expect(out.breadcrumbs?.[0]?.data).toEqual({ from: '/', to: '/join/***' });
  });
  it('Gegenbeispiel: andere Routen bleiben unverändert', () => {
    const event = {
      request: { url: 'https://app.example/#/tournament/t-1/live?f=2' },
      breadcrumbs: [{ category: 'navigation', data: { from: '/', to: '/tournament/t-1' } }],
    } as unknown as ErrorEvent;
    const out = scrubEventUrls(event);
    expect(out.request?.url).toBe('https://app.example/#/tournament/t-1/live?f=2');
    expect(out.breadcrumbs?.[0]?.data).toEqual({ from: '/', to: '/tournament/t-1' });
  });
  it('Breadcrumb-Nachricht und Zahlenwerte', () => {
    const b = scrubBreadcrumb({ message: 'GET /join/ABCDEFGH23', data: { status: 200, url: '/join/ABCDEFGH23' } });
    expect(b.message).toBe('GET /join/***');
    expect(b.data).toEqual({ status: 200, url: '/join/***' });
  });
});
