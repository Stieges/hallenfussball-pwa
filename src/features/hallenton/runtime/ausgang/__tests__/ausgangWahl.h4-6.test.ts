/**
 * H4-6 Wahl des Ausgangs, lokal je Gerät (@HT-053): bleibt nach dem Neuladen erhalten, erreicht jeden Tab über `storage`,
 * „Standard“ löscht sie, kaputte Einträge gelten als „Standard“. Die Wahl steht nur unter `hallenton:ausgang`.
 */
import { describe, expect, it } from 'vitest';
import { FalschesGeraet } from '../../../../../test/hallenton/falschesGeraet';
import { AUSGANG_SCHLUESSEL, erzeugeAusgangWahl } from '../ausgangWahl';

const DOCK = { id: 'dock', name: 'ThinkPad Thunderbolt 3 Dock USB Audio', gruppe: 'g-dock' };

function seite(geraet: FalschesGeraet) {
  const s = geraet.neueSeite();
  return erzeugeAusgangWahl({ speicher: s.speicher, seite: s.seite });
}

describe('@HT-053 Die Wahl bleibt nach dem Neuladen erhalten', () => {
  it('@HT-053 Olli wählt das Dock → eine neue Seite auf demselben Gerät liest Kennung, Name und Gruppe; gespeichert unter hallenton:ausgang', () => {
    const geraet = new FalschesGeraet();
    seite(geraet).setzen(DOCK);
    expect(seite(geraet).lesen()).toEqual(DOCK);
    expect(JSON.parse(geraet.speicher.getItem(AUSGANG_SCHLUESSEL) ?? 'null')).toEqual(DOCK);
    expect(AUSGANG_SCHLUESSEL).toBe('hallenton:ausgang');
  });

  it('Standard (null) löscht die Wahl; die Systemstandard-Kennung wird nie als Wahl gespeichert', () => {
    const geraet = new FalschesGeraet();
    const wahl = seite(geraet);
    wahl.setzen(DOCK);
    wahl.setzen(null);
    expect(geraet.speicher.getItem(AUSGANG_SCHLUESSEL)).toBeNull();
    wahl.setzen({ id: 'default', name: 'Standard', gruppe: 'g' });
    expect(wahl.lesen()).toBeNull();
  });

  it('ein kaputter oder unvollständiger Eintrag gilt als „Standard“ und wirft nicht', () => {
    const geraet = new FalschesGeraet();
    geraet.speicher.setItem(AUSGANG_SCHLUESSEL, '{kaputt');
    expect(seite(geraet).lesen()).toBeNull();
    geraet.speicher.setItem(AUSGANG_SCHLUESSEL, JSON.stringify({ id: 'x' }));
    expect(seite(geraet).lesen()).toBeNull();
  });

  it('ohne Speicher (gesperrt) gilt die Wahl bis zum Neuladen im Arbeitsspeicher, nichts wirft', () => {
    const wahl = erzeugeAusgangWahl({ speicher: null, seite: null });
    wahl.setzen(DOCK);
    expect(wahl.lesen()).toEqual(DOCK);
  });
});

describe('@HT-053 Die Wahl in Tab A erreicht Tab B', () => {
  it('@HT-053 A wählt → B wird benachrichtigt und liest die neue Wahl (storage); A selbst meldet über setzen', () => {
    const geraet = new FalschesGeraet();
    const a = seite(geraet);
    const b = seite(geraet);
    const inB: Array<string | null> = [];
    const inA: Array<string | null> = [];
    b.beobachten(() => inB.push(b.lesen()?.id ?? null));
    a.beobachten(() => inA.push(a.lesen()?.id ?? null));
    a.setzen(DOCK);
    a.setzen(null);
    expect(inB).toEqual(['dock', null]);
    expect(inA).toEqual(['dock', null]);
  });

  it('nach der Abmeldung kommt nichts mehr an', () => {
    const geraet = new FalschesGeraet();
    const a = seite(geraet);
    const b = seite(geraet);
    let n = 0;
    b.beobachten(() => { n += 1; })();
    a.setzen(DOCK);
    expect(n).toBe(0);
  });
});
