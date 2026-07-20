import { PasswordGate } from './PasswordGate';
import { AuthGate } from './AuthGate';
import { supabaseConfigured } from './lib/supabase';

/**
 * Porte d'accès unique. Deux mondes, un seul point de bascule :
 *   • SaaS (Supabase configuré) → vraie authentification (AuthGate) ;
 *   • Démo (aucune variable Supabase — dev, e2e, démo publique) → écran mot de
 *     passe dissuasif d'origine (PasswordGate), comportement inchangé.
 * Le choix est fait au chargement, sans rien changer à l'app derrière la porte.
 */
export function AccessGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  if (supabaseConfigured()) {
    return <AuthGate>{children}</AuthGate>;
  }
  return <PasswordGate>{children}</PasswordGate>;
}
