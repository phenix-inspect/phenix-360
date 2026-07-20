/// <reference types="vite/client" />

/**
 * Constantes injectées au build par Vite (`define`). Identité de version pour le
 * diagnostic (« quelle version tourne ? ») — voir vite.config.ts et diagnostics.ts.
 */
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILD_TIME__: string;

interface ImportMetaEnv {
  /** Mot de passe du gate RC1 (démo déployée). Absent en dev/e2e → pas de gate. */
  readonly VITE_DEMO_PASSWORD?: string;
  /** URL du projet Supabase (mode SaaS). Absent → mode démo local. */
  readonly VITE_SUPABASE_URL?: string;
  /** Clé publique « anon » Supabase (mode SaaS). Absent → mode démo local. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface Window {
  /** Bypass de test du gate mot de passe (simule VITE_DEMO_PASSWORD sans rebuild). */
  __PHENIX_GATE_PW__?: string;
  /**
   * Diagnostic exploitable sans capture d'écran : renvoie version, navigateur,
   * écran, URL et les dernières erreurs interceptées. Tapez `__PHENIX_DIAG__()`
   * dans la console du navigateur (ou lisez `localStorage['phenix-diag:last']`).
   */
  __PHENIX_DIAG__?: () => unknown;
}
