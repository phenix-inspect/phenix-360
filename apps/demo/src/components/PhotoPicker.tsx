import { useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import type { UploadedMedia } from '@phenix360/core';
import { ACCEPT_IMAGE, loadPhotos } from '../lib/media';

/**
 * Sélecteur de PHOTOS réutilisable (0 à `max`, défaut 3) — prise directe ou choix
 * dans la galerie (sélecteur natif `image/*`, sans `capture`). Utilisé par la
 * demande client et la réponse conducteur. Présentation seule : l'appelant tient
 * la liste. Aucune photo n'est obligatoire.
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
  const fileRef = useRef<HTMLInputElement | null>(null);

  const add = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    const room = max - photos.length;
    if (room <= 0) return;
    setBusy(true);
    try {
      const { media, error } = await loadPhotos(Array.from(files).slice(0, room));
      setPhotoError(error);
      onChange([...photos, ...media].slice(0, max));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_IMAGE}
          multiple
          className="sr-only"
          onChange={(e) => void add(e.target.files)}
        />
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
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
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
          </button>
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
