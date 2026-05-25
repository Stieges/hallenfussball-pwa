import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Build identifier — short Vercel commit SHA in production, timestamp marker locally.
// Injected at build time via `define` and consumed by Sentry release-tag + boot-context telemetry.
function resolveBuildHash(): string {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha && vercelSha.length >= 8) {
    return vercelSha.slice(0, 8);
  }
  return `local-${Date.now().toString(36)}`;
}

const BUILD_HASH = resolveBuildHash();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_HASH__: JSON.stringify(BUILD_HASH),
  },
  plugins: [
    react(),
    // PWA Plugin - Enables offline functionality
    VitePWA({
      // 'prompt' gives our swRegistration.setupSwAutoReload control over the
      // update flow (toast + hard reload). 'autoUpdate' silently installs the
      // new SW but never reloads the open tab, which leaves users on the
      // stale precached bundle — root cause of the 2026-05-24 login-bug.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      manifest: {
        name: 'Hallenfußball Turnier-Manager',
        short_name: 'Turnier',
        description: 'Turnier-Management für Hallenfußball - Spielpläne, Live-Ergebnisse und mehr',
        theme_color: '#00e676',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
        categories: ['sports', 'utilities'],
        lang: 'de',
      },
      workbox: {
        // Clean up outdated caches from previous builds
        // This prevents "Importing a module script failed" errors when old chunks are requested
        cleanupOutdatedCaches: true,
        // Cache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Runtime caching for external resources
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache Supabase API responses for public views
            // NetworkFirst: Try network, fall back to cache for offline support
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour cache for API responses
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 10, // Fall back to cache after 10s timeout
            },
          },
          {
            // Cache Supabase Auth API (for session validation)
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/v1\/.*/i,
            handler: 'NetworkOnly', // Auth should always be fresh
            options: {
              cacheName: 'supabase-auth-cache',
            },
          },
        ],
        // Skip waiting and claim clients immediately
        skipWaiting: true,
        clientsClaim: true,
      },
      // Development options
      devOptions: {
        enabled: false, // Enable in dev with: enabled: true
      },
    }),
    // Bundle analyzer - generates stats.html after build
    visualizer({
      filename: 'dist/stats.html',
      open: false, // Set to true to auto-open after build
      gzipSize: true,
      brotliSize: true,
    }),
    // Sentry source map upload - only in production with auth token
    mode === 'production' && process.env.SENTRY_AUTH_TOKEN
      ? sentryVitePlugin({
          org: 'stiegler-is',
          project: 'javascript-react',
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: {
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
          telemetry: false,
        })
      : null,
  ].filter(Boolean),
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 600, // Erhöht von 500KB auf 600KB
    rollupOptions: {
      output: {
        // Vite 7+ / rolldown only accepts the function form of manualChunks.
        manualChunks: (id) => {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/jspdf')) {
            return 'pdf-vendor';
          }
          return undefined;
        },
      },
    },
  },
}))
