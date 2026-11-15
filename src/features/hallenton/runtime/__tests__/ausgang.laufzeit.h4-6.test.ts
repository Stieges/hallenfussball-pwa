/**
 * H4-6 Ausgang auf Laufzeit-Ebene (@HT-053, @HT-054, @HT-055, Regel 3 aus @HT-033): echter Spieler, echter Wächter, echte Laufzeit
 * und Lebenszeichen auf gefälschtem AudioContext (`setSinkId`, `sinkchange`), gefälschten `mediaDevices` und Server-Doppel.
 * Erwartungen aus den Beispielzeilen der Anforderung (docs/anforderungen/2026-10-15_hallenton.md), nicht am Code abgelesen.
 * Ende von Spiel 11 = `ENDE_A2`; Hallen-Lautsprecher ist der Rechner der Turnierleitung (Feld 1).
 */
import { describe, expect, it, vi } from 'vitest';
import { ABSCHNITT_MS, ENDE_A2, T0, ev, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { AUSGAENGE, FalscheMedienGeraete, type FalscherAusgang } from '../../../../test/hallenton/falscheMedienGeraete';
import { FalscherHallServer } from '../../../../test/hallenton/falscherHallServer';
import { FalschesGeraet } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { AUSGANG_SCHLUESSEL } from '../ausgang/ausgangWahl';
import { feldAus, Tab } from './laufzeitTestlage';
import { LzTab } from './lebenszeichenTestlage';
import { flush } from './feldStandTestlage';

const DOCK: FalscherAusgang = AUSGAENGE.find((a) => a.id === 'dock')!;
const LG: FalscherAusgang = AUSGAENGE.find((a) => a.id === 'lg')!;
const BEENDET = [...zweiterAbschnitt(), ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)];

interface Lage {
  uhr: ManuelleUhr;
  geraet: FalschesGeraet;
  medien: FalscheMedienGeraete;
  server: FalscherHallServer;
}

function lage(o: { dauerhaft?: boolean; erlaubt?: boolean } = {}): Lage {
  const uhr = new ManuelleUhr(ENDE_A2 - 30_000);
  const medien = new FalscheMedienGeraete();
  medien.erlaubt = o.erlaubt ?? true;
  medien.dauerhaft = o.dauerhaft ?? true;
  const server = new FalscherHallServer(() => uhr.jetzt(), (fn, ms) => { uhr.gruppe('netz').spaeter(fn, ms); });
  server.zuordnen(1, 'laptop');
  return { uhr, geraet: new FalschesGeraet(), medien, server };
}

/** Ein Tab des Geräts mit Ausgang-Wächter; das Spiel 11 endet bei `ENDE_A2` (Stand am Server). */
function tab(l: Lage, name = 'A', mitMedien = true): LzTab {
  const t = new LzTab({ start: l.uhr.jetzt(), uhr: l.uhr, geraet: l.geraet, server: l.server, name, medien: mitMedien ? l.medien : undefined });
  const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }, { ab: ENDE_A2, log: BEENDET }]);
  t.tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
  t.tab.kontext.vorhandeneAusgaenge = new Set(l.medien.ausgaenge.map((a) => a.id));
  return t;
}

/** Wie V-AUSGANG Teil 2: der Browser meldet das Abziehen, die Ausgabe darauf steht still. */
function abziehen(l: Lage, tabs: LzTab[], id: string): void {
  for (const t of tabs) {
    t.tab.kontext.ausgangVerschwindet(id);
  }
  l.medien.abziehen(id);
}

function anstecken(l: Lage, tabs: LzTab[], ausgang: FalscherAusgang): void {
  for (const t of tabs) {
    t.tab.kontext.vorhandeneAusgaenge?.add(ausgang.id);
  }
  l.medien.anstecken(ausgang);
}

function speichereWahl(l: Lage, wahl: FalscherAusgang): void {
  l.geraet.speicher.setItem(AUSGANG_SCHLUESSEL, JSON.stringify({ id: wahl.id, name: wahl.name, gruppe: wahl.gruppe }));
}

const zustand = (t: LzTab) => t.tab.laufzeit.getSnapshot().geraeteZustand;

describe('@HT-053 Der gewählte Ausgang gilt für den Hallenton', () => {
  it('@HT-053 Olli „ThinkPad Thunderbolt 3 Dock USB Audio“ gewählt → der Abpfiff-Ton von Feld 1 kommt über diesen Ausgang, bereit', async () => {
    const l = lage();
    speichereWahl(l, DOCK);
    const a = tab(l);
    await a.starte();
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock']);
    expect(a.tab.kontext.sinkId).toBe('dock');
    expect(zustand(a)).toBe('ready');
    await a.vor(35_000);
    expect(a.tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock']); // nie ein Wechsel auf „Standard“
  });

  it('@HT-053 die Wahl wird erst nach „Ton aktivieren“ gesetzt; vorher kein Aufruf von setSinkId, nichts erklingt', async () => {
    const l = lage();
    speichereWahl(l, DOCK);
    const a = tab(l);
    await a.starte({ aktivieren: false });
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual([]);
    expect(a.tab.kontext.quellen).toHaveLength(0);
  });

  it('@HT-053 Browser ohne Ausgangswahl (setSinkId fehlt): ohne Wahl „Standard“, nichts wirft, der Ton kommt wie bisher', async () => {
    const l = lage();
    const a = tab(l);
    a.tab.kontext.ohneSetSinkId();
    await a.starte();
    expect(zustand(a)).toBe('ready');
    await a.vor(35_000);
    expect(a.tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
  });

  it('@HT-053 Browser ohne Ausgangswahl, aber eine Wahl ist gespeichert: nie still über „Standard“ – unbestätigt, kein Ton', async () => {
    const l = lage();
    speichereWahl(l, DOCK);
    const a = tab(l);
    a.tab.kontext.ohneSetSinkId();
    await a.starte();
    await a.vor(35_000);
    expect(zustand(a)).toBe('output_unconfirmed');
    expect(a.tab.toene()).toEqual([]);
  });

  it('@HT-053 Wahl in Tab A wirkt im tönenden Tab B; „Standard“ in A setzt B zurück', async () => {
    const l = lage();
    const b = tab(l, 'B');
    await b.starte();
    expect(b.tab.kontext.setSinkIdAufrufe).toEqual([]); // ohne Wahl nie ein Aufruf
    const a = tab(l, 'A');
    a.tab.wahl.setzen({ id: DOCK.id, name: DOCK.name, gruppe: DOCK.gruppe });
    await flush();
    expect(b.tab.kontext.setSinkIdAufrufe).toEqual(['dock']);
    expect(zustand(b)).toBe('ready');
    a.tab.wahl.setzen(null);
    await flush();
    expect(b.tab.kontext.setSinkIdAufrufe).toEqual(['dock', '']);
    expect(b.tab.kontext.sinkId).toBe('');
    expect(zustand(b)).toBe('ready');
  });
});

describe('@HT-054 Verschwindet der gewählte Ausgang, wechselt der Hallenton nicht still auf einen anderen', () => {
  async function dockLaeuft(): Promise<{ l: Lage; a: LzTab }> {
    const l = lage();
    speichereWahl(l, DOCK);
    const a = tab(l);
    await a.starte();
    return { l, a };
  }

  it('@HT-054 das Dock abgezogen wird → „nicht bereit – Ausgang verloren“ (Zustand output_lost), kein Ton aus den Lautsprechern des Laptops, nichts nachgeholt', async () => {
    const { l, a } = await dockLaeuft();
    await a.vor(20_000, [{ um: ENDE_A2 - 12_000, tu: () => abziehen(l, [a], 'dock') }]);
    expect(zustand(a)).toBe('output_lost');
    await a.vor(20_000); // das Ende bei ENDE_A2 fällt in die Zeit ohne Ausgang
    expect(a.tab.toene()).toEqual([]);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock']); // nie auf „Standard“ oder den Laptop gewechselt
    expect(a.tab.kontext.sinkId).toBe('dock');
    expect(l.server.lautsprecher.get(1)?.state).toBe('output_lost'); // nach höchstens 15 Sekunden am Server
  });

  it('@HT-054 ein schon eingeplanter, noch nicht begonnener Ton wird beim Verlust abgebrochen und kommt nach der Rückkehr nicht nach', async () => {
    const { l, a } = await dockLaeuft();
    await a.vor(28_000); // das Ende steht kurz bevor, sein Ton ist eingeplant
    expect(a.tab.spieler.geplant().length).toBeGreaterThan(0);
    abziehen(l, [a], 'dock');
    await a.vor(300);
    expect(a.tab.spieler.geplant()).toEqual([]);
    await a.vor(8000); // länger als 5 Sekunden nach dem Ende
    anstecken(l, [a], DOCK);
    await a.vor(6000);
    expect(a.tab.toene()).toEqual([]);
  });

  it('@HT-054 Rückkehr höchstens 5 Sekunden nach dem Ende: der Ton kommt nicht beim Abziehen, sondern einmal nach der Rückkehr (wie nach dem Neuladen, @HT-013), nie doppelt', async () => {
    const { l, a } = await dockLaeuft();
    await a.vor(29_000);
    abziehen(l, [a], 'dock'); // 1 s vor dem Ende
    await a.vor(3000);
    expect(a.tab.toene()).toEqual([]); // zum Ende ohne Ausgang: nichts erklingt
    anstecken(l, [a], DOCK); // 2 s nach dem Ende
    await a.vor(8000);
    const toene = a.tab.toene();
    expect(toene.map((t) => t.art)).toEqual(['abpfiff']);
    expect(toene[0].at).toBeGreaterThanOrEqual(ENDE_A2 + 2000);
  });

  it('@HT-054 das Dock wieder angesteckt wird → der Hallenton läuft wieder über das Dock, ohne neue Wahl; setSinkId neu gesetzt, danach „bereit“', async () => {
    const { l, a } = await dockLaeuft();
    await a.vor(10_000, [{ um: ENDE_A2 - 25_000, tu: () => abziehen(l, [a], 'dock') }]);
    expect(zustand(a)).toBe('output_lost');
    anstecken(l, [a], DOCK);
    await a.vor(1500);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock', 'dock']);
    expect(zustand(a)).toBe('ready');
    expect(a.tab.wahl.lesen()?.id).toBe('dock'); // keine neue Wahl nötig
  });

  it('@HT-054 Rückkehr, aber resume() ohne Geste misslingt → „Ton nicht aktiviert“, kein Ausgang-Zustand', async () => {
    const { l, a } = await dockLaeuft();
    await a.vor(3000, [{ um: ENDE_A2 - 28_000, tu: () => abziehen(l, [a], 'dock') }]);
    a.tab.kontext.resumeErlaubt = false;
    anstecken(l, [a], DOCK);
    await a.vor(1500);
    expect(zustand(a)).toBe('not_activated');
  });

  it('@HT-054 Olli nach dem Abziehen einen anderen Ausgang wählt → der neue gilt, „Ausgang verloren“ verschwindet', async () => {
    const { l, a } = await dockLaeuft();
    await a.vor(3000, [{ um: ENDE_A2 - 28_000, tu: () => abziehen(l, [a], 'dock') }]);
    expect(zustand(a)).toBe('output_lost');
    a.tab.wahl.setzen({ id: LG.id, name: LG.name, gruppe: LG.gruppe });
    await a.vor(1500);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock', 'lg']);
    expect(a.tab.kontext.sinkId).toBe('lg');
    expect(zustand(a)).toBe('ready');
  });

  it('@HT-054 Olli nach dem Abziehen „Standard“ wählt → setSinkId(Standard) wird gesetzt (die Ausgabe stand auf dem toten Ausgang)', async () => {
    const { l, a } = await dockLaeuft();
    await a.vor(3000, [{ um: ENDE_A2 - 28_000, tu: () => abziehen(l, [a], 'dock') }]);
    a.tab.wahl.setzen(null);
    await a.vor(1500);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock', '']);
    expect(zustand(a)).toBe('ready');
  });

  it('@HT-054 „Standard“ gewählt und das System schaltet auf einen anderen Ausgang um → der Hallenton folgt dem System: weiter bereit, nie verloren, nie unbestätigt, kein setSinkId', async () => {
    const l = lage();
    const a = tab(l);
    await a.starte();
    await a.vor(2000); // der Takt hat die Anzeichen am Spieler angelegt
    const gesehen = new Set<string>();
    a.tab.spieler.onZustand((z) => gesehen.add(z));
    l.medien.abziehen('default');
    l.medien.anstecken({ id: 'default', name: 'Standard - Dock', gruppe: 'g-dock' });
    await a.vor(6000);
    expect(zustand(a)).toBe('ready');
    expect([...gesehen].filter((z) => z === 'output_lost' || z === 'output_unconfirmed')).toEqual([]);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual([]);
    expect(l.server.lebenszeichen.some((z) => z.outputChanged)).toBe(true); // „🔈? Prüfen“ (@HT-047)
  });

  it('@HT-054 die Sperre des Geräts bleibt bei „Ausgang verloren“ gehalten, und der Hallenton plant nichts', async () => {
    const { l, a } = await dockLaeuft();
    const b = tab(l, 'B');
    await b.starte(); // ebenfalls aktiviert, wartet auf die Sperre
    expect(l.geraet.sperren.gehalten()).toBe(true);
    await a.vor(5000, [{ um: ENDE_A2 - 26_000, tu: () => abziehen(l, [a, b], 'dock') }]);
    expect(zustand(a)).toBe('output_lost');
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('toent');
    expect(b.tab.laufzeit.getSnapshot().rolle).toBe('andererTab');
    expect(l.geraet.sperren.gehalten()).toBe(true);
  });

  it('@HT-054 der Browser wechselt von selbst auf einen anderen Ausgang (sinkchange) → die App setzt den gewählten wieder, der Ton wandert nicht still', async () => {
    const { a } = await dockLaeuft();
    a.tab.kontext.ausgangWechseltVonAussen('mac');
    await a.vor(1500);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock', 'dock']);
    expect(a.tab.kontext.sinkId).toBe('dock');
    expect(zustand(a)).toBe('ready');
  });
});

describe('@HT-055 Nach dem Neuladen bestätigt Olli den gewählten Ausgang mit einem Tipp', () => {
  it('@HT-055 Mikrofon „nur dieses Mal“, App neu geladen → „nicht bereit – Ausgang bestätigen“ (output_unconfirmed, nie output_lost), schon vor „Ton aktivieren“; kein Ton über „Standard“', async () => {
    const l = lage({ dauerhaft: false });
    speichereWahl(l, DOCK);
    l.medien.neuLaden(); // „Nur dieses Mal“ ist vorbei: keine Kennungen mehr
    const a = tab(l);
    const gesehen = new Set<string>();
    a.tab.spieler.onZustand((z) => gesehen.add(z));
    await a.starte({ aktivieren: false });
    await a.vor(2000);
    expect(zustand(a)).toBe('output_unconfirmed');
    expect(l.server.lautsprecher.get(1)?.state).toBe('output_unconfirmed');
    await a.tab.laufzeit.tonAktivieren(); // der Klick auf „Ton aktivieren“ ändert daran nichts
    await a.vor(40_000);
    expect(zustand(a)).toBe('output_unconfirmed');
    expect(gesehen.has('output_lost')).toBe(false);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual([]);
    expect(a.tab.kontext.sinkId).toBe(''); // nie still „Standard“ gesetzt
    expect(a.tab.kontext.quellen).toHaveLength(0); // und nichts erklang
    expect(a.tab.toene()).toEqual([]);
  });

  it('@HT-055 Olli „Ausgang bestätigen“ tippt und das Mikrofon erlaubt → gilt wieder das Dock ohne neue Wahl, bereit sobald der Ton aktiviert ist', async () => {
    const l = lage({ dauerhaft: false });
    speichereWahl(l, DOCK);
    l.medien.neuLaden();
    const a = tab(l);
    await a.starte();
    expect(zustand(a)).toBe('output_unconfirmed');
    l.medien.erlaubt = true; // Mikrofon erlaubt (und der Strom sofort beendet, siehe ausgangListe-Test)
    a.tab.wahl.pruefenAnstossen();
    await a.vor(1500);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock']);
    expect(zustand(a)).toBe('ready');
    expect(a.tab.wahl.lesen()?.id).toBe('dock'); // ohne neue Wahl
  });

  it('@HT-055 Olli „Ausgang bestätigen“ tippt und das Mikrofon lehnt ab → bleibt „Ausgang bestätigen“', async () => {
    const l = lage({ dauerhaft: false });
    speichereWahl(l, DOCK);
    l.medien.neuLaden();
    l.medien.ablehnen = true;
    const a = tab(l);
    await a.starte();
    a.tab.wahl.pruefenAnstossen(); // der Tipp ohne Erlaubnis
    await a.vor(1500);
    expect(zustand(a)).toBe('output_unconfirmed');
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual([]);
  });

  it('@HT-055 Olli das Mikrofon beim ersten Mal „bei Besuchen dieser Website“ erlaubt hatte → nach dem Neuladen kein Bestätigen nötig', async () => {
    const l = lage({ dauerhaft: true });
    speichereWahl(l, DOCK);
    l.medien.neuLaden();
    const a = tab(l);
    await a.starte();
    await a.vor(1500);
    expect(zustand(a)).toBe('ready');
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock']);
  });

  it('@HT-055 die Sperre bleibt bei „Ausgang bestätigen“ gehalten; der Hallenton plant nichts', async () => {
    const l = lage({ dauerhaft: false });
    speichereWahl(l, DOCK);
    l.medien.neuLaden();
    const a = tab(l);
    await a.starte();
    await a.vor(2000);
    expect(l.geraet.sperren.gehalten()).toBe(true);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('toent');
    expect(a.tab.spieler.geplant()).toEqual([]);
  });

  it('@HT-055 setSinkId mit der gespeicherten Kennung scheitert (Ausgang listet der Browser, nimmt ihn aber nicht) → unbestätigt, nie verloren, kein Ton', async () => {
    const l = lage();
    speichereWahl(l, DOCK);
    const a = tab(l);
    a.tab.kontext.vorhandeneAusgaenge = new Set(['lg']); // der Browser kennt die Kennung nicht mehr
    await a.starte();
    await a.vor(35_000);
    expect(zustand(a)).toBe('output_unconfirmed');
    expect(a.tab.toene()).toEqual([]);
    expect(a.tab.kontext.sinkId).toBe('');
  });
});

describe('Geräte ohne gespeicherte Wahl verhalten sich wie vor H4-6 (Rückwärtsverträglichkeit)', () => {
  async function lauf(mitMedien: boolean) {
    const l = lage();
    const a = tab(l, 'A', mitMedien);
    const verlauf: string[] = [];
    a.tab.spieler.onZustand((z) => verlauf.push(z));
    await a.starte({ aktivieren: false });
    const vorher = zustand(a);
    await a.tab.laufzeit.tonAktivieren();
    await a.vor(40_000);
    return { l, a, vorher, verlauf, nachher: zustand(a), toene: a.tab.toene(), heartbeat: l.server.lebenszeichen.map((z) => z.state) };
  }

  it('gleiche Zustände, gleicher Ton über den Standard-Ausgang, kein Freigabe-Dialog, kein Mikrofon-Aufruf und kein setSinkId ohne Nutzeraktion', async () => {
    const neu = await lauf(true);
    const alt = await lauf(false);
    expect(neu.vorher).toBe('not_activated');
    expect(neu.vorher).toBe(alt.vorher);
    expect(neu.verlauf).toEqual(alt.verlauf);
    expect(neu.heartbeat).toEqual(alt.heartbeat);
    expect(neu.nachher).toBe('ready');
    expect(neu.toene).toEqual(alt.toene);
    expect(neu.toene.map((t) => t.art)).toEqual(['abpfiff']);
    expect(neu.a.tab.kontext.setSinkIdAufrufe).toEqual([]);
    expect(neu.a.tab.kontext.sinkId).toBe('');
    expect(neu.l.medien.mikrofonAnfragen).toBe(0);
    expect(neu.l.medien.spuren).toHaveLength(0);
    expect(neu.l.medien.leseAufrufe).toBe(0);
    expect(neu.l.medien.erlaubnisAbfragen).toBe(0);
  });
});

describe('Name und Kennung des Ausgangs verlassen das Gerät nie', () => {
  it('Lebenszeichen mit output_lost und output_unconfirmed: nur der Zustand geht an den Server – weder Name, Kennung noch Gruppe', async () => {
    const geheim: FalscherAusgang = { id: 'kennung-geheim-4711', name: 'Dock Olli Privat (Geheim)', gruppe: 'gruppe-geheim-0815' };
    const l = lage();
    l.medien.ausgaenge.push(geheim);
    speichereWahl(l, geheim);
    const a = tab(l);
    await a.starte();
    await a.vor(7000);
    abziehen(l, [a], geheim.id);
    await a.vor(7000); // lost
    l.medien.erlaubt = false; // Freigabe weg → unbestätigt
    anstecken(l, [a], geheim);
    l.medien.erlaubt = false;
    l.medien.geraeteWechsel();
    await a.vor(7000);
    const zustaende = new Set(l.server.lebenszeichen.map((z) => z.state));
    expect(zustaende.has('output_lost')).toBe(true);
    expect(zustaende.has('output_unconfirmed')).toBe(true);
    const alles = JSON.stringify([l.server.lebenszeichen, l.server.aufrufe, l.server.quittungen]);
    for (const geheimnis of [geheim.id, geheim.name, geheim.gruppe, 'Geheim', '4711']) {
      expect(alles).not.toContain(geheimnis);
    }
    // auch im Kanal und in allen anderen Schlüsseln des Geräts steht nichts (nur unter hallenton:ausgang)
    const andere = [...l.geraet.speicher.werte.entries()].filter(([k]) => k !== AUSGANG_SCHLUESSEL);
    expect(JSON.stringify(andere)).not.toContain(geheim.id);
    expect(JSON.stringify(andere)).not.toContain(geheim.name);
  });

  it('nichts geht in die Konsole (auch nicht der Fehlertext des Browsers, der die Kennung nennt)', async () => {
    const geheim: FalscherAusgang = { id: 'kennung-geheim-4711', name: 'Dock Olli Privat (Geheim)', gruppe: 'gruppe-geheim-0815' };
    const l = lage();
    l.medien.ausgaenge.push(geheim);
    speichereWahl(l, geheim);
    const a = tab(l);
    a.tab.kontext.vorhandeneAusgaenge = new Set(); // setSinkId scheitert mit einer Meldung, die die Kennung enthält
    const spione = (['log', 'info', 'warn', 'error', 'debug'] as const).map((stufe) => vi.spyOn(console, stufe).mockImplementation(() => undefined));
    try {
      await a.starte();
      await a.vor(10_000);
    } finally {
      for (const spion of spione) {
        spion.mockRestore();
      }
    }
    expect(zustand(a)).toBe('output_unconfirmed');
    expect(spione.flatMap((spion) => spion.mock.calls)).toEqual([]);
  });
});

describe('Regel 3 (@HT-033 Zeilen 2, 10, 11) bleibt: der Cockpit-Ton hängt nicht am gewählten Ausgang', () => {
  it('@HT-033 Gegenbeispiel: Feld 2 hat keinen Lautsprecher auf demselben Laptop → der Cockpit-Ton von Feld 2 tönt wie eingestellt, Feld 1 schweigt', async () => {
    const l = lage();
    speichereWahl(l, DOCK);
    const a = tab(l);
    await a.starte();
    await a.vor(3000);
    const { cockpitTonSchweigtJetzt } = await import('../../cockpitTon');
    const jetzt = l.uhr.jetzt();
    expect(cockpitTonSchweigtJetzt('hallencup-nord', 'field-2', jetzt, l.geraet.speicher, jetzt)).toBe(false);
    expect(cockpitTonSchweigtJetzt('hallencup-nord', 'field-1', jetzt, l.geraet.speicher, jetzt)).toBe(true);
  });

  it('@HT-053 Und-Zeile: eigener Ausgang „Dock“ gewählt, Lautsprecher bereit → für Feld 1 kommt kein Cockpit-Ton, auch nicht über den Hallenton-Ausgang', async () => {
    const l = lage();
    speichereWahl(l, DOCK);
    const a = tab(l);
    await a.starte();
    await a.vor(3000);
    const { cockpitTonSchweigtJetzt } = await import('../../cockpitTon');
    const jetzt = l.uhr.jetzt();
    const quellenVorher = a.tab.kontext.quellen.length;
    expect(zustand(a)).toBe('ready');
    expect(cockpitTonSchweigtJetzt('hallencup-nord', 'field-1', jetzt, l.geraet.speicher, jetzt)).toBe(true);
    expect(a.tab.kontext.quellen.length).toBe(quellenVorher); // der Cockpit-Weg erzeugt am Hallenton-Ausgang nichts
  });

  it('@HT-033 Zeile 10: Lautsprecher nicht bereit (Ausgang verloren) → der Cockpit-Ton tönt wie eingestellt', async () => {
    const l = lage();
    speichereWahl(l, DOCK);
    const a = tab(l);
    await a.starte();
    await a.vor(4000, [{ um: ENDE_A2 - 27_000, tu: () => abziehen(l, [a], 'dock') }]);
    await a.vor(3000);
    expect(zustand(a)).toBe('output_lost');
    const { cockpitTonSchweigtJetzt } = await import('../../cockpitTon');
    const jetzt = l.uhr.jetzt();
    expect(cockpitTonSchweigtJetzt('hallencup-nord', 'field-1', jetzt, l.geraet.speicher, jetzt)).toBe(false);
  });
});

describe('Ohne Wächter (alte Einbauten) bleibt der Spieler wie vor H4-6', () => {
  it('ein Tab ohne medien: kein setSinkId, Ton wie bisher', async () => {
    const uhr = new ManuelleUhr(ENDE_A2 - 30_000);
    const t = new Tab({ start: uhr.jetzt(), uhr });
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }, { ab: ENDE_A2, log: BEENDET }]);
    t.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await t.starte();
    await t.vor(35_000);
    expect(t.toene().map((x) => x.art)).toEqual(['abpfiff']);
    expect(t.kontext.setSinkIdAufrufe).toEqual([]);
  });
});
