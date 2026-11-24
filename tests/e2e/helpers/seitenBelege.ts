/**
 * Belege für wackelnde Hilfsschritte (@TA-040): Konsole, Seitenfehler, fehlgeschlagene und abgelehnte Netzanfragen,
 * Seitenwechsel des Hauptframes (mit Zeit seit Beginn des Schritts), Adresse und sichtbarer Text der Seite werden mitgeschrieben und NUR bei einem Fehlschlag als Anhang an den Testbericht gehängt.
 * Der Anhang liegt als Datei `belege-<name>.txt` im Ausgabeordner des gescheiterten Versuchs (also im hochgeladenen
 * `test-results`) und zusätzlich im Report.
 * Die Prüfung selbst bleibt unverändert: der Fehler wird nach dem Anhängen unverändert weitergereicht (keine Wartezeit, keine
 * Wiederholung).
 * Datenschutz, ehrlich: Das Schwärzen gilt nur für diesen Textanhang (Adressen ohne Query-Teil, Bearer-Angaben, JWT- und
 * Supabase-Schlüsselmuster); es schreibt keine Anfrage- oder Antwortkörper und keine Kopfzeilen mit. Das hochgeladene Artefakt
 * enthält daneben Bilder und Testdaten; es stammt aus dem Wegwerf-Stack des Runners und enthält nur dessen Daten.
 */
import { writeFile } from 'node:fs/promises';
import type { Page, TestInfo } from '@playwright/test';

const MAX_ZEILEN = 200;
const MAX_ZEICHEN_ZEILE = 400;
const MAX_ZEICHEN_TEXT = 3000;

/** Schwärzt Adressen-Query-Teile (nur direkt an einer Adresse) und alles, was wie ein Schlüssel aussieht. */
export function schwaerzen(text: string): string {
  return text
    .replace(/(https?:\/\/[^\s"'<>?#]+|#\/[^\s"'<>?]*)\?[^\s"'<>)]*/g, '$1?…')
    .replace(/Bearer\s+[\w.-]+/gi, 'Bearer [entfernt]')
    .replace(/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, '[Token entfernt]')
    .replace(/\bsb_(publishable|secret)_[\w-]+/g, 'sb_$1_[entfernt]')
    .replace(/\b(apikey|authorization|access_token|refresh_token)\b\s*[:=]\s*\S+/gi, '$1=[entfernt]');
}

const kuerzen = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max)}…[gekürzt]` : text);

/**
 * Führt `schritt` aus und schreibt dabei Konsole/Netz der Seite mit. Scheitert der Schritt, hängt die Funktion die Belege an
 * `testInfo` (Name: `belege-<name>`) und wirft denselben Fehler weiter. Gelingt er, bleibt nichts zurück.
 */
export async function mitSeitenBelegen<T>(page: Page, testInfo: TestInfo, name: string, schritt: () => Promise<T>): Promise<T> {
  const zeilen: string[] = [];
  const merke = (art: string, text: string): void => {
    if (zeilen.length < MAX_ZEILEN) { zeilen.push(kuerzen(schwaerzen(`${art} ${text}`), MAX_ZEICHEN_ZEILE)); }
  };
  const beginn = Date.now();
  const onNavigated = (frame: { url(): string }): void => {
    if (frame === page.mainFrame()) { merke('[seitenwechsel]', `${new Date().toISOString()} (+${String(Date.now() - beginn)} ms) ${frame.url()}`); }
  };
  const onConsole = (m: { type(): string; text(): string }): void => { merke(`[konsole:${m.type()}]`, m.text()); };
  const onPageError = (e: Error): void => { merke('[seitenfehler]', e.message); };
  const onRequestFailed = (r: { method(): string; url(): string; failure(): { errorText: string } | null }): void => {
    merke('[netz-fehlgeschlagen]', `${r.method()} ${r.url()} ${r.failure()?.errorText ?? ''}`);
  };
  const onResponse = (r: { status(): number; url(): string; request(): { method(): string } }): void => {
    if (r.status() >= 400) { merke('[netz-status]', `${String(r.status())} ${r.request().method()} ${r.url()}`); }
  };
  page.on('framenavigated', onNavigated);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);
  try {
    return await schritt();
  } catch (fehler) {
    await anhaengen(page, testInfo, name, zeilen);
    throw fehler;
  } finally {
    page.off('framenavigated', onNavigated);
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
    page.off('response', onResponse);
  }
}

async function anhaengen(page: Page, testInfo: TestInfo, name: string, zeilen: string[]): Promise<void> {
  try {
    const adresse = page.isClosed() ? '(Seite geschlossen)' : schwaerzen(page.url());
    const sichtbar = page.isClosed()
      ? ''
      : await page.locator('body').innerText({ timeout: 2000 }).catch(() => '(Text nicht lesbar)');
    const inhalt = [
      `Schritt: ${name}`,
      `Adresse: ${adresse}`,
      '',
      `Sichtbarer Text (gekürzt):`,
      kuerzen(schwaerzen(sichtbar).replace(/\n{3,}/g, '\n\n'), MAX_ZEICHEN_TEXT),
      '',
      `Konsole/Netz (${String(zeilen.length)} Zeilen, höchstens ${String(MAX_ZEILEN)}):`,
      ...zeilen,
    ].join('\n');
    const datei = testInfo.outputPath(`belege-${name}.txt`);
    await writeFile(datei, inhalt, 'utf8');
    await testInfo.attach(`belege-${name}`, { path: datei, contentType: 'text/plain' });
  } catch {
    // Beleg darf den ursprünglichen Fehler nie verdecken.
  }
}
