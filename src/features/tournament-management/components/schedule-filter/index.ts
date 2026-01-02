/**
 * Schedule Filter Components
 *
 * Components for filtering matches in the schedule view.
 *
 * @see docs/concepts/SPIELPLAN-FILTER-KONZEPT.md
 */

// Main Component (auto-selects desktop/mobile)
export { ScheduleFilterBar } from './ScheduleFilterBar';

// Desktop Components
export { ScheduleFilterBarDesktop } from './ScheduleFilterBarDesktop';

// Mobile Components
export { ScheduleFilterBarMobile } from './ScheduleFilterBarMobile';
export { ScheduleFilterSheet } from './ScheduleFilterSheet';

// Shared Components
export { FilterDropdown } from './FilterDropdown';
export type { FilterOption } from './FilterDropdown';
export { StatusMultiSelect } from './StatusMultiSelect';
export { TeamSearchInput } from './TeamSearchInput';
export { FilterChips } from './FilterChips';
export { EmptyFilterState } from './EmptyFilterState';
