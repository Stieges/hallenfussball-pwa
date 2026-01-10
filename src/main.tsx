import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

// Font: Inter Variable (self-hosted via @fontsource for offline capability)
import '@fontsource-variable/inter';

import App from './App';
import './styles/global.css';

/**
 * OAuth Redirect Fix for HashRouter
 *
 * Problem: Supabase OAuth redirects to /auth/callback?code=xxx
 * But HashRouter only routes based on the hash (/#/path)
 * So the AuthCallback component never mounts.
 *
 * Solution: Detect OAuth callback at /auth/callback and redirect to /#/auth/callback
 * This runs BEFORE React/HashRouter initializes.
 */
(function handleOAuthRedirect() {
  const { pathname, search, hash } = window.location;

  // Only intercept if we're at /auth/callback WITHOUT a hash route
  // (If hash already contains a path, HashRouter is already handling it)
  if (pathname === '/auth/callback' && !hash.startsWith('#/')) {
    // Redirect to hash-based route, preserving query params
    const newUrl = `${window.location.origin}/#/auth/callback${search}`;
    window.location.replace(newUrl);
    return; // Stop execution, page will reload
  }
})();

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
