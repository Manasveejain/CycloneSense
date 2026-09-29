import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',   // SW updates automatically in background
      injectRegister: 'auto',

      // ── Web App Manifest ───────────────────────────────────────────────
      manifest: {
        name:             'CycloneSense — AI Early Warning',
        short_name:       'CycloneSense',
        description:      'Real-time cyclone prediction and risk heatmaps for coastal emergency response.',
        theme_color:      '#06b6d4',
        background_color: '#070d18',
        display:          'standalone',
        orientation:      'any',
        start_url:        '/',
        scope:            '/',
        lang:             'en-IN',
        categories:       ['weather', 'utilities', 'emergency'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          {
            name:      'Live Dashboard',
            short_name:'Dashboard',
            url:       '/',
            description: 'Open the live cyclone prediction dashboard',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
        ],
      },

      // ── Workbox Service Worker strategy ───────────────────────────────
      workbox: {
        // Cache name prefix
        cacheId: 'cyclonesense-v2',

        // App shell — all Vite-emitted assets (JS, CSS, icons)
        globPatterns: ['**/*.{js,css,html,ico,png,gif,svg,woff2}'],

        // Runtime caching rules (applied in order — first match wins)
        runtimeCaching: [

          // 1. Map tiles — StaleWhileRevalidate (show cached, refresh in bg)
          //    Covers OpenFreeMap vector tiles
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // 2. MapLibre GL fonts & sprites
          {
            urlPattern: /^https:\/\/fonts\.openmaptiles\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // 3. Google Fonts (UI typography)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 14 * 24 * 3600 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // 4. FastAPI backend — NetworkFirst (fresh when online, cached when offline)
          {
            urlPattern: /^http:\/\/localhost:8000\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-responses',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 60 },  // 30 min
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // 5. Satellite / NOAA imagery — StaleWhileRevalidate
          {
            urlPattern: /^https:\/\/cdn\.star\.nesdis\.noaa\.gov\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'satellite-images',
              expiration: { maxEntries: 20, maxAgeSeconds: 2 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // 6. RainViewer weather overlay
          {
            urlPattern: /^https:\/\/api\.rainviewer\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'rainviewer',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 10, maxAgeSeconds: 10 * 60 },
            },
          },
        ],

        // Skip waiting and claim all clients immediately on SW update
        skipWaiting: true,
        clientsClaim: true,

        // Pre-cache the cyclone GIF and icons
        additionalManifestEntries: [
          { url: '/cyclone.gif',   revision: null },
          { url: '/icon-192.png',  revision: null },
          { url: '/icon-512.png',  revision: null },
        ],
      },

      // Dev mode: emit SW in development so we can inspect it
      devOptions: {
        enabled:   true,
        type:      'module',
        navigateFallback: 'index.html',
      },
    }),
  ],

  server: {
    port: 5173,
    host: true,
  },

  worker: { format: 'es' },

  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },

  build: {
    // Increase chunk size warning limit (maplibre is large)
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          maplibre: ['maplibre-gl'],
          react:    ['react', 'react-dom'],
          vendor:   ['axios', 'lucide-react'],
        },
      },
    },
  },
})
