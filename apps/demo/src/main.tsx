import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@phenix360/ui/fonts.css';
import '@phenix360/ui/tokens.css';
import './index.css';
import { App } from './App';
import { AccessGate } from './AccessGate';
import { ErrorBoundary } from './ErrorBoundary';
import { installDiagnostics } from './lib/diagnostics';

// Observabilité : trace la version qui tourne et collecte les erreurs non gérées
// (cf. src/lib/diagnostics.ts). À installer AVANT le rendu pour ne rien manquer.
installDiagnostics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AccessGate>
        <App />
      </AccessGate>
    </ErrorBoundary>
  </StrictMode>,
);
