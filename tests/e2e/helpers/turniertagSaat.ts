/**
 * Saat „Turniertag“ für die Startseite (@OB-078, Grundriss „Am Turniertag stehen die Turniere des Tages oben und offen“):
 * dreimal „Nikolausturnier“ am Samstag – F2 (Sa 28.11. 08:30), F1 (13:00), D (16:30) – und am Sonntag G/E2/E1, ebenfalls „Nikolausturnier“
 * (reale Turniere heißen gleich, unterschieden nur durch die Altersklasse, Daniel 07.11.), dazu der Wintercup, ein Turnier mit 50 Zeichen Titel, ein Entwurf,
 * ein abgeschlossenes Turnier, ein Turnier im Papierkorb; auf Wunsch zusätzlich der Herbstcup (läuft, nie abgeschlossen)
 * und eine nie angepfiffene Probe-Kopie vom 26.11. Aus der eingefrorenen Messlauf-Saat abgeleitet (Testumgebung, kein Produktivcode).
 */
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

type Spiel = Record<string, unknown>;
type Turnier = Record<string, unknown> & { matches: Spiel[]; id: string };

export type Lage = 'bereit' | 'f2laeuft' | 'f2fertig';
export const UHRZEIT: Record<Lage, string> = {
  bereit: '2026-11-28T08:00:00+01:00',
  f2laeuft: '2026-11-28T09:10:00+01:00',
  f2fertig: '2026-11-28T12:40:00+01:00',
};

const ERGEBNISFELDER = new Set(['scoreA', 'scoreB', 'decidedBy', 'finishedAt', 'timerElapsedSeconds', 'timerStartTime', 'timerPausedAt', 'shootout', 'overtimeScoreA', 'overtimeScoreB']);

function geplant(t: Turnier, datum: string, zeit: string): Spiel[] {
  const start = new Date(`${datum}T${zeit}:00+01:00`).getTime();
  return t.matches.map((m, i) => ({
    ...Object.fromEntries(Object.entries(m).filter(([feld]) => !ERGEBNISFELDER.has(feld))),
    scheduledTime: new Date(start + i * 12 * 60000).toISOString(),
    matchStatus: 'scheduled',
  }));
}

export function baueTurniertagSaat(lage: Lage, mitAltlasten = false): Turnier[] {
  const saat = leseSaat('hallencup-messlauf');
  const cache = saat.datenbanken.find((db: { store: string }) => db.store === 'cache').eintraege.tournaments as Turnier[];
  const basis = cache[0];
  const entwurfBasis = cache[6];
  const turnier = (id: string, title: string, datum: string, zeit: string, extra: Record<string, unknown> = {}): Turnier => {
    const t = structuredClone(basis);
    Object.assign(t, {
      id, title, date: datum, startDate: datum, startTime: zeit, timeSlot: `${zeit} - 12:00`,
      location: { name: 'Bergader SportARENA', city: 'Waging am See' }, organizer: 'TSV Waging',
      isPublic: false, groupCompletions: [], monitors: [], sponsors: [],
      createdAt: '2026-11-05T18:00:00.000Z', updatedAt: '2026-11-05T18:00:00.000Z', publishedAt: '2026-11-05T18:00:00.000Z',
    });
    delete t.shareCode;
    t.matches = geplant(t, datum, zeit);
    return Object.assign(t, extra);
  };
  const laeuft = (t: Turnier): Turnier => {
    t.matches[0] = { ...t.matches[0], matchStatus: 'finished', scoreA: 2, scoreB: 1, decidedBy: 'regular' };
    t.matches[1] = { ...t.matches[1], matchStatus: 'running', scoreA: 0, scoreB: 0 };
    return t;
  };
  const fertig = (t: Turnier): Turnier => {
    t.matches = t.matches.map((m) => ({ ...m, matchStatus: 'finished', scoreA: 1, scoreB: 0, decidedBy: 'regular' }));
    t.lifecycleStatus = 'finished';
    return t;
  };

  const f2 = turnier('tw-f2', 'Nikolausturnier', '2026-11-28', '08:30', { ageClass: 'F2-Junioren' });
  if (lage === 'f2laeuft') { laeuft(f2); }
  if (lage === 'f2fertig') { fertig(f2); }
  const entwurf = structuredClone(entwurfBasis);
  Object.assign(entwurf, { id: 'tw-entwurf', title: 'Frühjahrscup', date: '2027-03-06', startDate: '2027-03-06', updatedAt: '2026-11-04T10:00:00.000Z' });
  const liste: Turnier[] = [
    f2,
    turnier('tw-f1', 'Nikolausturnier', '2026-11-28', '13:00', { ageClass: 'F1-Junioren' }),
    turnier('tw-d', 'Nikolausturnier', '2026-11-28', '16:30', { ageClass: 'D-Junioren' }),
    turnier('tw-g', 'Nikolausturnier', '2026-11-29', '08:30', { ageClass: 'G-Junioren' }),
    turnier('tw-e2', 'Nikolausturnier', '2026-11-29', '12:30', { ageClass: 'E2-Junioren' }),
    turnier('tw-e1', 'Nikolausturnier', '2026-11-29', '16:00', { ageClass: 'E1-Junioren' }),
    turnier('tw-winter', 'Wintercup', '2026-12-12', '10:00', { location: { name: 'Sporthalle Traunstein' } }),
    turnier('tw-lang', 'Hallenmasters Waging am See um den Raiffeisenpokal', '2027-01-16', '09:00'),
    entwurf,
    fertig(turnier('tw-archiv', 'Sommer-Hallencup 2026', '2026-07-11', '10:00')),
    turnier('tw-papier', 'Testturnier alt', '2026-10-01', '10:00', { deletedAt: '2026-11-01T10:00:00.000Z' }),
    turnier('tw-papier2', 'Wintercup Probe', '2026-10-02', '10:00', { deletedAt: '2026-11-02T10:00:00.000Z' }),
  ];
  if (mitAltlasten) {
    liste.push(laeuft(turnier('tw-herbst', 'Herbstcup (nie abgeschlossen)', '2026-10-24', '09:00')));
    liste.push(turnier('tw-probe', 'Nikolausturnier (Probe)', '2026-11-26', '18:00', { ageClass: 'F2-Junioren' }));
  }
  return liste;
}
