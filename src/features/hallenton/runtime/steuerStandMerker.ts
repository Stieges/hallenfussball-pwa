/**
 * „Leite ich Feld X?“ über ein Neuladen ohne Netz hinweg (H3b-3, Befund 6a aus H3b-2b, Regel 2, @HT-033 Zeile 11).
 *
 * Der Steuer-Stand kommt aus `field_control_state` (`useFieldControl` → `ownFields`). Nach einem Neuladen ohne Netz ist er
 * leer, bis wieder gelesen wird – ein selbst geleitetes Feld galt dann als Server-Feld (kein Ton, Warnung). Deshalb merkt
 * sich der Lautsprecher den zuletzt gelesenen Stand seines Turniers in `localStorage` (`hallenton:steuer`) und nimmt ihn,
 * solange in dieser Seite noch nichts gelesen wurde. Ab dem ersten Lesen gilt nur der gelesene Stand.
 *
 * Gemerkt wird nur für das Turnier, für das dieses Gerät Lautsprecher ist (`merkenFuer`); ein Abmelden oder Kontowechsel
 * (`tournamentId` null) löscht den gemerkten Stand. Nichts wirft.
 */
import type { OwnFieldsListener } from '../../../core/fieldControl/ownFields';
import { lies, schreib } from './tonEinstellungen';
import type { KanalSpeicher } from './lautsprecherKanal';

export const STEUER_SCHLUESSEL = 'hallenton:steuer';

export interface SteuerStandMerkerDeps {
  speicher: KanalSpeicher | null;
  /** Zuletzt gelesener Stand je Turnier (`ownFieldsByTournament`). */
  eigeneFelder: () => Record<string, readonly number[]>;
  /** `onOwnFieldsNoted`. */
  abonniere: (fn: OwnFieldsListener) => () => void;
  merkenFuer: (turnierId: string) => boolean;
}

export interface SteuerStandMerker {
  leiteIchFeld(turnierId: string, feld: number): boolean;
  beenden(): void;
}

function gemerkt(speicher: KanalSpeicher | null): { turnierId: string; felder: number[] } | null {
  try {
    const roh: unknown = JSON.parse(lies(speicher, STEUER_SCHLUESSEL) ?? 'null');
    if (!roh || typeof roh !== 'object') {
      return null;
    }
    const { turnierId, felder } = roh as { turnierId?: unknown; felder?: unknown };
    const gueltig = typeof turnierId === 'string' && Array.isArray(felder) && felder.every((f) => Number.isInteger(f));
    return gueltig ? { turnierId, felder: felder as number[] } : null;
  } catch {
    return null;
  }
}

export function erzeugeSteuerStandMerker({ speicher, eigeneFelder, abonniere, merkenFuer }: SteuerStandMerkerDeps): SteuerStandMerker {
  const gelesen = new Set<string>();
  const ab = abonniere((turnierId, felder) => {
    if (turnierId === null) {
      gelesen.clear();
      try {
        speicher?.removeItem(STEUER_SCHLUESSEL);
      } catch {
        // gesperrt: nichts gemerkt
      }
      return;
    }
    gelesen.add(turnierId);
    if (merkenFuer(turnierId)) {
      schreib(speicher, STEUER_SCHLUESSEL, JSON.stringify({ turnierId, felder: [...felder] }));
    }
  });
  return {
    leiteIchFeld(turnierId, feld) {
      if (gelesen.has(turnierId)) {
        return (eigeneFelder()[turnierId] ?? []).includes(feld);
      }
      const alt = gemerkt(speicher);
      return alt?.turnierId === turnierId && alt.felder.includes(feld);
    },
    beenden: ab,
  };
}
