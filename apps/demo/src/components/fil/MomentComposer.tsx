import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@phenix360/ui';
import { ImagePlus, Loader2 } from 'lucide-react';
import type { EventActor, Project, ProjectZone, UploadedMedia } from '@phenix360/core';
import { demo } from '../../store';
import { mediaUploader } from '../../lib/media';

/**
 * Ajout d'un Moment (brique 1 : une photo, prêt pour l'album). Upload RÉEL :
 * la vraie image s'affiche immédiatement. Le titre est le cœur du Moment ; la
 * localisation est optionnelle.
 */
export function MomentComposer({
  project,
  actor,
  zones,
  onClose,
}: {
  project: Project;
  actor: EventActor;
  zones: ProjectZone[];
  onClose: () => void;
}): React.JSX.Element {
  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [legende, setLegende] = useState('');
  const [zone, setZone] = useState('');

  const onPick = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setBusy(true);
    try {
      setMedia(await mediaUploader(file));
    } finally {
      setBusy(false);
    }
  };

  const publish = (): void => {
    if (!media || !title.trim()) return;
    demo.addMoment({
      projectId: project.id,
      actor,
      title,
      media,
      ...(zone ? { zoneId: zones.find((z) => z.id === zone)?.id } : {}),
      ...(legende.trim() ? { legende } : {}),
    });
    onClose();
  };

  const selectCls = 'h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Partager un moment</DialogTitle>
          <DialogDescription>
            Partagez une photo de l’avancement avec votre client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sélecteur / aperçu photo */}
          <label className="block">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void onPick(e.target.files?.[0])}
            />
            <span className="flex aspect-[4/5] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-paper-50 text-muted-foreground transition-colors duration-base hover:border-gold-300 hover:text-foreground">
              {busy ? (
                <span className="inline-flex items-center gap-2 text-sm [&_svg]:size-5 [&_svg]:animate-spin">
                  <Loader2 aria-hidden /> Traitement…
                </span>
              ) : media ? (
                <img src={media.imageUrl} alt="Aperçu" className="size-full object-cover" />
              ) : (
                <span className="inline-flex flex-col items-center gap-2 text-sm [&_svg]:size-7">
                  <ImagePlus aria-hidden />
                  Choisir une photo
                </span>
              )}
            </span>
          </label>

          <Field label="Titre">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Cuisine installée"
              autoFocus
            />
          </Field>

          <Field label="Légende (optionnel)">
            <Input
              value={legende}
              onChange={(e) => setLegende(e.target.value)}
              placeholder="Ex. Pose terminée ce matin"
            />
          </Field>

          <Field label="Pièce (optionnel)">
            <select value={zone} onChange={(e) => setZone(e.target.value)} className={selectCls}>
              <option value="">Aucune</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={publish} disabled={!media || !title.trim()}>
              Partager
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
