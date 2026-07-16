import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Rend ses enfants DIRECTEMENT sous `<body>`, hors de l'arbre de l'application.
 * ---------------------------------------------------------------------------
 * Indispensable pour les surfaces plein écran (`position: fixed; inset: 0`).
 * Rendues en flux dans l'app, elles héritent du contexte de leur ancêtre :
 *   • une marge d'espacement (`space-y-*` de Tailwind pose `margin-top` sur les
 *     enfants suivants) décale un overlay `fixed` vers le bas — un liseré de
 *     l'écran précédent réapparaissait alors en haut ;
 *   • un `transform`/`filter`/`contain` sur un ancêtre crée un bloc contenant
 *     qui « piège » le `fixed`, qui ne couvre plus le viewport.
 * En sortant l'overlay sous `<body>`, il se positionne toujours par rapport au
 * viewport : il recouvre l'écran entier, quoi qu'il arrive au-dessus de lui.
 */
export function Portal({ children }: { children: React.ReactNode }): React.ReactNode {
  // Garde de montage : `document.body` n'existe qu'après le premier rendu côté
  // navigateur. On ne portalise qu'une fois monté (jamais pendant le SSR).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
