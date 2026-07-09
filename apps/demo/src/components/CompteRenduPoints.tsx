import {
  DIFFUSION_LABEL,
  pointsPourAudience,
  type CompteRenduPoint,
  type CrAudience,
} from '@phenix360/core';

/**
 * Rendu CHRONOLOGIQUE des points d'un compte rendu de chantier — photo +
 * commentaire, filtrés par destinataire. Le conducteur voit tout (avec le badge
 * de diffusion) ; le client ne voit que les points qui lui sont destinés (sans
 * badge — la cible est de l'information interne). Présentation seule.
 */
export function CompteRenduPoints({
  points,
  audience,
}: {
  points: CompteRenduPoint[] | undefined;
  audience: CrAudience;
}): React.JSX.Element | null {
  const visibles = pointsPourAudience(points, audience);
  if (visibles.length === 0) return null;
  return (
    <ol className="mt-3 space-y-2.5">
      {visibles.map((p, i) => (
        <li
          key={i}
          className="flex gap-3 rounded-xl border border-border bg-surface p-2.5 shadow-sm"
        >
          {p.photos.length > 0 && (
            <div className="flex shrink-0 gap-1">
              {p.photos.map((ph, j) => (
                <img
                  key={j}
                  src={ph.imageUrl}
                  alt=""
                  className="size-16 rounded-lg border border-border object-cover"
                />
              ))}
            </div>
          )}
          <div className="min-w-0 flex-1 leading-snug">
            <p className="text-sm text-foreground">{p.comment}</p>
            {audience === 'conducteur' && (
              <span className="mt-1 inline-flex items-center rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-800">
                {DIFFUSION_LABEL[p.diffusion]}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
