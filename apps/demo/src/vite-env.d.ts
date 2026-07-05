/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mot de passe du gate RC1 (démo déployée). Absent en dev/e2e → pas de gate. */
  readonly VITE_DEMO_PASSWORD?: string;
}

interface Window {
  /** Bypass de test du gate mot de passe (simule VITE_DEMO_PASSWORD sans rebuild). */
  __PHENIX_GATE_PW__?: string;
}
