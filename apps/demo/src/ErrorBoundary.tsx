import { Component, type ErrorInfo, type ReactNode } from 'react';
import { BUILD, recordError } from './lib/diagnostics';

/**
 * Filet de sécurité de dernier recours. Si un écran lève une erreur au rendu,
 * on n'affiche JAMAIS une page blanche : on montre un message clair, rassurant
 * (les données sont locales, rien n'est perdu) et une action pour repartir.
 * Volontairement autonome (aucune dépendance au store ni aux composants métier,
 * qui pourraient être la source de l'erreur).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Trace pour le diagnostic ; l'utilisateur, lui, voit un message soigné.
    console.error('PHÉNIX 360 — erreur de rendu interceptée', error, info.componentStack);
    // Collecte pour l'observabilité (version + dernière erreur, cf. diagnostics.ts).
    recordError('render', error?.message ?? String(error), {
      stack: error?.stack ?? info.componentStack ?? undefined,
    });
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          color: '#2a2620',
          background: '#f7f4ee',
        }}
      >
        <div style={{ maxWidth: '30rem', textAlign: 'center' }}>
          <p
            style={{
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#a9803a',
              fontWeight: 700,
              margin: 0,
            }}
          >
            PHÉNIX 360
          </p>
          <h1 style={{ fontSize: '1.4rem', margin: '0.5rem 0 0.75rem' }}>
            Une erreur inattendue est survenue
          </h1>
          <p style={{ color: '#6b6b6b', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
            Vos données sont enregistrées sur cet appareil : rien n’est perdu. Rechargez
            l’application pour reprendre où vous en étiez.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              cursor: 'pointer',
              border: 'none',
              borderRadius: '0.6rem',
              background: '#a9803a',
              color: '#fffdf9',
              fontSize: '0.95rem',
              fontWeight: 600,
              padding: '0.7rem 1.4rem',
            }}
          >
            Recharger l’application
          </button>
          <p style={{ marginTop: '1.25rem', fontSize: '0.7rem', color: '#a3a3a3' }}>
            Version {BUILD.version} · {BUILD.builtAt.slice(0, 10)}
          </p>
        </div>
      </div>
    );
  }
}
