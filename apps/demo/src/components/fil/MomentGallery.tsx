import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Moment } from '@phenix360/core';
import { FilImage } from './FilImage';

/**
 * Galerie immersive d'un album : plein écran, navigation fluide (flèches,
 * clavier, swipe), compteur et légende par photo. Premium et mobile-friendly.
 * Pas de message par photo à ce stade (brique suivante).
 */
export function MomentGallery({
  moment,
  onClose,
}: {
  moment: Moment;
  onClose: () => void;
}): React.JSX.Element {
  const photos = [...moment.photos].sort((a, b) => a.ordre - b.ordre);
  const start = Math.max(
    0,
    photos.findIndex((p) => p.id === moment.coverPhotoId),
  );
  const [index, setIndex] = useState(start);
  const touchX = useRef<number | null>(null);

  const total = photos.length;
  const go = (dir: -1 | 1): void => setIndex((i) => Math.min(total - 1, Math.max(0, i + dir)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const current = photos[index];
  if (!current) return <></>;

  return (
    <div
      className="fixed inset-0 z-modal flex flex-col"
      style={{ backgroundColor: 'rgba(19,16,9,0.985)' }}
      role="dialog"
      aria-modal="true"
      aria-label={moment.title}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      {/* Barre haute : titre + compteur + fermer */}
      <div className="flex items-center justify-between gap-3 p-4 text-paper-0">
        <div className="min-w-0">
          <p className="truncate font-serif text-lg font-semibold tracking-tight">{moment.title}</p>
          <p className="text-xs opacity-80">
            {index + 1} / {total}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-paper-0 transition-colors duration-base hover:bg-paper-0/10 [&_svg]:size-5"
        >
          <X aria-hidden />
        </button>
      </div>

      {/* Image */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2">
        <div className="relative max-h-full w-full max-w-3xl">
          <div className="mx-auto aspect-[4/5] max-h-[72vh] w-full overflow-hidden rounded-xl">
            <FilImage photo={current} />
          </div>
        </div>

        {index > 0 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Photo précédente"
            className="absolute left-3 inline-flex size-11 items-center justify-center rounded-full bg-paper-0/10 text-paper-0 transition-colors duration-base hover:bg-paper-0/20 [&_svg]:size-6"
          >
            <ChevronLeft aria-hidden />
          </button>
        )}
        {index < total - 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Photo suivante"
            className="absolute right-3 inline-flex size-11 items-center justify-center rounded-full bg-paper-0/10 text-paper-0 transition-colors duration-base hover:bg-paper-0/20 [&_svg]:size-6"
          >
            <ChevronRight aria-hidden />
          </button>
        )}
      </div>

      {/* Légende + pastilles */}
      <div className="space-y-3 p-4 text-paper-0">
        {current.legende && (
          <p className="mx-auto max-w-3xl text-center text-sm opacity-90">{current.legende}</p>
        )}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Aller à la photo ${i + 1}`}
                className={`size-1.5 rounded-full transition-colors duration-base ${
                  i === index ? 'bg-paper-0' : 'bg-paper-0/35'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
