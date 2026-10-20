/**
 * @ZM-152 Die Folie hat keine eigene Farbe der Ergebniskästen: `SlideConfigSchema` kennt `liveColorScheme` nicht, Zod (`strip`) wirft
 * den Altschlüssel einer gespeicherten Folie beim Lesen ab. Gegenbeispiel: die übrigen Schlüssel bleiben.
 */
import { describe, it, expect } from 'vitest';
import { SlideConfigSchema } from '../SlideConfigSchema';

describe('@ZM-152 SlideConfigSchema verwirft liveColorScheme', () => {
  it('@ZM-152 Altschlüssel liveColorScheme fällt beim Lesen weg', () => {
    const gelesen = SlideConfigSchema.parse({
      fieldId: 'field-1',
      liveColorScheme: { preset: 'classic', homeColor: '#1E40AF', awayColor: '#DC2626', useTeamColors: false },
    });
    expect(gelesen).toEqual({ fieldId: 'field-1' });
    expect('liveColorScheme' in gelesen).toBe(false);
  });

  it('Gegenbeispiel: Schlüssel, die die Live-Folie noch kennt, bleiben erhalten', () => {
    expect(SlideConfigSchema.parse({ fieldId: 'field-1', pauseRotationDuringMatch: false })).toEqual({ fieldId: 'field-1', pauseRotationDuringMatch: false });
  });
});
