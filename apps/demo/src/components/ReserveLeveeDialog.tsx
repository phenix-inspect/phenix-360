import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@phenix360/ui';
import type { EventActor, ReserveEvent, UploadedMedia } from '@phenix360/core';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { demo } from '../store';
import { loadPhotos } from '../lib/media';
import { PhotoInput } from './PhotoInput';

/**
 * Lever une réserve — clôture PROPRE et append-only. On n'efface ni ne modifie
 * la réserve : on ajoute une note et, en option, une photo de preuve ; le
 * Journal enregistre l'action. Le conducteur reste maître (geste explicite).
 */
export function ReserveLeveeDialog({
  reserve,
  actor,
  onClose,
}: {
  reserve: ReserveEvent;
  actor: EventActor;
  onClose: () => void;
}): React.JSX.Element {
  const [note, setNote] = useState('');
  const [preuve, setPreuve] = useState<UploadedMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const onPick = async (files: File[]): Promise<void> => {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    try {
      // Validation type/taille + échec VISIBLE (jamais une rejection silencieuse).
      const { media, error } = await loadPhotos([file]);
      setPhotoError(error);
      if (media[0]) setPreuve(media[0]);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (): Promise<void> => {
    // Verrou anti double-clic : « Lever la réserve » lance une mutation append-only.
    // Sans ce garde, un double-clic créait DEUX événements de levée pour une réserve.
    if (busy) return;
    setBusy(true);
    try {
      await demo.leverReserve(reserve.projectId, reserve.id, actor, {
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(preuve ? { preuve } : {}),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lever la réserve n°{reserve.content.numero}</DialogTitle>
          <DialogDescription>{reserve.content.libelle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Note de levée (optionnel)</span>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex. Prise déplacée et reprise validée sur place."
              rows={3}
              autoFocus
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Photo de preuve (optionnel)</span>
            {preuve ? (
              <div className="relative w-40 overflow-hidden rounded-lg border border-border">
                <img
                  src={preuve.imageUrl}
                  alt="Preuve de levée"
                  className="aspect-[4/3] w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPreuve(null)}
                  aria-label="Retirer la preuve"
                  className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-ink-900/60 text-paper-0 [&_svg]:size-3.5"
                >
                  <X aria-hidden />
                </button>
              </div>
            ) : (
              <PhotoInput
                onFiles={onPick}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-paper-50 py-4 text-sm text-muted-foreground transition-colors duration-base hover:border-gold-300 hover:text-foreground [&_svg]:size-5"
              >
                {busy ? (
                  <>
                    <Loader2 aria-hidden className="animate-spin" /> Traitement…
                  </>
                ) : (
                  <>
                    <ImagePlus aria-hidden /> Ajouter une photo de preuve
                  </>
                )}
              </PhotoInput>
            )}
            {photoError && (
              <p role="alert" className="text-sm text-destructive">
                {photoError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              Lever la réserve
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
