/**
 * @HT-060 / @HT-041 Der Hook meldet Abmelden und Kontowechsel, nicht aber die erste Anmeldung eines Tabs und nicht dasselbe Konto.
 */
import { renderHook } from '@testing-library/react';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { beiKontoWechsel } from '../../../../core/auth/kontoWechsel';
import { useKontoWechselMeldung } from '../useKontoWechselMeldung';

const gemeldet = vi.fn();
const aus = beiKontoWechsel(gemeldet);
afterEach(() => { gemeldet.mockClear(); });
afterAll(() => { aus(); });

function mitKonto(start: string | null) {
  return renderHook(({ id }: { id: string | null }) => useKontoWechselMeldung(id), { initialProps: { id: start } });
}

describe('@HT-060 Meldung bei Kontowechsel', () => {
  it('Olli → abgemeldet: gemeldet', () => {
    const { rerender } = mitKonto('olli');
    rerender({ id: null });
    expect(gemeldet).toHaveBeenCalledTimes(1);
  });

  it('Olli → Tom ohne ausdrückliches Abmelden (abgelaufene Sitzung, neues Konto): gemeldet', () => {
    const { rerender } = mitKonto('olli');
    rerender({ id: 'tom' });
    expect(gemeldet).toHaveBeenCalledTimes(1);
  });

  it('dasselbe Konto meldet sich nach dem Abmelden wieder an: genau eine Meldung (beim Abmelden)', () => {
    const { rerender } = mitKonto('olli');
    rerender({ id: null });
    rerender({ id: 'olli' });
    expect(gemeldet).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel @HT-041: ohne Abmelden (gleiche Kennung, neu gerendert) keine Meldung', () => {
    const { rerender } = mitKonto('olli');
    rerender({ id: 'olli' });
    expect(gemeldet).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: erste Anmeldung des Tabs (niemand davor) ist kein Wechsel', () => {
    const { rerender } = mitKonto(null);
    rerender({ id: 'olli' });
    expect(gemeldet).not.toHaveBeenCalled();
  });
});
