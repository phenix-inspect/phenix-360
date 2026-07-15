import { useEffect, useRef, useState } from 'react';
import { Button } from '@phenix360/ui';
import {
  DIFFUSION_LABEL,
  MAX_POINT_PHOTOS,
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
import { ACCEPT_IMAGE, loadPhotos } from '../../lib/media';
import { LeaveConfirmDialog, useBeforeUnloadGuard } from './LeaveGuard';

interface DraftPoint {
  photos: UploadedMedia[];
  comment: string;
  diffusion: Diffusion;
}

const DIFFUSIONS: Diffusion[] = ['client', 'artisan', 'both'];

/**
 * Compte rendu de chantier — la mission fusionnée (visite + réunion). Le conducteur
 * ne « crée pas une réunion » : il raconte ce qu'il vient de constater, point par
 * point. Un point = 1 à 3 photos (obligatoire, un mini-album) + 1 commentaire
 * (obligatoire, commun aux photos) + 1 cible de diffusion (client / artisan / les
 * deux). Objectif UX : ajouter un point → 1 à 3 photos → commentaire → cible →
 * point suivant → publier. Aucune étape inutile.
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
  const [photos, setPhotos] = useState<UploadedMedia[]>([]);
  const [comment, setComment] = useState('');
  const [diffusion, setDiffusion] = useState<Diffusion>('client');
  const [etape, setEtape] = useState<ProjectStep | ''>('');
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const addPhotos = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    const room = MAX_POINT_PHOTOS - photos.length;
    if (room <= 0) return;
    setBusy(true);
    try {
      const { media, error } = await loadPhotos(Array.from(files).slice(0, room));
      setPhotoError(error);
      setPhotos((ps) => [...ps, ...media].slice(0, MAX_POINT_PHOTOS));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const canAdd = photos.length >= 1 && comment.trim().length > 0;
  const resetDraft = (): void => {
    setPhotos([]);
    setComment('');
    setDiffusion('client');
    if (fileRef.current) fileRef.current.value = '';
  };
  const addPoint = (): void => {
    if (!canAdd) return;
    setPoints((ps) => [...ps, { photos, comment: comment.trim(), diffusion }]);
    resetDraft();
  };

  const removePoint = (i: number): void => setPoints((ps) => ps.filter((_, idx) => idx !== i));

  const publish = async (): Promise<void> => {
    // Ne JAMAIS perdre le point en cours : s'il est complet (photo + commentaire)
    // mais pas encore ajouté, on l'intègre à la publication plutôt que le jeter.
    const effectifs = canAdd ? [...points, { photos, comment: comment.trim(), diffusion }] : points;
    if (effectifs.length === 0 || publishing) return;
    setPublishing(true);
    try {
      await demo.createCompteRendu(project.id, actor, {
        points: effectifs.map((p) => ({
          photos: p.photos.map((ph) => ({
            imageUrl: ph.imageUrl,
            bucket: ph.bucket,
            storagePath: ph.storagePath,
          })),
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

  // Protection anti-perte : un point en cours (photos + commentaire) ou déjà
  // ajouté = travail non enregistré. On confirme avant de quitter (jamais après
  // publication, où tout est enregistré).
  const dirty = !done && (points.length > 0 || photos.length > 0 || comment.trim().length > 0);
  useBeforeUnloadGuard(dirty);
  const requestClose = (): void => {
    if (dirty) setConfirmLeave(true);
    else onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // Quand la confirmation est ouverte, Échap la referme (géré par le Dialog) —
      // on ne réagit pas ici pour ne pas la rouvrir aussitôt.
      if (e.key === 'Escape' && !confirmLeave) requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, confirmLeave]);

  return (
    <div className="fixed inset-0 z-modal flex flex-col bg-background">
      <LeaveConfirmDialog
        open={confirmLeave}
        onCancel={() => setConfirmLeave(false)}
        onLeave={onClose}
      />
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <button
          type="button"
          onClick={requestClose}
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
            {done ? 'Compte rendu publié' : 'Des photos, une phrase, une cible — point par point.'}
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
            {/* Points déjà ajoutés (aperçu chronologique, mini-album par point). */}
            {points.length > 0 && (
              <ol className="space-y-3">
                {points.map((p, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm"
                  >
                    <div className="flex shrink-0 gap-1">
                      {p.photos.map((ph, j) => (
                        <img
                          key={j}
                          src={ph.imageUrl}
                          alt=""
                          className="size-14 rounded-lg object-cover"
                        />
                      ))}
                    </div>
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

            {/* Nouveau point : 1 à 3 photos → commentaire → cible. */}
            <section className="space-y-3 rounded-2xl border border-dashed border-border p-4">
              <p className="text-sm font-medium text-foreground">
                Nouveau point{points.length > 0 ? ` (${points.length + 1})` : ''}
              </p>

              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT_IMAGE}
                multiple
                className="sr-only"
                onChange={(e) => void addPhotos(e.target.files)}
              />

              {/* Mini-album du point en cours (jusqu'à 3 photos). */}
              <div className="grid grid-cols-3 gap-2">
                {photos.map((ph, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-xl">
                    <img src={ph.imageUrl} alt="" className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((ps) => ps.filter((_, idx) => idx !== i))}
                      aria-label={`Retirer la photo ${i + 1}`}
                      className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink-900/70 text-paper-0 [&_svg]:size-3.5"
                    >
                      <X aria-hidden />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_POINT_PHOTOS && (
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
                          : `Ajouter (${photos.length}/${MAX_POINT_PHOTOS})`}
                    </span>
                  </button>
                )}
              </div>
              {photoError && (
                <p role="alert" className="text-sm text-destructive">
                  {photoError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                1 à {MAX_POINT_PHOTOS} photos — prise directe ou choix dans la galerie. Le
                commentaire concerne l’ensemble des photos.
              </p>

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
            {(() => {
              // Le point en cours complet compte dans le total publiable (il sera
              // intégré à la publication) → le bouton reflète la réalité de l'écran.
              const total = points.length + (canAdd ? 1 : 0);
              return (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={total === 0 || publishing}
                  onClick={() => void publish()}
                >
                  {publishing
                    ? 'Publication…'
                    : `Publier le compte rendu${total > 0 ? ` (${total})` : ''}`}
                </Button>
              );
            })()}
          </footer>
        </>
      )}
    </div>
  );
}
