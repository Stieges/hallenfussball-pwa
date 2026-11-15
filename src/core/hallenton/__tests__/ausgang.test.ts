/**
 * H4-6 Ausgang, reine Hilfen: Sortierung, „virtuell“ am Ende, Bluetooth-Hinweis und die Bewertung der Wahl
 * (@HT-053, @HT-054, @HT-055). Erwartungen aus den Beispielzeilen der Anforderung, nicht am Code abgelesen.
 */
import { describe, expect, it } from 'vitest';
import { bewerteAusgang, istBluetooth, istVirtuell, sortiereAusgaenge, type AusgangRoh, type GewaehlterAusgang } from '../ausgang';

const roh = (id: string, name: string): AusgangRoh => ({ id, name, gruppe: `g-${id}` });
const DOCK: GewaehlterAusgang = { id: 'dock', name: 'ThinkPad Thunderbolt 3 Dock USB Audio', gruppe: 'g-dock' };
const LISTE = [roh('default', 'Standard - Poly'), roh('lg', 'LG Ultra HD'), roh('dock', DOCK.name)];

describe('@HT-053 Liste der Ausgänge', () => {
  it('@HT-053 virtuelle Geräte stehen am Ende, „Standard“ zuerst, der Rest in der Reihenfolge des Browsers', () => {
    const sortiert = sortiereAusgaenge([
      roh('teams', 'Microsoft Teams Audio Device (Virtual)'), roh('lg', 'LG Ultra HD (DisplayPort)'), roh('default', 'Standard - Poly'),
      roh('dock', 'ThinkPad Thunderbolt 3 Dock USB Audio'), roh('zoom', 'ZoomAudioDevice (virtual)'),
    ]);
    expect(sortiert.map((e) => e.id)).toEqual(['default', 'lg', 'dock', 'teams', 'zoom']);
    expect(sortiert.filter((e) => e.virtuell).map((e) => e.id)).toEqual(['teams', 'zoom']);
    expect(sortiert[0].standard).toBe(true);
  });

  it('@HT-053 ohne Kennungen (Mikrofon nicht erlaubt) bleibt die Liste leer', () => {
    expect(sortiereAusgaenge([roh('', '')])).toEqual([]);
  });

  it('Bluetooth wird am Namen erkannt (Poly im Versuch V-AUSGANG), ein Kabel-Ausgang nicht', () => {
    expect(istBluetooth('Poly VFOCUS2 Series (Bluetooth)')).toBe(true);
    expect(istBluetooth('ThinkPad Thunderbolt 3 Dock USB Audio (17ef:306a)')).toBe(false);
    expect(istVirtuell('Microsoft Teams Audio Device (Virtual)')).toBe(true);
    expect(istVirtuell('LG Ultra HD (DisplayPort)')).toBe(false);
  });
});

describe('@HT-054 @HT-055 Bewertung der Wahl', () => {
  const eintraege = LISTE;

  it('keine Wahl = „Standard“: nie verloren, nie unbestätigt – auch ohne Kennungen und ohne Erlaubnis', () => {
    expect(bewerteAusgang({ wahl: null, eintraege, erlaubnis: 'granted', senkeScheitert: false })).toBe('standard');
    expect(bewerteAusgang({ wahl: null, eintraege: [], erlaubnis: 'prompt', senkeScheitert: false })).toBe('standard');
    expect(bewerteAusgang({ wahl: null, eintraege: [], erlaubnis: null, senkeScheitert: true })).toBe('standard');
  });

  it('@HT-054 das Dock steckt: ok; das Dock fehlt, die Kennungen sind lesbar: lost (nie ein stiller Wechsel)', () => {
    expect(bewerteAusgang({ wahl: DOCK, eintraege, erlaubnis: 'granted', senkeScheitert: false })).toBe('ok');
    expect(bewerteAusgang({ wahl: DOCK, eintraege: eintraege.filter((e) => e.id !== 'dock'), erlaubnis: 'granted', senkeScheitert: false })).toBe('lost');
  });

  it('@HT-055 nach dem Neuladen mit „Nur dieses Mal“: Erlaubnis nicht mehr erteilt oder leere Kennungen → unconfirmed, nie lost', () => {
    expect(bewerteAusgang({ wahl: DOCK, eintraege: [roh('', '')], erlaubnis: 'prompt', senkeScheitert: false })).toBe('unconfirmed');
    expect(bewerteAusgang({ wahl: DOCK, eintraege: [roh('', '')], erlaubnis: null, senkeScheitert: false })).toBe('unconfirmed');
    expect(bewerteAusgang({ wahl: DOCK, eintraege, erlaubnis: 'denied', senkeScheitert: false })).toBe('unconfirmed');
  });

  it('@HT-055 Erlaubnis nicht abfragbar (z. B. Safari): die Kennungen entscheiden', () => {
    expect(bewerteAusgang({ wahl: DOCK, eintraege, erlaubnis: null, senkeScheitert: false })).toBe('ok');
  });

  it('@HT-055 setSinkId mit der gespeicherten Kennung scheitert → unconfirmed (nicht lost: der Ausgang ist da)', () => {
    expect(bewerteAusgang({ wahl: DOCK, eintraege, erlaubnis: 'granted', senkeScheitert: true })).toBe('unconfirmed');
  });

  it('@HT-054 Zeile 5 in dieser Sitzung gesetzt: nicht lesbare Kennungen / Erlaubnis weg → weiter ok; lesbar und fehlt → lost; setSinkId gescheitert → unconfirmed', () => {
    const g = { wahl: DOCK, inSitzungGesetzt: true, senkeScheitert: false };
    expect(bewerteAusgang({ ...g, eintraege: [roh('', '')], erlaubnis: 'prompt' })).toBe('ok');
    expect(bewerteAusgang({ ...g, eintraege: [], erlaubnis: null })).toBe('ok');
    expect(bewerteAusgang({ ...g, eintraege: eintraege.filter((e) => e.id !== 'dock'), erlaubnis: 'granted' })).toBe('lost');
    expect(bewerteAusgang({ ...g, eintraege, erlaubnis: 'granted' })).toBe('ok');
    expect(bewerteAusgang({ ...g, senkeScheitert: true, eintraege, erlaubnis: 'granted' })).toBe('unconfirmed');
  });
});
