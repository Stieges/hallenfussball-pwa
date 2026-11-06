/**
 * Teile der Leibchen-Wahl für die Spielfläche (@SL-137, @SL-148): je Anzeigeseite die Taste in der Team-Spalte, darunter Farbe und Hinweise.
 * Die Anzeigeseiten folgen `useSideOrder` (Seiten tauschen, @SL-065).
 */
import type { ReactNode } from 'react';
import type { Side } from '../model/cockpitTypes';
import type { LeibchenWahlZustand } from '../hooks/useLeibchenWahl';
import { AnpfiffLeibchen, LeibchenSeite } from './AnpfiffLeibchen';

export interface AnpfiffTeile { links: ReactNode; rechts: ReactNode; unten: ReactNode }

export function anpfiffTeile(zustand: LeibchenWahlZustand, teams: { a: string; b: string }, order: { links: Side; rechts: Side }): AnpfiffTeile {
  const taste = (s: Side): ReactNode => (
    <LeibchenSeite zustand={zustand} seite={s === 'home' ? 'a' : 'b'} team={s === 'home' ? teams.a : teams.b} />
  );
  return { links: taste(order.links), rechts: taste(order.rechts), unten: <AnpfiffLeibchen zustand={zustand} teams={teams} /> };
}
