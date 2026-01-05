# Monitore (Monitor-Konfigurator) - Code Review

**Datum:** 2026-01-05
**Reviewer:** Claude Opus 4.5
**Komponenten:**
- [MonitorsConfigTab.tsx](../../src/features/tournament-management/MonitorsConfigTab.tsx)
- [MonitorEditor.tsx](../../src/features/tournament-management/MonitorEditor.tsx)
- [MonitorTab.tsx](../../src/features/tournament-management/MonitorTab.tsx)
- [useMonitors.ts](../../src/hooks/useMonitors.ts)

---

## Zusammenfassung

Der Monitor-Konfigurator ist gut strukturiert mit einem klaren Hook-Pattern für CRUD-Operationen. Die kürzlich hinzugefügten Fixes (Timeout-Cleanup, Clipboard-API, Modal-Accessibility) haben die Qualität verbessert. Es gibt jedoch noch einige Verbesserungsmöglichkeiten.

---

## Findings

### Warnungen

#### 1. Inline Styles Performance (MonitorsConfigTab.tsx, MonitorEditor.tsx)
**Schweregrad:** Niedrig
**Beschreibung:** Alle Styles werden inline definiert, was bei jedem Render neue Objekte erstellt.
**Betroffener Code:**
```typescript
const containerStyle: CSSProperties = {
  padding: cssVars.spacing.lg,
  background: cssVars.colors.background,
  // ...
};
```
**Empfehlung:** Statische Styles außerhalb der Komponente definieren oder CSS-Module verwenden.

#### 2. Fehlende Loading-UI für asynchrone Operationen (MonitorEditor.tsx:530)
**Beschreibung:** Bei `isLoading` wird nur Opacity reduziert, kein visueller Loading-Indicator.
```typescript
style={{ ...contentStyle, opacity: isLoading ? 0.6 : 1 }}
```
**Empfehlung:** Spinner oder Skeleton hinzufügen.

#### 3. Delete-Confirmation UX (MonitorsConfigTab.tsx:118-135)
**Beschreibung:** Zwei Klicks auf "Löschen" erforderlich (erst setzen, dann bestätigen), aber der Button-Text ändert sich zu "Bestätigen", was verwirrend sein kann.
**Empfehlung:** Deutlichere visuelle Trennung oder Modal für Bestätigung.

#### 4. Keine Validierung bei Monitor-Name (MonitorsConfigTab.tsx:87-110)
**Beschreibung:** Nur leerer Name wird abgefangen, keine Maximallänge, keine Sonderzeichen-Prüfung.
**Empfehlung:** Validierungsregeln hinzufügen (max 50 Zeichen, etc.).

---

### Verbesserungsvorschläge

#### 5. Accessibility Verbesserungen

**5a. MonitorCard Buttons ohne aussagekräftige Labels**
```typescript
<button style={actionButtonStyle()} onClick={onCopyUrl}>
  {isCopied ? '✓ Kopiert!' : '🔗 URL kopieren'}
</button>
// Fehlt: aria-label für Screenreader
```

**5b. Fokus-Management beim Schließen des Editors**
Nach Schließen des MonitorEditors sollte Fokus zurück auf den auslösenden Button gehen.

#### 6. Drag-and-Drop für Slide-Reihenfolge fehlt
**Beschreibung:** Slides können nur mit ↑/↓ Buttons bewegt werden.
**Empfehlung:** @dnd-kit oder react-beautiful-dnd für bessere UX.

#### 7. Keine Undo-Funktionalität
**Beschreibung:** Gelöschte Slides/Monitore können nicht wiederhergestellt werden.
**Empfehlung:** Soft-Delete mit Undo-Toast oder Bestätigungs-Modal.

#### 8. SlideConfigEditor nicht memoized
**Beschreibung:** Die SlideConfigEditor-Komponente wird bei jedem Parent-Render neu erstellt.
**Empfehlung:** React.memo verwenden.

---

## Code-Qualität Metriken

| Kategorie | Bewertung | Notizen |
|-----------|-----------|---------|
| Lesbarkeit | Gut | Klare Struktur, gute Kommentare |
| Wartbarkeit | Gut | Modulare Komponenten |
| Performance | Verbesserungsbedürftig | Inline Styles, fehlende Memoization |
| Accessibility | Verbesserungsbedürftig | ARIA-Labels fehlen teils |
| Test-Coverage | Mangelhaft | Keine Unit-Tests vorhanden |
| Security | Gut | Keine Injection-Risiken |

---

## Positive Aspekte

1. **Gute Trennung von Concerns:** useMonitors Hook kapselt alle CRUD-Operationen
2. **Accessibility für Modal:** role="dialog", aria-modal, aria-labelledby, Escape-Handler
3. **Memory Leak Prevention:** Timeout-Cleanup für Copy-Feedback implementiert
4. **Responsive Design:** Flexbox/Grid mit Wrap für mobile Ansicht
5. **Error Handling:** Konsistente Fehleranzeige in UI

---

## Risiken

1. **Große Monitore-Liste:** Keine Pagination oder Virtualisierung. Bei 50+ Monitoren könnte die Performance leiden.

2. **Concurrent Edits:** Kein Optimistic Locking. Zwei User könnten gleichzeitig denselben Monitor bearbeiten.

3. **Datenverlust bei Browser-Crash:** Keine Auto-Save oder Draft-Funktionalität.

---

## Nächste Schritte

Siehe [MONITORE-IMPLEMENTATION-PLAN.md](./MONITORE-IMPLEMENTATION-PLAN.md) für den Umsetzungsplan.
