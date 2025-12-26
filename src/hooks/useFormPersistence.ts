import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY_PREFIX = 'formDraft_';
const DEBOUNCE_MS = 1000;

interface UseFormPersistenceOptions<T> {
  key: string;
  defaultValue: T;
  enabled?: boolean;
}

interface UseFormPersistenceReturn<T> {
  data: T;
  setData: (value: T | ((prev: T) => T)) => void;
  hasDraft: boolean;
  clearDraft: () => void;
  lastSavedAt: Date | null;
}

/**
 * Hook for persisting form data to localStorage with debouncing
 */
export function useFormPersistence<T>({
  key,
  defaultValue,
  enabled = true,
}: UseFormPersistenceOptions<T>): UseFormPersistenceReturn<T> {
  const storageKey = `${STORAGE_KEY_PREFIX}${key}`;
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);

  // Load initial data from localStorage
  const loadStoredData = useCallback((): { data: T; timestamp: number } | null => {
    if (!enabled) {return null;}

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && 'data' in parsed) {
          // Type assertion: validated structure matches expected format
          return parsed as { data: T; timestamp: number };
        }
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }, [storageKey, enabled]);

  const storedData = loadStoredData();
  const [data, setDataState] = useState<T>(storedData?.data ?? defaultValue);
  const [hasDraft, setHasDraft] = useState(storedData !== null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    storedData?.timestamp ? new Date(storedData.timestamp) : null
  );

  // Save data to localStorage with debouncing
  const saveToStorage = useCallback(
    (newData: T) => {
      if (!enabled) {return;}

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        try {
          const payload = {
            data: newData,
            timestamp: Date.now(),
          };
          localStorage.setItem(storageKey, JSON.stringify(payload));
          setLastSavedAt(new Date(payload.timestamp));
          setHasDraft(true);
        } catch {
          // Ignore storage errors (quota exceeded, etc.)
        }
      }, DEBOUNCE_MS);
    },
    [storageKey, enabled]
  );

  // Wrapper for setData that also triggers save
  const setData = useCallback(
    (value: T | ((prev: T) => T)) => {
      setDataState((prev) => {
        const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        // Don't save on initial load
        if (!initialLoadRef.current) {
          saveToStorage(newValue);
        }
        return newValue;
      });
    },
    [saveToStorage]
  );

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setLastSavedAt(null);
    } catch {
      // Ignore removal errors
    }
  }, [storageKey]);

  // Mark initial load as complete after first render
  useEffect(() => {
    initialLoadRef.current = false;
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    data,
    setData,
    hasDraft,
    clearDraft,
    lastSavedAt,
  };
}

/**
 * Check if a draft exists for a given key without loading it
 */
export function hasDraftForKey(key: string): boolean {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    return stored !== null;
  } catch {
    return false;
  }
}

/**
 * Get draft metadata without loading the full data
 */
interface StoredDraftData {
  timestamp?: string;
}

export function getDraftMetadata(key: string): { exists: boolean; timestamp: Date | null } {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    if (stored) {
      const parsed = JSON.parse(stored) as StoredDraftData | null;
      if (parsed?.timestamp) {
        return { exists: true, timestamp: new Date(parsed.timestamp) };
      }
    }
  } catch {
    // Ignore parse errors
  }
  return { exists: false, timestamp: null };
}
