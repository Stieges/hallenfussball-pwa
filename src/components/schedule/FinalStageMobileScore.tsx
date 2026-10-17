/**
 * Eingabe der Tore auf der Finalrunden-Karte (C-FINALRUNDE-MOBIL-EINGABE).
 *
 * Jedes Feld hat einen eigenen Zwischenstand. Gespeichert wird erst, wenn beide Felder einen Wert haben –
 * bei einem offenen Spiel (noch kein Stand) kann so erst die eine, dann die andere Seite eingetragen werden.
 * Vorher war das Feld an `match.scoreB !== undefined` gekoppelt: bei einem offenen Spiel sprang die Eingabe
 * zurück und kam nie an (Handy/Tablet hochkant).
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';

export interface ScoreDraft {
  a: string;
  b: string;
  setA: (value: string) => void;
  setB: (value: string) => void;
}

interface ScoreDraftProps {
  matchId: string;
  scoreA: number | undefined;
  scoreB: number | undefined;
  onCommit: (scoreA: number, scoreB: number) => void;
  children: (draft: ScoreDraft) => React.ReactNode;
}

const asText = (score: number | undefined): string => (score === undefined ? '' : String(score));

export const ScoreDraftProvider: React.FC<ScoreDraftProps> = ({ matchId, scoreA, scoreB, onCommit, children }) => {
  const [a, setA] = useState(asText(scoreA));
  const [b, setB] = useState(asText(scoreB));

  useEffect(() => {
    setA(asText(scoreA));
    setB(asText(scoreB));
  }, [matchId, scoreA, scoreB]);

  const commit = (nextA: string, nextB: string) => {
    if (nextA !== '' && nextB !== '') {
      onCommit(parseInt(nextA, 10), parseInt(nextB, 10));
    }
  };

  return (
    <>
      {children({
        a,
        b,
        setA: (value) => { setA(value); commit(value, b); },
        setB: (value) => { setB(value); commit(a, value); },
      })}
    </>
  );
};

const inputStyle: CSSProperties = {
  width: cssVars.touchTargets.minimum,
  height: cssVars.touchTargets.minimum,
  padding: cssVars.spacing.xs,
  border: `1px solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.sm,
  // Eingabefelder mindestens 16 px, sonst zoomt iOS beim Fokus
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.bold,
  textAlign: 'center',
  backgroundColor: cssVars.colors.background,
  color: cssVars.colors.textPrimary,
};

const correctionStyle: CSSProperties = {
  borderColor: cssVars.colors.warning,
  backgroundColor: cssVars.colors.warningLight,
};

interface MobileScoreInputProps {
  value: string;
  onChange: (value: string) => void;
  inCorrectionMode: boolean;
  testId: string;
  ariaLabel: string;
}

export const MobileScoreInput: React.FC<MobileScoreInputProps> = ({ value, onChange, inCorrectionMode, testId, ariaLabel }) => (
  <input
    type="number"
    inputMode="numeric"
    min="0"
    step="1"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="–"
    aria-label={ariaLabel}
    data-testid={testId}
    style={{ ...inputStyle, ...(inCorrectionMode ? correctionStyle : {}) }}
  />
);
