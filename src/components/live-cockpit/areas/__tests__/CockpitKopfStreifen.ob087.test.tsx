/**
 * @OB-087 Zeile 3 im echten Streifen unter der Tafel: der Tipp auf „Anmelden“ führt zur Anmeldung (Route `/login`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { holeRueckkehr, RUECKKEHR_SCHLUESSEL } from '../../../../features/auth/utils/loginRueckkehr';
import { FalscherSpeicher } from '../../../../test/hallenton/falschesGeraet';
import { emptyOutboxStatus } from '../../../../core/match/client/outboxTypes';

vi.mock('../../../../features/collaboration', () => ({ AwaitingServerCopyLine: () => null }));
vi.mock('../../../../features/hallenton/ui/CockpitHallHinweis', () => ({ CockpitHallHinweis: () => null }));

import { CockpitKopfStreifen } from '../CockpitKopfStreifen';

const speicherBinden = (): void => {
  const speicher = new FalscherSpeicher();
  vi.mocked(localStorage.getItem).mockImplementation((k: string) => speicher.getItem(k));
  vi.mocked(localStorage.setItem).mockImplementation((k: string, w: string) => speicher.setItem(k, w));
  vi.mocked(localStorage.removeItem).mockImplementation((k: string) => speicher.removeItem(k));
};
beforeEach(speicherBinden);

function zeige(authRequired: boolean, adresse = '/tournament/t1/live') {
  return render(
    <MemoryRouter initialEntries={[adresse]}>
      <Routes>
        <Route path="/login" element={<div data-testid="anmeldung" />} />
        <Route
          path="*"
          element={(
            <CockpitKopfStreifen
              tournamentId="t1" matchId="m1" feldId="field-1" zustand="laeuft" verdeckt={false} readOnly={false} fremdGesteuert={false}
              outboxStatus={{ ...emptyOutboxStatus(), authRequired }} onOutboxReload={vi.fn()} nurZusehen={null}
            />
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('@OB-087 Zeile 3 – Cockpit: „Anmelden“ am Hinweis „Bitte neu anmelden“', () => {
  it('@OB-087 Zeile 3: der Tipp auf „Anmelden“ öffnet die Anmeldung', () => {
    zeige(true);
    fireEvent.click(screen.getByTestId('outbox-notice-login'));
    expect(screen.getByTestId('anmeldung')).toBeInTheDocument();
  });

  it('@OB-087 Zeile 3: der Tipp merkt das Cockpit dieses Felds für die Rückkehr nach der Anmeldung', () => {
    zeige(true, '/tournament/t1/live?f=2');
    fireEvent.click(screen.getByTestId('outbox-notice-login'));
    expect(holeRueckkehr()).toBe('/tournament/t1/live?f=2');
  });

  it('@OB-087 Zeile 3 Gegenbeispiel: ohne Tipp wird nichts gemerkt', () => {
    zeige(true, '/tournament/t1/live?f=2');
    expect(window.localStorage.getItem(RUECKKEHR_SCHLUESSEL)).toBeNull();
  });

  it('@OB-087 Zeile 3 Gegenbeispiel: ist die Sitzung gültig, steht weder Hinweis noch Taste da', () => {
    zeige(false);
    expect(screen.queryByTestId('outbox-notice-login')).toBeNull();
    expect(screen.queryByTestId('outbox-notice')).toBeNull();
  });
});
