/**
 * Einpassen der Teamnamen: das Messfeld hat keine Übergänge (Regel „weniger Bewegung“ der Monitor-Seite, @ZM-213).
 * Die Monitor-Seite setzt bei „weniger Bewegung“ `transition-duration: 0.01ms !important` auf alle Elemente; ein Messfeld mit Übergang
 * lieferte beim Lesen der Höhe den Anfang des Übergangs, und jeder Name fiele auf die kleinste Schrift (gefunden mit `npm run visual:metrics`).
 * jsdom hat keine Übergänge: geprüft wird, dass das Messfeld sie mit `!important` ausschaltet (schlägt die Regel der Seite).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { passeTeamNameAn } from '../teamNameFit';

afterEach(() => { vi.restoreAllMocks(); });

function messfeldBeimEinpassen(): HTMLElement {
  const gesehen: HTMLElement[] = [];
  const original = Element.prototype.appendChild;
  vi.spyOn(Element.prototype, 'appendChild').mockImplementation(function (this: Element, knoten: Node) {
    if (knoten instanceof HTMLElement && knoten.getAttribute('aria-hidden') === 'true') { gesehen.push(knoten); }
    return original.call(this, knoten);
  });
  const feld = document.createElement('div');
  document.body.appendChild(feld);
  feld.textContent = 'TSV Fridolfing';
  passeTeamNameAn(feld, ['TSV Fridolfing'], '20px');
  feld.remove();
  return gesehen[0];
}

describe('@ZM-213 Messfeld des Einpassens', () => {
  it('hat keinen Übergang und keine Animation, auch wenn die Seite „weniger Bewegung“ mit !important setzt', () => {
    const messfeld = messfeldBeimEinpassen();
    expect(messfeld).toBeDefined();
    expect(messfeld.style.getPropertyValue('transition')).toBe('none');
    expect(messfeld.style.getPropertyPriority('transition')).toBe('important');
    expect(messfeld.style.getPropertyValue('animation')).toBe('none');
    expect(messfeld.style.getPropertyPriority('animation')).toBe('important');
  });

  it('Gegenbeispiel: das Messfeld ist ein verstecktes, absolut gesetztes Element (es verschiebt nichts)', () => {
    const messfeld = messfeldBeimEinpassen();
    expect(messfeld.style.visibility).toBe('hidden');
    expect(messfeld.style.position).toBe('absolute');
  });
});
