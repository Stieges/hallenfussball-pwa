/** Schnittstelle der Statuszeile (G6): `StatusEintrag` und `StatusZeileProps`. Eigene Datei, damit Logik und Zeile sich nicht gegenseitig importieren. */
import type { ReactNode } from 'react';
import type { StatusPilleAktion, StatusPilleRand, StatusPilleTon } from '../atoms/StatusPille';

export type StatusRang = 'stoerung' | 'probe' | 'hinweis' | 'bereit';

export interface StatusEintrag {
  id: string;
  rang: StatusRang;
  /** Reihenfolge innerhalb eines Rangs (z. B. Feldnummer). */
  reihe?: number;
  ton: StatusPilleTon;
  symbol: ReactNode;
  text: string;
  /** Kurzform für schmale Fenster bei zwei und mehr Einträgen. */
  kurz?: string;
  /** Ausgeschriebener Name für Vorlesehilfen. */
  lesetext?: string;
  rand?: StatusPilleRand;
  aktion: StatusPilleAktion;
  /** Zweite Pille unmittelbar neben diesem Eintrag (z. B. „🔈? Prüfen“ neben „bereit“). Zählt nicht als eigener Eintrag. */
  daneben?: StatusEintrag;
}

export interface StatusZeileProps {
  eintraege: ReadonlyArray<StatusEintrag>;
  /** Text der Sammelpille, z. B. „+2 weitere“. */
  weitereText: (n: number) => string;
  /** Führt Einträge mit `aktion.art === 'navigiere'` aus (im Gastgeber `navigate()`). Pflicht: sonst täte eine antippbare Pille nichts. */
  onNavigiere: (ziel: string) => void;
  /** Name der Zeile für Vorlesehilfen (Bereich), z. B. „Status“. */
  label: string;
  'data-testid'?: string;
}
