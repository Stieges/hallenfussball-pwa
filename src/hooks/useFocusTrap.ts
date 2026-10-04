/**
 * useFocusTrap Hook - WCAG 4.1.3 Compliant Focus Management
 *
 * Implements focus trap for modal dialogs with:
 * - Focus containment (Tab cycling within modal)
 * - Focus restoration (returns to trigger on close)
 * - Background inert (screen readers ignore background)
 * - Escape key handling
 *
 * @see docs/roadmap/P0-IMPLEMENTATION-PLAN.md#p0-2-wcag-413-focus-management
 */

import { useEffect, useRef, type RefObject } from 'react';

interface UseFocusTrapOptions {
  /** Whether the trap is active */
  isActive: boolean;
  /** Element to return focus to on close */
  returnFocusTo?: HTMLElement | null;
  /** Auto-focus first focusable element (or initialFocusRef, falls gesetzt) */
  autoFocus?: boolean;
  /**
   * Explizites Start-Ziel für den Fokus (@OB-014: bei gefährlichen Rückfragen
   * zuerst auf „Abbrechen", nicht auf das erste beliebige Element).
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * @OB-014: Die Eingabetaste soll nichts auslösen — weder den Bestätigen- noch
   * den Abbrechen-Knopf. Verhindert die Default-Aktivierung des fokussierten
   * Buttons (und das Absenden eines fokussierten Eingabefelds).
   */
  suppressEnter?: boolean;
  /** Callback when escape is pressed. Ohne diesen Callback legt der Dialog keinen
   * History-Eintrag an (die Zurück-Taste führt dann zur vorigen Seite). */
  onEscape?: () => void;
  /**
   * @OB-012: Die Zurück-Taste des Handys schließt den Dialog wie „Abbrechen“.
   * Der Dialog hält dafür einen eigenen History-Eintrag; beim Schließen auf
   * anderem Weg (Esc, Schließen-Knopf) wird der Eintrag wieder entfernt, damit
   * die nächste Zurück-Taste zur vorigen Seite führt (kein Geister-Dialog).
   * Standard: an. Für seitenweite Fokusfallen (Login/Registrierung) abschalten.
   */
  closeOnBack?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const openDialogs: string[] = [];
let dialogIdCounter = 0;
let consumedPopState: PopStateEvent | null = null;

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions
) {
  const {
    isActive,
    returnFocusTo,
    autoFocus = true,
    initialFocusRef,
    suppressEnter,
    onEscape,
    closeOnBack = true,
  } = options;
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  // @OB-012: Zurück-Taste schließt den Dialog (eigener History-Eintrag)
  useEffect(() => {
    if (!isActive || !closeOnBack || !onEscapeRef.current) {
      return;
    }

    dialogIdCounter += 1;
    const dialogId = `focus-trap-${dialogIdCounter}`;
    openDialogs.push(dialogId);
    window.history.pushState({ dialogId }, '');

    let isClosing = false;

    function detach() {
      window.removeEventListener('popstate', handlePopState);
      const index = openDialogs.indexOf(dialogId);
      if (index !== -1) {
        openDialogs.splice(index, 1);
      }
    }

    function handlePopState(event: PopStateEvent) {
      if (consumedPopState === event) {
        return;
      }
      if (openDialogs[openDialogs.length - 1] !== dialogId) {
        return;
      }
      consumedPopState = event;
      if (isClosing) {
        // Eigener Eintrag aus dem Cleanup: nur aufräumen, nicht zusätzlich schließen.
        detach();
        return;
      }
      // Die Zurück-Taste hat den Eintrag verbraucht – der Dialog schließt wie „Abbrechen“.
      detach();
      onEscapeRef.current?.();
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      const state = window.history.state as { dialogId?: string } | null;
      if (state?.dialogId === dialogId) {
        // Auf anderem Weg geschlossen: eigenen Eintrag entfernen.
        isClosing = true;
        window.history.back();
        return;
      }
      detach();
    };
  }, [isActive, closeOnBack]);

  // Store the element that had focus before trap activated
  useEffect(() => {
    if (isActive) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }
  }, [isActive]);

  // Handle focus trap
  useEffect(() => {
    if (!isActive || !containerRef.current) {
      return;
    }

    const container = containerRef.current;

    // Auto-focus the configured target (fallback: first focusable element)
    if (autoFocus) {
      const initialFocusable = initialFocusRef?.current ?? container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      initialFocusable?.focus();
    }

    // Set background as inert
    const siblings = document.body.children;
    const inertElements: Element[] = [];

    for (const element of siblings) {
      // Mark as inert if element is NOT the container AND doesn't contain the container
      // (i.e., is not an ancestor of the container like an overlay wrapper)
      if (element !== container && !element.contains(container)) {
        element.setAttribute('inert', '');
        inertElements.push(element);
      }
    }

    // Handle tab key for focus cycling
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      if (e.key === 'Enter' && suppressEnter) {
        e.preventDefault();
        return;
      }

      if (e.key !== 'Tab') {
        return;
      }

      const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

      // Only handle tab cycling if there are focusable elements
      if (focusableElements.length === 0) {
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Remove inert from siblings
      for (const element of inertElements) {
        element.removeAttribute('inert');
      }

      // Restore focus
      const returnTarget = returnFocusTo ?? previousActiveElement.current;
      returnTarget?.focus();
    };
  }, [isActive, autoFocus, initialFocusRef, suppressEnter, onEscape, returnFocusTo]);

  return { containerRef };
}
