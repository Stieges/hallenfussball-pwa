# US-MICRO-INTERACTIONS: Systematisches Feedback & Interaktions-Design

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-MICRO-INTERACTIONS |
| **Priorität** | High |
| **Status** | Done ✅ |
| **Erstellt** | 2025-12-25 |
| **Abgeschlossen** | 2025-12-25 |
| **Kategorie** | UX / Design System |
| **Impact** | Hoch - Nutzererlebnis & Professionalität |
| **Aufwand** | 8-12 Stunden |

---

## User Story

**Als** Nutzer der App
**möchte ich** bei jeder Interaktion sofortiges, klares Feedback erhalten
**damit** ich weiß, dass meine Aktion erkannt wurde und was als Nächstes passiert

---

## Kontext

### Was sind Micro-Interactions?

Micro-Interactions sind kleine, gezielte Animationen und Feedback-Mechanismen, die:

1. **Bestätigen:** "Ja, dein Klick wurde registriert"
2. **Informieren:** "Das lädt gerade..."
3. **Führen:** "Schau hier hin"
4. **Belohnen:** "Gut gemacht!" (z.B. bei Tor-Erfassung)
5. **Warnen:** "Achtung, das ist endgültig"

### Warum sind sie wichtig? (Forschung 2024)

| Studie | Ergebnis |
|--------|----------|
| Nielsen Norman Group | 100ms Reaktionszeit = "sofort", >1s = Nutzer verliert Fokus |
| Google UX Research | Micro-Interactions erhöhen "perceived quality" um 28% |
| Baymard Institute | 68% Kaufabbrüche durch fehlende Feedback-Mechanismen |
| Material Design 3 | "Motion brings meaning" - Animation als Kommunikationsmittel |

### Aktueller Zustand

| Bereich | Status | Problem |
|---------|--------|---------|
| **Button-Feedback** | ⚠️ Basis | Nur Hover + disabled opacity |
| **Loading States** | ⚠️ Spinner | Keine Skeleton Screens |
| **Form Validation** | ✅ OK | Inline-Errors vorhanden |
| **Toast Notifications** | ✅ Gut | 4 Typen, animiert |
| **Tor-Animation** | ✅ Gut | Vorhanden (Goal Animation) |
| **Page Transitions** | ❌ Fehlt | Harter Cut zwischen Seiten |
| **List-Animationen** | ❌ Fehlt | Elemente erscheinen statisch |
| **Erfolgs-Feedback** | ⚠️ Minimal | Nur Toast, kein konfetti/pulse |

### Sport-App Kontext

In einer Sport-/Turnier-App sind Micro-Interactions besonders wichtig:

- **Tor-Erfassung:** Muss sich "gut anfühlen", emotional
- **Timer-Start:** Klare Bestätigung, dass Uhr läuft
- **Ergebnis-Speicherung:** Bestätigung, dass Daten sicher sind
- **Live-Updates:** Neue Daten müssen auffallen
- **Fehler:** Schnelle, klare Rückmeldung bei Problemen

---

## Acceptance Criteria

### Basis-Funktionalität

1. **AC1 - Button Press Feedback:** Given ich drücke einen Button, When ich loslasse, Then sehe/fühle ich eine visuelle/haptische Reaktion (scale, ripple, oder color shift) innerhalb von 100ms.

2. **AC2 - Loading Skeleton:** Given eine Liste lädt Daten, When ich warte, Then sehe ich Skeleton-Placeholders statt eines Spinners.

3. **AC3 - Form Validation:** Given ich gebe ungültige Daten ein, When ich das Feld verlasse oder abschicke, Then erscheint Feedback mit einer Shake-Animation.

4. **AC4 - Success States:** Given eine Aktion war erfolgreich, When sie abgeschlossen ist, Then sehe ich eine Checkmark-Animation oder ähnliches Erfolgs-Feedback.

5. **AC5 - Hover States:** Given ich hovere über ein interaktives Element (Desktop), Then verändert es sich innerhalb von 150ms (Background, Shadow, oder Transform).

### Erweiterte Funktionalität

6. **AC6 - Tor-Celebration:** Given ich erfasse ein Tor, Then sehe ich eine verstärkte Animation (bestehendes Goal Animation verbessern).

7. **AC7 - Pull-to-Refresh:** Given ich bin auf einer Liste auf Mobile, When ich nach unten ziehe, Then sehe ich eine Refresh-Animation.

8. **AC8 - Empty States:** Given eine Liste hat keine Einträge, Then sehe ich einen animierten Empty-State mit Call-to-Action.

9. **AC9 - Error Recovery:** Given ein Fehler tritt auf, When ich die Aktion wiederhole, Then sehe ich den Loading- → Success/Error-Übergang animiert.

10. **AC10 - Reduced Motion:** Given ein Nutzer hat `prefers-reduced-motion: reduce`, Then werden alle Animationen auf Minimum reduziert (Fades statt Bewegung).

---

## UX-Hinweise

### Feedback-Timing

```
┌─────────────────────────────────────────────────────────────┐
│  TIMING-RICHTLINIEN                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚡ 0-100ms    "Instant"                                    │
│  ├─ Button press visual                                     │
│  ├─ Focus ring appearance                                   │
│  └─ Hover state change                                      │
│                                                             │
│  🔄 100-300ms  "Fast"                                       │
│  ├─ Toast appear/disappear                                  │
│  ├─ Modal open/close                                        │
│  └─ Collapsible expand/collapse                             │
│                                                             │
│  ⏳ 300-500ms  "Normal"                                     │
│  ├─ Page transitions                                        │
│  ├─ Complex animations                                      │
│  └─ List item stagger                                       │
│                                                             │
│  🐢 >500ms     "Slow" (use sparingly)                       │
│  ├─ Celebration animations                                  │
│  └─ Onboarding sequences                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Animation Principles (Material Design 3)

1. **Schnell rein, langsam raus:** Enter schneller als Exit
2. **Natürliche Bewegung:** Easing statt Linear
3. **Bedeutung vor Dekoration:** Animation muss Zweck haben
4. **Konsistenz:** Gleiche Aktion = gleiche Animation
5. **Fokus:** Animation lenkt Aufmerksamkeit

### Feedback-Matrix

| Aktion | Feedback | Typ | Dauer |
|--------|----------|-----|-------|
| Button klicken | Scale down + color | Visual | 100ms |
| Button erfolgreich | Checkmark pulse | Visual | 300ms |
| Formular abschicken | Button → Loading → Success | Visual | Variable |
| Tor erfassen | Goal Animation + Haptic | Multi | 500ms |
| Timer starten | Pulse + Toast | Visual | 300ms |
| Fehler auftreten | Shake + Toast | Visual + Audio? | 300ms |
| Liste laden | Skeleton → Fade-in | Visual | 200ms |
| Element löschen | Slide-out + Collapse | Visual | 200ms |
| Drag & Drop | Shadow + Lift | Visual | 150ms |
| Toggle switch | Slide + Color | Visual | 200ms |

---

## Technische Hinweise

### 1. Motion Tokens

```typescript
// src/design-tokens/motion.ts

// Durations
export const durations = {
  instant: '0ms',
  faster: '100ms',
  fast: '150ms',
  normal: '250ms',
  slow: '350ms',
  slower: '500ms',
} as const;

// Easings (Material Design 3)
export const easings = {
  // Standard - für die meisten Bewegungen
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  standardDecelerate: 'cubic-bezier(0, 0, 0, 1)',  // Rein-Animation
  standardAccelerate: 'cubic-bezier(0.3, 0, 1, 1)', // Raus-Animation

  // Emphasized - für wichtige Übergänge
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  emphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',

  // Legacy (falls benötigt)
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',

  // Bounce (für Celebrations)
  bounce: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
} as const;

// Composite Transitions
export const transitions = {
  buttonPress: `transform ${durations.faster} ${easings.standard}`,
  fadeIn: `opacity ${durations.fast} ${easings.standardDecelerate}`,
  fadeOut: `opacity ${durations.fast} ${easings.standardAccelerate}`,
  slideIn: `transform ${durations.normal} ${easings.emphasizedDecelerate}`,
  slideOut: `transform ${durations.fast} ${easings.emphasizedAccelerate}`,
  expand: `height ${durations.normal} ${easings.standard}, opacity ${durations.normal} ${easings.standard}`,
  color: `background-color ${durations.fast} ${easings.standard}, border-color ${durations.fast} ${easings.standard}`,
  shadow: `box-shadow ${durations.fast} ${easings.standard}`,
} as const;
```

### 2. CSS Keyframe Animationen

```css
/* src/styles/animations.css */

/* Button Press */
@keyframes buttonPress {
  0% { transform: scale(1); }
  50% { transform: scale(0.97); }
  100% { transform: scale(1); }
}

/* Success Checkmark */
@keyframes checkmark {
  0% {
    stroke-dashoffset: 50;
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
}

/* Shake (Error) */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}

/* Pulse (Attention) */
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

/* Skeleton Loading */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Fade In Up (List Items) */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Slide Out Right (Delete) */
@keyframes slideOutRight {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}

/* Confetti Particle (Goal Celebration) */
@keyframes confettiDrop {
  0% {
    transform: translateY(-100vh) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}

/* Reduced Motion Fallbacks */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 3. Button mit Press-Feedback

```typescript
// src/components/ui/Button.tsx (erweitert)

import React, { useState } from 'react';
import { transitions } from '../../design-tokens';

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  loading,
  success,
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);

  const buttonStyle: React.CSSProperties = {
    transform: isPressed ? 'scale(0.97)' : 'scale(1)',
    transition: transitions.buttonPress,
    // ... andere Styles
  };

  return (
    <button
      style={buttonStyle}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <LoadingSpinner size="small" />
      ) : success ? (
        <SuccessCheckmark />
      ) : (
        children
      )}
    </button>
  );
};
```

### 4. Skeleton Komponente

```typescript
// src/components/ui/Skeleton.tsx

import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  variant = 'text',
  animation = 'wave',
}) => {
  return (
    <div
      className={`${styles.skeleton} ${styles[variant]} ${styles[animation]}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
};

// Skeleton für Match-Card
export const MatchCardSkeleton: React.FC = () => (
  <div className={styles.matchCard}>
    <div className={styles.header}>
      <Skeleton width="60%" height="1.5rem" />
      <Skeleton width="80px" height="1rem" />
    </div>
    <div className={styles.teams}>
      <Skeleton width="40%" height="1.25rem" />
      <Skeleton width="60px" height="2rem" variant="rectangular" />
      <Skeleton width="40%" height="1.25rem" />
    </div>
  </div>
);
```

```css
/* src/components/ui/Skeleton.module.css */

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface) 0%,
    var(--color-surface-hover) 50%,
    var(--color-surface) 100%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
}

.text {
  border-radius: var(--radius-sm);
}

.circular {
  border-radius: 50%;
}

.rectangular {
  border-radius: var(--radius-md);
}

.wave {
  animation: shimmer 1.5s infinite;
}

.pulse {
  animation: pulse 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (prefers-reduced-motion: reduce) {
  .wave, .pulse {
    animation: none;
    background: var(--color-surface);
  }
}
```

### 5. Success Checkmark SVG Animation

```typescript
// src/components/ui/SuccessCheckmark.tsx

import React from 'react';
import styles from './SuccessCheckmark.module.css';

export const SuccessCheckmark: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg
    className={styles.checkmark}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      className={styles.circle}
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      className={styles.check}
      d="M7 12.5L10 15.5L17 8.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
```

```css
/* src/components/ui/SuccessCheckmark.module.css */

.checkmark {
  color: var(--color-success);
}

.circle {
  stroke-dasharray: 63;
  stroke-dashoffset: 63;
  animation: circleIn 0.3s ease-out forwards;
}

.check {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
  animation: checkIn 0.2s ease-out 0.2s forwards;
}

@keyframes circleIn {
  to { stroke-dashoffset: 0; }
}

@keyframes checkIn {
  to { stroke-dashoffset: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .circle, .check {
    animation: none;
    stroke-dashoffset: 0;
  }
}
```

### 6. Shake Animation für Errors

```typescript
// src/hooks/useShake.ts

import { useState, useCallback } from 'react';

export function useShake() {
  const [isShaking, setIsShaking] = useState(false);

  const shake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 300);
  }, []);

  const shakeStyles: React.CSSProperties = isShaking
    ? { animation: 'shake 0.3s ease-in-out' }
    : {};

  return { shake, shakeStyles, isShaking };
}

// Verwendung:
// const { shake, shakeStyles } = useShake();
// <div style={shakeStyles}>...</div>
// onError: shake()
```

### 7. List Animation Hook

```typescript
// src/hooks/useListAnimation.ts

import { useMemo } from 'react';

export function useListAnimation<T>(items: T[], baseDelay: number = 50) {
  return useMemo(() => {
    return items.map((item, index) => ({
      item,
      style: {
        animation: `fadeInUp 0.3s ease-out ${index * baseDelay}ms both`,
      } as React.CSSProperties,
    }));
  }, [items, baseDelay]);
}

// Verwendung:
// const animatedItems = useListAnimation(matches);
// {animatedItems.map(({ item, style }) => (
//   <MatchCard key={item.id} match={item} style={style} />
// ))}
```

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/design-tokens/motion.ts` | Neue Token-Definitionen |
| `src/styles/animations.css` | Keyframe-Animationen |
| `src/components/ui/Button.tsx` | Press-Feedback hinzufügen |
| `src/components/ui/Skeleton.tsx` | Neue Komponente |
| `src/components/ui/SuccessCheckmark.tsx` | Neue Komponente |
| `src/hooks/useShake.ts` | Neuer Hook |
| `src/hooks/useListAnimation.ts` | Neuer Hook |
| `src/components/schedule/*.tsx` | Skeleton-States |
| `src/components/dialogs/*.tsx` | Transition verbessern |

---

## Implementierungs-Reihenfolge

### Phase 1: Basis (4h)
1. Motion Tokens definieren
2. Keyframe-Animationen erstellen
3. Button Press-Feedback
4. `prefers-reduced-motion` Support

### Phase 2: Loading (3h)
1. Skeleton-Komponente
2. Match-Card Skeleton
3. Liste mit Skeletons
4. Loading-States verbessern

### Phase 3: Feedback (3h)
1. Success Checkmark Animation
2. Shake für Errors
3. Form-Validation-Feedback
4. Toast-Animationen überprüfen

### Phase 4: Listen & Details (2h)
1. List-Stagger-Animation
2. Delete-Animation
3. Empty-State-Animation
4. Pull-to-Refresh (optional)

---

## Definition of Done

- [ ] Motion Tokens in design-tokens/
- [ ] Mindestens 5 Keyframe-Animationen
- [ ] Button Press-Feedback implementiert
- [ ] Skeleton-Komponente + 2 Varianten
- [ ] Success-Checkmark-Animation
- [ ] Shake-Animation für Fehler
- [ ] `prefers-reduced-motion` vollständig unterstützt
- [ ] Keine Jank/Ruckler bei Animationen (60fps)
- [ ] Visueller Review

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Performance-Probleme | Mittel | Hoch | will-change, transform-only |
| Zu viel Animation | Mittel | Mittel | Fokus auf Purpose |
| Inkonsistenz | Niedrig | Mittel | Zentrale Token |

---

## Referenzen

| Typ | Referenz |
|-----|----------|
| **Abhängig von** | US-DESIGN-TOKENS |
| **Verwandt** | US-A11Y-CONTRAST (reduced-motion) |
| **Standards** | [Material Design 3 Motion](https://m3.material.io/styles/motion/overview) |

---

## Quellen

- [Material Design 3 Motion](https://m3.material.io/styles/motion/overview)
- [UX Design Trends 2024: Micro-Interactions](https://medium.com/@xperienzRD/a-glimpse-into-the-future-heres-the-ux-design-trends-we-expect-to-dominate-2024-5e7e58c56512)
- [Web Animation Performance](https://web.dev/animations/)
- [prefers-reduced-motion MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [Skeleton Loading UX](https://uxdesign.cc/what-you-should-know-about-skeleton-screens-a820c45a571a)
