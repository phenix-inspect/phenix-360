import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@phenix360/ui';
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Star, X } from 'lucide-react';
import {
  MAX_ALBUM_PHOTOS,
  type EventActor,
  type Project,
  type ProjectZone,
  type UploadedMedia,
} from '@phenix360/core';
import { demo } from '../../store';
import { ACCEPT_IMAGE, mediaUploader } from '../../lib/media';

interface Pick {
  key: string;
  media: UploadedMedia;
}

/**
 * Créer un MOMENT de chantier — l'ALBUM PHOTO des coulisses. Formulaire VOLONTAIREMENT
 * minimal (publier en moins de 20 s) : photos (jusqu'à 10), légende LIBRE et
 * optionnelle, pièce (optionnelle). Pas de titre à inventer, pas de partage à cocher
 * (une publication coulisses est TOUJOURS pour le client), pas d'intervenants (le
 * client regarde des photos, pas une feuille de présence). C'est la brique PLAISIR —
 * les livrables (CR, PV, réserves) passent par « Nouvelle mission ».
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
  // Un seul champ texte, LIBRE et OPTIONNEL : la légende (ex-« observations »).
  const [legende, setLegende] = useState('');
  const [zone, setZone] = useState('');

  const onPick = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      // Un album = 10 photos MAXIMUM : on ne prend que ce qui reste de place.
      const remaining = MAX_ALBUM_PHOTOS - picks.length;
      if (remaining <= 0) return;
      const chosen = Array.from(files).slice(0, remaining);
      const uploaded = await Promise.all(chosen.map((f) => mediaUploader(f)));
      const next = uploaded.map((media) => ({ key: crypto.randomUUID(), media }));
      setPicks((p) => [...p, ...next]);
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

  const create = (): void => {
    if (picks.length === 0) return;
    const coverIndex = Math.max(
      0,
      picks.findIndex((p) => p.key === coverKey),
    );
    demo.addMoment({
      projectId: project.id,
      actor,
      // Pas de titre à inventer : la légende (optionnelle) porte le récit. Le titre
      // du Moment reste vide — l'album se lit par ses photos + sa légende.
      title: '',
      medias: picks.map((p) => p.media),
      coverIndex,
      // Une publication « coulisses » est TOUJOURS destinée au client (brique
      // plaisir) : le conducteur n'a pas à se poser la question du partage.
      shareWithClient: true,
      ...(zone ? { zoneId: zones.find((z) => z.id === zone)?.id } : {}),
      ...(legende.trim() ? { observations: legende } : {}),
    });
    onClose();
  };

  const selectCls = 'h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground';
  const cover = coverKey ?? picks[0]?.key ?? null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un moment</DialogTitle>
          <DialogDescription>
            L’album photo de votre chantier : jusqu’à {MAX_ALBUM_PHOTOS} photos en une fois (un seul
            moment). Il est partagé avec le client dans « Dans les coulisses ».
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

          {picks.length >= MAX_ALBUM_PHOTOS ? (
            <p className="rounded-xl border border-dashed border-border bg-paper-50 px-3 py-3 text-center text-sm text-muted-foreground">
              Album complet — {MAX_ALBUM_PHOTOS} photos maximum.
            </p>
          ) : (
            <label className="block">
              <input
                type="file"
                accept={ACCEPT_IMAGE}
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
                    {picks.length > 0
                      ? `Ajouter des photos (${picks.length}/${MAX_ALBUM_PHOTOS})`
                      : 'Choisir des photos'}
                  </span>
                )}
              </span>
            </label>
          )}

          <Field label="Légende (optionnelle)">
            <textarea
              value={legende}
              onChange={(e) => setLegende(e.target.value)}
              rows={2}
              placeholder="Décrivez ce moment… (ex. La cuisine prend forme !)"
              className="min-h-[3.5rem] resize-y rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
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
                : 'Ajoutez au moins une photo'}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={create} disabled={picks.length === 0}>
                Créer le moment
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
