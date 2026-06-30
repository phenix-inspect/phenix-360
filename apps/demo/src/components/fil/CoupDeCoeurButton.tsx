import { Heart } from 'lucide-react';

/**
 * ♡ Coup de cœur — un geste unique et discret pour dire « j'aime ce moment ».
 * Pas de course aux likes : le compte reste muet et secondaire (jamais un
 * trophée). C'est une marque d'appréciation, pas une métrique.
 */
export function CoupDeCoeurButton({
  active,
  count,
  onToggle,
}: {
  active: boolean;
  count: number;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 text-sm transition-colors duration-base [&_svg]:size-5 ${
        active ? 'text-gold-700' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Heart aria-hidden className={active ? 'fill-current' : ''} />
      <span>{active ? 'Coup de cœur' : "J'aime ce moment"}</span>
      {count > 0 && <span className="text-xs text-muted-foreground">· {count}</span>}
    </button>
  );
}
