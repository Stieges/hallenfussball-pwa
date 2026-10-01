/**
 * fairPlayProfiles (C3b-2 F3b1, PO 30.09.): austauschbares Fair-Play-Regelprofil -- framework-frei
 * (kein React), damit `calculateFairPlay` (src/utils/calculations.ts) keine festen Punktwerte mehr
 * im Code haelt. Weniger Punkte = besser.
 *
 * `secondYellowReplacesFirst` gilt NUR fuer "Gelb, dann spaeter Gelb-Rot desselben Spielers" --
 * die fruehere Gelbe wird in der Rechnung ersetzt (nicht zusaetzlich gezaehlt). Das aendert nichts
 * an den Spiel-Eintraegen selbst (die bleiben unveraendert), nur an der Fair-Play-Summe.
 *
 * `yellowPlusRed` gilt fuer "Gelb + direktes Rot (kein Gelb-Rot) desselben Spielers" -- entweder
 * ein fester Punktwert oder 'SUM' (= yellow + red addiert).
 *
 * Kombinationen gelten nur je Spieler (Team + Rueckennummer) innerhalb desselben Spiels; ohne
 * Rueckennummer gibt es keine Zusammenfuehrung (jeder Eintrag zaehlt fuer sich).
 */

export interface FairPlayProfile {
  readonly name: string;
  readonly yellow: number;
  readonly yellowRed: number;
  readonly red: number;
  readonly timePenalty: number;
  readonly secondYellowReplacesFirst: boolean;
  readonly yellowPlusRed: number | 'SUM';
}

/** DFBnet (Standard, NFV-FAQ fussball.de). */
export const DFBNET_PROFILE: FairPlayProfile = {
  name: 'DFBNET',
  yellow: 1,
  yellowRed: 3,
  red: 5,
  timePenalty: 3,
  secondYellowReplacesFirst: true,
  yellowPlusRed: 'SUM',
};

export const UEFA_PROFILE: FairPlayProfile = {
  name: 'UEFA',
  yellow: 1,
  yellowRed: 3,
  red: 3,
  timePenalty: 0,
  secondYellowReplacesFirst: true,
  yellowPlusRed: 4,
};

export const FIFA_PROFILE: FairPlayProfile = {
  name: 'FIFA',
  yellow: 1,
  yellowRed: 3,
  red: 4,
  timePenalty: 0,
  secondYellowReplacesFirst: true,
  yellowPlusRed: 5,
};

/** Produktivcode ohne Profil-Parameter nutzt diesen Standard (DFBNET). */
export const DEFAULT_FAIR_PLAY_PROFILE: FairPlayProfile = DFBNET_PROFILE;
