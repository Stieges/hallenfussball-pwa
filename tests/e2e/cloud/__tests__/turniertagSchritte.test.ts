// TM-1 (@TA-013 bis @TA-016) für den Durchstich (Nebenlinie `d*.ts` und Hauptlinie Nikolaus `nikolaus-*.ts`): die Schritte unter turniertag/steps/ sind Daten, die EIN Playwright-Test mit
// Template-Titel abspielt -- der Szenario-Scanner sieht sie nicht. Dieser Wächter liest die Step-Module und stellt sicher:
//  - jeder erwartet rote Schritt (`expectedFail`) nennt einen Besitzer ODER mindestens einen Befund (`befunde`);
//    für ungebaute Pakete genügt der Besitzer, ein Befund gehört nur dorthin, wo gebauter Code von der Anforderung abweicht;
//  - jede Befund-Kennung hat die Schreibweise C-… oder DF-nnn (@TA-023); bekannt? prüft scenario-tests.mjs lokal (@TA-024);
//  - jeder erwartet grüne Schritt trägt mindestens eine Szenario-Kennung;
//  - Schritt-Kennungen sind eindeutig.
import { describe, expect, it } from 'vitest';
import type { TurniertagStep } from '../turniertag/steps/types';

const SCHRITT_MODULE = import.meta.glob<Record<string, unknown>>(['../turniertag/steps/d*.ts', '../turniertag/steps/nikolaus-*.ts'], { eager: true });
const SZENARIO = /^@[A-Z][A-Z0-9]{0,3}-\d{3}$/;

function istSchritt(x: unknown): x is TurniertagStep {
  return typeof x === 'object' && x !== null && 'id' in x && 'expectedFail' in x && 'run' in x;
}

const schritte: TurniertagStep[] = Object.values(SCHRITT_MODULE).flatMap((modul) =>
  Object.values(modul).flatMap((wert) => (Array.isArray(wert) ? wert.filter(istSchritt) : []))
);
/** Schreibweise eines Befund- oder Defekt-Verweises (@TA-023); ob er bekannt ist, prüft `scenario-tests.mjs` lokal gegen die Befundliste (@TA-024). */
const BEFUND_FORM = /^(?:C-[A-Z0-9ÄÖÜ]+(?:-[A-Z0-9ÄÖÜ]+)*|DF-\d{3})$/;

describe('Durchstich-Schritte (TM-1)', () => {
  it('findet die Schritte der Step-Module', () => {
    expect(schritte.length).toBeGreaterThan(40);
  });

  it('@TA-013 jeder erwartet rote Schritt hat einen Besitzer oder mindestens einen Befund', () => {
    const ohne = schritte.filter((s) => s.expectedFail && !s.owner.trim() && (s.befunde ?? []).length === 0).map((s) => s.id);
    expect(ohne).toEqual([]);
  });

  it('@TA-023 jede Befund-Kennung der Schritte hat die Schreibweise C-… oder DF-nnn', () => {
    const falsch = schritte.flatMap((s) => (s.befunde ?? []).filter((b) => !BEFUND_FORM.test(b)).map((b) => `${s.id}: ${b}`));
    expect(falsch).toEqual([]);
  });

  it('jeder erwartet grüne Schritt trägt mindestens eine Szenario-Kennung', () => {
    const ohne = schritte.filter((s) => !s.expectedFail && s.scenarios.length === 0).map((s) => s.id);
    expect(ohne).toEqual([]);
  });

  it('alle Szenario-Kennungen der Schritte haben die Form @XX-nnn', () => {
    const falsch = schritte.flatMap((s) => s.scenarios.filter((k) => !SZENARIO.test(k)).map((k) => `${s.id}: ${k}`));
    expect(falsch).toEqual([]);
  });

  it('Schritt-Kennungen sind eindeutig', () => {
    const ids = schritte.map((s) => s.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
});
