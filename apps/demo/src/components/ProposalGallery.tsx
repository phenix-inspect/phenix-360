import { Check, Image as ImageIcon } from 'lucide-react';
import { cn } from '@phenix360/ui';
import type { SelectionOption } from '@phenix360/core';
import { warmGradient } from './gradient';

/**
 * Galerie de PROPOSITIONS client — brique GÉNÉRIQUE (cuisine, carrelage,
 * parquet, peinture, sanitaires, luminaires, mobilier, poignées…). PHÉNIX
 * présente plusieurs ambiances soigneusement préparées : grande photo +
 * titre + description + caractéristiques. Le client sélectionne celle qu'il
 * préfère — jamais un formulaire. La photo est éditoriale (dégradé déterministe)
 * tant qu'aucune vraie image n'est fournie.
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
    <div className="grid gap-3 sm:grid-cols-2">
      {options.slice(0, 5).map((opt, i) => {
        const selected = opt.id === selectedId;
        const ref = opt.ref ?? String.fromCharCode(65 + i); // A, B, C…
        const seed = opt.imageSeed ?? `${opt.id}-${opt.title}`;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(opt.id)}
            className={cn(
              'group overflow-hidden rounded-xl border bg-surface text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected ? 'border-primary shadow-gold' : 'border-border hover:border-gold-300',
            )}
          >
            <div
              className="relative aspect-[4/3] w-full overflow-hidden"
              style={warmGradient(seed)}
            >
              {opt.imageUrl ? (
                <img src={opt.imageUrl} alt={opt.title} className="size-full object-cover" />
              ) : (
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center text-paper-0 [&_svg]:size-12"
                  style={{ opacity: 0.18 }}
                >
                  <ImageIcon />
                </span>
              )}
              <span className="absolute left-3 top-3 flex size-7 items-center justify-center rounded-full bg-paper-0/85 font-mono text-xs font-semibold text-ink-800">
                {ref}
              </span>
              {selected && (
                <span className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground [&_svg]:size-4">
                  <Check aria-hidden />
                </span>
              )}
            </div>

            <div className="space-y-1.5 p-3">
              <p className="font-serif text-base font-semibold tracking-tight text-foreground">
                {opt.title}
              </p>
              {opt.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">{opt.description}</p>
              )}
              {opt.attributs && opt.attributs.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 pt-0.5">
                  {opt.attributs.map((a) => (
                    <li
                      key={a.label}
                      className="rounded-full border border-border bg-paper-50 px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      <span className="text-gold-700">{a.label}</span> : {a.value}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
