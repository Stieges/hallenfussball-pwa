/**
 * @LZ-001 Zustand des Turnier: Entwurf · Bereit · Läuft · Abgeschlossen · Abgebrochen; die Karte auf der Startseite trägt
 * dasselbe Wort, auch im Archiv; bereite, noch nicht angepfiffene Turniere stehen unter „Kommende Turniere“; die Taste im
 * Assistenten heißt „Turnier fertigstellen“ (docs/anforderungen/2026-10-01_turnier-lebenszyklus.md). Befund C-STARTSEITE-ZUSTANDSWORT.
 * Liest die echten Sprachdateien (die Test-i18n gibt sonst nur Schlüssel zurück).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lies = (sprache: 'de' | 'en', datei: string): Record<string, Record<string, string> & string> =>
  JSON.parse(readFileSync(join(__dirname, '..', 'locales', sprache, `${datei}.json`), 'utf8')) as Record<string, Record<string, string> & string>;

describe('@LZ-001 Zustandswörter der Startseite (Deutsch)', () => {
  const dashboard = lies('de', 'dashboard');
  it.each([
    ['upcoming', 'Bereit'],
    ['running', 'Läuft'],
    ['draft', 'Entwurf'],
    ['finished', 'Abgeschlossen'],
    ['cancelled', 'Abgebrochen'],
    ['archived', 'Abgeschlossen'],
  ])('Karte „%s“ trägt das Wort „%s“', (schluessel, wort) => {
    expect(dashboard.status[schluessel]).toBe(wort);
  });

  it('der Abschnitt für bereite Turniere heißt „Kommende Turniere“, der des Tages „Heute“', () => {
    expect(dashboard.sections.upcomingTournaments).toBe('Kommende Turniere');
    expect(dashboard.sections.today).toBe('Heute');
  });

  it('Gegenbeispiel: keines der alten Wörter bleibt als Zustand stehen', () => {
    const alle = JSON.stringify(dashboard.status) + dashboard.sections.upcomingTournaments;
    for (const alt of ['Bevorstehend', 'Bevorstehende', 'Festgelegt', 'Archiviert', 'Geplant', 'Beendet']) {
      expect(alle).not.toContain(alt);
    }
  });

  it('die Taste im Assistenten heißt „Turnier fertigstellen“; die Verwaltung zeigt „Bereit“', () => {
    expect(lies('de', 'wizard').publish.button).toBe('Turnier fertigstellen');
    expect(lies('de', 'admin').dashboard.statusActive).toBe('Bereit');
  });

  it('das Glossar führt die Wörter (Sprachdatei sport.json)', () => {
    const sport = lies('de', 'sport').lifecycle;
    expect(sport).toMatchObject({ ready: 'Bereit', finalize: 'Turnier fertigstellen', backToDraft: 'Zurück zum Entwurf', finished: 'Abgeschlossen', cancelled: 'Abgebrochen' });
  });
});

describe('@LZ-001 Zustandswörter der Startseite (Englisch)', () => {
  it('Ready, Completed, Cancelled, Draft; Taste „Finalise tournament“', () => {
    const dashboard = lies('en', 'dashboard');
    expect(dashboard.status).toMatchObject({ upcoming: 'Ready', finished: 'Completed', cancelled: 'Cancelled', draft: 'Draft', archived: 'Completed' });
    expect(lies('en', 'wizard').publish.button).toBe('Finalise tournament');
    expect(lies('en', 'sport').lifecycle.backToDraft).toBe('Back to draft');
  });
});
