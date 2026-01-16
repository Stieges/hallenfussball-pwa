import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

// Font: Inter Variable (self-hosted via @fontsource for offline capability)
import '@fontsource-variable/inter';

import App from './App';
import './styles/global.css';
import { initInertPolyfill } from './utils/polyfills/inert';

/**
 * Global handler for unhandled promise rejections
 *
 * AbortError is expected in React StrictMode when Supabase auth initializes:
 * - StrictMode mounts/unmounts/remounts components
 * - First mount starts Supabase lock acquisition
 * - Unmount aborts the lock (AbortError)
 * - Second mount succeeds normally
 *
 * We suppress this specific error to keep the console clean.
 */
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason instanceof Error && event.reason.name === 'AbortError') {
    // Suppress AbortError - expected in StrictMode with Supabase
    event.preventDefault();
  }
});

/**
 * OAuth/Auth Redirect Fix for HashRouter
 *
 * Problem: Supabase auth redirects to /auth/callback with tokens in different formats:
 * - PKCE flow: /auth/callback?code=xxx (query params)
 * - Implicit flow: /auth/callback#access_token=xxx&type=recovery (hash fragment)
 *
 * But HashRouter only routes based on hash paths (/#/path).
 * So the AuthCallback component never mounts.
 *
 * Solution: Detect auth callback at /auth/callback and redirect to /#/auth/callback
 * Converting hash fragment tokens to query params (since URLs can only have ONE hash).
 * This runs BEFORE React/HashRouter initializes.
 */
(function handleAuthRedirect() {
  const { pathname, search, hash } = window.location;

  // Only intercept if we're at /auth/callback or /auth/confirm WITHOUT a hash route
  // Hash might contain tokens (implicit flow) like #access_token=xxx
  // Or be empty (PKCE flow uses query params)
  const authPaths = ['/auth/callback', '/auth/confirm'];
  if (authPaths.includes(pathname) && !hash.startsWith('#/')) {
    // Build new URL with HashRouter path
    let newUrl = `${window.location.origin}/#${pathname}`;

    // Collect all params - from both query string AND hash fragment
    // URLs can only have ONE hash, so we convert hash fragment tokens to query params
    const allParams: string[] = [];

    // Add existing query params (PKCE flow: ?code=xxx)
    if (search) {
      allParams.push(search.substring(1)); // Remove leading ?
    }

    // Convert hash fragment tokens to query params (implicit flow: #access_token=xxx)
    // Hash fragment format: #access_token=xxx&refresh_token=yyy&type=recovery
    if (hash && !hash.startsWith('#/')) {
      allParams.push(hash.substring(1)); // Remove leading #
    }

    // Append all params as query string
    if (allParams.length > 0) {
      newUrl += '?' + allParams.join('&');
    }

    window.location.replace(newUrl);
    return; // Stop execution, page will reload
  }
})();

// Initialize inert polyfill for Safari <15.5 compatibility
// Must run before React renders to ensure dialogs work correctly
initInertPolyfill().catch((error) => {
  console.error('Failed to initialize inert polyfill:', error);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
