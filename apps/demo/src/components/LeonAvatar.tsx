import { useState } from 'react';
import { MessageCircle } from 'lucide-react';

/**
 * LEON — le visage de PHÉNIX. Léon Le Bricolo est l'avatar officiel du concierge :
 * bouton flottant, en-tête, chaque bulle, reprises. Le MÊME avatar partout →
 * identité cohérente (le conducteur comme le client parlent à Léon).
 *
 * L'image est servie depuis `apps/demo/public/leon.png`. On la résout via
 * `import.meta.env.BASE_URL` : indispensable sous un sous-chemin (GitHub Pages
 * sert la démo sous `/phenix-360/`, où un chemin racine `/leon.png` renverrait un
 * 404). Repli NEUTRE (bulle de conversation) si l'image manque — jamais un casque
 * de chantier (qui ne représente pas l'assistant), jamais une étoile.
 */
const LEON_SRC = `${import.meta.env.BASE_URL}leon.png`;

export function LeonAvatar({ className }: { className?: string }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-ink-900 text-gold-300 ${
        className ?? 'size-7'
      }`}
    >
      {failed ? (
        <MessageCircle aria-hidden className="size-[55%]" />
      ) : (
        <img
          src={LEON_SRC}
          alt="Léon, l’assistant PHÉNIX"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
    </span>
  );
}
