/**
 * @OB-087: der gemerkte Rückweg nach der Anmeldung („Anmelden“ im Cockpit) gehört zum Konto – beim Abmelden dieses Geräts wird er vergessen,
 * damit sich danach ein anderes Konto nicht im Cockpit des vorigen wiederfindet. „Auf allen anderen Geräten abmelden“ lässt dieses Gerät unberührt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAuthActionDeps } from './mocks/supabaseMock';
import { FalscherSpeicher } from '../../../../test/hallenton/falschesGeraet';

vi.mock('../../../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));

import { holeRueckkehr, merkeRueckkehr } from '../../utils/loginRueckkehr';
import { logout } from '../logoutAction';

const COCKPIT = '/tournament/hallencup-nord/live?f=2';

beforeEach(() => {
  const speicher = new FalscherSpeicher();
  vi.mocked(localStorage.getItem).mockImplementation((k: string) => speicher.getItem(k));
  vi.mocked(localStorage.setItem).mockImplementation((k: string, w: string) => speicher.setItem(k, w));
  vi.mocked(localStorage.removeItem).mockImplementation((k: string) => speicher.removeItem(k));
});

describe('logout (@OB-087) – der gemerkte Rückweg nach der Anmeldung', () => {
  it('Abmelden dieses Geräts vergisst den Rückweg: die nächste Anmeldung führt zur Startseite', async () => {
    merkeRueckkehr(COCKPIT);
    await logout(createMockAuthActionDeps());
    expect(holeRueckkehr()).toBeNull();
  });

  it('Gegenbeispiel: ohne Abmelden bleibt der Rückweg (Anmelden aus dem Cockpit bei abgelaufener Sitzung)', () => {
    merkeRueckkehr(COCKPIT);
    expect(holeRueckkehr()).toBe(COCKPIT);
  });
});
