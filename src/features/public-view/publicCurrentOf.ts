/**
 * Kopfblock der Zuschauer-Seite (Paket Z2, @ZM-141): die Wahl steht seit @ZP-109 in `components/schedule/currentBlockOf.ts`, weil die
 * Spielplan-Karte der Turnierleitung dieselbe Wahl trifft. Hier bleiben die bisherigen Namen.
 */
import { currentBlockOf, type CurrentBlock } from '../../components/schedule/currentBlockOf';

export type PublicCurrent = CurrentBlock;
export const publicCurrentOf = currentBlockOf;
