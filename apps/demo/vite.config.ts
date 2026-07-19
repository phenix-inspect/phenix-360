import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` par défaut '/' (Vercel domaine racine + preview e2e). Pour GitHub Pages
// (servi sous /<repo>/), le workflow passe PAGES_BASE=/phenix-360/. Aucune
// incidence en dev/e2e/Vercel où PAGES_BASE n'est pas défini.

// Identité de version injectée au build (observabilité — cf. src/lib/diagnostics.ts).
// L'IDENTITÉ REPRODUCTIBLE est le COMMIT : même commit + même lockfile = même code.
// Le commit provient de l'hébergeur (Vercel / GitHub Actions) ; `local` hors CI.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const commit = (
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  'local'
).slice(0, 7);
const buildTime = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  base: process.env.PAGES_BASE || '/',
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version}+${commit}`),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
  },
  build: {
    rollupOptions: {
      output: {
        // Isole les gros vendors STABLES dans leurs propres chunks : le navigateur
        // les met en cache et ne les réinvalide PAS à chaque déploiement applicatif
        // (meilleur temps de chargement en visite répétée).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('/scheduler/'))
            return 'react';
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          return undefined;
        },
      },
    },
  },
});
