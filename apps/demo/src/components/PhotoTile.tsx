import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@phenix360/ui';
import type { PhotoEvent } from '@phenix360/core';
import { warmGradient } from './gradient';

/**
 * Tuile photo ÉDITORIALE : en l'absence de vraie image, un dégradé chaud
 * déterministe + glyphe filigrane + légende, qui se lit comme une photo
 * intentionnelle (pas une image cassée). Prête à recevoir un vrai `src` ensuite.
 */
export function PhotoTile({
  photo,
  size = 'hero',
  className,
}: {
  photo: PhotoEvent;
  size?: 'hero' | 'thumb';
  className?: string;
}): React.JSX.Element {
  const attachment = photo.content.attachment;
  const seed = attachment.id;
  const dataUrl = attachment.dataUrl;
  const legende = photo.content.legende;
  const piece = photo.content.piece;
  const hero = size === 'hero';

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden',
        hero ? 'aspect-[4/3] rounded-xl' : 'aspect-square rounded-lg',
        className,
      )}
      style={dataUrl ? undefined : warmGradient(seed)}
      role="img"
      aria-label={legende ?? 'Photo du chantier'}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={legende ?? 'Photo du chantier'}
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 flex items-center justify-center text-paper-0',
            hero ? '[&_svg]:size-14' : '[&_svg]:size-7',
          )}
          style={{ opacity: 0.18 }}
        >
          <ImageIcon />
        </span>
      )}

      {hero && (piece != null || legende != null) && (
        <div
          className="absolute inset-x-0 bottom-0 p-4 text-paper-0"
          style={{
            backgroundImage: 'linear-gradient(to top, rgba(19,16,9,0.55), rgba(19,16,9,0))',
          }}
        >
          {piece != null && (
            <span
              className="mb-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium tracking-wide text-paper-0"
              style={{ backgroundColor: 'rgba(252,250,246,0.18)' }}
            >
              {piece}
            </span>
          )}
          {legende != null && <p className="text-sm font-medium leading-snug">{legende}</p>}
        </div>
      )}
    </div>
  );
}
