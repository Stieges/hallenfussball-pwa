import { useEffect, RefObject } from 'react'

/**
 * useClickOutside - Detects clicks outside of a referenced element
 *
 * @param ref - React ref to the element to monitor
 * @param handler - Callback function when click outside is detected
 * @param enabled - Optional flag to enable/disable the listener (default: true)
 *
 * @example
 * const dropdownRef = useRef<HTMLDivElement>(null)
 * const [isOpen, setIsOpen] = useState(false)
 *
 * useClickOutside(dropdownRef, () => {
 *   setIsOpen(false)
 * }, isOpen) // Only listen when dropdown is open
 *
 * return (
 *   <div ref={dropdownRef}>
 *     {isOpen && <DropdownContent />}
 *   </div>
 * )
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return

    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current

      // Do nothing if clicking ref's element or descendent elements
      if (!el || el.contains(event.target as Node)) {
        return
      }

      handler(event)
    }

    // Use mousedown and touchstart for better UX (detects before click completes)
    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)

    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler, enabled])
}

/**
 * useClickOutsideMultiple - Detects clicks outside of multiple elements
 *
 * @param refs - Array of React refs to monitor
 * @param handler - Callback function when click outside all elements is detected
 * @param enabled - Optional flag to enable/disable the listener (default: true)
 *
 * @example
 * const menuRef = useRef<HTMLDivElement>(null)
 * const buttonRef = useRef<HTMLButtonElement>(null)
 *
 * useClickOutsideMultiple([menuRef, buttonRef], () => {
 *   closeMenu()
 * })
 */
export function useClickOutsideMultiple<T extends HTMLElement>(
  refs: RefObject<T>[],
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return

    const listener = (event: MouseEvent | TouchEvent) => {
      // Check if click is inside any of the referenced elements
      const isInsideAny = refs.some((ref) => {
        const el = ref.current
        return el && el.contains(event.target as Node)
      })

      if (!isInsideAny) {
        handler(event)
      }
    }

    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)

    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [refs, handler, enabled])
}
