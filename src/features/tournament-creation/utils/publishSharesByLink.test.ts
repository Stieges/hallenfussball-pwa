/** C-FESTLEGEN-TEILT-NICHT (@W1-037): „Festlegen“ teilt per Link genau dort, wo die Vorschau den Link ankuendigt. */
import { describe, it, expect } from 'vitest';
import { publishSharesByLink } from './publishNotice';

const online = { toCloud: true, isOnline: true, isAnonymous: false };

describe('publishSharesByLink', () => {
  it('angemeldet, online, erstes Festlegen: ja', () => {
    expect(publishSharesByLink({ ...online, visibility: 'shareable' })).toBe(true);
  });
  it('bereits festgelegt und privat: nein', () => {
    expect(publishSharesByLink({ ...online, visibility: 'private' })).toBe(false);
  });
  it('Gast (nicht in der Cloud): nein', () => {
    expect(publishSharesByLink({ ...online, toCloud: false, visibility: 'shareable' })).toBe(false);
  });
  it('ohne Netz: nein', () => {
    expect(publishSharesByLink({ ...online, isOnline: false, visibility: 'shareable' })).toBe(false);
  });
  it('anonymes Konto: nein', () => {
    expect(publishSharesByLink({ ...online, isAnonymous: true, visibility: 'shareable' })).toBe(false);
  });
});
