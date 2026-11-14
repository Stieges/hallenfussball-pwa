/**
 * cockpitHallZeile (H4-12, @HT-011, @HT-034, @HT-035, @HT-040, @HT-050, @HT-039 Spalte Cockpit): aus dem Cockpit-Hinweis der Leitung
 * (`useHallCockpitHinweis`) die eine Zeile, die das Cockpit unter der Tafel zeigt – oder keine. Rein, ohne Hooks.
 * - `keinNetz`: das leitende Gerät hat selbst kein Netz – „Kein Netz – Halle zeigt alten Stand“.
 * - `aus`: „Hallen-Lautsprecher aus – Ende selbst anzeigen“ mit „Grund: …“. `grund: null` = ein Zustand, den dieser App-Stand nicht kennt
 *   (nur die Zeile, kein Wortgrund, @HT-039). „Ausgang verloren/bestätigen“ gibt es erst, wenn der Server diese Zustände kennt (H4-6, H4-11).
 * - `ausgangGeaendert`: ruhige Zeile (@HT-050), keine Störung.
 * Kein Lautsprecher am Feld (`keiner`) oder bereit ohne Hinweis → keine Zeile (@HT-016, @HT-038).
 */
import type { CockpitHinweis } from './runtime/hallStatusAuswertung';

export type CockpitGrundText = 'tonNichtAktiviert' | 'hintergrund' | 'schlafenGelegt' | 'lautstaerkeNull';

export type CockpitHallZeile =
  | { art: 'keinNetz' }
  | { art: 'aus'; grund: CockpitGrundText | 'meldetSichNicht' | null; zuletztServerMs: number | null }
  | { art: 'ausgangGeaendert' };

const GRUND_TEXT: Record<string, CockpitGrundText | undefined> = {
  not_activated: 'tonNichtAktiviert',
  background: 'hintergrund',
  slept: 'schlafenGelegt',
  volume_zero: 'lautstaerkeNull',
};

export function cockpitHallZeile(hinweis: CockpitHinweis): CockpitHallZeile | null {
  switch (hinweis.art) {
    case 'unbekannt':
      return { art: 'keinNetz' };
    case 'ausgangGeaendert':
      return { art: 'ausgangGeaendert' };
    case 'aus':
      return {
        art: 'aus',
        grund: hinweis.grund === 'meldetSichNicht' ? 'meldetSichNicht' : GRUND_TEXT[hinweis.grund] ?? null,
        zuletztServerMs: hinweis.zuletztServerMs,
      };
    case 'keiner':
    case 'bereit':
      return null;
  }
}
