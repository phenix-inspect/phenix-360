import { useState } from 'react';
import { HardHat } from 'lucide-react';

/**
 * LEON — le visage de PHÉNIX. Léon Le Bricolo (AssistantByLeon) est l'avatar
 * officiel du concierge : bouton flottant, en-tête, chaque bulle, reprises.
 *
 * L'image est servie depuis `apps/demo/public/leon.png` (déposez-y le PNG de
 * Léon : ce composant l'affiche partout, sans autre changement). Tant que le
 * fichier n'est pas présent, un repère neutre premium s'affiche (jamais l'étoile).
 */
export function LeonAvatar({ className }: { className?: string }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-ink-900 text-gold-300 ${
        className ?? 'size-7'
      }`}
    >
      {failed ? (
        <HardHat aria-hidden className="size-[55%]" />
      ) : (
        <img
          src="/leon.png"
          alt="PHÉNIX"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
    </span>
  );
}
