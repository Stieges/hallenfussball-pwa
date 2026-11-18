/**
 * HallTeamName – Teamname oben in der Farbfläche des Profils „Halle (sehr fern)“ (@ZM-213).
 *
 * Der Text kommt aus `monitorTeamName` (Vereinswörter nach Liste gekürzt, sonst der volle Name, nie „…“). Er bricht nur an Leerzeichen
 * oder nach „/“ um (`HyphenSafe`), steht in höchstens zwei Zeilen und passt sich der größten Schrift an, die in Breite UND Höhe des
 * Namensfelds passt (`useTeamNameFit` mit `hoehe`). Beide Namen stehen in derselben Größe (die kleinere der beiden, B3).
 * Passt auch die kleinste Schrift (3 % der Bildhöhe) nicht, bricht der Name weiter um; er wird nie abgeschnitten.
 * Bis zur ersten Messung ist der Name unsichtbar (kein Bild mit der Vorgabe-Schrift über der Torzahl).
 * Ändert sich der Text im Dokument außerhalb von React (Übersetzungsfunktion des Browsers, Messwerkzeug), passt sich die Schrift ihm an.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { displayHall } from '../../../design-tokens';
import { monitorTeamName } from '../../../core/models/teamNameAbbrev';
import { HyphenSafe } from '../../ui/atoms/TeamName';
import type { ScoreBoxOutcome } from '../../ui/molecules/scoreBoxStyle';
import { passeTeamNameAn, useTeamNameFit, type TeamNameFitGrenzen } from '../teamNameFit';
import { nameStyle } from './hallStyles';

/** Grenzen des Einpassens: Höhe des Namensfelds, Zeilenhöhe der Anzeige, gemessen am Inhalt des Dokuments (Bindestrich-Wörter und Umbruchstellen wie angezeigt) */
const GRENZEN: TeamNameFitGrenzen = { hoehe: displayHall.name.height, zeilenhoehe: displayHall.name.lineHeight, domInhalt: true };

export interface HallTeamNameProps {
  name: string;
  outcome?: ScoreBoxOutcome;
  /** Gemeinsame Größe beider Namen (px) */
  sizePx?: number;
  /** Meldet die eigene passende Größe (px) an das Elternteil */
  onFitPx?: (px: number) => void;
  testId: string;
}

export function HallTeamName({ name, outcome, sizePx, onFitPx, testId }: HallTeamNameProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const text = monitorTeamName(name);
  // Der Text, an dem gemessen wird: der Anzeigetext, bei einer Änderung im Dokument außerhalb von React der Text des Dokuments
  const [gemessen, setGemessen] = useState(text);
  useEffect(() => { setGemessen(text); }, [text]);
  // Folgt der Text im Dokument (ohne React) einem anderen, passt sich die Schrift sofort an, noch im selben Augenblick (kein Zwischenbild mit der alten Größe)
  const letztePx = useRef({ sizePx, onFitPx });
  useEffect(() => { letztePx.current = { sizePx, onFitPx }; });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof MutationObserver === 'undefined') { return undefined; }
    const beobachter = new MutationObserver(() => {
      const jetzt = el.textContent ?? '';
      const neu = passeTeamNameAn(el, [jetzt], displayHall.name.maxFont, letztePx.current.sizePx, GRENZEN);
      letztePx.current.onFitPx?.(neu.px);
      setGemessen((alt) => (jetzt === alt ? alt : jetzt));
    });
    beobachter.observe(el, { childList: true, characterData: true, subtree: true });
    return () => beobachter.disconnect();
  }, []);
  const wahl = useTeamNameFit(ref, [gemessen], true, displayHall.name.maxFont, sizePx, GRENZEN);
  const eigenPx = wahl?.px;
  useEffect(() => {
    if (eigenPx !== undefined && Number.isFinite(eigenPx)) { onFitPx?.(eigenPx); }
  }, [eigenPx, onFitPx]);

  return (
    <div ref={ref} style={nameStyle(outcome, wahl !== null)} title={name} data-teamname data-testid={testId} data-fit-vorgabe={displayHall.name.maxFont}>
      <HyphenSafe text={text} />
    </div>
  );
}
