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
import {
  MISSION_LABEL,
  buildCorps,
  prepareMission,
  type EventActor,
  type MissionKind,
  type MissionPreparation,
  type Project,
  type ProjectZone,
  type UploadedMedia,
} from '@phenix360/core';
import { Check, ImagePlus, Loader2, Send, Sparkles, Trash2, X } from 'lucide-react';
import { demo } from '../../store';
import { mediaUploader } from '../../lib/media';

type Step = 'capture' | 'validation' | 'share';

interface Pick {
  key: string;
  media: UploadedMedia;
}

const AUDIENCES: { id: string; label: string }[] = [
  { id: 'client', label: 'Client' },
  { id: 'artisan', label: 'Artisan' },
  { id: 'architecte', label: 'Architecte' },
  { id: 'bc', label: 'Bureau de contrôle' },
  { id: 'investisseur', label: 'Investisseur' },
  { id: 'moe', label: 'Maître d’œuvre' },
];

/**
 * Le fil complet d'une mission : le conducteur montre et parle (capture) ;
 * PHÉNIX prépare ; le conducteur relit, corrige, valide ; puis partage s'il le
 * décide. Privé par défaut. Rien ne part sans validation. Aucune rédaction.
 */
export function MissionFlow({
  kind,
  project,
  actor,
  zones,
  onClose,
}: {
  kind: MissionKind;
  project: Project;
  actor: EventActor;
  zones: ProjectZone[];
  onClose: () => void;
}): React.JSX.Element {
  const [step, setStep] = useState<Step>('capture');
  const [busy, setBusy] = useState(false);

  // Capture
  const [picks, setPicks] = useState<Pick[]>([]);
  const [recit, setRecit] = useState('');
  const [presents, setPresents] = useState<string[]>([]);
  const [presentDraft, setPresentDraft] = useState('');
  const [zone, setZone] = useState('');

  // Préparation (éditable)
  const [prep, setPrep] = useState<MissionPreparation | null>(null);

  // Partage
  const [audiences, setAudiences] = useState<string[]>([]);
  const [shared, setShared] = useState<string[] | null>(null);

  const onPick = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => mediaUploader(f)));
      setPicks((p) => [...p, ...uploaded.map((media) => ({ key: crypto.randomUUID(), media }))]);
    } finally {
      setBusy(false);
    }
  };

  const addPresent = (): void => {
    const v = presentDraft.trim();
    if (!v) return;
    setPresents((l) => (l.includes(v) ? l : [...l, v]));
    setPresentDraft('');
  };

  const runPhenix = (): void => {
    const prepared = prepareMission({
      kind,
      recit,
      presents,
      photoIds: [],
    });
    setPrep(prepared);
    setStep('validation');
  };

  const validate = async (): Promise<void> => {
    if (!prep || busy) return;
    setBusy(true);
    try {
      const corps = buildCorps({
        kind,
        docTitre: prep.docTitre,
        observations: prep.observations,
        presents: prep.presents,
        decisions: prep.decisions,
        actions: prep.actions,
        reserves: prep.reserves,
        manquants: prep.manquants,
      });
      await demo.createMission(project.id, actor, {
        kind,
        medias: picks.map((p) => p.media),
        recit,
        presents: prep.presents,
        ...(zone ? { zoneId: zones.find((z) => z.id === zone)?.id } : {}),
        prepared: { ...prep, corps },
      });
      setStep('share');
    } finally {
      setBusy(false);
    }
  };

  const share = async (): Promise<void> => {
    if (!prep || audiences.length === 0 || busy) return;
    setBusy(true);
    try {
      // On retrouve la mission qu'on vient de créer (le dernier compte rendu interne).
      const missionEvent = demo
        .getSnapshot()
        .events.filter(
          (e) =>
            e.projectId === project.id && e.type === 'compte_rendu' && e.visibility === 'interne',
        )
        .at(-1);
      const map = demo.getSnapshot().fil.moments[project.id] ?? [];
      const momentId = map.at(-1)?.id ?? '';
      if (missionEvent) {
        await demo.shareMission(project.id, actor, {
          missionEventId: missionEvent.id,
          momentId,
          audiences,
          texteClient: prep.texteClient,
          docTitre: prep.docTitre,
        });
        setShared(audiences);
      }
    } finally {
      setBusy(false);
    }
  };

  const selectCls = 'h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{MISSION_LABEL[kind]}</DialogTitle>
          <DialogDescription>
            {step === 'capture'
              ? 'Montrez et parlez. PHÉNIX prépare le reste — vous ne rédigez rien.'
              : step === 'validation'
                ? 'Voici ce que PHÉNIX a préparé. Relisez, corrigez, validez.'
                : 'Enregistré dans le Journal. Vous pouvez partager si vous le décidez.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'capture' && (
          <div className="space-y-4">
            {picks.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {picks.map((p) => (
                  <div
                    key={p.key}
                    className="relative aspect-square overflow-hidden rounded-lg border border-border"
                  >
                    <img src={p.media.imageUrl} alt="Aperçu" className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPicks((x) => x.filter((y) => y.key !== p.key))}
                      aria-label="Retirer"
                      className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-ink-900/60 text-paper-0 [&_svg]:size-3.5"
                    >
                      <X aria-hidden />
                    </button>
                  </div>
                ))}
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
              <span className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-paper-50 py-4 text-sm text-muted-foreground transition-colors duration-base hover:border-gold-300 hover:text-foreground [&_svg]:size-5">
                {busy ? (
                  <>
                    <Loader2 aria-hidden className="animate-spin" /> Traitement…
                  </>
                ) : (
                  <>
                    <ImagePlus aria-hidden /> Ajouter des photos
                  </>
                )}
              </span>
            </label>

            <Field label="Qu'est-ce qui s'est passé ?">
              <textarea
                value={recit}
                onChange={(e) => setRecit(e.target.value)}
                rows={4}
                placeholder="Racontez ce que vous avez vu, décidé, constaté…"
                className="min-h-[6rem] resize-y rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
                autoFocus
              />
            </Field>

            <Group label="Présents (optionnel)">
              {presents.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {presents.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => setPresents((l) => l.filter((x) => x !== name))}
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
                  value={presentDraft}
                  onChange={(e) => setPresentDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPresent();
                    }
                  }}
                  placeholder="Ex. Plombier, Architecte…"
                />
                <Button variant="ghost" onClick={addPresent} disabled={!presentDraft.trim()}>
                  Ajouter
                </Button>
              </div>
            </Group>

            <Group label="Pièce / zone (optionnel)">
              <select value={zone} onChange={(e) => setZone(e.target.value)} className={selectCls}>
                <option value="">Aucune</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </select>
            </Group>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={runPhenix} disabled={!recit.trim() && picks.length === 0}>
                <Sparkles aria-hidden /> PHÉNIX prépare
              </Button>
            </div>
          </div>
        )}

        {step === 'validation' && prep && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">{prep.docTitre}</p>

            {prep.presents.length > 0 && (
              <EditList
                label="Présents"
                items={prep.presents}
                onChange={(items) => setPrep({ ...prep, presents: items })}
              />
            )}
            {prep.decisions.length > 0 && (
              <EditList
                label="Décisions"
                items={prep.decisions}
                onChange={(items) => setPrep({ ...prep, decisions: items })}
              />
            )}
            {prep.actions.length > 0 && (
              <EditList
                label="Actions à suivre"
                items={prep.actions.map((a) => a.label)}
                onChange={(items) =>
                  setPrep({ ...prep, actions: items.map((label) => ({ label })) })
                }
              />
            )}
            {prep.manquants.length > 0 && (
              <EditList
                label="Manquants / dommages"
                items={prep.manquants}
                onChange={(items) => setPrep({ ...prep, manquants: items })}
              />
            )}
            {prep.reserves.length > 0 && (
              <EditList
                label="Réserves / points à reprendre"
                items={prep.reserves.map((r) => r.libelle)}
                onChange={(items) =>
                  setPrep({
                    ...prep,
                    reserves: items.map((libelle, i) => ({
                      libelle,
                      ...(prep.reserves[i]?.photoId ? { photoId: prep.reserves[i]!.photoId } : {}),
                    })),
                  })
                }
              />
            )}

            {prep.observations.length > 0 && (
              <Group label="Observations">
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {prep.observations.map((o, i) => (
                    <li key={i}>• {o}</li>
                  ))}
                </ul>
              </Group>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setStep('capture')}>
                Retour
              </Button>
              <Button onClick={() => void validate()} disabled={busy}>
                <Check aria-hidden /> Valider
              </Button>
            </div>
          </div>
        )}

        {step === 'share' && prep && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-gold-200 bg-gold-50 p-3 text-sm text-foreground [&_svg]:size-4 [&_svg]:text-gold-700">
              <Check aria-hidden />
              Enregistré dans le Journal — privé, tant que vous ne partagez pas.
            </div>

            <MissionDoc prep={prep} project={project} />

            {shared ? (
              <div className="rounded-xl border border-border bg-surface p-3 text-sm text-foreground">
                Partagé (aperçu) à : <strong>{sharedLabels(shared)}</strong>.
                {shared.includes('client') && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Le client voit une version simplifiée, sans aucune donnée interne.
                  </span>
                )}
              </div>
            ) : (
              <Group label="Partager à">
                <div className="grid grid-cols-2 gap-2">
                  {AUDIENCES.map((a) => {
                    const on = audiences.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setAudiences((l) =>
                            l.includes(a.id) ? l.filter((x) => x !== a.id) : [...l, a.id],
                          )
                        }
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                          on
                            ? 'border-gold-400 bg-gold-100 font-medium text-gold-800'
                            : 'border-border bg-surface text-muted-foreground hover:border-gold-300'
                        }`}
                      >
                        {a.label}
                        {on && <Check aria-hidden className="size-4" />}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Aperçu / journalisation uniquement — pas d'envoi ni de signature réels en V1.
                </p>
              </Group>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {!shared && (
                <Button onClick={() => void share()} disabled={audiences.length === 0 || busy}>
                  <Send aria-hidden /> Partager
                </Button>
              )}
              <Button variant={shared ? 'primary' : 'ghost'} onClick={onClose}>
                Terminer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function sharedLabels(ids: string[]): string {
  return ids.map((id) => AUDIENCES.find((a) => a.id === id)?.label ?? id).join(', ');
}

/** Aperçu du document généré (vue imprimable simple). */
function MissionDoc({
  prep,
  project,
}: {
  prep: MissionPreparation;
  project: Project;
}): React.JSX.Element {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <article className="rounded-xl border border-border bg-paper-0 p-5">
      <header className="border-b border-border pb-3">
        <p className="text-xs uppercase tracking-wide text-gold-700">{prep.docTitre}</p>
        <h3 className="font-serif text-lg font-semibold text-foreground">{project.name}</h3>
        <p className="text-xs text-muted-foreground">{date}</p>
      </header>
      <div className="space-y-3 pt-3 text-sm">
        {prep.presents.length > 0 && (
          <DocSection title="Présents">{prep.presents.join(', ')}</DocSection>
        )}
        {prep.observations.length > 0 && (
          <DocSection title="Observations">
            <ul className="space-y-0.5">
              {prep.observations.map((o, i) => (
                <li key={i}>• {o}</li>
              ))}
            </ul>
          </DocSection>
        )}
        {prep.decisions.length > 0 && (
          <DocSection title="Décisions">
            <ul className="space-y-0.5">
              {prep.decisions.map((d, i) => (
                <li key={i}>• {d}</li>
              ))}
            </ul>
          </DocSection>
        )}
        {prep.actions.length > 0 && (
          <DocSection title="Actions à suivre">
            <ul className="space-y-0.5">
              {prep.actions.map((a, i) => (
                <li key={i}>• {a.label}</li>
              ))}
            </ul>
          </DocSection>
        )}
        {prep.manquants.length > 0 && (
          <DocSection title="Manquants / dommages">
            <ul className="space-y-0.5">
              {prep.manquants.map((m, i) => (
                <li key={i}>• {m}</li>
              ))}
            </ul>
          </DocSection>
        )}
        {prep.reserves.length > 0 && (
          <DocSection title={`Réserves (${prep.reserves.length})`}>
            <ul className="space-y-0.5">
              {prep.reserves.map((r, i) => (
                <li key={i}>
                  {i + 1}. {r.libelle}
                </li>
              ))}
            </ul>
          </DocSection>
        )}
      </div>
    </article>
  );
}

function DocSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-0.5 text-foreground">{children}</div>
    </section>
  );
}

/** Liste éditable : corriger chaque élément, en retirer. */
function EditList({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}): React.JSX.Element {
  return (
    <Group label={`${label} (${items.length})`}>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              value={it}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              className="h-9 flex-1 rounded-lg border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Supprimer « ${it} »`}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground [&_svg]:size-4"
            >
              <Trash2 aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Group>
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

/** Comme Field mais sans <label> (pour tout groupe contenant des boutons). */
function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
