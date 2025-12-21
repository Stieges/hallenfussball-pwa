/**
 * Toast Component Exports
 *
 * Usage:
 * 1. Wrap your app with ToastProvider
 * 2. Use useToast() hook to show notifications
 *
 * @example
 * // In App.tsx
 * import { ToastProvider } from './components/ui/Toast';
 * <ToastProvider><App /></ToastProvider>
 *
 * // In any component
 * import { useToast } from './components/ui/Toast';
 * const { showSuccess, showError } = useToast();
 * showSuccess('Gespeichert!');
 */

export { Toast } from './Toast';
export type { ToastType, ToastProps } from './Toast';

export { ToastContainer } from './ToastContainer';

export { ToastProvider, useToast } from './ToastContext';
export type { ToastOptions } from './ToastContext';
