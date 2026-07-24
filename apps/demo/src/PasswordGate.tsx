import { useState } from 'react';
import { Button, Input } from '@phenix360/ui';
import { Lock } from 'lucide-react';

const GATE_KEY = 'phenix-demo:gate:v1';

/**
 * Gate mot de passe — protection RC1 TEMPORAIRE d'une démo déployée. Ce n'est PAS
 * une authentification (ni le futur système d'auth) : juste un écran mot de passe
 * dissuasif avant d'accéder à PHÉNIX.
 *
 *  • Le mot de passe vient de la variable d'env `VITE_DEMO_PASSWORD` (build Vercel).
 *  • Aucune variable → AUCUN gate : l'app reste accessible normalement (dev + e2e).
 *  • Une fois saisi, la session est gardée en localStorage (persiste au reload).
 *  • Bouton « Verrouiller » pour se déconnecter.
 *
 * Testabilité / bypass propre : `window.__PHENIX_GATE_PW__` simule la variable
 * sans rebuild (utilisé par la suite e2e `gate`). NB : contrôle 100 % côté client
 * — dissuasif, pas confidentiel (le mot de passe est présent dans le bundle).
 */
function configuredPassword(): string {
  const env = import.meta.env.VITE_DEMO_PASSWORD;
  const win = typeof window !== 'undefined' ? window.__PHENIX_GATE_PW__ : undefined;
  return String(env || win || '').trim();
}

export function PasswordGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const password = configuredPassword();
  const [authed, setAuthed] = useState<boolean>(
    () => !password || localStorage.getItem(GATE_KEY) === password,
  );

  if (!authed) {
    return <GateScreen expected={password} onUnlock={() => setAuthed(true)} />;
  }

  const lock = (): void => {
    localStorage.removeItem(GATE_KEY);
    setAuthed(false);
  };

  return (
    <>
      {children}
      {/* Le verrou n'apparaît que sur la démo protégée (jamais en dev/e2e). */}
      {password && <LockButton onLock={lock} />}
    </>
  );
}

function GateScreen({
  expected,
  onUnlock,
}: {
  expected: string;
  onUnlock: () => void;
}): React.JSX.Element {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const submit = (): void => {
    if (value === expected) {
      localStorage.setItem(GATE_KEY, expected);
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface p-8 text-center shadow-lg">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-7">
          <Lock aria-hidden />
        </span>
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            PHÉNIX 360
          </h1>
          <p className="text-sm text-muted-foreground">Démo privée — entrez le mot de passe.</p>
        </div>
        <div className="space-y-2 text-left">
          <Input
            type="password"
            aria-label="Mot de passe"
            placeholder="Mot de passe"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoFocus
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              Mot de passe incorrect.
            </p>
          )}
        </div>
        <Button className="w-full" onClick={submit} disabled={!value}>
          Entrer
        </Button>
      </div>
    </div>
  );
}

function LockButton({ onLock }: { onLock: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onLock}
      aria-label="Verrouiller la démo"
      title="Verrouiller la démo"
      className="fixed bottom-5 left-5 z-modal inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 [&_svg]:size-3.5"
    >
      <Lock aria-hidden /> Verrouiller
    </button>
  );
}
