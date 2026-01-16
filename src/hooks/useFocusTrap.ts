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

import { useEffect, useRef } from 'react';

interface UseFocusTrapOptions {
  /** Whether the trap is active */
  isActive: boolean;
  /** Element to return focus to on close */
  returnFocusTo?: HTMLElement | null;
  /** Auto-focus first focusable element */
  autoFocus?: boolean;
  /** Callback when escape is pressed */
  onEscape?: () => void;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions
) {
  const { isActive, returnFocusTo, autoFocus = true, onEscape } = options;
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

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

    // Auto-focus first focusable element
    if (autoFocus) {
      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
    }

    // Set background as inert
    const siblings = document.body.children;
    const inertElements: Element[] = [];

    for (const element of siblings) {
      if (element !== container && !container.contains(element)) {
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
  }, [isActive, autoFocus, onEscape, returnFocusTo]);

  return { containerRef };
}
