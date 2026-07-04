import { useRef } from 'react';
import { Heart } from 'lucide-react';

/**
 * ♡ Coup de cœur — un geste unique pour dire « j'aime ce moment ». AUCUN
 * compteur : le but n'est pas de mesurer une popularité, mais d'exprimer une
 * émotion. Ce n'est pas une métrique.
 *
 * Le feedback DOIT être immédiat et sans ambiguïté (retour terrain) : au clic,
 * le cœur se remplit en rouge vif et fait un petit « pop ». Un second clic le
 * vide. La couleur d'émotion (#e11d48) n'existe pas dans la palette de marque
 * (rôles sobres) : on la pose donc en style inline, ici, dans l'app.
 */
const LIKE = '#e11d48';

export function CoupDeCoeurButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const heartRef = useRef<SVGSVGElement>(null);

  const handleClick = (): void => {
    // « Pop » immédiat (scale 1 → 1.15 → 1), indépendant de like/unlike.
    heartRef.current?.animate?.(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
      { duration: 180, easing: 'ease-out' },
    );
    onToggle();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? 'Retirer le coup de cœur' : 'Ajouter un coup de cœur'}
      className={`inline-flex items-center gap-2 text-sm transition-colors duration-base [&_svg]:size-5 ${
        active ? 'font-medium' : 'text-muted-foreground hover:text-foreground'
      }`}
      style={active ? { color: LIKE } : undefined}
    >
      {/* Cœur : rempli + coloré quand actif (le style inline gagne sur `fill=none`). */}
      <Heart ref={heartRef} aria-hidden style={active ? { fill: LIKE } : undefined} />
      <span>Coup de cœur</span>
    </button>
  );
}
