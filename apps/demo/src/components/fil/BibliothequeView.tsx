import { EmptyState } from '@phenix360/ui';
import { Images } from 'lucide-react';
import type { BibliothequeImage } from '@phenix360/core';
import { FilImage } from './FilImage';

/**
 * La Bibliothèque — une AUTRE VUE sur exactement les mêmes médias que Le Fil.
 * Le Fil raconte l'histoire ; la Bibliothèque permet de retrouver une image.
 * Grille premium, récent → ancien. Les filtres (pièce, date, auteur, type,
 * étape, favoris) viendront dans les prochaines bricks — les données sont déjà
 * porteuses de ces dimensions (cf. bibliothequeImages).
 */
export function BibliothequeView({
  images,
  zoneLabel,
}: {
  images: BibliothequeImage[];
  zoneLabel: (id?: string) => string | undefined;
}): React.JSX.Element {
  if (images.length === 0) {
    return (
      <EmptyState
        icon={<Images aria-hidden />}
        title="La bibliothèque est vide"
        description="Chaque photo partagée dans Le Fil viendra se ranger ici, prête à être retrouvée."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {images.map((img) => {
        const zone = zoneLabel(img.zoneId);
        return (
          <div
            key={img.photo.id}
            className="relative aspect-square overflow-hidden rounded-lg border border-border bg-paper-100"
          >
            <FilImage photo={img.photo} />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-paper-0"
              style={{
                backgroundImage: 'linear-gradient(to top, rgba(19,16,9,0.6), rgba(19,16,9,0))',
              }}
            >
              <p className="truncate text-xs font-medium">{img.title}</p>
              {zone && <p className="truncate text-[0.625rem] opacity-90">{zone}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
