import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  integrations: [
    mdx(),
    react(),
    AstroPWA({
      mode: 'production',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo-pos.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'PhD Manager',
        short_name: 'PhD Manager',
        description: 'Organize research, literature, models, constructs, and writing for your PhD.',
        theme_color: '#712038',
        background_color: '#f8f6f4',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Do not precache HTML — otherwise navigating away and back serves a stale page
        // until a hard refresh. Assets stay precached; documents use NetworkFirst below.
        globPatterns: ['**/*.{js,css,svg,png,ico,txt,jpg,jpeg,webp,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        cacheId: 'phd-manager-v5',
        navigateFallback: null,
        // Query params (e.g. ?id=) must not break precache match for paper detail
        ignoreURLParametersMatching: [/^id$/, /^v$/, /^highlight$/],
        runtimeCaching: [
          {
            // Always prefer the network for page navigations so deploys show up without hard refresh.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'phd-html-pages',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              request.destination === 'document' || /\.html?$/i.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'phd-html-pages',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/paper-narrations\/.+/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'paper-narrations',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      experimental: {
        directoryAndTrailingSlashHandler: true,
      },
    }),
  ],
  site: 'https://your-username.github.io',
  // Use your repo name for project sites: base: '/phd/' → site at username.github.io/phd/
  base: '/phd/',
  output: 'static',
  trailingSlash: 'always',
});
