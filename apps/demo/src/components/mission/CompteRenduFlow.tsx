import { useRef, useState } from 'react';
import { Button } from '@phenix360/ui';
import {
  DIFFUSION_LABEL,
  PROJECT_STEPS,
  PROJECT_STEP_LABEL,
  type Diffusion,
  type EventActor,
  type Project,
  type ProjectStep,
  type UploadedMedia,
} from '@phenix360/core';
import { Camera, Check, ImagePlus, Trash2, X } from 'lucide-react';
import { demo } from '../../store';
import { ACCEPT_IMAGE, mediaUploader } from '../../lib/media';

interface DraftPoint {
  media: UploadedMedia;
  comment: string;
  diffusion: Diffusion;
}

const DIFFUSIONS: Diffusion[] = ['client', 'artisan', 'both'];

/**
 * Compte rendu de chantier — la mission fusionnée (visite + réunion). Le conducteur
 * ne « crée pas une réunion » : il raconte ce qu'il vient de constater, point par
 * point. Un point = 1 photo (obligatoire) + 1 commentaire (obligatoire) + 1 cible de
 * diffusion (client / artisan / les deux). Objectif UX : photographier, écrire une
 * phrase, choisir la cible, passer au point suivant. Aucune complexité superflue.
 */
export function CompteRenduFlow({
  project,
  actor,
  onClose,
}: {
  project: Project;
  actor: EventActor;
  onClose: () => void;
}): React.JSX.Element {
  const [points, setPoints] = useState<DraftPoint[]>([]);
  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [comment, setComment] = useState('');
  const [diffusion, setDiffusion] = useState<Diffusion>('client');
  const [etape, setEtape] = useState<ProjectStep | ''>('');
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pickPhoto = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setBusy(true);
    try {
      setMedia(await mediaUploader(file));
    } finally {
      setBusy(false);
    }
  };

  const canAdd = media != null && comment.trim().length > 0;
  const addPoint = (): void => {
    if (!canAdd || !media) return;
    setPoints((ps) => [...ps, { media, comment: comment.trim(), diffusion }]);
    setMedia(null);
    setComment('');
    setDiffusion('client');
    if (fileRef.current) fileRef.current.value = '';
  };

  const removePoint = (i: number): void => setPoints((ps) => ps.filter((_, idx) => idx !== i));

  const publish = async (): Promise<void> => {
    if (points.length === 0 || publishing) return;
    setPublishing(true);
    try {
      await demo.createCompteRendu(project.id, actor, {
        points: points.map((p) => ({
          imageUrl: p.media.imageUrl,
          bucket: p.media.bucket,
          storagePath: p.media.storagePath,
          comment: p.comment,
          diffusion: p.diffusion,
        })),
        ...(etape ? { etapeConfirmee: etape } : {}),
      });
      setDone(true);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground [&_svg]:size-5"
        >
          <X aria-hidden />
        </button>
        <div className="min-w-0">
          <p className="font-serif text-lg font-semibold text-foreground">
            Compte rendu de chantier
          </p>
          <p className="text-xs text-muted-foreground">
            {done ? 'Compte rendu publié' : 'Une photo, une phrase, une cible — point par point.'}
          </p>
        </div>
      </header>

      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success text-success-foreground [&_svg]:size-8">
            <Check aria-hidden />
          </span>
          <div>
            <p className="font-serif text-xl font-semibold text-foreground">Compte rendu publié</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {points.length} point{points.length > 1 ? 's' : ''} · chaque destinataire ne verra que
              ce qui le concerne.
            </p>
          </div>
          <Button size="lg" onClick={onClose}>
            Terminer
          </Button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            {/* Points déjà ajoutés (aperçu chronologique). */}
            {points.length > 0 && (
              <ol className="space-y-3">
                {points.map((p, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm"
                  >
                    <img
                      src={p.media.imageUrl}
                      alt=""
                      className="size-16 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{p.comment}</p>
                      <span className="mt-1 inline-flex items-center rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-800">
                        {DIFFUSION_LABEL[p.diffusion]}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePoint(i)}
                      aria-label={`Retirer le point ${i + 1}`}
                      className="self-start text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4"
                    >
                      <Trash2 aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {/* Nouveau point : photo → commentaire → cible. */}
            <section className="space-y-3 rounded-2xl border border-dashed border-border p-4">
              <p className="text-sm font-medium text-foreground">
                Nouveau point{points.length > 0 ? ` (${points.length + 1})` : ''}
              </p>

              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT_IMAGE}
                className="sr-only"
                onChange={(e) => void pickPhoto(e.target.files?.[0])}
              />
              {media ? (
                <div className="relative overflow-hidden rounded-xl">
                  <img src={media.imageUrl} alt="" className="max-h-64 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setMedia(null);
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    aria-label="Changer la photo"
                    className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-ink-900/70 px-3 py-1.5 text-xs text-paper-0 [&_svg]:size-3.5"
                  >
                    <ImagePlus aria-hidden />
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 [&_svg]:size-8"
                >
                  <Camera aria-hidden />
                  <span className="text-sm font-medium">
                    {busy ? 'Chargement…' : 'Ajouter une photo'}
                  </span>
                </button>
              )}

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Décrivez ce point (ex. « Le carrelage est terminé. »)"
                rows={2}
                className="w-full resize-none rounded-xl border border-input bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
              />

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Diffusion</p>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFUSIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiffusion(d)}
                      aria-pressed={diffusion === d}
                      className={`rounded-xl border px-2 py-2 text-sm font-medium transition-colors ${
                        diffusion === d
                          ? 'border-gold-400 bg-gold-50 text-gold-800'
                          : 'border-input bg-surface text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {DIFFUSION_LABEL[d]}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full" disabled={!canAdd} onClick={addPoint}>
                Ajouter ce point
              </Button>
            </section>

            {/* Avancement facultatif : l'étape reste portée par le compte rendu. */}
            <section className="space-y-1.5">
              <label htmlFor="cr-etape" className="text-xs font-medium text-muted-foreground">
                Étape franchie (facultatif)
              </label>
              <select
                id="cr-etape"
                value={etape}
                onChange={(e) => setEtape((e.target.value as ProjectStep) || '')}
                className="h-10 w-full rounded-xl border border-input bg-surface px-3 text-sm text-foreground"
              >
                <option value="">Ne pas changer l’avancement</option>
                {PROJECT_STEPS.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STEP_LABEL[s]}
                  </option>
                ))}
              </select>
            </section>
          </div>

          <footer className="border-t border-border p-4">
            <Button
              size="lg"
              className="w-full"
              disabled={points.length === 0 || publishing}
              onClick={() => void publish()}
            >
              {publishing
                ? 'Publication…'
                : `Publier le compte rendu${points.length > 0 ? ` (${points.length})` : ''}`}
            </Button>
          </footer>
        </>
      )}
    </div>
  );
}
