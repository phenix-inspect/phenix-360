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
import {
  MOMENT_TYPES,
  MOMENT_TYPE_SHORT,
  type EventActor,
  type MomentType,
  type Project,
  type ProjectZone,
  type UploadedMedia,
} from '@phenix360/core';
import { demo } from '../../store';
import { mediaUploader } from '../../lib/media';

interface Pick {
  key: string;
  media: UploadedMedia;
}

/**
 * Créer un MOMENT de chantier — le geste unique du conducteur. Il ne remplit pas
 * un formulaire : il choisit ce qu'il vit (type), ajoute des photos, dit ce
 * qu'il observe, qui était présent — et décide s'il le partage au client. Le
 * Moment est INTERNE par défaut : « privé par défaut → Partager → Espace client ».
 * Tout le reste (document, CR, réserve, historique) en découlera.
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
  const [type, setType] = useState<MomentType>('etape');
  const [picks, setPicks] = useState<Pick[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [observations, setObservations] = useState('');
  const [intervenants, setIntervenants] = useState<string[]>([]);
  const [intervenantDraft, setIntervenantDraft] = useState('');
  const [zone, setZone] = useState('');
  const [share, setShare] = useState(false);

  const onPick = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => mediaUploader(f)));
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

  const addIntervenant = (): void => {
    const v = intervenantDraft.trim();
    if (!v) return;
    setIntervenants((list) => (list.includes(v) ? list : [...list, v]));
    setIntervenantDraft('');
  };

  const create = (): void => {
    if (picks.length === 0 || !title.trim()) return;
    const coverIndex = Math.max(
      0,
      picks.findIndex((p) => p.key === coverKey),
    );
    demo.addMoment({
      projectId: project.id,
      actor,
      type,
      title,
      medias: picks.map((p) => p.media),
      coverIndex,
      shareWithClient: share,
      ...(zone ? { zoneId: zones.find((z) => z.id === zone)?.id } : {}),
      ...(observations.trim() ? { observations } : {}),
      ...(intervenants.length ? { intervenants } : {}),
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
            Vous vivez votre chantier — PHÉNIX en fait un document. Ce moment reste interne tant que
            vous ne le partagez pas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type de moment — groupe de boutons (jamais dans un <label>) */}
          <Group label="Type de moment">
            <div className="flex flex-wrap gap-2">
              {MOMENT_TYPES.map((t) => {
                const active = t === type;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setType(t)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? 'border-gold-400 bg-gold-100 font-medium text-gold-800'
                        : 'border-border bg-surface text-muted-foreground hover:border-gold-300 hover:text-foreground'
                    }`}
                  >
                    {MOMENT_TYPE_SHORT[t]}
                  </button>
                );
              })}
            </div>
          </Group>

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
              placeholder="Ex. Réunion de chantier hebdomadaire"
              autoFocus
            />
          </Field>

          <Field label="Observations (optionnel)">
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              placeholder="Ce que vous avez constaté sur place…"
              className="min-h-[4.5rem] resize-y rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
            />
          </Field>

          <Group label="Intervenants présents (optionnel)">
            <div className="space-y-2">
              {intervenants.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {intervenants.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => setIntervenants((l) => l.filter((x) => x !== name))}
                        aria-label={`Retirer ${name}`}
                        className="text-muted-foreground hover:text-foreground [&_svg]:size-3"
                      >
                        <X aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={intervenantDraft}
                  onChange={(e) => setIntervenantDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addIntervenant();
                    }
                  }}
                  placeholder="Ex. Plombier, Électricien…"
                />
                <Button
                  variant="ghost"
                  onClick={addIntervenant}
                  disabled={!intervenantDraft.trim()}
                >
                  Ajouter
                </Button>
              </div>
            </div>
          </Group>

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

          {/* Partage — une ACTION, pas un objet : bascule l'audience du Moment. */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-paper-50 p-3">
            <input
              type="checkbox"
              checked={share}
              onChange={(e) => setShare(e.target.checked)}
              className="mt-0.5 size-4 accent-gold-600"
            />
            <span className="text-sm leading-snug">
              <span className="font-medium text-foreground">Partager avec le client</span>
              <span className="block text-xs text-muted-foreground">
                {share
                  ? 'Ce moment apparaîtra dans l’espace client.'
                  : 'Ce moment reste interne. Vous pourrez le partager plus tard.'}
              </span>
            </span>
          </label>

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
              <Button onClick={create} disabled={picks.length === 0 || !title.trim()}>
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

/**
 * Comme Field mais SANS <label> : à utiliser dès que le groupe contient des
 * boutons (un <label> qui enveloppe des boutons casse leur nom accessible et
 * détourne le clic vers le champ associé).
 */
function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
