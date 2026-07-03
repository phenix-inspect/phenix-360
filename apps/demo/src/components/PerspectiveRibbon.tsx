import { Eye } from 'lucide-react';

/**
 * Bandeau de perspective (P2 — stabilisation). Le conducteur pilote une seule
 * application ; les vues « Artisan » et « Espace client » sont des aperçus de ce
 * que voient les autres acteurs. Ce ruban le dit sans ambiguïté, pour qu'on
 * comprenne immédiatement de quel côté on se trouve. VISION.md Art. 9.
 */
export function PerspectiveRibbon({
  audience,
  subject,
}: {
  audience: 'artisan' | 'client';
  subject?: string;
}): React.JSX.Element {
  const who =
    audience === 'artisan'
      ? 'ce que voit l’artisan sur ce chantier'
      : subject
        ? `l’espace de votre client, ${subject}`
        : 'l’espace de votre client';
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-gold-200 bg-gold-50 px-4 py-2.5 text-sm text-gold-800 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-gold-600">
      <Eye aria-hidden />
      <p>
        <span className="font-medium">Aperçu</span> — vous consultez {who}.
      </p>
    </div>
  );
}
