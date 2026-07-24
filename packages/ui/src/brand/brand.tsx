/**
 * PHÉNIX 360 — Identité de marque (officielle)
 * ---------------------------------------------------------------------------
 * Le logo PHÉNIX est l'identité OFFICIELLE : ces composants sont la seule
 * source d'identité visuelle, partagés par toutes les apps (header, splash,
 * future page de connexion). Le logo (phénix or, fond détouré) flotte sur
 * n'importe quel fond — il met en valeur l'app sans imposer de couleur : les
 * textes utilisent les tokens.
 *
 * Assets référencés via `import.meta.url` (résolus par le bundler ; aucun typage
 * d'image requis). Proportions respectées (object-contain), jamais déformé.
 */
import { cn } from '../lib/cn.js';

const markUrl = new URL('./phenix-mark.png', import.meta.url).href;
const logoUrl = new URL('./phenix-logo.png', import.meta.url).href;

/** Signature produit officielle. */
export const BRAND_NAME = 'PHÉNIX 360';
export const BRAND_TAGLINE = 'Le suivi intelligent de votre projet';

/** La marque seule (phénix or). object-contain → jamais déformé. */
export function BrandMark({ className }: { className?: string }): React.JSX.Element {
  return (
    <img src={markUrl} alt="PHÉNIX" className={cn('block size-9 object-contain', className)} />
  );
}

type BrandTone = 'light' | 'dark';
type BrandSize = 'sm' | 'md' | 'lg';

const MARK_SIZE: Record<BrandSize, string> = {
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
};
const TITLE_SIZE: Record<BrandSize, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
};

/**
 * Verrou de marque : phénix + « PHÉNIX 360 » + sous-titre optionnel.
 * `tone="dark"` pour fond sombre (textes clairs).
 */
export function BrandLockup({
  size = 'md',
  subtitle = false,
  tone = 'light',
  className,
}: {
  size?: BrandSize;
  subtitle?: boolean;
  tone?: BrandTone;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <BrandMark className={MARK_SIZE[size]} />
      <div className="flex flex-col justify-center leading-none">
        <span
          className={cn(
            'font-serif font-semibold tracking-tight',
            TITLE_SIZE[size],
            tone === 'dark' ? 'text-paper-50' : 'text-foreground',
          )}
        >
          {BRAND_NAME}
        </span>
        {subtitle && (
          <span
            className={cn(
              'mt-1 text-xs',
              tone === 'dark' ? 'text-ink-300' : 'text-muted-foreground',
            )}
          >
            {BRAND_TAGLINE}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Écran de chargement sobre (et base de la future page de connexion) : logo
 * complet + nom + tagline, sur fond sombre, animation légère (fade + zoom léger).
 * `leaving` pilote un fondu de sortie discret.
 */
export function BrandSplash({ leaving = false }: { leaving?: boolean }): React.JSX.Element {
  return (
    <div
      className={cn(
        'fixed inset-0 z-modal grid place-items-center bg-ink-900 transition-opacity duration-slow ease-out',
        leaving ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div className="flex animate-in flex-col items-center gap-6 text-center duration-slow fade-in zoom-in-95">
        <img src={logoUrl} alt="PHÉNIX" className="size-40 object-contain sm:size-48" />
        <div className="space-y-2">
          <div className="font-serif text-3xl font-semibold tracking-tight text-paper-50">
            {BRAND_NAME}
          </div>
          <div className="text-sm text-ink-300">{BRAND_TAGLINE}</div>
        </div>
      </div>
    </div>
  );
}
