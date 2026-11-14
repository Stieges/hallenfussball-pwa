import { describe, it, expect } from 'vitest';
import { selectDisplayableSlides, SPIELPLAN_FALLBACK_SLIDE } from './slideProgramme';

describe('selectDisplayableSlides – Spielplan-Rückfall (F11)', () => {
  it('liefert den Spielplan-Rückfall, wenn nichts Darstellbares übrig ist und kein QR möglich ist', () => {
    const result = selectDisplayableSlides([{ id: 'alt', type: 'altbestand' }], { qrMoeglich: false });
    expect(result).toEqual([SPIELPLAN_FALLBACK_SLIDE]);
  });
});

describe('@ME-077 selectDisplayableSlides – Folien ohne Einrichtung werden übersprungen', () => {
  const live = { id: 'live', type: 'live', config: {} };
  const qr = { id: 'qr', type: 'qr-code', config: {} };
  const sponsorOhne = { id: 'sp-leer', type: 'sponsor', config: {} };
  const textOhne = { id: 'txt-leer', type: 'custom-text', config: { headline: '   ' } };
  const sponsoren = [{ id: 'sp1' }];

  it('Live-Spiel, Sponsor ohne Sponsor, Text ohne Überschrift, Zuschauer-QR → nur Live-Spiel und QR', () => {
    const ergebnis = selectDisplayableSlides([live, sponsorOhne, textOhne, qr], { qrMoeglich: true, sponsors: sponsoren });
    expect(ergebnis.map(f => f.id)).toEqual(['live', 'qr']);
  });

  it('ein Sponsor, den es im Turnier nicht mehr gibt, wird übersprungen', () => {
    const geloescht = { id: 'sp-weg', type: 'sponsor', config: { sponsorId: 'geloescht' } };
    expect(selectDisplayableSlides([live, geloescht], { qrMoeglich: true, sponsors: sponsoren }).map(f => f.id)).toEqual(['live']);
  });

  it('Gegenbeispiel: eingerichtete Sponsor- und Text-Folie bleiben, in ihrer Reihenfolge', () => {
    const sponsorOk = { id: 'sp-ok', type: 'sponsor', config: { sponsorId: 'sp1' } };
    const textOk = { id: 'txt-ok', type: 'custom-text', config: { headline: 'Willkommen' } };
    const ergebnis = selectDisplayableSlides([textOk, sponsorOhne, sponsorOk, textOhne], { qrMoeglich: true, sponsors: sponsoren });
    expect(ergebnis.map(f => f.id)).toEqual(['txt-ok', 'sp-ok']);
  });

  it('Feld-Bezüge bleiben unberührt: Folien ohne oder mit unbekanntem Feld laufen weiter (Feld 1, @ZM-074)', () => {
    const ohneFeld = { id: 'plan', type: 'schedule-field', config: {} };
    const unbekannt = { id: 'live-9', type: 'live', config: { fieldId: 'field-9' } };
    const ergebnis = selectDisplayableSlides([ohneFeld, unbekannt], { qrMoeglich: true, sponsors: [] });
    expect(ergebnis.map(f => f.id)).toEqual(['plan', 'live-9']);
  });

  it('bleibt keine eingerichtete Folie übrig: Zuschauer-QR (@OB-011); ohne QR-Möglichkeit der Spielplan-Rückfall', () => {
    const nurLeer = [sponsorOhne, textOhne];
    expect(selectDisplayableSlides(nurLeer, { qrMoeglich: true, sponsors: sponsoren }).map(f => f.type)).toEqual(['qr-code']);
    expect(selectDisplayableSlides(nurLeer, { qrMoeglich: false, sponsors: sponsoren })).toEqual([SPIELPLAN_FALLBACK_SLIDE]);
  });

  it('ohne bekannte Sponsorenliste zählt nur, dass ein Sponsor gewählt ist (Turnier noch nicht geladen)', () => {
    const gewaehlt = { id: 'sp-x', type: 'sponsor', config: { sponsorId: 'sp1' } };
    expect(selectDisplayableSlides([live, gewaehlt, sponsorOhne], { qrMoeglich: true }).map(f => f.id)).toEqual(['live', 'sp-x']);
  });
});
