import { useEffect, useState } from 'react';
import { Button, Input } from '@phenix360/ui';
import { LogOut, Mail } from 'lucide-react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './lib/supabase';

/**
 * Authentification réelle (mode SaaS). N'est montée QUE lorsque Supabase est
 * configuré (cf. AccessGate) : en démo / e2e, on garde le PasswordGate et rien
 * de tout ceci ne s'exécute. Tant que l'utilisateur n'a pas de session valide,
 * on affiche l'écran de connexion ; une fois connecté, l'app s'affiche
 * normalement (l'expérience et les parcours ne changent pas).
 */
export function AuthGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let alive = true;
    void getSupabaseClient().then((c) => {
      if (!alive) return;
      if (!c) {
        setReady(true);
        return;
      }
      setClient(c);
      void c.auth.getSession().then(({ data }) => {
        if (!alive) return;
        setSession(data.session);
        setReady(true);
      });
      const { data } = c.auth.onAuthStateChange((_event, s) => setSession(s));
      unsub = () => data.subscription.unsubscribe();
    });
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  if (!ready) {
    return <Splash label="Chargement…" />;
  }
  if (!client || !session) {
    return <LoginScreen client={client} />;
  }
  return (
    <>
      {children}
      <SignOutButton client={client} />
    </>
  );
}

function Splash({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function LoginScreen({ client }: { client: SupabaseClient | null }): React.JSX.Element {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const disabled = busy || !email.trim() || password.length < 6;

  const submit = async (): Promise<void> => {
    if (!client || disabled) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'signup') {
        const { data, error: e } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + window.location.pathname },
        });
        if (e) throw e;
        // Selon les réglages Supabase : session immédiate, ou confirmation par email.
        if (!data.session) {
          setInfo(
            'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse, puis revenez vous connecter.',
          );
          setMode('signin');
        }
      } else {
        const { error: e } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (e) throw e;
      }
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface p-8 text-center shadow-lg">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-7">
          <Mail aria-hidden />
        </span>
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            PHÉNIX 360
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'signin' ? 'Connectez-vous à votre espace.' : 'Créez votre accès.'}
          </p>
        </div>
        <div className="space-y-2 text-left">
          <Input
            type="email"
            autoComplete="email"
            aria-label="Adresse email"
            placeholder="Adresse email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
          />
          <Input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            aria-label="Mot de passe"
            placeholder="Mot de passe (6 caractères minimum)"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {info && <p className="text-sm text-gold-700">{info}</p>}
        </div>
        <Button className="w-full" onClick={() => void submit()} disabled={disabled}>
          {busy ? 'Un instant…' : mode === 'signin' ? 'Se connecter' : 'Créer mon accès'}
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError('');
            setInfo('');
          }}
        >
          {mode === 'signin'
            ? 'Pas encore de compte ? Créer un accès'
            : 'J’ai déjà un compte — me connecter'}
        </button>
      </div>
    </div>
  );
}

function SignOutButton({ client }: { client: SupabaseClient }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => void client.auth.signOut()}
      aria-label="Se déconnecter"
      title="Se déconnecter"
      className="fixed bottom-5 left-5 z-modal inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 [&_svg]:size-3.5"
    >
      <LogOut aria-hidden /> Se déconnecter
    </button>
  );
}

/** Message clair (français) à partir d'une erreur Supabase. */
function messageFor(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(raw)) return 'Email ou mot de passe incorrect.';
  if (/already registered|already exists/i.test(raw))
    return 'Un compte existe déjà avec cet email.';
  if (/email not confirmed/i.test(raw))
    return 'Votre email n’est pas encore confirmé. Vérifiez votre boîte mail.';
  if (/password should be at least/i.test(raw))
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  return raw || 'Une erreur est survenue. Réessayez.';
}
