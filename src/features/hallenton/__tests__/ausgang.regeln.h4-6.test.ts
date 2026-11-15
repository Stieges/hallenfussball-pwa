/**
 * H4-6 Absicherung des Ausgangs (G2, G12): (1) `vercel.json` erlaubt das Mikrofon nur für die eigene Herkunft, Kamera und
 * Standort bleiben gesperrt, die übrigen Header unberührt; (2) `getUserMedia` steht nur in `ausgangListe.ts` (die ESLint-Sperre
 * `no-restricted-syntax` ist die erste Linie, dieser Test die zweite); (3) der Ausgang-Code nennt weder Name noch Kennung in
 * Logs, Sentry oder Netzaufrufen – er enthält keinen solchen Aufruf.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const WURZEL = process.cwd();

interface HeaderBlock { source: string; headers: Array<{ key: string; value: string }> }

function headerAlle(): HeaderBlock[] {
  const roh = JSON.parse(readFileSync(join(WURZEL, 'vercel.json'), 'utf8')) as { headers: HeaderBlock[] };
  return roh.headers;
}

function dateien(ordner: string, treffer: string[] = []): string[] {
  for (const name of readdirSync(ordner)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) {
      continue;
    }
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) {
      dateien(pfad, treffer);
    } else if (/\.(ts|tsx)$/.test(name)) {
      treffer.push(pfad);
    }
  }
  return treffer;
}

describe('G12 Permissions-Policy in vercel.json', () => {
  const alle = headerAlle().find((b) => b.source === '/(.*)');
  const policy = alle?.headers.find((h) => h.key === 'Permissions-Policy')?.value ?? '';

  it('das Mikrofon ist für die eigene Herkunft erlaubt (microphone=(self))', () => {
    expect(policy.split(',').map((t) => t.trim())).toContain('microphone=(self)');
  });

  it('Kamera und Standort bleiben gesperrt (camera=(), geolocation=()); sonst nichts erlaubt', () => {
    expect(policy.split(',').map((t) => t.trim()).sort()).toEqual(['camera=()', 'geolocation=()', 'microphone=(self)']);
  });

  it('die übrigen Sicherheits-Header sind unverändert vorhanden, und es gibt genau eine Permissions-Policy', () => {
    const schluessel = alle?.headers.map((h) => h.key) ?? [];
    expect(schluessel.filter((k) => k === 'Permissions-Policy')).toHaveLength(1);
    expect(schluessel).toEqual(expect.arrayContaining(['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Content-Security-Policy']));
    expect(alle?.headers.find((h) => h.key === 'X-Frame-Options')?.value).toBe('DENY');
    const csp = alle?.headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('microphone');
  });
});

describe('G2 getUserMedia nur in ausgangListe.ts', () => {
  const ERLAUBT = new Set([
    'src/features/hallenton/runtime/ausgang/ausgangListe.ts', // die einzige Stelle der App
    'src/test/hallenton/falscheMedienGeraete.ts', // Test-Doppel (definiert die Methode, ruft sie nicht)
    'src/features/hallenton/__tests__/ausgang.regeln.h4-6.test.ts', // dieser Test (nennt das Wort)
  ]);

  it('keine andere Datei in src/ und tests/ ruft getUserMedia auf', () => {
    const treffer = [...dateien(join(WURZEL, 'src')), ...dateien(join(WURZEL, 'tests'))]
      .map((pfad) => relative(WURZEL, pfad))
      .filter((pfad) => !ERLAUBT.has(pfad))
      .filter((pfad) => readFileSync(join(WURZEL, pfad), 'utf8').includes('getUserMedia'));
    expect(treffer).toEqual([]);
  });

  it('ausgangListe.ts ist die einzige Stelle der App mit dem Aufruf und beendet den Strom sofort (stop)', () => {
    const quelle = readFileSync(join(WURZEL, 'src/features/hallenton/runtime/ausgang/ausgangListe.ts'), 'utf8');
    expect(quelle.match(/\.getUserMedia\(/g)).toHaveLength(1);
    expect(quelle).toContain('spur.stop()');
  });
});

describe('Name und Kennung bleiben auf dem Gerät: der Ausgang-Code hat keinen Weg nach draußen', () => {
  const ordner = join(WURZEL, 'src/features/hallenton/runtime/ausgang');
  const dateienAusgang = [
    ...dateien(ordner).filter((p) => !p.includes('__tests__')),
    join(WURZEL, 'src/features/hallenton/useHallAusgang.ts'),
    join(WURZEL, 'src/core/hallenton/ausgang.ts'),
  ];

  it.each(dateienAusgang.map((p) => [relative(WURZEL, p), p]))('%s: kein console, kein Sentry, kein fetch/sendBeacon/Supabase', (_name, pfad) => {
    const quelle = readFileSync(pfad, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(quelle).not.toMatch(/\bconsole\./);
    expect(quelle).not.toMatch(/sentry|captureException|addBreadcrumb|captureMessage/i);
    expect(quelle).not.toMatch(/\bfetch\(|sendBeacon|supabase|hallentonRpc|XMLHttpRequest|WebSocket/);
  });
});
