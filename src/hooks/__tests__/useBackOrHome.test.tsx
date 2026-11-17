/**
 * @RE-005 „Zurück“ auf Impressum und Datenschutz führt immer in die App zurück.
 * Zeilen des Gherkins (docs/anforderungen/2026-10-03_recht-impressum-datenschutz.md): vom Reiter „Info“ der Zuschauer-Seite aus → wieder dort;
 * Adresse direkt geöffnet → Startseite (die App wird nicht verlassen). Beide Seiten.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { HashRouter, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ImpressumScreen } from '../../screens/ImpressumScreen';
import { DatenschutzScreen } from '../../screens/DatenschutzScreen';
import { useBackOrHome } from '../useBackOrHome';

const Ort = () => { const l = useLocation(); return <p data-testid="ort">{l.pathname}{l.search}</p>; };
const Impressum = () => <ImpressumScreen onBack={useBackOrHome()} />;
const Datenschutz = () => <DatenschutzScreen onBack={useBackOrHome()} />;

/** Die Attrappe des Routers kennt keinen Browser-Verlauf: den Index setzt der Test, wie react-router ihn im Browser ablegt. */
function zeige(eintraege: string[], index?: number) {
  window.history.replaceState({ idx: index ?? 0 }, '');
  return render(
    <MemoryRouter initialEntries={eintraege} {...(index === undefined ? {} : { initialIndex: index })}>
      <Ort />
      <Routes>
        <Route path="/" element={<p>Startseite</p>} />
        <Route path="/live/:code" element={<p>Zuschauer-Seite</p>} />
        <Route path="/impressum" element={<Impressum />} />
        <Route path="/datenschutz" element={<Datenschutz />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe.each([['/datenschutz', 'Datenschutz'], ['/impressum', 'Impressum']])('@RE-005 Seite %s (%s)', (pfad) => {
  it('mit Verlauf (vom Reiter „Info“ der Zuschauer-Seite): ein Schritt zurück, derselbe Reiter', async () => {
    zeige(['/live/NORD28?tab=info', pfad], 1);
    expect(screen.getByTestId('ort')).toHaveTextContent(pfad);
    await userEvent.click(screen.getByTestId('legal-back-button'));
    expect(screen.getByTestId('ort')).toHaveTextContent('/live/NORD28?tab=info');
    expect(screen.getByText('Zuschauer-Seite')).toBeInTheDocument();
  });

  it('Gegenbeispiel: direkt geöffnet (kein Verlauf): die Startseite der App, kein Schritt aus der App hinaus', async () => {
    zeige([pfad]);
    await userEvent.click(screen.getByTestId('legal-back-button'));
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/$/);
    expect(screen.getByText('Startseite')).toBeInTheDocument();
  });
});

describe('@RE-005 der Kopf mit „Zurück“ bleibt beim Scrollen oben stehen', () => {
  it('Kopf ist sticky am oberen Rand mit Fläche aus dem Token, die Taste liegt darin und ist ≥ 44 px hoch', () => {
    zeige(['/datenschutz']);
    const kopf = screen.getByTestId('legal-header');
    expect(kopf.style.position).toBe('sticky');
    expect(kopf.style.top).toBe('0px');
    expect(kopf.style.background).not.toBe('');
    expect(kopf).toContainElement(screen.getByTestId('legal-back-button'));
    expect(screen.getByTestId('legal-back-button').style.minHeight).toBe('44px');
  });
});

/** Echter Hash-Verlauf wie im Browser: Mail-Link öffnet /auth/confirm als ersten Eintrag, die App leitet per `replace` auf /login weiter. */
describe('@OB-090 Weiterleitung per replace ist kein Schritt davor', () => {
  const Weiterleitung = () => { const navigate = useNavigate(); useEffect(() => { void navigate('/login', { replace: true }); }, [navigate]); return null; };
  const Anmeldung = () => <button type="button" data-testid="login-zurueck" onClick={useBackOrHome()}>zurueck</button>;

  it('direkt geöffnet → per replace auf /login → „Zurück“ → Startseite (nicht die Seite davor)', async () => {
    window.history.replaceState(null, '', '#/auth/confirm');
    render(
      <HashRouter>
        <Ort />
        <Routes>
          <Route path="/" element={<p>Startseite</p>} />
          <Route path="/auth/confirm" element={<Weiterleitung />} />
          <Route path="/login" element={<Anmeldung />} />
        </Routes>
      </HashRouter>,
    );
    await userEvent.click(await screen.findByTestId('login-zurueck'));
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/$/);
    expect(screen.getByText('Startseite')).toBeInTheDocument();
  });

  it('Gegenbeispiel: Startseite → push auf /login → „Zurück“ → vorige Seite', async () => {
    window.history.replaceState(null, '', '#/');
    const Auf = () => { const navigate = useNavigate(); return <button type="button" data-testid="zu-login" onClick={() => void navigate('/login')}>login</button>; };
    render(
      <HashRouter>
        <Ort />
        <Routes>
          <Route path="/" element={<Auf />} />
          <Route path="/login" element={<Anmeldung />} />
        </Routes>
      </HashRouter>,
    );
    await userEvent.click(screen.getByTestId('zu-login'));
    await userEvent.click(await screen.findByTestId('login-zurueck'));
    await waitFor(() => expect(screen.getByTestId('zu-login')).toBeInTheDocument());
  });
});
