import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@phenix360/ui';
import type { SelectionOption } from '@phenix360/core';
import { warmGradient } from './gradient';

/**
 * Galerie de PROPOSITIONS client — brique 100 % GÉNÉRIQUE (cuisine, carrelage,
 * parquet, peinture, robinetterie, sanitaires, luminaires, mobilier, poignées…).
 * Présentation ÉDITORIALE, façon catalogue d'architecte d'intérieur : une grande
 * photo à gauche, les informations à droite, une lecture fluide. Le client coche
 * la proposition (A–E) qui lui plaît — jamais un formulaire. La photo est
 * éditoriale (dégradé déterministe) tant qu'aucune vraie image n'est fournie ;
 * `imageUrl` bascule automatiquement sur la photo réelle.
 *
 * Note d'architecture : les `SelectionOption` seront à terme GÉNÉRÉES par PHÉNIX
 * (photos du projet + style + bibliothèque de références), le conducteur ne fera
 * que les ajuster. Ce composant n'en dépend pas : il affiche des options, d'où
 * qu'elles viennent.
 */
export function ProposalGallery({
  options,
  selectedId,
  onSelect,
}: {
  options: SelectionOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  return (
    <ul className="space-y-3">
      {options.slice(0, 5).map((opt, i) => {
        const selected = opt.id === selectedId;
        const ref = opt.ref ?? String.fromCharCode(65 + i); // A, B, C…
        const seed = opt.imageSeed ?? `${opt.id}-${opt.title}`;
        const attrs = opt.attributs?.map((a) => a.value).join(' · ');
        return (
          <li key={opt.id}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(opt.id)}
              className={cn(
                'flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-primary shadow-gold'
                  : 'border-border bg-surface hover:border-gold-300',
              )}
            >
              <div className="flex shrink-0 items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full border-2',
                    selected ? 'border-primary' : 'border-input',
                  )}
                >
                  {selected && <span className="size-2.5 rounded-full bg-primary" />}
                </span>
                <span className="flex size-7 items-center justify-center rounded-full bg-gold-100 font-mono text-xs font-semibold text-gold-800">
                  {ref}
                </span>
              </div>

              <div
                className="relative aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-xl sm:w-44"
                style={opt.imageUrl ? undefined : warmGradient(seed)}
              >
                {opt.imageUrl ? (
                  <img src={opt.imageUrl} alt={opt.title} className="size-full object-cover" />
                ) : (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center text-paper-0 [&_svg]:size-10"
                    style={{ opacity: 0.18 }}
                  >
                    <ImageIcon />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-serif text-lg font-semibold tracking-tight text-foreground">
                  {opt.title}
                </p>
                {opt.description && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{opt.description}</p>
                )}
                {attrs && <p className="text-xs uppercase tracking-wide text-gold-700">{attrs}</p>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
