# Findings Backlog

| ID | Sev | Area | Title | File | Effort | Status |
|----|-----|------|-------|------|--------|--------|
| F-001 | 🔴 | architecture | Dependency Inversion Verletzung in RepositoryContext | src/core/contexts/RepositoryContext.tsx | 2h | open |
| F-002 | 🔴 | data | Inkonsistentes Date-Handling in Schemas | src/core/models/schemas/TournamentSchema.ts | 1h | open |
| F-003 | 🟠 | architecture | Zu komplexe Logik im Schedule Generator | src/core/generators/scheduleGenerator.ts | 4h | open |
| F-004 | 🟠 | data | Reduzierte Type Safety bei Mutation Payloads | src/core/models/schemas/MutationItemSchema.ts | 2h | open |
| F-005 | 🟡 | architecture | Potenzielle Memory Leaks im RepositoryContext | src/core/contexts/RepositoryContext.tsx | 30m | open |
| F-006 | 🔴 | data | Team ID/Name Matching Ambiguity in Calculations | src/utils/calculations.ts | 2h | open |
| F-007 | 🟠 | perf | O(n²) Complexity in Fairness Calculator | src/utils/FairnessCalculator.ts | 8h | open |
| F-008 | 🟠 | other | Dead Code: updateKnockoutMatchesAfterResult | src/utils/knockoutMatchGenerator.ts | 1h | open |
| F-009 | 🟠 | testing | Non-Null Assertions (!) in Test Files | src/utils/__tests__/calculations.test.ts | 1h | open |
| F-010 | 🟡 | testing | Unsafe JSON Parsing in Test Imports | src/utils/__tests__/ScenarioHMK.test.ts | 2h | open |
| F-011 | 🟡 | other | Overly Permissive ESLint Disable Comments | src/utils/calculations.ts | 30m | open |
| F-012 | 🟡 | testing | Hard-coded Timeout Values in Tests | src/utils/__tests__/fairScheduler.minimal.test.ts | 30m | open |
| F-013 | 🔴 | other | ActionMenu: Hooks Rules Violation | src/components/ActionMenu.tsx | 30m | open |
| F-014 | 🟠 | a11y | ActionMenu: Missing Keyboard Navigation | src/components/ActionMenu.tsx | 1h | open |
| F-015 | 🟠 | a11y | Card: Clickable Div Missing ARIA | src/components/Card.tsx | 20m | open |
| F-016 | 🟠 | a11y | CollapsibleInfoPanel: Non-semantic Button | src/components/CollapsibleInfoPanel.tsx | 15m | open |
| F-017 | 🟠 | a11y | PasswordInput: TabIndex=-1 on Toggle | src/components/PasswordInput.tsx | 10m | open |
| F-018 | 🟠 | a11y | LogoUploadDialog: DropZone Keyboard Issue | src/components/LogoUploadDialog.tsx | 20m | open |
| F-019 | 🟠 | a11y | Combobox: Missing aria-activedescendant | src/components/Combobox.tsx | 30m | open |
| F-020 | 🟠 | other | ConfirmDialog: isOpen Default True | src/components/ConfirmDialog.tsx | 10m | open |
| F-021 | 🟠 | other | ActionMenu: Inline Styles Anti-pattern | src/components/ActionMenu.tsx | 45m | open |
| F-022 | 🟡 | a11y | ActionMenu: Static aria-label | src/components/ActionMenu.tsx | 10m | open |
| F-023 | 🟡 | a11y | SyncIndicator: title instead of aria-label | src/components/SyncIndicator.tsx | 10m | open |
| F-024 | 🟡 | a11y | ConnectionStatusBar: title instead of aria-label | src/components/ConnectionStatusBar.tsx | 10m | open |
| F-025 | 🟡 | architecture | Hardcoded zIndex Values | src/components/ActionMenu.tsx | 30m | open |
| F-026 | 🟡 | architecture | ToastContainer: Hardcoded Positions | src/components/ToastContainer.tsx | 15m | open |
| F-027 | 🟡 | other | BottomNavigation: Type Mismatch | src/components/BottomNavigation.tsx | 15m | open |
| F-028 | 🟡 | a11y | Icons: Missing aria-hidden | src/components/Icons.tsx | 20m | open |
| F-029 | 🟡 | perf | Button: prefersReducedMotion in useEffect | src/components/Button.tsx | 10m | open |
| F-030 | 🟡 | doc | PDF-Export Implementation nicht im Code sichtbar | src/components/dialogs/PDFExportDialog.tsx | 1h | open |
| F-031 | 🟠 | ux | Kein Fallback bei PDF-Generierungs-Fehlern | src/components/dialogs/PDFExportDialog.tsx | 30m | open |
| F-032 | 🟠 | ux | Kein Print-Layout (@media print) vorhanden | src/components/ScheduleDisplay.tsx | 1h | open |
| F-033 | 🟡 | ux | ShareDialog Implementation nicht im Code sichtbar | src/components/ScheduleActionButtons.tsx | 30m | open |
| F-034 | 🟠 | other | CSV/JSON Export fehlt (nur Import vorhanden) | src/components/dialogs/ImportDialog.tsx | 2h | open |
| F-035 | 🟡 | ux | Keine Copy-to-Clipboard für Turnier-Links | src/components/ScheduleActionButtons.tsx | 15m | open |
| F-036 | 🔴 | other | useLongPress isPressed state stale due to Ref usage | src/hooks/useLongPress.ts | 30m | open |
| F-037 | 🟠 | perf | useClickOutside listener re-attachment on every render | src/hooks/useClickOutside.ts | 15m | open |
| F-038 | 🟠 | perf | Timer Hooks return new object every second causing re-renders | src/hooks/useMatchTimerExtended.ts | 45m | open |
| F-039 | 🟠 | perf | useMatchSound audioRef not explicitly nullified on unmount | src/hooks/useMatchSound.ts | 15m | open |
| F-040 | 🟡 | architecture | useMatchExecution too complex (God Hook tendency) | src/hooks/useMatchExecution.ts | 2h | open |
| F-041 | 🟡 | perf | useLocalStorage performs JSON.stringify on every set | src/hooks/useLocalStorage.ts | 20m | open |
| F-042 | 🟠 | perf | useLiveMatches Map recreation triggers unnecessary re-renders | src/hooks/useLiveMatches.ts | 30m | open |
| F-043 | 🟠 | a11y | Decorative icons lack aria-hidden | src/components/ContactForm.tsx | - | open |
| F-044 | 🟠 | a11y | Technical error details exposed to users | src/components/ErrorBoundary.tsx | - | open |
| F-045 | 🟡 | a11y | Live-Region implementation status unclear | src/components/Cockpit.tsx | - | open |
| F-046 | 🟡 | a11y | Dialog focus trap not verified | src/components/Dialogs.tsx | - | open |
| F-047 | 🟡 | a11y | Skip to Content link missing | src/App.tsx | - | open |
| F-048 | 🟡 | architecture | Race Conditions bei Spielstart nicht im Code sichtbar | src/features/live-cockpit/ | - | open |
| F-049 | 🟡 | perf | Timer-Drift im Browser nicht implementiert | src/features/live-cockpit/Timer.tsx | - | open |
| F-050 | 🟡 | security | Server-seitige Validierung für Tore nicht sichtbar | src/features/live-cockpit/ | - | open |
| F-051 | 🟡 | ux | Offline-Queue für Tore fehlt im Code | src/features/live-cockpit/ | - | open |
| F-052 | 🟡 | architecture | Live-Cockpit-Komponenten komplett fehlend | src/features/live-cockpit/ | - | open |
| F-053 | 🔴 | perf | Blocking Storage Init verzögert First Contentful Paint | src/core/storage/StorageFactory.ts | 2h | open |
| F-054 | 🟡 | perf | Service Worker Caching-Strategie nicht im Code sichtbar | vite.config.ts | 1h | open |
| F-055 | 🔴 | perf | Realtime Memory Leaks bei Supabase Channel Cleanup | src/features/**/*.ts | 1h | open |
| F-056 | 🟠 | perf | jsPDF Bundle Bloat blockiert Initial Load | src/features/export/*.ts | 30m | open |
| F-057 | 🟡 | perf | Vite manualChunks Konfiguration nicht im Code sichtbar | vite.config.ts | 1h | open |
| F-058 | 🟡 | ux | Offline-Status Hook nicht implementiert | src/hooks/useOnlineStatus.ts | 1h | open |
| F-059 | 🟡 | ux | Install-Prompt Handler nicht implementiert | src/ | 1h | open |
| F-060 | 🔴 | security | Fehlende Route Guards für Tournament Management | src/router.tsx | 1h | open |
| F-061 | 🟠 | architecture | Redundante Public View Screens (3 Screens für gleiche Funktion) | src/screens/PublicLiveViewScreen.tsx | 2h | open |
| F-062 | 🟠 | ux | Missing 404 Catch-All Route | src/router.tsx | 15m | open |
| F-063 | 🟠 | ux | Inkonsistente Back-Button Logik ohne Fallback | src/screens/DashboardScreen.tsx | 30m | open |
| F-064 | 🟠 | ux | Mobile Bottom Sheet 'More Menu' nicht URL-synced | src/screens/TournamentManagementScreen.tsx | 45m | open |
| F-065 | 🟠 | other | Wizard Steps URL-Parameter ohne Validierung | src/features/tournament-creation/utils.ts | 30m | open |
| F-066 | 🟡 | architecture | Inkonsistente URL-Muster für Legal Pages | src/router.tsx | 20m | open |
| F-067 | 🟡 | ux | Tournament Creation Wizard History Clutter | src/features/tournament-creation/TournamentCreationScreen.tsx | 30m | open |
| F-068 | 🟡 | ux | Settings Screen hat kein klar definiertes Exit-Ziel | src/screens/SettingsScreen.tsx | 15m | open |
| F-069 | 🟡 | ux | Keine Share-Links für Matches im Cockpit | src/features/schedule/components/ScheduleDisplay.tsx | 45m | open |
| F-070 | 🟡 | security | Missing Row Level Security (RLS) Policies | supabase/ | - | open |
| F-071 | ⚫ | security | Sensitive Tokens Exposed in URL Parameters | src/features/auth/components/AuthConfirmPage.tsx | - | open |
| F-072 | 🟡 | security | No Content Security Policy (CSP) Configured | vercel.json | - | open |
| F-073 | 🟡 | security | No Rate Limiting on Auth Endpoints | supabase/ | - | open |
| F-074 | 🔴 | security | Session Timeout Not Configured | supabase/ | - | open |
| F-075 | 🔴 | security | No Account Lockout After Failed Attempts | src/features/auth/components/LoginScreen.tsx | - | open |
| F-076 | 🔴 | security | Invite Tokens Not Short-Lived | src/features/auth/components/InviteDialog.tsx | - | open |
| F-077 | 🔴 | security | No Input Sanitization for User-Generated Content | src/features/auth/components/MemberList.tsx | - | open |
| F-078 | 🟠 | security | No Audit Logging for Security Events | src/ | - | open |
| F-079 | 🟠 | security | No 2FA Support for Admin Accounts | src/ | - | open |
| F-080 | 🟠 | security | Sensitive Data Stored in LocalStorage | src/core/adapters/IStorageAdapter.ts | - | open |
| F-081 | 🟠 | security | No Secure Cookie Flags Configured | vercel.json | - | open |
| F-082 | 🟠 | data | Doppelte SportId-Typ-Definitionen | src/types/tournament.ts | 1h | open |
| F-083 | 🟠 | data | ScheduledTime JSON-Serialisierung verliert Date-Typ | src/core/models/schemas/TournamentSchema.ts | 30m | open |
| F-084 | 🟠 | data | MatchSchema fehlende Team-Validierung | src/core/models/schemas/MatchSchema.ts | 1h | open |
| F-085 | 🟠 | data | RuntimeMatchEventSchema matchId optional | src/core/models/schemas/RuntimeMatchEventSchema.ts | 30m | open |
| F-086 | 🟡 | architecture | Hardcoded Sport-Registry | src/config/sports/index.ts | 4h | open |
| F-087 | 🟡 | data | MatchStatus Duplikation in Modellen | src/core/models/LiveMatch.ts | 30m | open |
| F-088 | 🟡 | data | Zod Passthrough verschleiert Datenkorruption | src/core/models/schemas/TournamentSchema.ts | 2h | open |
| F-089 | 🟡 | data | Tiebreaker-Logik Inkonsistenz in Config | src/config/sports/football.ts | 1h | open |
| F-090 | 🟡 | security | RLS Policy Cleanup Migration fehlt im Code | migrations/ | - | open |
| F-091 | 🔴 | data | Optimistic Locking Race Condition bei Match-Initialisierung | src/repositories/SupabaseLiveMatchRepository.ts | - | open |
| F-092 | 🟠 | security | Anonymous User Limit umgehbar via SECURITY DEFINER | migrations/ | - | open |
| F-093 | 🟠 | data | Denormalized Owner Sync Trigger Race Condition | migrations/ | - | open |
| F-094 | 🟠 | data | Version-Inkrementierung in LocalStorage vor Cloud-Sync | src/repositories/LocalStorageRepository.ts | - | open |
| F-095 | 🟠 | perf | Granular Sync Delta-Erkennung unvollständig | src/repositories/OfflineRepository.ts | - | open |
| F-096 | 🟠 | perf | MutationQueue ohne Retry-Backoff-Strategie | src/repositories/MutationQueue.ts | - | open |
| F-097 | 🟠 | perf | Realtime Subscriptions ohne Cleanup bei Unmount | src/repositories/SupabaseLiveMatchRepository.ts | - | open |
| F-098 | 🟠 | security | Edge Function validate-registration-code ohne Rate Limiting | supabase/functions/validate-registration-code/ | - | open |
| F-099 | 🟡 | data | Version-Spalte fehlt auf tournaments-Tabelle | migrations/ | - | open |
| F-100 | 🟠 | testing | Hardcodierte Test-Daten in Mock-Dateien | src/test-data/mockTournament.ts | - | open |
| F-101 | 🟠 | testing | Bekannte Bugs werden mit .skip() umgangen | src/fairScheduler.minimal.test.ts | - | open |
| F-102 | 🟠 | testing | Inkonsistente Team-Referenzierung in Tests | src/calculations.test.ts | - | open |
| F-103 | 🟡 | testing | Fehlende E2E Tests für kritische Pfade | tests/e2e/tournament-creation.spec.ts | - | open |
| F-104 | 🟡 | testing | Fehlende Component Tests für React UI | src/components/__tests__/LiveScoreInput.test.tsx | - | open |
| F-105 | 🟡 | a11y | Fehlende Accessibility Tests | tests/a11y/tournament-view.spec.ts | - | open |
| F-106 | 🟡 | testing | Fehlende Tests für Error Handling | src/ | - | open |
| F-107 | 🟡 | architecture | Missing Playoff Bracket Generator Module | src/core/generators/playoffBracketGenerator.ts | 2h | open |
| F-108 | 🟡 | other | Missing Tiebreaker Resolution Logic | src/utils/tiebreakerResolver.ts | 1h | open |
| F-109 | 🟠 | ux | No Playoff Overview in Admin Center | src/TournamentAdminCenter.tsx | 3h | open |
| F-110 | 🟡 | data | Missing Result Correction Recalculation | src/core/services/resultCorrectionService.ts | 2h | open |
| F-111 | 🟡 | data | Missing Tournament Abort Calculation | src/core/services/tournamentAbbruchService.ts | 1h | open |
| F-112 | 🔴 | perf | Division durch Null in DurationEstimate.tsx | src/features/tournament-creation/components/DurationEstimate.tsx | 30m | open |
| F-113 | 🔴 | data | startDate Validierung fehlt in Metadata | src/features/tournament-creation/Step3_Metadata.tsx | 20m | open |
| F-114 | 🔴 | data | Team-Namen Validierung nicht vollständig | src/features/tournament-creation/Step4_Teams.tsx | 30m | open |
| F-115 | 🔴 | ux | Mobile Team-Verwaltung zu komplex | src/features/tournament-creation/Step4_Teams.tsx | 2h | open |
| F-116 | 🔴 | data | Gruppe ohne Feld-Zuordnung möglich | src/features/tournament-creation/Step_GroupsAndFields.tsx | 45m | open |
| F-117 | 🟠 | architecture | numberOfGroups State-Leck bei Moduswechsel | src/features/tournament-creation/Step2_ModeAndSystem.tsx | 30m | open |
| F-118 | 🟠 | architecture | Referee Config Typisierung unsicher | src/features/tournament-creation/components/RefereeSettings.tsx | 20m | open |
| F-119 | 🟠 | data | ShortCode Eindeutigkeit nicht geprüft | src/features/tournament-creation/components/NameGrid.tsx | 30m | open |
| F-120 | 🟠 | architecture | Team-Count Synchronisation inkonsistent | src/features/tournament-creation/Step4_Teams.tsx | 45m | open |
| F-121 | 🟠 | ux | FinalsConfiguration Warnungen unklar | src/features/tournament-creation/FinalsConfiguration.tsx | 30m | open |
| F-122 | 🟠 | architecture | Team-Löschung bei numberOfTeams inkonsistent | src/features/tournament-creation/Step4_Teams.tsx | 30m | open |
| F-123 | 🟡 | ux | BambiniSettings Checkboxen nicht intuitiv | src/features/tournament-creation/BambiniSettings.tsx | 20m | open |
| F-124 | 🟡 | data | numberOfReferees auf 0 setzen möglich | src/features/tournament-creation/components/RefereeSettings.tsx | 15m | open |
| F-125 | 🔴 | other | Zu komplexe Funktion: compareDirectMatches | src/utils/calculations.ts | 2h | open |
| F-126 | 🔴 | other | Komplexe Logik in cleanupOldLiveMatches | src/utils/storageCleanup.ts | 1h | open |
| F-127 | 🔴 | other | Unsichere Non-Null Assertions | src/utils/FairnessCalculator.ts | 30m | open |
| F-128 | 🟠 | security | Schwache Fallback-UUID Generierung | src/utils/idGenerator.ts | 30m | fixed |
| F-129 | 🟠 | testing | Type-Casts in Test-Fixtures | src/utils/__tests__/ScenarioHMK.test.ts | 45m | open |
| F-130 | 🟠 | other | Falscher Operator für Nullish-Checks | src/utils/filterMatches.ts | 15m | open |
| F-131 | 🟠 | doc | Häufige ESLint-Disables | src/utils/displayNames.ts | 30m | open |
| F-132 | 🟡 | testing | Debug-Output in Tests | src/utils/scheduleGenerator_finals_bug.test.ts | 15m | open |
| F-133 | 🟡 | doc | Veralteter Dead-Code Kommentar | src/utils/knockoutMatchGenerator.ts | 10m | open |
| F-134 | ⚫ | architecture | useRef für Subscriptions verhindert korrekten Cleanup | src/core/contexts/RepositoryContext.tsx | - | open |
| F-135 | ⚫ | data | Date-Serialisierung: JSON-String vs TypeScript Date | src/core/models/schemas/TournamentSchema.ts | - | open |
| F-136 | ⚫ | architecture | Circular Import Risk: Core importiert aus Features | src/core/contexts/RepositoryContext.tsx | - | open |
| F-137 | 🔴 | architecture | God Object: fairScheduler zu groß (23.637 Zeichen) | src/core/generators/fairScheduler.ts | - | open |
| F-138 | 🔴 | architecture | Mixed Concerns: scheduleGenerator generiert, scheduliert, rendert | src/core/generators/scheduleGenerator.ts | - | open |
| F-139 | 🔴 | data | LiveMatch vs Match Duplikation führt zu Sync-Risiko | src/core/models/LiveMatch.ts | - | open |
| F-140 | 🟡 | architecture | Optimistic Locking Implementierung fehlt [REQUIRES_CROSS_CHECK] | src/core/repositories/ | - | open |
| F-141 | 🟡 | testing | Integration Tests zwischen Core/Features fehlen [REQUIRES_CROSS_CHECK] | src/ | - | open |
| F-142 | 🟡 | architecture | Feature Flag System fehlt [REQUIRES_CROSS_CHECK] | src/core/config/ | - | open |
| F-143 | 🟠 | doc | Barrel Export Chaos: Zu viele export * ohne Dokumentation | src/core/index.ts | - | open |
| F-144 | 🟡 | other | Test File Size: playoffGenerator.test.ts zu groß | src/core/generators/__tests__/playoffGenerator.test.ts | - | open |
| F-145 | 🟡 | other | Hardcoded Timezones: parseStartTime ohne UTC-Handling | src/core/generators/scheduleHelpers.ts | - | open |
| F-146 | 🟠 | architecture | compareDirectMatches hat 80+ LOC mit tiefer Verschachtelung | src/utils/calculations.ts | 2h | open |
| F-147 | 🔴 | security | Non-Null Assertions (!) können Runtime-Errors verursachen | src/utils/FairnessCalculator.ts | 1h | open |
| F-148 | 🟠 | security | Type Assertions (as) in Tests reduzieren Type-Safety | src/utils/__tests__/ScenarioHMK.test.ts | 30m | open |
| F-149 | 🟠 | other | || statt ?? für Boolean-Checks birgt Logik-Risiko | src/utils/filterMatches.ts | 15m | open |
| F-150 | 🟡 | testing | console.log Debug-Output in Test-Dateien | src/utils/scheduleGenerator_finals_bug.test.ts | 15m | open |
| F-151 | 🟡 | architecture | cleanupOldLiveMatches hat 70+ LOC komplexe Logik | src/utils/storageCleanup.ts | 45m | open |
| F-152 | 🟡 | security | Fallback-UUID ist schwach und kollisionsanfällig | src/utils/idGenerator.ts | 30m | fixed |
| F-153 | 🟡 | doc | Dead-Code-Kommentare verursachen Verwirrung | src/utils/knockoutMatchGenerator.ts | 10m | open |
| F-154 | 🟡 | other | eslint-disable für prefer-nullish-coalescing in displayNames.ts | src/utils/displayNames.ts | 15m | open |
| F-155 | 🟡 | other | Error Boundaries nicht im Code sichtbar [REQUIRES_CROSS_CHECK] | src/ | 1h | open |
| F-156 | 🟠 | perf | PDF-Generierung ohne Timeout-Handling | PDFExportDialog.tsx | - | open |
| F-157 | 🟠 | testing | Fehlende Fehlerdiagnose bei jsPDF-Fehlern | PDFExportDialog.tsx | - | open |
| F-158 | 🟡 | other | Schriftart-Embedded für Umlaute | lib/pdfExporter.ts | - | open |
| F-159 | 🟡 | ux | Clipboard-Fallback fehlt für Desktop | ShareDialog.tsx | - | open |
| F-160 | 🟠 | other | Kein Deep-Link für geteilte Turniere | ShareDialog.tsx | - | open |
| F-161 | 🟡 | security | Monitor-URL ohne Auth-Check | MonitorView.tsx | - | open |
| F-162 | 🟠 | other | Fehlender CSV Export für Tabellen | src/ | - | open |
| F-163 | 🟠 | ux | Fehlende Print-Friendly Styles | ScheduleDisplay.tsx | - | open |
| F-164 | 🟠 | other | Fehlende Open Graph Meta-Tags | index.html | - | open |
| F-165 | 🔴 | a11y | Live-Daten ohne aria-live Announcements | src/components/Cockpit/MatchTimer.tsx | 2h | open |
| F-166 | 🔴 | a11y | Toggle-Button ohne aria-expanded State | src/components/ContactForm.tsx | 30m | open |
| F-167 | 🔴 | a11y | Fehlendes Focus Management in Modals | src/components/Modal/ | 4h | open |
| F-168 | 🟠 | a11y | Hardcodierte Icons/Arrows nicht übersetzbar | src/components/ContactForm.tsx | 1h | open |
| F-169 | 🟠 | a11y | Fehlende Skip Links für Keyboard-Nutzer | src/App.tsx | 1h | open |
| F-170 | 🟠 | a11y | ErrorBoundary Emoji ohne Screenreader-Kontext | src/components/ErrorBoundary.tsx | 30m | open |
| F-171 | 🟡 | other | Fehlende Plural-Keys für teams | src/locales/admin.json | 30m | open |
| F-172 | 🟡 | other | Zeitformatierung browserabhängig | src/utils/dateFormatting.ts | 1h | open |
| F-173 | 🟡 | a11y | Form Labels Verknüpfung prüfen [REQUIRES_CROSS_CHECK] | src/components/Input.tsx | 1h | open |
| F-174 | 🟡 | a11y | Touch Target Sizes nicht verifizierbar [REQUIRES_CROSS_CHECK] | src/styles/cssVars.ts | 2h | open |
| F-175 | 🟡 | a11y | Color Contrast nicht verifizierbar [REQUIRES_CROSS_CHECK] | src/styles/cssVars.ts | 3h | open |
| F-176 | 🟡 | a11y | Fehlende Reduced Motion Support | src/styles/globals.css | 1h | open |
| F-177 | 🟡 | other | Missing Live Timer Implementation | src/App.tsx | 4h | open |
| F-178 | 🟡 | data | Missing Score Calculation Logic | src/App.tsx | 3h | open |
| F-179 | 🟡 | data | Missing Race-Condition Prevention | src/App.tsx | 2h | open |
| F-180 | 🟡 | data | Missing Offline Resilience | src/App.tsx | 3h | open |
| F-181 | 🟠 | data | Undo History Lost on Tab Switch | src/features/schedule/ScheduleEditor.tsx | 1h | open |
| F-182 | 🟡 | ux | Fehlender Service Worker und Manifest | vite.config.ts | 2h | open |
| F-183 | 🟠 | perf | Blockierende Storage-Migration bei App-Start | src/core/storage/StorageFactory.ts | 30m | open |
| F-184 | 🟡 | perf | Keine Code-Splitting-Strategie sichtbar | vite.config.ts | 2h | open |
| F-185 | 🟡 | security | Fehlende zentrale ProtectedRoute-Komponente | src/components/routing/ProtectedRoute.tsx | - | open |
| F-186 | 🟠 | architecture | Redundante Public View Screens | src/screens/LiveViewScreen.tsx | - | open |
| F-187 | 🟡 | ux | Fehlendes 404-Handling für unbekannte Routen | src/router.tsx | - | open |
| F-188 | 🟠 | ux | Prop Drilling für Navigation über onBack Props | src/screens/LegalPageLayout.tsx | - | open |
| F-189 | 🟡 | ux | Inkonsequente Mobile-Navigation zwischen Screens | src/screens/DashboardScreen.tsx | - | open |
| F-190 | 🟡 | ux | Wizard History-Stack durch replace: true | src/screens/TournamentCreationScreen.tsx | - | open |
| F-191 | 🟡 | ux | Fehlende URL-Routing für Einstellungen | src/screens/SettingsScreen.tsx | - | open |
| F-192 | 🟡 | ux | Legal Pages ohne direkte URL-Zugänglichkeit | src/screens/DatenschutzScreen.tsx | - | open |
| F-193 | 🔴 | security | Migration Order Dependency Locks Data Access | migrations/004_optimized_rls.sql | 1h | open |
| F-194 | 🟠 | security | Potential RLS Recursion in tournament_collaborators | migrations/20260128_002_consolidate_rls_v3.sql | 30m | open |
| F-195 | 🟠 | ux | Missing UI Retry for OptimisticLockError | src/repositories/SupabaseLiveMatchRepository.ts | 2h | open |
| F-196 | 🟡 | perf | Missing Index on tournament_collaborators for RLS | migrations/20260121_002_denormalize_owner.sql | 15m | open |
| F-197 | 🟡 | data | Stale Match Recovery Only Local | src/repositories/LocalStorageLiveMatchRepository.ts | 30m | open |
| F-198 | 🟡 | testing | E2E-Tests fehlen komplett | tests/ | 4h | open |
| F-199 | 🟡 | a11y | Accessibility-Tests nicht sichtbar | tests/ | 2h | open |
| F-200 | 🟠 | testing | Fragile Time-based Assertions | tests/schedule.test.ts | 30m | open |
| F-201 | 🟠 | testing | i18next Mock zu vereinfacht | tests/setup.ts | 45m | open |
| F-202 | 🟠 | testing | Schwache Test-Assertions | tests/standings.test.ts | 30m | open |
| F-203 | 🟠 | testing | Fehlender Test-Cleanup für localStorage | tests/setup.ts | 20m | open |
| F-204 | 🟠 | perf | Performance-Tests mit großzügigen Timeouts | tests/performance.test.ts | 1h | open |
| F-205 | 🟡 | testing | Supabase Integration nicht getestet | src/services/supabase.ts | 3h | open |
| F-206 | 🟡 | testing | PWA-Features ungetestet | public/sw.js | 2h | open |
| F-207 | 🟠 | testing | Error-Handling nicht umfassend getestet | src/services/ | 2h | open |
| F-208 | 🟡 | security | Security-Tests fehlen | tests/ | 4h | open |
| F-209 | 🔴 | data | Team-Count Inkonsistenz zwischen numberOfTeams und teams.length | src/features/tournament-creation/Step4_Teams.tsx | 1h | open |
| F-210 | 🟠 | other | Ungleichgewicht bei Gruppenverteilung mit ungerader Teamzahl | src/features/tournament-creation/ScheduleGenerator.ts | 2h | open |
| F-211 | 🔴 | other | Schedule-Generation ohne Error-Handling kann App crashen | src/features/tournament-creation/TournamentPreview.tsx | 1h | open |
| F-212 | 🟡 | doc | Fehlendes Zod-Validierungsschema für Wizard | src/features/tournament-creation/wizardSchema.ts | 4h | open |
| F-213 | 🔴 | ux | Keine Auto-Save Persistierung bei Browser-Crash | src/features/tournament-creation/TournamentWizard.tsx | 3h | open |
| F-214 | 🟠 | ux | Keine Fortschrittsanzeige im Wizard-Flow | src/features/tournament-creation/TournamentWizard.tsx | 2h | open |
| F-215 | 🟠 | a11y | XSS-Risiko bei Team-Namen ohne Input-Sanitization | src/features/tournament-creation/Step4_Teams.tsx | 2h | open |
| F-216 | ⚫ | data | LiveMatch Optimistic Locking ohne Conflict-Resolution | src/features/live-match/LiveMatch.ts | 4h | open |
| F-217 | 🟠 | ux | Keine Warnung bei Browser-Schließen während Wizard aktiv | src/features/tournament-creation/TournamentWizard.tsx | 1h | open |
| F-218 | 🟡 | ux | Kein Bulk-Import für Teams (CSV/Excel) | src/features/tournament-creation/Step4_Teams.tsx | 6h | open |
| F-219 | 🟠 | perf | Keine Virtualisierung bei Team-Liste bei vielen Teams | src/features/tournament-creation/Step4_Teams.tsx | 3h | open |
| F-220 | 🟡 | testing | Keine Unit-Tests für Schedule-Generator-Logik | src/features/tournament-creation/ScheduleGenerator.ts | 8h | open |
| F-221 | 🔴 | perf | useMatchTimer verursacht unnötige Re-Renders pro Frame | src/hooks/useMatchTimer.ts | - | open |
| F-222 | 🔴 | perf | useLiveMatches erzeugt neue Map-Referenz bei jedem Update | src/hooks/useLiveMatches.ts | - | open |
| F-223 | 🔴 | perf | useDialogTimer Interval-Cleanup nicht robust | src/hooks/useDialogTimer.ts | - | open |
| F-224 | 🟠 | perf | useAutoSave führt JSON.stringify bei jedem Render aus | src/hooks/useAutoSave.ts | - | open |
| F-225 | 🟠 | ux | useMatchSound aktualisiert Audio-Element nicht bei Sound-Wechsel | src/hooks/useMatchSound.ts | - | open |
| F-226 | 🟠 | perf | useMatchCockpitPro berechnet effectiveSettings bei jedem Render | src/hooks/useMatchCockpitPro.ts | - | open |
| F-227 | 🟡 | doc | Deprecated Hooks werden im Haupt-Export bereitgestellt | src/hooks/index.ts | - | open |
| F-228 | 🔴 | a11y | ActionMenu Touch Target unter WCAG Minimum | src/components/ui/ActionMenu.tsx | 30m | open |
| F-229 | 🔴 | a11y | PasswordInput Toggle nicht keyboard-navigierbar | src/components/ui/PasswordInput.tsx | 15m | open |
| F-230 | 🔴 | a11y | Collapsible Panels ohne aria-pressed State | src/components/ui/CollapsibleInfoPanel.tsx | 20m | open |
| F-231 | 🔴 | a11y | BottomNavigation keine Keyboard-Navigation | src/components/ui/BottomNavigation.tsx | 1h | open |
| F-232 | 🔴 | a11y | ColorPicker Presets ohne Focus States | src/components/ui/ColorPicker.tsx | 30m | open |
| F-233 | 🟠 | a11y | Toast role="alert" für alle Typen | src/components/ui/Toast.tsx | 20m | open |
| F-234 | 🟠 | architecture | Inkonsistente Styling-Patterns | src/components/ui/ | 8h | open |
| F-235 | 🟠 | architecture | Hardcoded Design Values statt Tokens | src/components/ui/ | 4h | open |
| F-236 | 🟠 | architecture | Form Component API inkonsistent | src/components/ui/ | 2h | open |
| F-237 | 🟠 | a11y | NumberStepper Buttons ohne aria-label | src/components/ui/NumberStepper.tsx | 30m | open |
| F-238 | 🔴 | security | Client-Side Authorization Only in AuthGuard | src/features/auth/components/AuthGuard.tsx | 4h | open |
| F-239 | 🔴 | security | Supabase Service Role Key Exposure Risk | supabase/functions/merge-accounts/index.ts | 1h | open |
| F-240 | 🔴 | security | Invite Token in URL Parameters | src/features/auth/components/AuthConfirmPage.tsx | 2h | open |
| F-241 | 🔴 | security | No Rate Limiting on Auth Endpoints | src/features/auth/components/LoginScreen.tsx | 3h | open |
| F-242 | 🟡 | security | Missing CSP Headers Configuration | vercel.json | 2h | open |
| F-243 | 🔴 | security | Email Enumeration via Error Messages | src/features/auth/components/LoginScreen.tsx | 1h | open |
| F-244 | 🔴 | security | Guest Tournament Limits Client-Side Only | src/features/auth/hooks/useTournamentLimit.ts | 3h | open |
| F-245 | 🟠 | security | Console Logs in Production Build | src/features/auth/components/AuthCallback.tsx | 2h | open |
| F-246 | 🟠 | security | Merge Function SQL Injection Risk | supabase/functions/merge-accounts/index.ts | 2h | open |
| F-247 | 🟠 | security | No Session Timeout Implemented | src/features/auth/components/AuthGuard.tsx | 2h | open |
| F-248 | 🟠 | security | No Audit Logging for Sensitive Actions | supabase/functions/ | 6h | open |
| F-249 | 🟠 | security | Service Worker Cache Security | public/sw.js | 3h | open |
| F-250 | 🔴 | data | Date/ISO-Inkonsistenz bei scheduledTime | src/types/TournamentSchema.ts | - | open |
| F-251 | 🟠 | data | Redundante Sport-Felder im TournamentSchema | src/types/TournamentSchema.ts | - | open |
| F-252 | 🟠 | data | Fehlende FK-Validierung für Teams und Groups | src/types/MatchSchema.ts | - | open |
| F-253 | 🟠 | data | Timer-State-Inkonsistenz ohne Validierung | src/models/LiveMatch.ts | - | open |
| F-254 | 🟠 | data | Score-Validierung fehlt für negative Werte | src/types/MatchSchema.ts | - | open |
| F-255 | 🟠 | data | Schema .passthrough() Risiko | src/types/CommonSchemas.ts | - | open |
| F-256 | 🟠 | testing | Event-Typ-Validierung unvollständig | src/types/RuntimeMatchEventSchema.ts | - | open |
| F-257 | 🟠 | architecture | Status-Transition-Validierung fehlt | src/types/MatchSchema.ts | - | open |
| F-258 | 🟠 | architecture | Sport-Erweiterung erfordert Core-Änderungen | src/config/sports/football.ts | - | open |
| F-259 | 🟡 | architecture | AgeClasses nicht sport-neutral | src/config/sports/football.ts | - | open |
| F-260 | 🟡 | architecture | FinalsPreset-Enum nicht erweiterbar | src/types/types.ts | - | open |
| F-261 | 🔴 | data | reset_schedule löscht correctionHistory und bricht Audit-Trail | DangerZone/index.tsx | 2h | open |
| F-262 | 🔴 | data | regenerate_schedule setzt finishedAt nicht zurück bei finished Matches | DangerZone/index.tsx | 1h | open |
| F-263 | 🟠 | architecture | Tiebreaker-Logik in LiveMatch nicht implementiert | src/core/models/LiveMatch.ts | 4h | open |
| F-264 | 🟠 | data | Punktgleichheit-Tiebreaker-Regeln in calculateStandings unklar | Exports/index.tsx | 2h | open |
| F-265 | 🟠 | ux | DangerZone-Funktionen haben verwirrende Namensgebung | DangerZone/index.tsx | 30m | open |
| F-266 | 🟠 | ux | Keine Undo-Funktion für Ergebnis-Korrekturen | ActivityLog/index.tsx | 3h | open |
| F-267 | 🟠 | ux | Auto-Share-Code keine manuelle Kontrolle | Visibility/index.tsx | 1h | open |
| F-268 | 🟠 | ux | Teams können während Turnier nicht ausgetauscht werden | TeamHelpers/index.tsx | 2h | open |
| F-269 | 🟠 | ux | Feld-Zuweisung zu Matches nicht implementiert | Settings/index.tsx | 3h | open |
| F-270 | 🟡 | architecture | Playoff-Bracket-Generierung nicht im Code sichtbar [REQUIRES_CROSS_CHECK] | src/core/generators/ | 1d | open |
| F-271 | 🟡 | ux | Playoff-Vorschau im Admin nicht implementiert [REQUIRES_CROSS_CHECK] | src/components/Admin/ | 4h | open |
| F-272 | 🟠 | testing | Test-Coverage für Admin Center erhöhen | src/features/tournament-admin/__tests__/TournamentAdminCenter.test.tsx | 4h | open |
| F-273 | 🟠 | a11y | Keyboard-Navigation in Sidebar fehlt | AdminSidebar.tsx | 1h | open |
| F-274 | 🟡 | architecture | Abhängigkeit generateSchedule geklärt | DangerZone/index.tsx | 30m | open |
| F-275 | 🟡 | other | Ungenutzte Variable _isTablet | src/features/tournament-admin/TournamentAdminCenter.tsx | 5m | open |
| F-276 | 🟡 | architecture | Inline-Styles Wiederholung | src/features/tournament-admin/components/AdminSidebar.tsx | 2h | open |
| F-277 | 🟠 | a11y | Fehlende Keyboard-Navigation Sidebar | src/features/tournament-admin/components/AdminSidebar.tsx | 2h | open |
| F-278 | 🟠 | other | DangerZone Schedule-Actions unvollständig | src/features/tournament-admin/categories/DangerZone/index.tsx | 4h | open |
| F-279 | 🟠 | testing | Mangelnde Unit-Test-Coverage | src/features/tournament-admin/TournamentAdminCenter.tsx | 8h | open |
| F-280 | 🟡 | ux | Mobile Hub fehlt Suchfunktion | src/features/tournament-admin/components/AdminMobileHub.tsx | 1h | open |
| F-281 | 🟠 | architecture | Duplizierte Type-Definitionen statt zentraler Import | src/components/match-cockpit/MatchCockpit.tsx | 1h | open |
| F-282 | 🟠 | architecture | Inkonsistente Feldbenennung in DetailExpand | src/components/schedule/MatchExpand/DetailExpand.tsx | 15m | open |
| F-283 | 🔴 | a11y | ARIA-Attribute für Toggle und Slider fehlen | src/components/MatchCockpitSettingsPanel.tsx | - | open |
| F-284 | 🟠 | ux | Sound Loading-State nicht exponiert | src/hooks/useMatchSound.ts | - | open |
| F-285 | 🟠 | data | Timer-Werte ohne Validierung | src/hooks/useMatchTimer.ts | - | open |
| F-286 | 🟠 | architecture | Inkonsistente Error-Handling-Strategie | src/hooks/useMatchSound.ts | - | open |
| F-287 | 🟡 | architecture | Magic Numbers nicht als Konstanten definiert | src/constants/matchCockpit.ts | - | open |
| F-288 | 🟡 | testing | Test-Coverage für Hooks und Komponenten unzureichend | src/hooks/__tests__/ | - | open |
| F-289 | 🟡 | data | Deprecated Felder in MatchCockpit-Interface | src/components/MatchCockpit.tsx | - | open |
| F-290 | 🟠 | perf | Race Condition bei Sound-Laden | src/hooks/useMatchSound.ts | 1h | open |
| F-291 | 🟡 | other | Fehlende Validierung bei Timer-Werten | src/hooks/useMatchTimer.ts | 30m | open |
| F-292 | 🟡 | other | Deprecated API Usage in MatchEvent.payload | src/components/match-cockpit/MatchCockpit.tsx | 2h | open |
| F-293 | 🟡 | other | Nicht verwendete isTablet Variable | src/components/match-cockpit/MatchCockpit.tsx | 15m | open |
| F-294 | 🟡 | other | Inkonsistente Error-Handling-Strategie | src/hooks/useMatchSound.ts | 1h | open |
| F-295 | 🟡 | other | Magic Numbers in SettingsPanel | src/components/match-cockpit/MatchCockpitSettingsPanel.tsx | 30m | open |
| F-296 | 🟠 | a11y | Toggle-Komponente fehlt ARIA-Label | src/components/match-cockpit/MatchCockpitSettingsPanel.tsx | 30m | open |
| F-297 | 🟠 | a11y | Slider fehlt ARIA-Attribute | src/components/match-cockpit/MatchCockpitSettingsPanel.tsx | 30m | open |
| F-298 | 🟡 | perf | Styles-Objekt bei jedem Render neu erstellt | src/components/match-cockpit/MatchCockpitSettingsPanel.tsx | 15m | open |
| F-299 | 🟠 | testing | Fehlende Unit-Tests für Hooks und Components | src/hooks/useMatchSound.ts | 4h | open |
| F-300 | 🟠 | a11y | ARIA-Labels für MonitorCard Buttons fehlen | MonitorsConfigTab.tsx | 30m | open |
| F-301 | 🟠 | ux | Loading-Indicator bei Save-Operation fehlt | MonitorEditor.tsx | 30m | open |
| F-302 | 🟠 | data | Monitor-Name Validierung fehlt | MonitorsConfigTab.tsx | 1h | open |
| F-303 | 🟡 | architecture | Styles inline in Komponente definiert | MonitorsConfigTab.tsx | 2h | open |
| F-304 | 🟡 | perf | SlideConfigEditor nicht memoized | MonitorEditor.tsx | 30m | open |
| F-305 | 🟠 | a11y | Fokus-Management nach Modal-Schließen fehlt | MonitorEditor.tsx, MonitorsConfigTab.tsx | 1h | open |
| F-306 | 🟡 | ux | Drag-and-Drop für Slides nicht implementiert | MonitorEditor.tsx | 6h | open |
| F-307 | 🟠 | testing | Test-Coverage für Monitors-Features unzureichend | src/features/tournament-management/__tests__/ | 4h | open |
| F-308 | 🔴 | a11y | Touch Targets unter 44px Minimum | src/features/tournament-management/components/schedule-filter/StatusMultiSelect.tsx | 5m | open |
| F-309 | 🔴 | a11y | Touch Targets unter 44px Minimum | src/features/tournament-management/components/schedule-filter/TeamSearchInput.tsx | 5m | open |
| F-310 | 🟠 | architecture | Hardcoded 'color: white' statt Design Token | src/features/tournament-management/components/schedule-filter/ScheduleFilterBarDesktop.tsx | 5m | open |
| F-311 | 🟠 | other | console.warn in Production Code | src/features/tournament-management/hooks/useScheduleFilters.ts | 5m | open |
| F-312 | 🟠 | architecture | Duplicate FilterOptions Interface in 4 Dateien | src/features/tournament-management/hooks/useScheduleFilters.ts | 10m | open |
| F-313 | 🟠 | architecture | Duplicate PHASE_OPTIONS Constant in 2 Dateien | src/features/tournament-management/components/schedule-filter/FilterDropdown.tsx | 10m | open |
| F-314 | 🟠 | a11y | Kein Visible Focus Ring für Keyboard Navigation | src/features/tournament-management/components/schedule-filter/ScheduleFilterBar.tsx | 15m | open |
| F-315 | 🟠 | a11y | Input Font-Size 14px verursacht iOS Zoom | src/features/tournament-management/components/schedule-filter/TeamSearchInput.tsx | 5m | open |
| F-316 | 🟡 | perf | Inline Handler ohne useCallback | src/features/tournament-management/components/schedule-filter/StatusMultiSelect.tsx | 10m | open |
| F-317 | 🟡 | architecture | useScrollDirection Hook nicht exportiert | src/hooks/index.ts | 5m | open |
| F-318 | 🟡 | architecture | Status Labels Duplikation zwischen Komponenten | src/features/tournament-management/components/schedule-filter/FilterChips.tsx | 15m | open |
| F-319 | 🟡 | architecture | Hardcoded letterSpacing statt Design Token | src/features/tournament-management/components/schedule-filter/FilterDropdown.tsx | 10m | open |
| F-320 | 🟡 | architecture | Hardcoded padding statt Design Token | src/features/tournament-management/components/schedule-filter/FilterChips.tsx | 5m | open |
