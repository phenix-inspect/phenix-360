import { Heart } from 'lucide-react';

/**
 * ♡ Coup de cœur — un geste unique pour dire « j'aime ce moment ». AUCUN
 * compteur : le but n'est pas de mesurer une popularité, mais d'exprimer une
 * émotion. Ce n'est pas une métrique.
 */
export function CoupDeCoeurButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 text-sm transition-colors duration-base [&_svg]:size-5 [&_svg]:transition-transform ${
        active ? 'font-medium text-red-500' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Heart aria-hidden className={active ? 'scale-110 fill-red-500 text-red-500' : ''} />
      <span>Coup de cœur</span>
    </button>
  );
}
