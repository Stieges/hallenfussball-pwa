# Findings Backlog

| ID | Sev | Area | Title | File | Effort | Status |
|----|-----|------|-------|------|--------|--------|
| F-001 | 🟠 | other | compareDirectMatches hat 80+ LOC mit tiefer Verschachtelung | src/utils/calculations.ts | 2h | open |
| F-002 | 🔴 | security | Non-Null Assertions (!) können Runtime-Errors verursachen | src/utils/FairnessCalculator.ts | 1h | open |
| F-003 | 🟠 | testing | Type-Safety in Tests durch 'as'-Casts verloren | src/utils/__tests__/ScenarioHMK.test.ts | 30m | open |
| F-004 | 🟠 | other | || statt ?? für Boolean-Checks erhöht Logik-Risiko | src/utils/filterMatches.ts | 30m | open |
| F-005 | 🟠 | security | Schwacher Fallback-UUID-Generator | src/utils/idGenerator.ts | 45m | fixed |
| F-006 | 🟡 | testing | console.log Debug-Output in Tests vorhanden | src/utils/scheduleGenerator_finals_bug.test.ts | 15m | open |
| F-007 | 🟡 | other | Dead-Code-Kommentar verwirrend | src/utils/knockoutMatchGenerator.ts | 10m | open |
| F-008 | 🟡 | other | Gemischte Deutsch/Englisch Namen in utils | src/utils/ | 2h | open |
| F-009 | 🟡 | other | Error Boundaries nicht im Code sichtbar | src/components/ | 1h | open |
| F-010 | 🟠 | other | cleanupOldLiveMatches hat 70+ LOC mit komplexer Logik | src/utils/storageCleanup.ts | 1.5h | open |
| F-011 | 🟡 | testing | Test File Size zu groß für Wartbarkeit | src/core/generators/__tests__/playoffGenerator.test.ts | - | open |
| F-012 | 🟡 | data | Hardcoded Timezones ohne UTC-Handling | src/core/generators/scheduleHelpers.ts | - | open |
| F-013 | 🔴 | data | Gruppe ohne Feld-Zuordnung möglich | src/features/tournament-creation/Step_GroupsAndFields.tsx | 45m | open |
| F-014 | 🟠 | data | Team-Löschung bei numberOfTeams inkonsistent | src/features/tournament-creation/Step4_Teams.tsx | 30m | open |
| F-015 | 🟡 | ux | refereeNames Löschung ohne Warnung | src/features/tournament-creation/components/RefereeSettings.tsx | 30m | open |
| F-016 | 🟠 | perf | PDF-Generierung ohne Timeout-Handling bei großen Datenmengen | src/components/PDFExportDialog.tsx | 2h | open |
| F-017 | 🟠 | other | Fehlendes Retry-Feedback bei jsPDF-Fehlern | src/components/PDFExportDialog.tsx | 1h | open |
| F-018 | 🟡 | data | Schriftart-Embedded für Umlaute nicht im Code sichtbar [REQUIRES_CROSS_CHECK] | src/lib/pdfExporter.ts | 1h | open |
| F-019 | 🟡 | ux | Clipboard-Fallback für Web Share API nicht im Code sichtbar [REQUIRES_CROSS_CHECK] | src/components/ShareDialog.tsx | 30m | open |
| F-020 | 🟠 | ux | Kein Deep-Link für geteilte Turniere | src/components/ShareDialog.tsx | 1h | open |
| F-021 | 🟡 | security | Monitor-URL ohne Auth-Check nicht im Code sichtbar [REQUIRES_CROSS_CHECK] | src/views/MonitorView.tsx | 2h | open |
| F-022 | ⚫ | a11y | Live-Daten ohne aria-live-Announcements im Cockpit | src/components/Cockpit/MatchTimer.tsx | 1h | open |
| F-023 | 🔴 | a11y | Toggle-Button ohne aria-expanded State | src/components/ContactForm.tsx | 30m | open |
| F-024 | 🟡 | a11y | Focus Management in Modals nicht sichtbar [REQUIRES_CROSS_CHECK] | src/components/Dialog/ | 2h | open |
| F-025 | 🟠 | a11y | Fehlende Skip-to-Content Links | src/App.tsx | 30m | open |
| F-026 | 🟠 | a11y | Form Labels müssen mit htmlFor verknüpft sein | src/components/Input.tsx | 1h | open |
| F-027 | 🟠 | i18n | Hardcodierte Icons/Arrows in ContactForm | src/components/ContactForm.tsx | 30m | open |
| F-028 | 🟡 | i18n | Fehlende Plural-Keys für 'teams' | src/locales/de/admin.json | 15m | open |
| F-029 | 🟡 | i18n | Zeitformatierung browserabhängig (12h/24h) | src/utils/dateFormatting.ts | 30m | open |
| F-030 | 🟡 | a11y | Reduced Motion Support für Animationen | src/styles/ | 30m | open |
| F-031 | 🟡 | a11y | Color Contrast nicht verifizierbar aus Code | src/styles/ | 1h | open |
| F-032 | 🔴 | data | Keine Race-Condition-Prävention bei Score-Updates | src/features/live-cockpit/ | - | open |
| F-033 | 🔴 | data | Keine Offline-Resilienz für Score-Updates | src/features/live-cockpit/ | - | open |
| F-034 | 🔴 | ux | Keine Bestätigung bei Tor-Eingabe | src/features/live-cockpit/ | - | open |
| F-035 | 🟠 | data | Undo/Redo-History geht bei Tab-Wechsel verloren | src/features/schedule-editor/ScheduleEditor.tsx | - | open |
| F-036 | 🟠 | ux | Kein 'Spiel läuft'-Indikator im Cockpit | src/features/live-cockpit/ | - | open |
| F-037 | 🟠 | data | Sortierung bei Punktgleichheit unklar | src/features/schedule-editor/ | - | open |
| F-038 | 🟡 | perf | Keine Browser-Tab-Drift-Kompensation | src/features/live-cockpit/ | - | open |
| F-039 | 🟡 | ux | Keine Audio-Feedback bei Spielereignissen | src/features/live-cockpit/ | - | open |
| F-040 | 🟡 | ux | Timer-Logik für Live-Cockpit nicht im Code sichtbar | src/features/live-cockpit/ | - | open |
| F-041 | 🟡 | doc | Match-Duration vs. Break-Duration Inkonsistenz | src/types/tournament.ts | - | open |
| F-042 | 🟠 | perf | Blockierende Storage-Migration bei App-Start | src/core/storage/StorageFactory.ts | 2h | open |
| F-043 | 🟡 | perf | Kein Code-Splitting für Features sichtbar | src/ | 4h | open |
| F-044 | 🟡 | perf | vite.config.ts nicht optimiert für Chunks | vite.config.ts | 2h | open |
| F-045 | 🟡 | perf | i18next Tree Shaking nicht implementiert | src/i18n.ts | 1h | open |
| F-046 | 🟡 | ux | Service Worker nicht im Code sichtbar | src/ | 2h | open |
| F-047 | 🟡 | ux | manifest.json nicht im Code sichtbar | public/ | 1h | open |
| F-048 | 🟡 | ux | Offline-Page fehlt | src/ | 3h | open |
| F-049 | 🟠 | perf | Blockierende Storage-Migration bei App-Start | src/core/storage/StorageFactory.ts | 2h | open |
| F-050 | 🟡 | perf | Kein Code-Splitting für Features sichtbar | src/ | 4h | open |
| F-051 | 🟡 | perf | vite.config.ts nicht optimiert für Chunks | vite.config.ts | 2h | open |
| F-052 | 🟡 | perf | i18next Tree Shaking nicht implementiert | src/i18n.ts | 1h | open |
| F-053 | 🟡 | ux | Service Worker nicht im Code sichtbar | src/ | 2h | open |
| F-054 | 🟡 | ux | manifest.json nicht im Code sichtbar | public/ | 1h | open |
| F-055 | 🟡 | ux | Offline-Page fehlt | src/ | 3h | open |
| F-056 | 🟡 | security | Fehlende zentrale Route Guards | src/App.tsx | - | open |
| F-057 | 🟠 | architecture | Redundante Public Screens (LiveView vs PublicTournament) | src/screens/LiveViewScreen.tsx | - | open |
| F-058 | 🟡 | ux | Fehlendes 404-Handling für unbekannte Routen | src/App.tsx | - | open |
| F-059 | 🟠 | ux | Prop Drilling für Navigation (onBack Props) | src/screens/DashboardScreen.tsx | - | open |
| F-060 | 🟡 | ux | Fehlende Deep-Link-URL für Einstellungen | src/screens/SettingsScreen.tsx | - | open |
| F-061 | 🔴 | security | Migration Order Dependency Risk in Denormalized RLS | 20260128_004_optimized_rls.sql | 1h | open |
| F-062 | 🟠 | security | RLS Recursion Risk in tournament_collaborators Policy | 20260128_002_consolidate_rls_v3.sql | 30m | open |
| F-063 | 🟠 | ux | OptimisticLockError Not Handled in Live-Cockpit UI | src/repositories/SupabaseLiveMatchRepository.ts | 2h | open |
| F-064 | 🟠 | data | is_public Trigger Missing Soft-Delete Case | 20260121_002_denormalize_owner.sql | 1h | open |
| F-065 | 🟠 | ux | Missing Sync Status Flag for Offline Changes | src/repositories/OfflineRepository.ts | 3h | open |
| F-066 | 🟡 | perf | Missing Index on tournament_collaborators for RLS Performance | 20260128_002_consolidate_rls_v3.sql | 15m | open |
| F-067 | 🟡 | data | Stale Match Recovery Loses Timer Data on Browser Crash | src/repositories/LocalStorageLiveMatchRepository.ts | 1h | open |
| F-068 | 🟠 | testing | Fragile Time-based Assertions können flaky sein | src/tests/scheduleGenerator.test.ts | 2h | open |
| F-069 | 🟠 | testing | i18next Mock zu stark vereinfacht | src/tests/setup.ts | 1h | open |
| F-070 | 🟠 | testing | Schwache Assertions ohne Spezifikation | src/tests/standings.test.ts | 30m | open |
| F-071 | 🟠 | testing | Fehlende Cleanup-Strategie für localStorage Mock | src/tests/setup.ts | 30m | open |
| F-072 | 🟠 | perf | Performance-Tests mit zu großzügigen Timeouts | src/tests/scheduler.perf.test.ts | 1h | open |
| F-073 | 🟡 | testing | E2E-Tests fehlen komplett [REQUIRES_CROSS_CHECK] | e2e/ | 8h | open |
| F-074 | 🟡 | a11y | Accessibility-Tests fehlen komplett [REQUIRES_CROSS_CHECK] | src/tests/ | 4h | open |
| F-075 | 🟡 | testing | Supabase Integration nicht getestet [REQUIRES_CROSS_CHECK] | src/services/supabase.ts | 6h | open |
| F-076 | 🟡 | testing | PWA-Tests fehlen [REQUIRES_CROSS_CHECK] | public/sw.js | 4h | open |
| F-077 | 🟡 | security | Auth-Flow nicht getestet [REQUIRES_CROSS_CHECK] | src/services/auth.ts | 3h | open |
| F-078 | 🟡 | testing | Realtime-Tests fehlen [REQUIRES_CROSS_CHECK] | src/services/realtime.ts | 4h | open |
| F-079 | 🟡 | testing | PDF-Export-Tests fehlen [REQUIRES_CROSS_CHECK] | src/utils/pdfExport.ts | 2h | open |
| F-080 | 🟠 | testing | Error-Handling nicht umfassend getestet | src/services/ | 4h | open |
| F-081 | 🟠 | testing | Fragile Time-based Assertions können flaky sein | src/tests/scheduleGenerator.test.ts | 2h | open |
| F-082 | 🟠 | testing | i18next Mock zu stark vereinfacht | src/tests/setup.ts | 1h | open |
| F-083 | 🟠 | testing | Schwache Assertions ohne Spezifikation | src/tests/standings.test.ts | 30m | open |
| F-084 | 🟠 | testing | Fehlende Cleanup-Strategie für localStorage Mock | src/tests/setup.ts | 30m | open |
| F-085 | 🟠 | perf | Performance-Tests mit zu großzügigen Timeouts | src/tests/scheduler.perf.test.ts | 1h | open |
| F-086 | 🟡 | testing | E2E-Tests fehlen komplett [REQUIRES_CROSS_CHECK] | e2e/ | 8h | open |
| F-087 | 🟡 | a11y | Accessibility-Tests fehlen komplett [REQUIRES_CROSS_CHECK] | src/tests/ | 4h | open |
| F-088 | 🟡 | testing | Supabase Integration nicht getestet [REQUIRES_CROSS_CHECK] | src/services/supabase.ts | 6h | open |
| F-089 | 🟡 | testing | PWA-Tests fehlen [REQUIRES_CROSS_CHECK] | public/sw.js | 4h | open |
| F-090 | 🟡 | security | Auth-Flow nicht getestet [REQUIRES_CROSS_CHECK] | src/services/auth.ts | 3h | open |
| F-091 | 🟡 | testing | Realtime-Tests fehlen [REQUIRES_CROSS_CHECK] | src/services/realtime.ts | 4h | open |
| F-092 | 🟡 | testing | PDF-Export-Tests fehlen [REQUIRES_CROSS_CHECK] | src/utils/pdfExport.ts | 2h | open |
| F-093 | 🟠 | testing | Error-Handling nicht umfassend getestet | src/services/ | 4h | open |
| F-094 | 🔴 | perf | useMatchTimer: requestAnimationFrame für Sekunden-Updates | src/hooks/useMatchTimer.ts | 1h | open |
| F-095 | 🔴 | perf | useLiveMatches: Map-Referenz ändert sich bei jedem Update | src/hooks/useLiveMatches.ts | 2h | open |
| F-096 | 🟠 | perf | useAutoSave: JSON.stringify bei jedem Render | src/hooks/useAutoSave.ts | 30m | open |
| F-097 | 🟠 | perf | useMatchCockpitPro: effectiveSettings ohne useMemo | src/hooks/useMatchCockpitPro.ts | 30m | open |
| F-098 | 🟠 | perf | useCorporateColors: effectiveSettings ohne useMemo | src/hooks/useCorporateColors.ts | 30m | open |
| F-099 | 🟠 | perf | useDialogTimer: Interval-Cleanup nicht robust | src/hooks/useDialogTimer.ts | 20m | open |
| F-100 | 🟡 | perf | useFocusTrap: inertElements Cleanup ohne Existenz-Check | src/hooks/useFocusTrap.ts | 15m | open |
| F-101 | 🟠 | perf | useMatchSound: Audio-Element nicht bei Sound-Wechsel aktualisiert | src/hooks/useMatchSound.ts | 30m | open |
| F-102 | 🟡 | other | Deprecated useMatchTimer wird noch exportiert | src/hooks/index.ts | 1h | open |
| F-103 | ⚫ | a11y | ActionMenu Touch Target unter WCAG Minimum (36x36px) | src/components/ui/ActionMenu.tsx | 30m | open |
| F-104 | ⚫ | a11y | PasswordInput Toggle nicht keyboard-navigierbar | src/components/ui/PasswordInput.tsx | 15m | open |
| F-105 | ⚫ | a11y | ColorPicker Presets ohne Focus States | src/components/ui/ColorPicker.tsx | 30m | open |
| F-106 | ⚫ | a11y | Collapsible Panels ohne aria-pressed State | src/components/ui/CollapsibleInfoPanel.tsx | 20m | open |
| F-107 | 🔴 | architecture | Inkonsistente Styling-Patterns (Inline vs CSS Modules) | src/components/ui/ | 2d | open |
| F-108 | 🟠 | architecture | Hardcoded Design Values statt Tokens | src/components/ui/ActionMenu.tsx | 1h | open |
| F-109 | 🟠 | architecture | Form Component API inkonsistent (error/errorMessage) | src/components/ui/Select.tsx | 2h | open |
| F-110 | 🟠 | architecture | Animation System inkonsistent (3 Patterns) | src/components/ui/BottomSheet.tsx | 1.5h | open |
| F-111 | 🟠 | a11y | BottomNavigation ohne Keyboard-Navigation | src/components/ui/BottomNavigation.tsx | 45m | open |
| F-112 | 🟠 | a11y | Toast role="alert" für alle Typen | src/components/ui/Toast.tsx | 30m | open |
| F-113 | 🔴 | a11y | Icons ohne zugängliche Alternative | src/components/ui/ | - | open |
| F-114 | 🟠 | a11y | ConfirmDialog hardcoded aria-labelledby ID | src/components/ui/ConfirmDialog.tsx | 20m | open |
| F-115 | 🔴 | security | Client-Side Authorization Only | src/features/auth/components/AuthGuard.tsx | 4h | open |
| F-116 | 🔴 | security | Supabase Service Role Key Exposure Risk | supabase/functions/merge-accounts/index.ts | 1h | open |
| F-117 | 🔴 | security | Invite Token im URL-Parameter | src/features/auth/components/AuthConfirmPage.tsx | 2h | open |
| F-118 | 🔴 | security | Keine Rate-Limiting auf Auth-Endpunkten | supabase/functions | 3h | open |
| F-119 | 🟡 | security | Fehlende Content Security Policy (CSP) | vercel.json | 2h | open |
| F-120 | 🔴 | security | Email Enumeration durch Fehlermeldungen | src/features/auth/components/LoginScreen.tsx | 1h | open |
| F-121 | 🔴 | security | Guest Tournament Limits Client-Side | src/features/auth/hooks/useTournamentLimit.ts | 3h | open |
| F-122 | 🟠 | security | Console Logs in Production | src/features/auth/components/AuthCallback.tsx | 2h | open |
| F-123 | 🟠 | security | Merge Function SQL Injection Risiko | supabase/functions/merge-accounts/index.ts | 2h | open |
| F-124 | 🟠 | security | Session Timeout nicht implementiert | supabase | 2h | open |
| F-125 | 🟠 | security | Kein Audit-Logging implementiert | supabase | 6h | open |
| F-126 | 🟠 | security | Service Worker Security | public/sw.js | 3h | open |
| F-127 | 🔴 | security | Client-Side Authorization Only | src/features/auth/components/AuthGuard.tsx | 4h | open |
| F-128 | 🔴 | security | Supabase Service Role Key Exposure Risk | supabase/functions/merge-accounts/index.ts | 1h | open |
| F-129 | 🔴 | security | Invite Token im URL-Parameter | src/features/auth/components/AuthConfirmPage.tsx | 2h | open |
| F-130 | 🔴 | security | Keine Rate-Limiting auf Auth-Endpunkten | supabase/functions | 3h | open |
| F-131 | 🟡 | security | Fehlende Content Security Policy (CSP) | vercel.json | 2h | open |
| F-132 | 🔴 | security | Email Enumeration durch Fehlermeldungen | src/features/auth/components/LoginScreen.tsx | 1h | open |
| F-133 | 🔴 | security | Guest Tournament Limits Client-Side | src/features/auth/hooks/useTournamentLimit.ts | 3h | open |
| F-134 | 🟠 | security | Console Logs in Production | src/features/auth/components/AuthCallback.tsx | 2h | open |
| F-135 | 🟠 | security | Merge Function SQL Injection Risiko | supabase/functions/merge-accounts/index.ts | 2h | open |
| F-136 | 🟠 | security | Session Timeout nicht implementiert | supabase | 2h | open |
| F-137 | 🟠 | security | Kein Audit-Logging implementiert | supabase | 6h | open |
| F-138 | 🟠 | security | Service Worker Security | public/sw.js | 3h | open |
| F-139 | 🔴 | data | Date/ISO-Inkonsistenz in Schemas | src/core/models/TournamentSchema.ts | 2h | open |
| F-140 | 🟠 | data | Redundante Sport-Felder in TournamentSchema | src/core/models/TournamentSchema.ts | 1h | open |
| F-141 | 🟠 | data | Fehlende Referenzintegrität für Team/Group IDs | src/core/models/MatchSchema.ts | 3h | open |
| F-142 | 🟠 | data | Timer-State-Inkonsistenz ohne Validierung | src/core/models/LiveMatch.ts | 2h | open |
| F-143 | 🟠 | data | Score-Validierung fehlt komplett | src/core/models/MatchSchema.ts | 2h | open |
| F-144 | 🟠 | security | .passthrough() erlaubt unbekannte Felder | src/core/schemas/CommonSchemas.ts | 1h | open |
| F-145 | 🟠 | data | Event-Typ-Validierung unvollständig | src/core/models/RuntimeMatchEventSchema.ts | 3h | open |
| F-146 | 🟠 | architecture | Status-Transition-Validierung fehlt | src/core/models/MatchSchema.ts | - | open |
| F-147 | 🟡 | architecture | Sport-Erweiterung erfordert Core-Änderungen | src/config/sports/football.ts | 4h | open |
| F-148 | 🟡 | architecture | AgeClasses nicht sport-neutral | src/config/sports/football.ts | 2h | open |
| F-149 | 🟡 | architecture | FinalsPreset-Enum nicht erweiterbar | src/types/FinalsPreset.ts | 2h | open |
| F-150 | 🟡 | architecture | Playoff-Bracket-Generierung nicht im Code sichtbar | src/core/generators/ | 8h | open |
| F-151 | 🔴 | data | reset_schedule löscht correctionHistory | src/admin/DangerZone/index.tsx | 1h | open |
| F-152 | 🟠 | data | regenerate_schedule ignoriert finished-Matches | src/admin/DangerZone/index.tsx | 30m | open |
| F-153 | 🟡 | architecture | Tiebreaker-Implementierung nicht im Code sichtbar | src/core/models/LiveMatch.ts | 4h | open |
| F-154 | 🟠 | data | Punktgleichheit nicht spezifiziert | src/exports/Exports/index.tsx | 2h | open |
| F-155 | 🟠 | ux | DangerZone zu mächtig ohne Bestätigung | src/admin/DangerZone/index.tsx | 1h | open |
| F-156 | 🟠 | ux | Keine Undo-Funktion für Ergebnis-Korrekturen | src/admin/ActivityLog/index.tsx | 3h | open |
| F-157 | 🟠 | ux | Team-Management während Turnier nicht möglich | src/helpers/TeamHelpers/index.tsx | 4h | open |
| F-158 | 🟠 | ux | Keine Playoff-Vorschau im Admin-Cockpit | src/admin/Cockpit/index.tsx | 2h | open |
| F-159 | 🟡 | ux | Auto-Share-Code ohne manuelle Kontrolle | src/admin/Visibility/index.tsx | 1h | open |
| F-160 | 🟠 | ux | Feld-Zuweisung zu Matches fehlt | src/admin/Settings/index.tsx | 2h | open |
