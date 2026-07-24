import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@phenix360/ui/fonts.css';
import '@phenix360/ui/tokens.css';
import './index.css';
import { App } from './App';
import { AccessGate } from './AccessGate';
import { ClientSpacePage } from './ClientSpacePage';
import { ErrorBoundary } from './ErrorBoundary';
import { installDiagnostics } from './lib/diagnostics';
import { supabaseConfigured } from './lib/supabase';

// Observabilité : trace la version qui tourne et collecte les erreurs non gérées
// (cf. src/lib/diagnostics.ts). À installer AVANT le rendu pour ne rien manquer.
installDiagnostics();

/**
 * Lien d'espace client : `…/#/c/<ref>` où `<ref>` est le CODE CHANTIER lisible
 * (`26-LY-003`, lien court et pro) OU l'UUID du chantier (liens historiques,
 * toujours acceptés). Le client (SANS compte) atterrit sur une page AUTONOME,
 * code-gardée, entièrement séparée de l'app conducteur. Uniquement en mode SaaS
 * (Supabase configuré) ; sinon on ignore le lien.
 */
function clientRouteRef(): string | null {
  const m = /^#\/c\/([0-9a-fA-F-]{36}|\d{2}-[A-Za-z]{2}-\d{3})$/.exec(window.location.hash);
  return m && supabaseConfigured() ? (m[1] ?? null) : null;
}

const clientRef = clientRouteRef();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {clientRef ? (
        <ClientSpacePage routeRef={clientRef} />
      ) : (
        <AccessGate>
          <App />
        </AccessGate>
      )}
    </ErrorBoundary>
  </StrictMode>,
);
