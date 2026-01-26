import { useRef, useEffect } from 'react'

/**
 * usePrevious - Returns the previous value of a variable
 *
 * @param value - The current value to track
 * @returns The previous value (undefined on first render)
 *
 * @example
 * const [count, setCount] = useState(0)
 * const prevCount = usePrevious(count)
 *
 * // prevCount will be the value of count from the previous render
 * console.log(`Count changed from ${prevCount} to ${count}`)
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}

/**
 * usePreviousDistinct - Returns the previous distinct value
 * Only updates when the value actually changes (using shallow comparison)
 *
 * @param value - The current value to track
 * @returns The previous distinct value
 *
 * @example
 * const [data, setData] = useState({ id: 1 })
 * const prevData = usePreviousDistinct(data)
 *
 * // prevData only updates when data reference changes
 */
export function usePreviousDistinct<T>(value: T): T | undefined {
  const prevRef = useRef<T | undefined>(undefined)
  const curRef = useRef<T>(value)

  if (curRef.current !== value) {
    prevRef.current = curRef.current
    curRef.current = value
  }

  return prevRef.current
}
