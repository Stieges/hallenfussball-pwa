/**
 * Saat für die Sichtmängel-Spezifikationen (@ZM-198, @ZM-205, @ZM-206, @ZM-207, @ZM-167, @ZM-208): das Turnier „Hallencup Messlauf“ der eingefrorenen
 * Messlauf-Saat, mit „SG Taching/Tengling“ (Name mit Schrägstrich) als Team; wahlweise vor dem ersten Spiel (kein Spiel beendet, kein Spiel läuft)
 * und mit einem zusätzlichen sehr langen Einzelwort als Teamname (Gegenbeispiel „Wort länger als die Zeile“). Aus der Saat abgeleitet (Testumgebung,
 * kein Produktivcode), Namen sind frei erfunden. Öffentlicher Zuschauer-Code `MESS26`, Monitore `mon-live`, `mon-plan-feld`, `mon-tabelle`, `mon-qr`.
 */
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

type Eintrag = Record<string, unknown>;
interface SaatDatei { datenbanken: Array<{ store: string; eintraege: Record<string, unknown> }> }

export const TURNIER_ID = 'hallencup-messlauf';
export const ZUSCHAUER_CODE = 'MESS26';
export const SCHRAEGSTRICH_NAME = 'SG Taching/Tengling';
/** Ein einziges Wort, länger als jede Zeile am Handy (Gegenbeispiel: darf an beliebiger Stelle umbrechen, aber nie überlaufen). */
export const LANGES_WORT = 'Donaudampfschifffahrtsgesellschaftskapitaensverein';

export interface MessSaatOptionen { vorErstemSpiel?: boolean; langesWort?: boolean }

const ERGEBNISFELDER = ['scoreA', 'scoreB', 'decidedBy', 'finishedAt', 'timerElapsedSeconds', 'timerStartTime', 'timerPausedAt', 'shootout', 'overtimeScoreA', 'overtimeScoreB', 'penaltyScoreA', 'penaltyScoreB'];

export function messSaat(opt: MessSaatOptionen = {}): SaatDatei {
  const saat = structuredClone(leseSaat('hallencup-messlauf')) as SaatDatei;
  const cache = saat.datenbanken.find((db) => db.store === 'cache');
  const turniere = cache?.eintraege.tournaments as Array<Eintrag & { id: string; teams: Array<{ name: string }>; matches: Eintrag[] }> | undefined;
  const turnier = turniere?.find((t) => t.id === TURNIER_ID);
  if (turnier === undefined) { throw new Error('Messlauf-Saat ohne Turnier hallencup-messlauf'); }
  turnier.teams[3].name = SCHRAEGSTRICH_NAME;
  if (opt.langesWort === true) { turnier.teams[1].name = LANGES_WORT; }
  if (opt.vorErstemSpiel === true) {
    turnier.matches = turnier.matches.map((m) => {
      const rest = Object.fromEntries(Object.entries(m).filter(([feld]) => !ERGEBNISFELDER.includes(feld)));
      return { ...rest, matchStatus: 'scheduled' };
    });
    const spiele = saat.datenbanken.find((db) => db.store === 'matches');
    if (spiele !== undefined) { spiele.eintraege = {}; }
  }
  return saat;
}
