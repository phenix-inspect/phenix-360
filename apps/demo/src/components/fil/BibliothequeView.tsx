import { useState } from 'react';
import { EmptyState } from '@phenix360/ui';
import {
  filtrerBibliotheque,
  moisDisponibles,
  zonesDisponibles,
  type BibliothequeFilters,
  type BibliothequeImage,
  type ProjectZone,
} from '@phenix360/core';
import { Heart, Images } from 'lucide-react';
import { FilImage } from './FilImage';

/**
 * La Bibliothèque — une AUTRE VUE sur exactement les mêmes médias que Le Fil.
 * Le Fil raconte l'histoire ; la Bibliothèque permet de retrouver une image.
 * Filtres simples (pièce, mois, coups de cœur) — la logique vit dans core,
 * ici on lit et on affiche. Vue secondaire, expérience volontairement simple.
 */
export function BibliothequeView({
  images,
  zones,
  momentsAimes,
}: {
  images: BibliothequeImage[];
  zones: ProjectZone[];
  momentsAimes: ReadonlySet<string>;
}): React.JSX.Element {
  const [filters, setFilters] = useState<BibliothequeFilters>({});

  const zoneLabel = (id?: string): string | undefined => zones.find((z) => z.id === id)?.label;
  const zonesPresentes = zonesDisponibles(images);
  const zonesOptions = zones.filter((z) => zonesPresentes.has(z.id));
  const moisOptions = moisDisponibles(images);
  const aDesCoups = images.some((img) => momentsAimes.has(img.momentId));

  const resultats = filtrerBibliotheque(images, filters, momentsAimes);
  const selectCls = 'h-9 rounded-lg border border-input bg-surface px-3 text-sm text-foreground';

  return (
    <div className="space-y-4">
      {/* Barre de filtres simple */}
      <div className="flex flex-wrap items-center gap-2">
        {zonesOptions.length > 0 && (
          <select
            value={filters.zoneId ?? ''}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                zoneId: e.target.value ? (e.target.value as ProjectZone['id']) : undefined,
              }))
            }
            className={selectCls}
            aria-label="Filtrer par pièce"
          >
            <option value="">Toutes les pièces</option>
            {zonesOptions.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        )}

        {moisOptions.length > 0 && (
          <select
            value={filters.mois ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, mois: e.target.value || undefined }))}
            className={selectCls}
            aria-label="Filtrer par mois"
          >
            <option value="">Tous les mois</option>
            {moisOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        )}

        {aDesCoups && (
          <button
            type="button"
            aria-pressed={Boolean(filters.avecCoupDeCoeur)}
            onClick={() => setFilters((f) => ({ ...f, avecCoupDeCoeur: !f.avecCoupDeCoeur }))}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors duration-base [&_svg]:size-4 ${
              filters.avecCoupDeCoeur
                ? 'border-gold-300 bg-gold-50 text-gold-800'
                : 'border-input bg-surface text-muted-foreground hover:text-foreground'
            }`}
          >
            <Heart aria-hidden className={filters.avecCoupDeCoeur ? 'fill-current' : ''} />
            Coups de cœur
          </button>
        )}
      </div>

      {resultats.length === 0 ? (
        <EmptyState
          icon={<Images aria-hidden />}
          title={images.length === 0 ? 'La bibliothèque est vide' : 'Aucune photo pour ce filtre'}
          description={
            images.length === 0
              ? 'Chaque photo partagée dans les coulisses du chantier viendra se ranger ici, prête à être retrouvée.'
              : 'Essayez un autre filtre pour retrouver vos photos.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {resultats.map((img) => {
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
      )}
    </div>
  );
}
