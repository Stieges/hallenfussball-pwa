/**
 * ÜBERGANG bis A-36d: Die Anzeige der Spielseiten liegt seit A-36b in der gemeinsamen Turnier-Ansicht
 * (`core/view/originText.ts`). Dieser Pfad bleibt nur als Re-Export für die bestehenden Importeure stehen
 * und wird in A-36d gelöscht (Importe auf `core/view` umgestellt).
 */
export {
  describeMatchLabel,
  describeSlot,
  describeAwaiting,
  awaitingLabel,
  matchLabelText,
  slotLabel,
  teamDisplayName,
  type SlotLabelMatch,
  type SlotLabelContext,
  type SlotKey,
  type SlotDescription,
  type SlotDescriptionValue,
} from '../view/originText';
