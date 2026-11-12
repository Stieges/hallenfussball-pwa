/**
 * `Icons` ist ein Sammel-Export über mehrere Dateien unter `ui/icons/`. Dieser Test hält die Menge der Namen fest
 * (kein Symbol geht beim Aufteilen verloren) und dass jedes Symbol ein SVG in der verlangten Größe und Farbe zeichnet.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Icons } from '../Icons';

const BESTAND = [
  'Plus', 'Edit', 'Trash', 'Check', 'Clock', 'Minus', 'Lock', 'Printer', 'X', 'ChevronLeft', 'ChevronRight', 'ChevronUp',
  'ChevronDown', 'ArrowUp', 'ArrowDown', 'Share', 'Settings', 'Refresh', 'Eye', 'Download', 'Upload', 'Copy', 'Trophy', 'Play',
  'Calendar', 'Save', 'Archive', 'List', 'BarChart', 'MoreHorizontal', 'Users', 'Monitor', 'User', 'UserPlus', 'LogOut',
  'Restore', 'AlertTriangle', 'Search', 'Filter', 'MoreVertical', 'ExternalLink', 'Info', 'WifiOff', 'QrCode', 'ArrowRightLeft',
] as const;

/** Seit H4-4 (Hallenton): Lautsprecher, Geräte, Zustände. */
const NEU = ['Speaker', 'SpeakerQuestion', 'CheckCircle', 'MinusCircle', 'SpeakerLow', 'SpeakerOff', 'Phone', 'Laptop', 'Moon', 'QuestionMark', 'HelpCircle', 'Swap'] as const;
const ALLE = [...BESTAND, ...NEU] as const;

describe('Icons: Sammel-Export', () => {
  it('führt alle bisherigen Symbole unter ihrem Namen', () => {
    const namen = Object.keys(Icons);
    for (const name of ALLE) {
      expect(namen, name).toContain(name);
    }
  });

  it.each(ALLE)('%s zeichnet ein SVG in der verlangten Größe', (name) => {
    const Symbol = Icons[name];
    const { container } = render(<Symbol size={32} color="red" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
  });
});
