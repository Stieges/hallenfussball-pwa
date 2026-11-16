/**
 * useBackOrHome – „Zurück“ bleibt in der App (@RE-005, @OB-090): gibt es in dieser Sitzung einen Schritt davor, geht es genau einen Schritt zurück
 * (der Reiter bzw. die Verwaltungs-Seite, von der aus man kam, steht wieder da); wurde die Seite direkt geöffnet (neuer Tab, Link von außen,
 * auch wenn sie danach per `replace` weitergeleitet wurde), öffnet sich die Startseite – nie die Seite davor außerhalb der App (leere Seite).
 *
 * Verlauf = Index im History-State: react-router (Browser- und Hash-Verlauf, installiert 7.x) legt `idx` im `window.history.state` ab;
 * der erste Eintrag einer Sitzung hat 0, `push` zählt hoch, `replace` behält den Index. Der Schlüssel `location.key` taugt nicht: er wird auch bei
 * `replace` neu vergeben. Fehlt `idx` (kein Zustand), gilt „keine vorige Seite“ → Startseite.
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

function hatVorigeSeite(): boolean {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' && idx > 0;
}

export function useBackOrHome(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    void (hatVorigeSeite() ? navigate(-1) : navigate('/', { replace: true }));
  }, [navigate]);
}
