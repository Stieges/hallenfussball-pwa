/**
 * Trikotfarbe eines Teams im Reiter „Teams“ (@W3-028): Farbwähler mit Namen der Palettenfarben.
 * Eine Palettenfarbe gilt sofort. Beim freien Farbwähler ruft `ColorPicker` bei jeder Zeigerbewegung `onChange`; gespeichert wird
 * erst beim Loslassen (Zeiger/Taste) oder nach kurzer Ruhe, nicht bei jeder Bewegung (jede Speicherung ist ein ganzes Turnier).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColorPicker } from '../../../components/ui';
import { palette, wizardJerseyPresets } from '../../../design-tokens/colors/palette';

/** So lange Ruhe beim Ziehen, bevor gespeichert wird (Loslassen speichert sofort). */
export const COLOR_COMMIT_DELAY_MS = 400;

type JerseyKey = Exclude<keyof typeof palette.jersey, 'neonGreen'>;
const JERSEY_KEYS = Object.keys(palette.jersey).filter((k): k is JerseyKey => k !== 'neonGreen');
const sameColor = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase();
const isPresetColor = (hex: string): boolean => wizardJerseyPresets.some((p) => sameColor(p, hex));

interface TeamColorFieldProps {
  /** Gespeicherte Trikotfarbe (Hex) */
  value: string;
  /** Speichert die Farbe (ganzes Turnier) */
  onCommit: (color: string) => void;
}

export function TeamColorField({ value, onCommit }: TeamColorFieldProps) {
  const { t } = useTranslation('tournament');
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const draftRef = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commitRef = useRef(onCommit);
  const valueRef = useRef(value);
  useEffect(() => { commitRef.current = onCommit; valueRef.current = value; });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const color = draftRef.current;
    draftRef.current = undefined;
    setDraft(undefined);
    if (color !== undefined && !sameColor(color, valueRef.current)) {
      commitRef.current(color);
    }
  }, []);

  // Beim Schließen der Karte oder Verlassen des Reiters geht keine Auswahl verloren
  useEffect(() => () => {
    clearTimeout(timer.current);
    const color = draftRef.current;
    if (color !== undefined && !sameColor(color, valueRef.current)) { commitRef.current(color); }
  }, []);

  const handleChange = (color: string) => {
    draftRef.current = color;
    setDraft(color);
    clearTimeout(timer.current);
    if (isPresetColor(color)) { flush(); return; }
    timer.current = setTimeout(flush, COLOR_COMMIT_DELAY_MS);
  };

  const shown = draft ?? value;
  const nameOf = (hex: string): string | undefined => {
    const key = JERSEY_KEYS.find((k) => sameColor(palette.jersey[k], hex));
    return key === undefined || !isPresetColor(hex) ? undefined : t(`teams.jerseyColorNames.${key}`);
  };

  return (
    <div onPointerUp={flush} onKeyUp={flush} onBlur={flush}>
      <ColorPicker value={shown} valueLabel={nameOf(shown)} presetLabel={nameOf} onChange={handleChange} />
    </div>
  );
}
