/**
 * @ZM-180 „Ein beendetes Spiel bleibt auf jeder Anzeige beendet, auch wenn ein älterer Stand nachkommt“ – Weg „Engine-Kopien
 * dieses Browsers“ (R5 PR 1, Prüfbericht L2a/L2b):
 * Gegeben Spiel 7 ist mit 2:1 beendet, wenn danach auf einem Übertragungsweg noch ein älterer Stand ankommt (1:1, läuft),
 * dann zeigt der Hallenmonitor Feld 1 weiter „Endstand 2:1“.
 */
import { describe, it, expect } from 'vitest';
import { isKnownToServer, withLocalEngineState } from '../localDisplay';
import { buildTournament, withMatch } from './monitorFixture';
import { BIS_1_1, kopie, ZUM_2_1_BEENDET } from './zm180Kopien';
import type { Tournament } from '../../../types/tournament';

/** Turnierkopie: Spiel 7 noch geplant (die Einträge stehen nur in den Engine-Kopien). */
const turnier: Tournament = buildTournament({ matches: withMatch('match-7', { scoreA: undefined, scoreB: undefined, matchStatus: 'scheduled' }) });
const spiel7 = (t: Tournament) => t.matches.find((m) => m.id === 'match-7');
const quelle = (...kopien: ReturnType<typeof kopie>[]) => ({ all: () => Promise.resolve(kopien) });

describe('@ZM-180 L2a: je Spiel gilt die Kopie mit dem weitesten Fortschritt', () => {
  it('Konto A: beendet 2:1 (updatedAt 1), Konto B: 1:1 läuft (updatedAt 9) -> Monitor zeigt Spiel 7 beendet 2:1', async () => {
    const kontoA = kopie('konto-a', [...BIS_1_1, ...ZUM_2_1_BEENDET], { updatedAt: 1 });
    const kontoB = kopie('konto-b', BIS_1_1, { updatedAt: 9 });
    for (const reihenfolge of [[kontoA, kontoB], [kontoB, kontoA]]) {
      const result = await withLocalEngineState(turnier, quelle(...reihenfolge));
      expect(spiel7(result)).toMatchObject({ scoreA: 2, scoreB: 1, matchStatus: 'finished' });
    }
  });

  it('Gegenbeispiel: beide laufend -> der längere Verlauf gilt, nicht die jüngere Kopie', async () => {
    const lang = kopie('konto-a', [...BIS_1_1, ZUM_2_1_BEENDET[0]], { updatedAt: 1 });
    const kurz = kopie('konto-b', BIS_1_1, { updatedAt: 9 });
    const result = await withLocalEngineState(turnier, quelle(kurz, lang));
    expect(spiel7(result)).toMatchObject({ scoreA: 2, scoreB: 1, matchStatus: 'running' });
  });

  it('Gleichstand im Fortschritt -> die jüngere Kopie entscheidet', async () => {
    const alt = kopie('konto-a', [...BIS_1_1.slice(0, 2), { ...BIS_1_1[2], teamId: 'team-nord' }], { updatedAt: 1 });
    const neu = kopie('konto-b', BIS_1_1, { updatedAt: 9 });
    expect(spiel7(await withLocalEngineState(turnier, quelle(alt, neu)))).toMatchObject({ scoreA: 1, scoreB: 1 });
    expect(spiel7(await withLocalEngineState(turnier, quelle(neu, alt)))).toMatchObject({ scoreA: 1, scoreB: 1 });
  });
});

describe('@ZM-180 L2b: bei einem Turnier, das der Server kennt, zählen nur bestätigte Einträge', () => {
  /** Cockpit hat offline abgepfiffen: bestätigt bis 1:1, Tor zum 2:1 und Abpfiff warten noch im Ausgang. */
  const mitWartendemAbpfiff = kopie('olli', BIS_1_1, { pending: ZUM_2_1_BEENDET });

  it('Kopie mit wartendem Abpfiff überlagert ein Cloud-Turnier nicht über den bestätigten Stand hinaus (1:1 läuft)', async () => {
    const result = await withLocalEngineState(turnier, quelle(mitWartendemAbpfiff), { onlyConfirmed: true });
    expect(spiel7(result)).toMatchObject({ scoreA: 1, scoreB: 1, matchStatus: 'running' });
  });

  it('@ZM-179 Gegenprobe: Turnier nur auf diesem Gerät -> wartende Einträge zeigt der Monitor sofort (2:1 beendet)', async () => {
    const result = await withLocalEngineState(turnier, quelle(mitWartendemAbpfiff));
    expect(spiel7(result)).toMatchObject({ scoreA: 2, scoreB: 1, matchStatus: 'finished' });
  });

  it('„Server kennt das Turnier“: Änderungszählung der Cloud oder eigene bestätigte Uploads; neu angelegt nicht', () => {
    expect(isKnownToServer({ changeRevision: 0 })).toBe(true);
    expect(isKnownToServer({ ownUploadsFrom: 3 })).toBe(true);
    expect(isKnownToServer({})).toBe(false);
  });
});
