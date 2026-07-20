import { useEffect, useState } from 'react';
import { BrandMark, Button, Input } from '@phenix360/ui';
import { LogOut } from 'lucide-react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseBackend, projectId as toProjectId, userId as toUserId } from '@phenix360/core';
import { getSupabaseClient } from './lib/supabase';
import { recordError } from './lib/diagnostics';

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
      <ConnectionStatus client={client} userId={session.user.id} />
    </>
  );
}

/**
 * Témoin de connexion à la base + test d'enregistrement.
 * ---------------------------------------------------------------------------
 * 1) LECTURE : tente une lecture inoffensive de `project` (la RLS filtre — une
 *    liste vide est un SUCCÈS). Prouve réseau + CSP + jeton + RLS + schéma.
 * 2) ÉCRITURE (à la demande) : crée un chantier de test via l'adaptateur RÉEL
 *    (SupabaseBackend), le relit, puis le supprime — round-trip complet et
 *    auto-nettoyé qui prouve que l'écriture persiste bien dans la base.
 * Échafaudage de validation du branchement (retiré une fois les données migrées).
 */
function ConnectionStatus({
  client,
  userId,
}: {
  client: SupabaseClient;
  userId: string;
}): React.JSX.Element | null {
  const [state, setState] = useState<'checking' | 'ok' | 'error'>('checking');
  const [message, setMessage] = useState('');
  const [writeState, setWriteState] = useState<'idle' | 'running' | 'ok' | 'error'>('idle');
  const [writeMessage, setWriteMessage] = useState('');

  useEffect(() => {
    let alive = true;
    void client
      .from('project')
      .select('id')
      .limit(1)
      .then(({ error }) => {
        if (!alive) return;
        if (error) {
          setState('error');
          setMessage(error.message);
          recordError('error', `Supabase health: ${error.message}`);
        } else {
          setState('ok');
        }
      });
    return () => {
      alive = false;
    };
  }, [client]);

  const runWriteTest = async (): Promise<void> => {
    setWriteState('running');
    setWriteMessage('');
    const backend = new SupabaseBackend(client);
    let createdId: string | null = null;
    // Diagnostic : propriétaire enregistré vs utilisateur courant + test de la
    // fonction de sécurité. Révèle la cause exacte d'un refus d'écriture.
    const diag = async (): Promise<string> => {
      let s = `uid=${userId.slice(0, 8)}`;
      if (!createdId) return s;
      try {
        const back = await client
          .from('project')
          .select('created_by')
          .eq('id', createdId)
          .maybeSingle();
        const cb = back.data?.created_by ? String(back.data.created_by) : 'NULL';
        s += ` cb=${cb.slice(0, 8)}`;
      } catch {
        s += ' cb=?';
      }
      try {
        const owns = await client.rpc('app_owns_project', { p_project: createdId });
        s += ` owns=${owns.error ? 'fn-absente' : String(owns.data)}`;
      } catch {
        s += ' owns=?';
      }
      return s;
    };
    try {
      const created = await backend.createProject({
        name: `Test enregistrement ${new Date().toISOString()}`,
        address: '1 rue de Test, 75001 Paris',
      });
      createdId = created.id;
      await backend.addMember({
        projectId: created.id,
        userId: toUserId(userId),
        role: 'compagnon',
      });
      const list = await backend.listProjects();
      const found = list.some((p) => p.id === created.id);
      if (!found) throw new Error('chantier créé mais non relu dans la base');
      setWriteState('ok');
      setWriteMessage(`Chantier ${created.code} créé, relu et nettoyé.`);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const d = await diag();
      setWriteState('error');
      setWriteMessage(`${raw} — [${d}]`);
      recordError('error', `Supabase write test: ${raw} ${d}`);
    } finally {
      if (createdId) {
        try {
          await backend.deleteProject(toProjectId(createdId)); // nettoyage best-effort (cascade)
        } catch {
          /* rien : sera nettoyé plus tard */
        }
      }
    }
  };

  if (state === 'checking') return null;
  const ok = state === 'ok';
  return (
    <div className="fixed bottom-5 right-5 z-modal flex flex-col items-end gap-2">
      {writeMessage && (
        <div
          className="max-w-xs rounded-xl border border-border bg-surface/95 px-3 py-2 text-xs shadow-sm backdrop-blur"
          style={{ color: writeState === 'error' ? '#c2410c' : '#129d6b' }}
        >
          {writeState === 'ok' ? '✅ Écriture OK — ' : '⚠️ '}
          {writeMessage}
        </div>
      )}
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
        <span
          role="status"
          title={ok ? 'PHÉNIX dialogue avec votre base de données.' : message}
          className="inline-flex items-center gap-1.5"
        >
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: ok ? '#129d6b' : '#c2410c' }}
          />
          {ok ? 'Base connectée' : 'Base injoignable'}
        </span>
        {ok && (
          <button
            type="button"
            onClick={() => void runWriteTest()}
            disabled={writeState === 'running'}
            className="border-l border-border pl-2 font-medium text-foreground underline-offset-2 hover:underline disabled:opacity-60"
          >
            {writeState === 'running' ? 'Test en cours…' : 'Tester l’enregistrement'}
          </button>
        )}
      </div>
    </div>
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
        <BrandMark className="mx-auto size-16" />
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
