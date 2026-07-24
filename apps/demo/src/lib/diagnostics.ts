/**
 * OBSERVABILITÉ — savoir « ce qui tourne » et « ce qui a cassé » sans capture d'écran.
 * ============================================================================
 * PHÉNIX 360 (mode démo) est 100 % côté navigateur : pas de serveur pour recevoir
 * des logs. Ce module fournit le strict nécessaire pour diagnostiquer un incident
 * quand un utilisateur dit « ça ne marche pas » :
 *
 *   • l'IDENTITÉ du build (version, commit, date) — figée au build par Vite ;
 *   • un COLLECTEUR d'erreurs non gérées (script + promesses) en mémoire, borné,
 *     avec la dernière erreur miroir dans localStorage (survit au reload) ;
 *   • `window.__PHENIX_DIAG__()` : un instantané copiable (version, navigateur,
 *     écran, URL, horodatage, dernières erreurs) à demander à l'utilisateur.
 *
 * Volontairement autonome : aucune dépendance au store ni aux composants métier
 * (qui pourraient être la source même de l'incident). Pour une vraie collecte
 * centralisée (Sentry & co.), voir docs/PRODUCTION.md — ce module en est le socle.
 */

export const BUILD = {
  version: __APP_VERSION__,
  commit: __APP_COMMIT__,
  builtAt: __APP_BUILD_TIME__,
} as const;

export type DiagKind = 'error' | 'unhandledrejection' | 'render';

export interface DiagEntry {
  ts: string;
  kind: DiagKind;
  message: string;
  source?: string;
  stack?: string;
}

const RING_MAX = 30;
const LAST_KEY = 'phenix-diag:last';
const ring: DiagEntry[] = [];

/** Enregistre une erreur : anneau borné en mémoire + miroir de la dernière sur disque. */
export function recordError(
  kind: DiagKind,
  message: string,
  opts: { source?: string; stack?: string } = {},
): void {
  const entry: DiagEntry = {
    ts: new Date().toISOString(),
    kind,
    message: String(message).slice(0, 500),
    ...(opts.source ? { source: opts.source } : {}),
    ...(opts.stack ? { stack: String(opts.stack).slice(0, 2000) } : {}),
  };
  ring.push(entry);
  if (ring.length > RING_MAX) ring.shift();
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ ...BUILD, ...entry }));
  } catch {
    /* stockage saturé / indisponible : l'anneau mémoire suffit au diagnostic */
  }
}

/** Instantané de diagnostic copiable — sans donnée métier, uniquement du contexte technique. */
export function diagnosticSnapshot(): Record<string, unknown> {
  return {
    ...BUILD,
    time: new Date().toISOString(),
    url: typeof location !== 'undefined' ? location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    language: typeof navigator !== 'undefined' ? navigator.language : '',
    online: typeof navigator !== 'undefined' ? navigator.onLine : null,
    viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
    errors: [...ring],
  };
}

let installed = false;

/**
 * Branche les collecteurs globaux et expose l'instantané. Idempotent. À appeler
 * une seule fois, au démarrage, avant le rendu React.
 */
export function installDiagnostics(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // Bannière de démarrage : `console.info` (jamais `error`) — trace la version qui tourne.
  console.info(
    `PHÉNIX 360 · version ${BUILD.version} · commit ${BUILD.commit} · build ${BUILD.builtAt}`,
  );

  // Erreurs de script non gérées (hors rendu React, couvert par l'ErrorBoundary).
  window.addEventListener('error', (ev: ErrorEvent) => {
    recordError('error', ev.message || 'Erreur inconnue', {
      source: ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined,
      stack: ev.error?.stack,
    });
  });

  // Rejets de promesses non gérés (async).
  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    const reason = ev.reason;
    recordError('unhandledrejection', reason?.message ?? String(reason), {
      stack: reason?.stack,
    });
  });

  window.__PHENIX_DIAG__ = diagnosticSnapshot;
}
