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
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Star, X } from 'lucide-react';
import type { EventActor, Project, ProjectZone, UploadedMedia } from '@phenix360/core';
import { demo } from '../../store';
import { mediaUploader } from '../../lib/media';

interface Pick {
  key: string;
  media: UploadedMedia;
}

/**
 * Partager un Moment — une OU plusieurs photos (album). Upload RÉEL (aperçu
 * immédiat). On peut réordonner simplement (← →), choisir la couverture (★) et
 * retirer une photo. La 1ʳᵉ photo est couverture par défaut. Le titre et la
 * légende restent au niveau du Moment ; la localisation est optionnelle.
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
  const [picks, setPicks] = useState<Pick[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [legende, setLegende] = useState('');
  const [zone, setZone] = useState('');

  const onPick = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => mediaUploader(f)));
      const next = uploaded.map((media) => ({ key: crypto.randomUUID(), media }));
      setPicks((p) => {
        const merged = [...p, ...next];
        return merged;
      });
      setCoverKey((c) => c ?? next[0]?.key ?? null);
    } finally {
      setBusy(false);
    }
  };

  const move = (key: string, dir: -1 | 1): void => {
    setPicks((p) => {
      const i = p.findIndex((x) => x.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  };

  const remove = (key: string): void => {
    setPicks((p) => p.filter((x) => x.key !== key));
    setCoverKey((c) => (c === key ? null : c));
  };

  const publish = (): void => {
    if (picks.length === 0 || !title.trim()) return;
    const coverIndex = Math.max(
      0,
      picks.findIndex((p) => p.key === coverKey),
    );
    demo.addMoment({
      projectId: project.id,
      actor,
      title,
      medias: picks.map((p) => p.media),
      coverIndex,
      ...(zone ? { zoneId: zones.find((z) => z.id === zone)?.id } : {}),
      ...(legende.trim() ? { legende } : {}),
    });
    onClose();
  };

  const selectCls = 'h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground';
  const cover = coverKey ?? picks[0]?.key ?? null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Partager un moment</DialogTitle>
          <DialogDescription>
            Partagez une ou plusieurs photos de l’avancement avec votre client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Aperçus + ajout */}
          {picks.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {picks.map((p, i) => {
                const isCover = p.key === cover;
                return (
                  <div
                    key={p.key}
                    className={`group relative aspect-square overflow-hidden rounded-lg border ${
                      isCover ? 'border-gold-400 ring-1 ring-gold-300' : 'border-border'
                    }`}
                  >
                    <img src={p.media.imageUrl} alt="Aperçu" className="size-full object-cover" />
                    {isCover && (
                      <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-gold-600 px-1.5 py-0.5 text-[0.625rem] font-medium text-primary-foreground [&_svg]:size-3">
                        <Star aria-hidden className="fill-current" /> Couverture
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(p.key)}
                      aria-label="Retirer"
                      className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-ink-900/60 text-paper-0 [&_svg]:size-3.5"
                    >
                      <X aria-hidden />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-ink-900/55 px-1 py-1 text-paper-0">
                      <button
                        type="button"
                        onClick={() => move(p.key, -1)}
                        disabled={i === 0}
                        aria-label="Déplacer à gauche"
                        className="inline-flex size-6 items-center justify-center disabled:opacity-30 [&_svg]:size-4"
                      >
                        <ChevronLeft aria-hidden />
                      </button>
                      {!isCover && (
                        <button
                          type="button"
                          onClick={() => setCoverKey(p.key)}
                          aria-label="Définir comme couverture"
                          className="inline-flex size-6 items-center justify-center [&_svg]:size-4"
                        >
                          <Star aria-hidden />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => move(p.key, 1)}
                        disabled={i === picks.length - 1}
                        aria-label="Déplacer à droite"
                        className="inline-flex size-6 items-center justify-center disabled:opacity-30 [&_svg]:size-4"
                      >
                        <ChevronRight aria-hidden />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <label className="block">
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => void onPick(e.target.files)}
            />
            <span
              className={`flex w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-paper-50 text-muted-foreground transition-colors duration-base hover:border-gold-300 hover:text-foreground ${
                picks.length > 0 ? 'py-4' : 'aspect-[4/5]'
              }`}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2 text-sm [&_svg]:size-5 [&_svg]:animate-spin">
                  <Loader2 aria-hidden /> Traitement…
                </span>
              ) : (
                <span className="inline-flex flex-col items-center gap-2 text-sm [&_svg]:size-7">
                  <ImagePlus aria-hidden />
                  {picks.length > 0 ? 'Ajouter des photos' : 'Choisir des photos'}
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

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              {picks.length > 0
                ? `${picks.length} photo${picks.length > 1 ? 's' : ''}`
                : 'Aucune photo'}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={publish} disabled={picks.length === 0 || !title.trim()}>
                Partager
              </Button>
            </div>
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
