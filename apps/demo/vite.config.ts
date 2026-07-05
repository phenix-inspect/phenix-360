import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` par défaut '/' (Vercel domaine racine + preview e2e). Pour GitHub Pages
// (servi sous /<repo>/), le workflow passe PAGES_BASE=/phenix-360/. Aucune
// incidence en dev/e2e/Vercel où PAGES_BASE n'est pas défini.
export default defineConfig({
  plugins: [react()],
  base: process.env.PAGES_BASE || '/',
});
