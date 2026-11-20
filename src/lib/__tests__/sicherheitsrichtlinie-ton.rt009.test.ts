/**
 * @RT-009 Die ausgelieferte Sicherheitsrichtlinie sperrt keinen Ton der App.
 * Anforderung: docs/anforderungen/plattform/2026-10-25_rauchtest-nach-deploy.md.
 * Geprüft wird die Richtlinie aus der Auslieferungs-Konfiguration (`vercel.json`): Ton von der eigenen Adresse, aus „data:“
 * und aus „blob:“ ist erlaubt, Ton von einer fremden Adresse bleibt gesperrt. Die Wirkung im Browser prüft der
 * Playwright-Test `tests/e2e/flows/sicherheitsrichtlinie-ton-rt009.spec.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface HeaderBlock { source: string; headers: Array<{ key: string; value: string }> }

function richtlinie(): string {
  const roh = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as { headers: HeaderBlock[] };
  const wert = roh.headers.find((b) => b.source === '/(.*)')?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
  expect(wert, 'Content-Security-Policy für /(.*) fehlt').toBeTruthy();
  return wert ?? '';
}

function angabe(name: string): string[] | undefined {
  const zeile = richtlinie().split(';').map((s) => s.trim()).find((s) => s.split(/\s+/)[0] === name);
  return zeile?.split(/\s+/).slice(1);
}

describe('@RT-009 Sicherheitsrichtlinie und Ton', () => {
  it('@RT-009 media-src erlaubt die eigene Adresse, data: und blob:', () => {
    const media = angabe('media-src');
    expect(media, 'media-src fehlt (dann gilt default-src und sperrt data: und blob:)').toBeDefined();
    expect(media).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:']));
  });

  it('@RT-009 Ton von einer fremden Adresse bleibt gesperrt: media-src nennt keinen Host und kein Sternchen', () => {
    const media = angabe('media-src') ?? [];
    const erlaubt = new Set(["'self'", 'data:', 'blob:']);
    expect(media.filter((q) => !erlaubt.has(q))).toEqual([]);
    expect(media.some((q) => /^https?:|\*|^wss?:/.test(q))).toBe(false);
  });

  it('@RT-009 die übrige Richtlinie bleibt: default-src nur die eigene Adresse, kein Ton-Weg über connect-src oder script-src geöffnet', () => {
    expect(angabe('default-src')).toEqual(["'self'"]);
    expect(angabe('script-src')).toEqual(["'self'"]);
    expect(angabe('object-src')).toEqual(["'none'"]);
  });
});
