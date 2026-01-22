/**
 * Auth Components - Exports
 */

// Phase 2: Auth Screens
export { LoginScreen } from './LoginScreen';
export { RegisterScreen } from './RegisterScreen';
export { AuthCallback } from './AuthCallback';
export { AuthConfirmPage } from './AuthConfirmPage';
export { SetPasswordScreen } from './SetPasswordScreen';
export { GuestBanner } from './GuestBanner';
export { AuthGuard } from './AuthGuard';

// Phase 3: User Profile
export { RoleBadge } from './RoleBadge';
export { TournamentCard } from './TournamentCard';
export type { TournamentCardData, TournamentDisplayStatus } from './TournamentCard';
export { UserProfileScreen } from './UserProfileScreen';

// Phase 4: Invitation System
export { InviteDialog } from './InviteDialog';
export { InviteLinkDialog } from './InviteLinkDialog';
export { InviteAcceptScreen } from './InviteAcceptScreen';
export { MemberList } from './MemberList';

// Phase 5: Role Management
export { RoleChangeDialog } from './RoleChangeDialog';
export { TransferOwnershipDialog } from './TransferOwnershipDialog';

// Phase 6: Mobile Auth UI
export { MobileAuthBottomSheet } from './MobileAuthBottomSheet';

// Phase 7: Tournament Limits (Anonymous Users)
export { TournamentLimitModal } from './TournamentLimitModal';

// Phase 8: Account Merge (Anonymous → Authenticated)
export { MergeAccountDialog } from './MergeAccountDialog';
