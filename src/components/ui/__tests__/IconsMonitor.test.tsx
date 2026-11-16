/**
 * @OB-038 Monitor-Pause: gefüllt und kräftig (aus der Hallentiefe gelesen), nicht das Linien-Symbol der Oberfläche.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MonitorIcons } from '../IconsMonitor';
import { MatchIcons } from '../IconsMatch';
import { TafelIcons } from '../IconsTafel';

const svgVon = (el: React.ReactElement): SVGElement => render(el).container.querySelector('svg')!;

describe('@OB-038 MonitorIcons.Pause', () => {
  it('zwei gefüllte Balken ohne Strich, dekorativ', () => {
    const svg = svgVon(<MonitorIcons.Pause />);
    expect(svg.getAttribute('fill')).toBe('currentColor');
    expect(svg.getAttribute('stroke')).toBe('none');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.querySelectorAll('rect')).toHaveLength(2);
  });

  it('Zeichnung unterscheidet sich von den Linien-Pausen der Oberfläche', () => {
    const html = svgVon(<MonitorIcons.Pause />).innerHTML;
    expect(html).not.toBe(svgVon(<MatchIcons.Pause />).innerHTML);
    expect(html).not.toBe(svgVon(<TafelIcons.Pause />).innerHTML);
  });

  it('Größe lässt sich setzen (auch als CSS-Länge)', () => {
    expect(svgVon(<MonitorIcons.Pause size="10vh" />).getAttribute('width')).toBe('10vh');
  });
});
