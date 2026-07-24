import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@phenix360/ui';
import type { FilPhoto } from '@phenix360/core';
import { warmGradient } from '../gradient';

/**
 * Image d'un Moment : la vraie photo si elle existe (upload réel), sinon une
 * tuile dégradée premium (jamais une image cassée). Remplit son parent — c'est
 * le parent qui fixe le cadre (ratio).
 */
export function FilImage({
  photo,
  className,
}: {
  photo: FilPhoto;
  className?: string;
}): React.JSX.Element {
  if (photo.imageUrl) {
    return (
      <img
        src={photo.imageUrl}
        alt={photo.legende ?? 'Photo du chantier'}
        className={cn('size-full object-cover', className)}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={cn('relative isolate size-full', className)}
      style={warmGradient(photo.id)}
      role="img"
      aria-label={photo.legende ?? 'Photo du chantier'}
    >
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center text-paper-0 [&_svg]:size-14"
        style={{ opacity: 0.18 }}
      >
        <ImageIcon />
      </span>
    </div>
  );
}
