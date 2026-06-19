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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,jpg,jpeg,webp,woff,woff2,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Query params (e.g. ?id=) must not break precache match for paper detail
        ignoreURLParametersMatching: [/^id$/, /^v$/, /^highlight$/],
        runtimeCaching: [
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
