/**
 * PHÉNIX 360 — Espace client par LIEN + CODE (le JUMEAU de l'app)
 * ===========================================================================
 * Page atteinte par `…/#/c/<projectId>` : le client (SANS compte) saisit le code
 * communiqué par son conducteur. Le code est vérifié CÔTÉ SERVEUR (`client_space`,
 * SECURITY DEFINER). Une fois entré, on branche le store en MODE CLIENT
 * (`demo.connectClientSpace` → `ClientSpaceBackend`, qui sert les données de
 * `client_space` et route les écritures du client vers les RPC code-gardées) et on
 * rend LE VRAI `ClientView` — exactement l'espace client validé de l'app, sans
 * compte ni store conducteur. Les deux vues sont donc de vrais JUMEAUX.
 *
 * Liveness : le client n'a pas le temps réel (non authentifié) ; on recharge
 * `client_space` à intervalle léger et au retour sur l'onglet.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { BrandMark, Button, Input } from '@phenix360/ui';
import { getSupabaseClient } from './lib/supabase';
import { demo } from './store';
import { ClientView } from './surfaces/ClientView';
import type { ClientSpaceRaw } from './lib/clientSpaceBackend';

/** Mémoire de session : évite de redemander le code à chaque rechargement. */
const codeKey = (projectId: string): string => `phenix-client-code:${projectId}`;

export function ClientSpacePage({ projectId }: { projectId: string }): React.JSX.Element {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const snap = useSyncExternalStore(demo.subscribe, demo.getSnapshot);

  const enter = useCallback(
    async (theCode: string): Promise<void> => {
      setBusy(true);
      setError('');
      try {
        const client = await getSupabaseClient();
        if (!client) throw new Error('config');
        const res = await client.rpc('client_space', {
          p_project: projectId,
          p_code: theCode.trim(),
        });
        if (res.error || !res.data || !(res.data as ClientSpaceRaw).project)
          throw new Error('denied');
        demo.connectClientSpace(client, projectId, theCode.trim(), res.data as ClientSpaceRaw);
        try {
          sessionStorage.setItem(codeKey(projectId), theCode.trim());
        } catch {
          /* stockage indisponible : on continue */
        }
        setConnected(true);
      } catch {
        setError(
          'Code incorrect, ou chantier introuvable. Vérifiez le code communiqué par votre conducteur.',
        );
        try {
          sessionStorage.removeItem(codeKey(projectId));
        } catch {
          /* rien */
        }
      } finally {
        setBusy(false);
      }
    },
    [projectId],
  );

  // Reprise silencieuse : si le code de cette session est déjà connu, on entre.
  useEffect(() => {
    let saved = '';
    try {
      saved = sessionStorage.getItem(codeKey(projectId)) ?? '';
    } catch {
      saved = '';
    }
    if (saved) void enter(saved);
  }, [projectId, enter]);

  // Liveness : pas de temps réel pour l'anonyme → on recharge périodiquement et
  // au retour sur l'onglet, sans écran d'attente (les saisies en cours sont
  // préservées : elles vivent dans les composants de ClientView).
  useEffect(() => {
    if (!connected) return;
    const tick = (): void => void demo.refreshClientSpace();
    const iv = window.setInterval(tick, 12_000);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') tick();
    };
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [connected]);

  if (connected) {
    const project = snap.projects.find((p) => p.id === projectId);
    if (project) {
      return (
        <div className="min-h-screen bg-background">
          <header className="border-b border-border bg-surface">
            <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
              <BrandMark className="size-10" />
              <div className="min-w-0">
                <p className="font-serif text-xl font-semibold tracking-tight text-foreground">
                  PHÉNIX 360
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Le suivi intelligent de votre projet
                </p>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-6 sm:px-5">
            <ClientView snap={snap} project={project} clientAccess />
          </main>
        </div>
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface p-8 text-center shadow-lg">
        <BrandMark className="mx-auto size-16" />
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Votre chantier
          </h1>
          <p className="text-sm text-muted-foreground">
            Saisissez le code que votre conducteur vous a communiqué pour suivre votre projet.
          </p>
        </div>
        <div className="space-y-2 text-left">
          <Input
            type="text"
            inputMode="text"
            autoComplete="off"
            aria-label="Code d’accès"
            placeholder="Code d’accès"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError('');
            }}
            onKeyDown={(e) =>
              e.key === 'Enter' && !busy && code.trim().length >= 4 && void enter(code)
            }
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <Button
          className="w-full"
          onClick={() => void enter(code)}
          disabled={busy || code.trim().length < 4}
        >
          {busy ? 'Un instant…' : 'Voir mon chantier'}
        </Button>
      </div>
    </div>
  );
}
