import { useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import type { UploadedMedia } from '@phenix360/core';
import { loadPhotos } from '../lib/media';
import { PhotoInput } from './PhotoInput';

/**
 * Sélecteur de PHOTOS réutilisable (0 à `max`, défaut 3). L'ajout passe par le
 * composant partagé `PhotoInput` : « Prendre une photo » (appareil) ou « Choisir
 * une photo ou un fichier » (sélecteur natif). Utilisé par la demande client et la
 * réponse conducteur. Présentation seule : l'appelant tient la liste.
 */
export function PhotoPicker({
  photos,
  onChange,
  max = 3,
}: {
  photos: UploadedMedia[];
  onChange: (photos: UploadedMedia[]) => void;
  max?: number;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const add = async (files: File[]): Promise<void> => {
    const room = max - photos.length;
    if (room <= 0) return;
    setBusy(true);
    try {
      const { media, error } = await loadPhotos(files.slice(0, room));
      setPhotoError(error);
      onChange([...photos, ...media].slice(0, max));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((ph, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-xl">
            <img src={ph.imageUrl} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
              aria-label={`Retirer la photo ${i + 1}`}
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink-900/70 text-paper-0 [&_svg]:size-3.5"
            >
              <X aria-hidden />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <PhotoInput
            onFiles={add}
            multiple
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 [&_svg]:size-6"
          >
            {photos.length === 0 ? <Camera aria-hidden /> : <ImagePlus aria-hidden />}
            <span className="text-xs font-medium">
              {busy
                ? 'Chargement…'
                : photos.length === 0
                  ? 'Photo'
                  : `Ajouter (${photos.length}/${max})`}
            </span>
          </PhotoInput>
        )}
      </div>
      {photoError && (
        <p role="alert" className="text-sm text-destructive">
          {photoError}
        </p>
      )}
    </>
  );
}
