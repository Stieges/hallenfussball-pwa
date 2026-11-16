/**
 * H4-12 Nachzug W-A: `istAngepfiffen` zählt die Pausen mit (@HT-040, @HT-050). Folgen im Lautsprecher: Abfragetakt 1 s statt 5 s
 * in der Halbzeit, Warnung „keine Verbindung“ auch in den Pausen, nicht nach dem Ende.
 */
import { describe, expect, it } from 'vitest';
import { CTX_11, T0, anpfiff, ev } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { TAKT_ANGEPFIFFEN_MS, TAKT_RUHE_MS } from '../feldStand';
import { warnFelderAus } from '../laufzeitZustand';
import { Lage } from './feldStandTestlage';

async function lageInDerHalbzeit(): Promise<Lage> {
  const bestaetigt = T0 + 340_000;
  const lage = new Lage({ start: bestaetigt });
  lage.setzeSpiel(CTX_11.matchId, { match_status: 'running' });
  lage.sende(CTX_11, [...anpfiff(), ev('SECTION_END', bestaetigt, 1, 340_000)]);
  await lage.runde();
  return lage;
}

describe('@HT-040 Pausen zählen für den Lautsprecher als angepfiffen', () => {
  it('Halbzeit (section_break): Abfragetakt 1 s, nicht 5 s', async () => {
    const lage = await lageInDerHalbzeit();
    expect(lage.stand()?.state.status).toBe('section_break');
    expect(TAKT_RUHE_MS).toBe(5000);
    expect(lage.fs.naechsterAbfrageTaktMs()).toBe(TAKT_ANGEPFIFFEN_MS);
  });

  it('Warnung „keine Verbindung“ gilt in der Halbzeit, nicht nach dem Ende', async () => {
    const lage = await lageInDerHalbzeit();
    const stand = lage.stand();
    if (!stand) {
      throw new Error('kein Stand');
    }
    const warnungen = [{ feldId: stand.feldId }];
    expect([...warnFelderAus(warnungen, [stand], false)]).toEqual([stand.feldId]);
    const beendet = { ...stand, state: { ...stand.state, status: 'finished' as const } };
    expect([...warnFelderAus(warnungen, [beendet], false)]).toEqual([]);
  });
});
