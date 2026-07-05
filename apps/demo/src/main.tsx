import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@phenix360/ui/fonts.css';
import '@phenix360/ui/tokens.css';
import './index.css';
import { App } from './App';
import { PasswordGate } from './PasswordGate';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PasswordGate>
      <App />
    </PasswordGate>
  </StrictMode>,
);
