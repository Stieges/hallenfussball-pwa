// Barrel export for all UI components
export { Button } from './Button';
export { Card } from './Card';
export { InlineNotice, NoticeLine, Scoreboard, MatchStatusBadge, ScoreBox } from './molecules';
export type { NoticeLineProps, ScoreboardProps, ScoreboardModel, MatchStatusBadgeProps, ScoreBoxProps } from './molecules';
export { Input } from './Input';
export { Select } from './Select';
export { Combobox } from './Combobox';
export { Icons } from './Icons';
export { MatchIcons } from './IconsMatch';
export { HoldButton, HOLD_MS } from './atoms';
export type { HoldButtonProps } from './atoms';
export { ThumbBar } from './molecules';
export type { ThumbBarProps, ThumbBarSlot, ThumbBarRolle } from './molecules';
export { NumberPicker, NUMBER_PICKER_SPERRE_MS, NUMBER_PICKER_ZEITABLAUF_MS } from './molecules';
export type { NumberPickerProps, NumberPickerTexte, NumberPickerSchliessGrund } from './molecules';
export { NumberStepper } from './NumberStepper';
export { CollapsibleSection } from './CollapsibleSection';

// US-GROUPS-AND-FIELDS: Gekapselte Anzeige-Komponenten
export { GroupDisplay } from './GroupDisplay';
export type { GroupDisplayVariant } from './GroupDisplay';
export { FieldDisplay } from './FieldDisplay';
export type { FieldDisplayVariant } from './FieldDisplay';

// Loading States
export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';
export { SkeletonPresets } from './SkeletonPresets';

// Mobile Navigation
export { BottomNavigation } from './BottomNavigation';
export type { BottomNavTab } from './BottomNavigation';
export { BottomSheet, BottomSheetItem } from './BottomSheet';

// Action Menu (Desktop Dropdown)
export { ActionMenu } from './ActionMenu';
export type { ActionMenuItem } from './ActionMenu';

// Bottom Action Bar (Edit Mode Actions)
export { BottomActionBar } from './BottomActionBar';
export type { BottomActionBarProps } from './BottomActionBar';

// Collapsible Info Panel (with localStorage persistence)
export { CollapsibleInfoPanel } from './CollapsibleInfoPanel';
export type { CollapsibleInfoPanelProps } from './CollapsibleInfoPanel';

// Progress Indicators
export { ProgressRing, ScoreContent, VSContent } from './ProgressRing';
export type { ProgressRingProps, ScoreContentProps } from './ProgressRing';

// Score Input
export { ScoreStepper } from './ScoreStepper';
export type { ScoreStepperProps } from './ScoreStepper';

// Team Management
export { TeamAvatar } from './TeamAvatar';
export { ColorPicker } from './ColorPicker';
export { LogoUploadDialog } from './LogoUploadDialog';

// Connection Status (Public View)
export { ConnectionStatusBar } from './ConnectionStatusBar';
export type { ConnectionStatusBarProps, ConnectionStatus } from './ConnectionStatusBar';

// B-17: Monitor-Dauerbetrieb

// Paket TB-B: Bausteine der Gleichstands-Oberfläche
export { TieMarker, ShootoutScoreInput, OrderPicker, PlacesToPlayOutPicker } from './molecules';
export type { TieMarkerProps, ShootoutScoreInputProps, OrderPickerProps, PlacesToPlayOutPickerProps } from './molecules';
export { NumberChoiceRow, SegmentedChoice } from './molecules';
export type { NumberChoiceRowProps, SegmentedChoiceProps, SegmentedOption } from './molecules';
