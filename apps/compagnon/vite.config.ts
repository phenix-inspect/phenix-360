import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PoC Sprint 0 : app-shell installable + service worker. La file offline est
// gérée côté app (IndexedDB) pour rester simple et testable (cf. README).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // SW actif aussi en dev pour pouvoir tester hors-ligne sans build.
      devOptions: { enabled: true, type: 'module' },
      workbox: { globPatterns: ['**/*.{js,css,html,woff,woff2,png}'] },
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'PHÉNIX 360 — Compagnon',
        short_name: 'Compagnon',
        description: 'PoC capture terrain hors-ligne',
        lang: 'fr',
        display: 'standalone',
        start_url: '/',
        background_color: '#f8f4ec',
        theme_color: '#b5893c',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
});
