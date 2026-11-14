/**
 * @RE-005 „Zurück“ auf Impressum und Datenschutz führt immer in die App zurück.
 * Zeilen des Gherkins (docs/anforderungen/2026-10-03_recht-impressum-datenschutz.md): vom Reiter „Info“ der Zuschauer-Seite aus → wieder dort;
 * Adresse direkt geöffnet → Startseite (die App wird nicht verlassen). Beide Seiten.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ImpressumScreen } from '../../screens/ImpressumScreen';
import { DatenschutzScreen } from '../../screens/DatenschutzScreen';
import { useBackOrHome } from '../useBackOrHome';

const Ort = () => { const l = useLocation(); return <p data-testid="ort">{l.pathname}{l.search}</p>; };
const Impressum = () => <ImpressumScreen onBack={useBackOrHome()} />;
const Datenschutz = () => <DatenschutzScreen onBack={useBackOrHome()} />;

function zeige(eintraege: string[], index?: number) {
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
