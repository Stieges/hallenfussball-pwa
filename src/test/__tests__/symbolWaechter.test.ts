/**
 * @OB-038 Wächter: „eine neue Seite oder einen neuen Text der Oberfläche – nie ein Emoji – ein Test weist es ab
 * (bekannte Altstellen stehen auf einer Liste, die schrumpft)“.
 *
 * Gelesen werden alle Texte, die ein Mensch in der App sieht: die Übersetzungsdateien (Deutsch und Englisch) und im Quelltext jede
 * Zeichenkette, jede Schablone und jeder JSX-Text (damit auch `icon="…"`-Angaben). Kommentare und Konsolen-Ausgaben zählen nicht (sie sieht kein Nutzer). Tests, Fixtures und Prüfstände sind ausgenommen. Gesucht werden Emoji und die Textzeichen, die bisher als Symbol dienten
 * (Haken, Kreuz, Dreieck, Punkt, Menüpunkte, Briefumschlag, ein einzelnes ×); Pfeile und Trennpunkte im Fließtext sind Satzzeichen und bleiben erlaubt.
 *
 * Die Altstellen stehen mit der Zahl der Treffer je Datei in `symbolWaechterAusnahmen.ts`. Mehr Treffer als erlaubt: rot (neue Stelle –
 * stattdessen ein gezeichnetes Symbol aus `components/ui/Icons`, oder gar keins). Weniger: nur ein Hinweis „Liste anpassen“ in der Testausgabe
 * (nie rot, damit parallele Aufräum-PRs main nicht brechen).
 */
import { describe, expect, it } from 'vitest';
import { SYMBOL_AUSNAHMEN } from '../symbolWaechterAusnahmen';
import { trefferImJson, trefferImQuelltext, vergleiche, zaehleAlles } from '../symbolScan';

const gezaehlt = zaehleAlles();

describe('@OB-038 Wächter: kein Emoji und kein Symbolersatz in Oberflächentexten', () => {
  const { zuViel, zuWenig } = vergleiche(gezaehlt, SYMBOL_AUSNAHMEN);

  it('keine Datei hat mehr Treffer, als die Liste der Altstellen erlaubt (neue Stellen werden abgewiesen)', () => {
    expect(zuViel, 'Neue Emoji oder Textzeichen als Symbol: ein gezeichnetes Symbol aus components/ui/Icons nehmen (oder nur das Wort)').toEqual([]);
  });

  it('Hinweis (nie rot): Einträge der Liste, die gesenkt oder gestrichen werden können', () => {
    if (zuWenig.length > 0) {
      // Hinweis in der Testausgabe, kein Fehler: sonst machten zwei parallele Aufräum-PRs main rot
      console.warn(`@OB-038 Liste anpassen (src/test/symbolWaechterAusnahmen.ts), diese Einträge können gesenkt werden:\n${zuWenig.join('\n')}`);
    }
    expect(true).toBe(true);
  });

  it('Vergleich: weniger Treffer als erlaubt bleibt grün (nur Hinweis), mehr Treffer ist rot, eine neue Datei ist rot', () => {
    const liste = { 'a.tsx': 3 };
    expect(vergleiche(new Map([['a.tsx', 2]]), liste)).toEqual({ zuViel: [], zuWenig: ['a.tsx: nur noch 2 Treffer, in der Liste 3'] });
    expect(vergleiche(new Map(), liste).zuViel).toEqual([]);
    expect(vergleiche(new Map([['a.tsx', 3]]), liste)).toEqual({ zuViel: [], zuWenig: [] });
    expect(vergleiche(new Map([['a.tsx', 4]]), liste).zuViel).toHaveLength(1);
    expect(vergleiche(new Map([['b.tsx', 1]]), liste).zuViel).toEqual(['b.tsx: 1 Treffer, erlaubt 0']);
  });

  it('Probe des Zählers: ein Emoji im Text, im JSX, im Attribut und in der Schablone wird gefunden, Satzzeichen nicht', () => {
    expect(trefferImQuelltext("const a = '🔒 Privat';")).toBe(1);
    expect(trefferImQuelltext('const b = <p>⚠️ Achtung</p>;')).toBe(1);
    expect(trefferImQuelltext('const c = <Karte icon="📊" />;')).toBe(1);
    expect(trefferImQuelltext('const d = `${x} ✓ ok`;')).toBe(1);
    expect(trefferImQuelltext("const e = '\\u2713';")).toBe(1);
    expect(trefferImQuelltext("const f = '×';")).toBe(1);
    expect(trefferImQuelltext("const g = 'A → B • C · 3 × 4 © Verein';")).toBe(0);
    expect(trefferImQuelltext('// 🔒 nur ein Kommentar\nconst h = 1;')).toBe(0);
    expect(trefferImJson({ a: { b: 'ℹ️ Hinweis' }, c: ['Text', '✕ Nein'] })).toBe(2);
    expect(trefferImJson({ a: 'Hinweis ohne Zeichen' })).toBe(0);
  });

  it('die Quellen der Quick Wins (Paket S1) stehen nicht auf der Liste', () => {
    const erledigt = [
      'components/ui/ConfirmDialog.tsx', 'components/ui/Toast/Toast.tsx', 'components/live-cockpit/components/Toast/Toast.tsx',
      'components/schedule/MatchSummary/index.tsx', 'components/live-cockpit/components/Dialogs/CardDialog.tsx',
      'features/tournament-management/MonitorEditor.tsx', 'features/tournament-management/components/monitor-editor/MonitorEditorDialog.tsx',
      'features/tournament-admin/categories/Hallenton/index.tsx', 'features/tournament-admin/categories/MatchCockpit/HallentonKarte.tsx',
      'screens/ManagementChrome.tsx', 'features/public-view/components/PublicStatusViews.tsx',
      'i18n/locales/de/publicView.json', 'i18n/locales/en/publicView.json',
      'components/monitor/NoMatchDisplay.tsx', 'components/monitor/GoalAnimation.tsx', 'features/monitor-display/slides/SponsorSlide.tsx',
    ];
    expect(erledigt.filter((d) => d in SYMBOL_AUSNAHMEN)).toEqual([]);
    expect(erledigt.filter((d) => gezaehlt.has(d))).toEqual([]);
  });
});
