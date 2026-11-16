/**
 * H4-6 Liste der Ausgänge und Mikrofon-Freigabe (@HT-053): ohne Freigabe nur „Standard“; nach Freigabe Namen, der Strom sofort
 * beendet, virtuelle Geräte am Ende; abgelehnt oder ohne `mediaDevices` wirft nichts.
 */
import { describe, expect, it } from 'vitest';
import { FalscheMedienGeraete } from '../../../../../test/hallenton/falscheMedienGeraete';
import { erzeugeAusgangListe } from '../ausgangListe';

const liste = (medien: FalscheMedienGeraete | null) => erzeugeAusgangListe({ geraete: medien, berechtigungen: medien });

describe('@HT-053 Ausgang wählen: Mikrofon nicht freigegeben', () => {
  it('@HT-053 Olli das Mikrofon nicht freigegeben hat → steht nur „Standard“ zur Wahl: die Liste ist leer, das Mikrofon wurde nie angefragt', async () => {
    const medien = new FalscheMedienGeraete();
    const ergebnis = await liste(medien).lesen();
    expect(ergebnis).toEqual({ eintraege: [], lesbar: false });
    expect(medien.mikrofonAnfragen).toBe(0);
    expect(await liste(medien).erlaubnis()).toBe('prompt');
  });
});

describe('@HT-053 Ausgang wählen: Mikrofon einmal erlaubt', () => {
  it('@HT-053 Olli das Mikrofon einmal erlaubt → alle Ausgänge mit Namen, das Mikrofon sofort wieder frei, virtuelle am Ende', async () => {
    const medien = new FalscheMedienGeraete();
    const quelle = liste(medien);
    expect(await quelle.mikrofonErlauben()).toBe(true);
    expect(medien.mikrofonAnfragen).toBe(1);
    expect(medien.spuren).toHaveLength(1);
    expect(medien.spuren.every((s) => s.gestoppt)).toBe(true); // Strom sofort beendet, noch vor dem Lesen der Namen
    const { eintraege, lesbar } = await quelle.lesen();
    expect(lesbar).toBe(true);
    expect(eintraege.map((e) => e.name)).toEqual([
      'Standard - MacBook Pro-Lautsprecher (Built-in)', 'LG Ultra HD (DisplayPort)',
      'ThinkPad Thunderbolt 3 Dock USB Audio (17ef:306a)', 'MacBook Pro-Lautsprecher (Built-in)', 'Microsoft Teams Audio Device (Virtual)',
    ]);
    expect(eintraege.at(-1)?.virtuell).toBe(true);
    expect(eintraege.some((e) => e.name.includes('Mikrofon'))).toBe(false); // nur Ausgänge
    expect(medien.mikrofonAnfragen).toBe(1); // Lesen fragt nie nach
  });

  it('Gegenbeispiel: Olli lehnt die Frage ab → false, nichts wirft, die Liste bleibt leer', async () => {
    const medien = new FalscheMedienGeraete();
    medien.ablehnen = true;
    const quelle = liste(medien);
    expect(await quelle.mikrofonErlauben()).toBe(false);
    expect(await quelle.lesen()).toEqual({ eintraege: [], lesbar: false });
    expect(medien.spuren).toHaveLength(0);
  });
});

describe('@HT-053 Browser ohne Ausgangswahl', () => {
  it('@HT-053 ohne mediaDevices: leere Liste, Mikrofon nicht möglich, nichts wirft', async () => {
    const quelle = liste(null);
    expect(quelle.verfuegbar()).toBe(false);
    expect(await quelle.lesen()).toEqual({ eintraege: [], lesbar: false });
    expect(await quelle.mikrofonErlauben()).toBe(false);
    expect(await quelle.erlaubnis()).toBeNull();
    expect(() => quelle.beiGeraeteWechsel(() => undefined)()).not.toThrow();
  });

  it('permissions.query für das Mikrofon scheitert (Safari) → Erlaubnis unbekannt (null), nichts wirft', async () => {
    const medien = new FalscheMedienGeraete();
    medien.ohneBerechtigungen = true;
    expect(await liste(medien).erlaubnis()).toBeNull();
  });
});
