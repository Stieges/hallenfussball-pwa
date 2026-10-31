/**
 * @OB-017 Wächter (Befund C-WINDOW-CONFIRM): im Produktcode unter src/ steht kein Fenster des Browsers
 * (window.confirm/alert/prompt, loses confirm(/alert(/prompt(). Die übrigen @OB-017-Fälle prüft B3.appDialoge.ob017.test.tsx.
 *
 * @TA-021 (Befund C-B3-OB017-TEST-FLAKE): früher lief dieser Wächter im dom-Projekt (jsdom) und las den ganzen src-Baum
 * einzeln per readdirSync/readFileSync – im Commit-Hook unter Last bis 13 s (Grenze 5 s). Jetzt im Node-Projekt; ein
 * nativer `git grep` (eingecheckte und neue, nicht ignorierte Dateien) liefert nur die Dateien, in denen eines der Wörter
 * überhaupt vorkommt; die genaue Regel (Kommentare entfernt, lokales `confirm` erlaubt) gilt unverändert für diese.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const isTest = (p: string) => /(\.test\.|\.spec\.)/.test(p) || /(^|\/)(__tests__|test)\//.test(p);
/** Kommentare entfernen, damit Hinweise wie „statt window.confirm“ nicht anschlagen. */
const ohneKommentare = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Treffer der Regel in einem Quelltext (leer = sauber). */
function verstoesse(code: string): string[] {
  const ohne = ohneKommentare(code);
  const lokalesConfirm = /(const|let|function)\s+confirm\b/.test(ohne);
  const muster = [/\b(window|globalThis|self)\.(confirm|alert|prompt)\b/, /(^|[^\w.$])(alert|prompt)\(/, lokalesConfirm ? null : /(^|[^\w.$])confirm\(/];
  return muster.filter((m): m is RegExp => m?.test(ohne) ?? false).map(String);
}

function kandidaten(): string[] {
  const r = spawnSync('git', ['grep', '-l', '--untracked', '-E', 'confirm|alert|prompt', '--', 'src/*.ts', 'src/*.tsx'], { cwd: ROOT, encoding: 'utf8' });
  expect(r.error).toBeUndefined();
  expect([0, 1], r.stderr).toContain(r.status);
  return r.stdout.split('\n').filter((p) => p !== '' && !isTest(p.slice('src/'.length)));
}

describe('@OB-017 Wächter: im Produktcode steht kein Fenster des Browsers mehr', () => {
  it('@OB-017 @TA-021 kein window.confirm|alert|prompt und kein loses confirm(/alert(/prompt( in src/ (ohne Tests)', () => {
    const treffer = kandidaten().flatMap((datei) => verstoesse(readFileSync(join(ROOT, datei), 'utf8')).map((m) => `${datei}: ${m}`));
    expect(treffer).toEqual([]);
  });

  it('@OB-017 Gegenbeispiel: die Regel erkennt confirm(, window.alert und prompt(, nicht aber Kommentare und ein lokales confirm', () => {
    expect(verstoesse('if (confirm("Sicher?")) {}')).not.toEqual([]);
    expect(verstoesse('window.alert("x")')).not.toEqual([]);
    expect(verstoesse('const n = prompt("Name")')).not.toEqual([]);
    expect(verstoesse('// statt window.confirm\nconst a = 1')).toEqual([]);
    expect(verstoesse('const confirm = useConfirm();\nawait confirm({ titel })')).toEqual([]);
  });
});
