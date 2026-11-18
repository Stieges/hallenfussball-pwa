/**
 * Bildschirmverhältnis (Breite durch Höhe) des Monitors für die schmale Aufteilung der Listen-Folien (@ZM-211): die Breite der Namensspalten
 * hängt daran. Folgt der Fenstergröße; ohne Fenster 16:9.
 */
import { useEffect, useState } from 'react';

const QUERFORMAT = 16 / 9;

/** Sichtfläche des Dokuments (ohne Bildlaufleisten); wo es keine Maße gibt (Testumgebung ohne Layout), 16:9. */
function lies(): number {
  if (typeof document === 'undefined') { return QUERFORMAT; }
  const { clientWidth, clientHeight } = document.documentElement;
  return clientWidth > 0 && clientHeight > 0 ? clientWidth / clientHeight : QUERFORMAT;
}

export function useBildAspekt(): number {
  const [aspekt, setAspekt] = useState(lies);
  useEffect(() => {
    const aktualisiere = (): void => { setAspekt(lies()); };
    window.addEventListener('resize', aktualisiere);
    return () => { window.removeEventListener('resize', aktualisiere); };
  }, []);
  return aspekt;
}
