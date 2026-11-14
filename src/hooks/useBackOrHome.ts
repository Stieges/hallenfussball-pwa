/**
 * useBackOrHome – „Zurück“ bleibt in der App (@RE-005): gibt es in dieser Sitzung einen Schritt davor, geht es genau einen Schritt zurück
 * (der Reiter bzw. die Verwaltungs-Seite, von der aus man kam, steht wieder da); wurde die Seite direkt geöffnet (neuer Tab, Link von außen),
 * öffnet sich die Startseite – nie die Seite davor außerhalb der App (leere Seite).
 *
 * Verlauf = `location.key`: der Router vergibt `'default'` nur dem ersten Eintrag einer Sitzung (react-router, History-API ohne eigenen Zustand).
 */
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useBackOrHome(): () => void {
  const navigate = useNavigate();
  const { key } = useLocation();
  const hasHistory = key !== 'default';
  return useCallback(() => {
    void (hasHistory ? navigate(-1) : navigate('/', { replace: true }));
  }, [hasHistory, navigate]);
}
