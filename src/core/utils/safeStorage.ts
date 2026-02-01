/**
 * SafeStorage Utility
 *
 * Wraps localStorage/sessionStorage to prevent crashes in Incognito mode
 * or environments where storage is blocked (SecurityError).
 *
 * Falls back to in-memory storage if persistent storage is unavailable.
 */

class MemoryStorage implements Storage {
    private data: Record<string, string> = {};

    get length(): number {
        return Object.keys(this.data).length;
    }

    clear(): void {
        this.data = {};
    }

    getItem(key: string): string | null {
        return this.data[key] ?? null;
    }

    key(index: number): string | null {
        const keys = Object.keys(this.data);
        return keys[index] || null;
    }

    removeItem(key: string): void {
        // Use object spread to avoid eslint no-dynamic-delete
        const { [key]: _, ...rest } = this.data;
        void _; // Suppress unused variable warning
        this.data = rest;
    }

    setItem(key: string, value: string): void {
        this.data[key] = String(value);
    }
}

class SafeStorage implements Storage {
    private storage: Storage;
    private isAvailable: boolean = false;
    private memoryFallback: MemoryStorage;

    constructor(type: 'localStorage' | 'sessionStorage') {
        this.memoryFallback = new MemoryStorage();

        try {
            // Check if window is defined (SSR safety)
            if (typeof window === 'undefined') {
                this.storage = this.memoryFallback;
                return;
            }

            this.storage = window[type];

            // Test write access (crucial for detecting blocked storage)
            const x = '__storage_test__';
            this.storage.setItem(x, x);
            this.storage.removeItem(x);
            this.isAvailable = true;
        } catch (e) {
            // Storage is blocked or unavailable
            console.warn(`[SafeStorage] ${type} is unavailable, using memory fallback.`, e);
            this.storage = this.memoryFallback;
        }
    }

    get length(): number {
        return this.storage.length;
    }

    clear(): void {
        try {
            this.storage.clear();
        } catch {
            this.memoryFallback.clear();
        }
    }

    getItem(key: string): string | null {
        try {
            return this.storage.getItem(key);
        } catch {
            return this.memoryFallback.getItem(key);
        }
    }

    key(index: number): string | null {
        try {
            return this.storage.key(index);
        } catch {
            return this.memoryFallback.key(index);
        }
    }

    removeItem(key: string): void {
        try {
            this.storage.removeItem(key);
        } catch {
            this.memoryFallback.removeItem(key);
        }
    }

    setItem(key: string, value: string): void {
        try {
            this.storage.setItem(key, value);
        } catch (e) {
            console.warn('[SafeStorage] setItem failed, using fallback', e);
            // If writing fails mid-session (e.g. quota exceeded), try fallback
            this.memoryFallback.setItem(key, value);
        }
    }

    getIsAvailable(): boolean {
        return this.isAvailable;
    }
}

export const safeLocalStorage = new SafeStorage('localStorage');
export const safeSessionStorage = new SafeStorage('sessionStorage');
