/**
 * useTastenkuerzelAn – der Schalter „Tastenkürzel“ in den Einstellungen des Cockpits (WCAG 2.1.4, Plan-Review F7, @SL-189).
 * Je Gerät (nicht je Turnier), Vorbelegung an; steht im `localStorage`, ein Wechsel erreicht alle Stellen im Fenster sofort.
 * Ohne `localStorage` (privater Modus, gesperrt) bleibt der Wert für diese Sitzung im Speicher.
 */
import { useSyncExternalStore } from 'react';

export const TASTENKUERZEL_SCHLUESSEL = 'hallenfussball:cockpit:tastenkuerzel';
const EREIGNIS = 'hallenfussball:tastenkuerzel';
let sitzung = true;

function lies(): boolean {
  try {
    const wert = window.localStorage.getItem(TASTENKUERZEL_SCHLUESSEL);
    return typeof wert === 'string' ? wert !== 'aus' : sitzung;
  } catch { return sitzung; }
}

function abonniere(onChange: () => void): () => void {
  window.addEventListener(EREIGNIS, onChange);
  window.addEventListener('storage', onChange);
  return () => { window.removeEventListener(EREIGNIS, onChange); window.removeEventListener('storage', onChange); };
}

/** Schalter setzen (auch außerhalb von React, z. B. in Tests zum Zurücksetzen). */
export function setzeTastenkuerzel(neu: boolean): void {
  sitzung = neu;
  try { window.localStorage.setItem(TASTENKUERZEL_SCHLUESSEL, neu ? 'an' : 'aus'); } catch { /* nur Sitzung */ }
  window.dispatchEvent(new Event(EREIGNIS));
}

export function useTastenkuerzelAn(): [boolean, (an: boolean) => void] {
  const an = useSyncExternalStore(abonniere, lies, () => true);
  return [an, setzeTastenkuerzel];
}
